import { query } from '../config/db.js';
import { HttpError, noEncontrado } from '../utils/http-error.js';

const SELECT_MOVIMIENTO = `
  SELECT mv.id_movimiento, mv.fecha, mv.tipo, mv.cantidad, mv.costo_unitario,
         mv.cantidad * mv.costo_unitario AS importe, mv.nota,
         p.id_producto, p.modelo, p.descripcion,
         c.nombre AS categoria, m.nombre AS marca,
         u.id_usuario, u.nombre AS usuario
    FROM movimientos mv
    JOIN productos  p ON p.id_producto  = mv.id_producto
    JOIN categorias c ON c.id_categoria = p.id_categoria
    JOIN marcas     m ON m.id_marca     = p.id_marca
    JOIN usuarios   u ON u.id_usuario   = mv.id_usuario`;

export async function listar({ producto, tipo, desde, hasta, pagina = 1, porPagina = 25 } = {}) {
  const where = [];
  const params = [];
  if (producto) { where.push('mv.id_producto = ?'); params.push(producto); }
  if (tipo) { where.push('mv.tipo = ?'); params.push(tipo); }
  if (desde) { where.push('mv.fecha >= ?'); params.push(desde); }
  if (hasta) { where.push('mv.fecha < DATE_ADD(?, INTERVAL 1 DAY)'); params.push(hasta); }
  const filtro = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [{ total }] = await query(`SELECT COUNT(*) AS total FROM movimientos mv ${filtro}`, params);

  // pagina y porPagina ya vienen validados como enteros positivos (zod),
  // por eso se pueden insertar directamente en LIMIT/OFFSET.
  const offset = (pagina - 1) * porPagina;
  const datos = await query(
    `${SELECT_MOVIMIENTO} ${filtro} ORDER BY mv.fecha DESC, mv.id_movimiento DESC
      LIMIT ${porPagina} OFFSET ${offset}`,
    params,
  );

  return { datos, pagina, porPagina, total, paginas: Math.ceil(total / porPagina) };
}

export async function obtener(id) {
  const [fila] = await query(`${SELECT_MOVIMIENTO} WHERE mv.id_movimiento = ?`, [id]);
  if (!fila) throw noEncontrado('Movimiento');
  return fila;
}

// La validación de stock y la actualización del producto las hacen los triggers.
export async function registrar(datos, idUsuario) {
  const [producto] = await query(
    'SELECT costo_unitario, activo FROM productos WHERE id_producto = ?',
    [datos.id_producto],
  );
  if (!producto) throw noEncontrado('Producto');
  if (!producto.activo) throw new HttpError(409, 'El producto está dado de baja');

  const costo = datos.costo_unitario ?? producto.costo_unitario;
  const r = await query(
    `INSERT INTO movimientos (id_producto, id_usuario, tipo, cantidad, costo_unitario, nota)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [datos.id_producto, idUsuario, datos.tipo, datos.cantidad, costo, datos.nota ?? null],
  );
  return obtener(r.insertId);
}
