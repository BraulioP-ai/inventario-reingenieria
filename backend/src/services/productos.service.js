import { obtenerPool, query } from '../config/db.js';
import { noEncontrado } from '../utils/http-error.js';

const SELECT_PRODUCTO = `
  SELECT p.id_producto, p.id_categoria, c.nombre AS categoria,
         p.id_marca, m.nombre AS marca, p.modelo, p.descripcion,
         p.costo_unitario, p.stock_actual, p.stock_minimo,
         p.stock_actual * p.costo_unitario AS costo_total,
         (p.stock_actual <= p.stock_minimo) AS bajo_minimo,
         p.activo, p.creado_en, p.actualizado_en
    FROM productos p
    JOIN categorias c ON c.id_categoria = p.id_categoria
    JOIN marcas     m ON m.id_marca     = p.id_marca`;

const normalizar = (f) => ({ ...f, bajo_minimo: Boolean(f.bajo_minimo), activo: Boolean(f.activo) });

// Equivale a la búsqueda por marca/categoría del VB6, pero con parámetros
// en lugar de concatenar texto ("... WHERE Brand='" & SearchString1 & "'").
export async function listar({ categoria, marca, q, bajoMinimo } = {}) {
  const where = ['p.activo = TRUE'];
  const params = [];
  if (categoria) { where.push('p.id_categoria = ?'); params.push(categoria); }
  if (marca) { where.push('p.id_marca = ?'); params.push(marca); }
  if (q) {
    where.push('(p.modelo LIKE ? OR p.descripcion LIKE ?)');
    params.push(`%${q}%`, `%${q}%`);
  }
  if (bajoMinimo) where.push('p.stock_actual <= p.stock_minimo');

  const filas = await query(
    `${SELECT_PRODUCTO} WHERE ${where.join(' AND ')} ORDER BY c.nombre, m.nombre, p.modelo`,
    params,
  );
  return filas.map(normalizar);
}

export async function obtener(id) {
  const [fila] = await query(`${SELECT_PRODUCTO} WHERE p.id_producto = ?`, [id]);
  if (!fila) throw noEncontrado('Producto');
  return normalizar(fila);
}

// Crea el producto y, si se indica, registra su entrada inicial en la misma transacción.
export async function crear(datos, idUsuario) {
  const conn = await obtenerPool().getConnection();
  try {
    await conn.beginTransaction();
    const [r] = await conn.execute(
      `INSERT INTO productos (id_categoria, id_marca, modelo, descripcion, costo_unitario, stock_minimo)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [datos.id_categoria, datos.id_marca, datos.modelo, datos.descripcion,
        datos.costo_unitario, datos.stock_minimo],
    );
    if (datos.stock_inicial > 0) {
      await conn.execute(
        `INSERT INTO movimientos (id_producto, id_usuario, tipo, cantidad, costo_unitario, nota)
         VALUES (?, ?, 'ENTRADA', ?, ?, 'Inventario inicial')`,
        [r.insertId, idUsuario, datos.stock_inicial, datos.costo_unitario],
      );
    }
    await conn.commit();
    return obtener(r.insertId);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// El stock NO se edita aquí: solo cambia mediante movimientos (trazabilidad).
const EDITABLES = ['id_categoria', 'id_marca', 'modelo', 'descripcion', 'costo_unitario', 'stock_minimo', 'activo'];

export async function actualizar(id, datos) {
  const cambios = EDITABLES.filter((c) => datos[c] !== undefined);
  if (cambios.length) {
    const r = await query(
      `UPDATE productos SET ${cambios.map((c) => `${c} = ?`).join(', ')} WHERE id_producto = ?`,
      [...cambios.map((c) => datos[c]), id],
    );
    if (r.affectedRows === 0) throw noEncontrado('Producto');
  }
  return obtener(id);
}

export async function desactivar(id) {
  return actualizar(id, { activo: false });
}
