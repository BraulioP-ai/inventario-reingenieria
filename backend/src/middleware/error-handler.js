import { ZodError } from 'zod';
import { HttpError } from '../utils/http-error.js';

// Traduce los errores de MySQL a respuestas HTTP claras.
const ERRORES_MYSQL = {
  ER_DUP_ENTRY: [409, 'Ya existe un registro con ese valor'],
  ER_ROW_IS_REFERENCED_2: [409, 'No se puede eliminar: el registro está en uso'],
  ER_NO_REFERENCED_ROW_2: [400, 'La referencia indicada no existe'],
  ER_CHECK_CONSTRAINT_VIOLATED: [400, 'Valor fuera del rango permitido'],
  ER_CONSTRAINT_FAILED: [400, 'Valor fuera del rango permitido'], // MariaDB
};

export function notFound(req, res) {
  res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Datos inválidos',
      detalles: err.issues.map((i) => ({ campo: i.path.join('.'), mensaje: i.message })),
    });
  }

  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, detalles: err.details });
  }

  // SIGNAL SQLSTATE '45000' lanzado por los triggers (p. ej. stock insuficiente)
  if (err.sqlState === '45000') {
    return res.status(409).json({ error: err.sqlMessage });
  }

  if (err.code && ERRORES_MYSQL[err.code]) {
    const [status, mensaje] = ERRORES_MYSQL[err.code];
    return res.status(status).json({ error: mensaje });
  }

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'JSON mal formado' });
  }

  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
}
