import { query } from '../config/db.js';
import { noEncontrado } from '../utils/http-error.js';

// Servicio genérico para catálogos simples (categorías y marcas).
// Los nombres de tabla/columna vienen de esta configuración fija, nunca del usuario.
const CATALOGOS = {
  categorias: { tabla: 'categorias', id: 'id_categoria', campos: ['nombre', 'descripcion'], etiqueta: 'Categoría' },
  marcas: { tabla: 'marcas', id: 'id_marca', campos: ['nombre'], etiqueta: 'Marca' },
};

const normalizar = (f) => ({ ...f, activo: Boolean(f.activo) });

export function crearServicioCatalogo(clave) {
  const { tabla, id, campos, etiqueta } = CATALOGOS[clave];
  const columnas = [id, ...campos, 'activo'].join(', ');

  return {
    async listar({ incluirInactivos = false } = {}) {
      const filas = await query(
        `SELECT ${columnas},
                (SELECT COUNT(*) FROM productos p WHERE p.${id} = t.${id} AND p.activo) AS productos
           FROM ${tabla} t
          ${incluirInactivos ? '' : 'WHERE activo = TRUE'}
          ORDER BY nombre`,
      );
      return filas.map(normalizar);
    },

    async obtener(idValor) {
      const [fila] = await query(`SELECT ${columnas} FROM ${tabla} WHERE ${id} = ?`, [idValor]);
      if (!fila) throw noEncontrado(etiqueta);
      return normalizar(fila);
    },

    async crear(datos) {
      const valores = campos.map((c) => datos[c] ?? null);
      const r = await query(
        `INSERT INTO ${tabla} (${campos.join(', ')}) VALUES (${campos.map(() => '?').join(', ')})`,
        valores,
      );
      return this.obtener(r.insertId);
    },

    async actualizar(idValor, datos) {
      const cambios = [...campos, 'activo'].filter((c) => datos[c] !== undefined);
      if (cambios.length) {
        const r = await query(
          `UPDATE ${tabla} SET ${cambios.map((c) => `${c} = ?`).join(', ')} WHERE ${id} = ?`,
          [...cambios.map((c) => datos[c]), idValor],
        );
        if (r.affectedRows === 0) throw noEncontrado(etiqueta);
      }
      return this.obtener(idValor);
    },

    // Baja lógica: el registro se conserva para no romper el historial.
    async desactivar(idValor) {
      return this.actualizar(idValor, { activo: false });
    },
  };
}
