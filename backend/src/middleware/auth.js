import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { HttpError } from '../utils/http-error.js';

export function firmarToken(usuario) {
  return jwt.sign(
    { sub: usuario.id_usuario, nombre: usuario.nombre, rol: usuario.rol },
    env.jwt.secret,
    { expiresIn: env.jwt.expiresIn },
  );
}

// Exige un token válido en "Authorization: Bearer <token>".
export function autenticar(req, res, next) {
  const [tipo, token] = (req.headers.authorization ?? '').split(' ');
  if (tipo !== 'Bearer' || !token) {
    return next(new HttpError(401, 'Se requiere iniciar sesión'));
  }
  try {
    const datos = jwt.verify(token, env.jwt.secret);
    req.usuario = { id: datos.sub, nombre: datos.nombre, rol: datos.rol };
    next();
  } catch {
    next(new HttpError(401, 'Sesión inválida o expirada'));
  }
}

// Restringe una ruta a ciertos roles.
export function permitir(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.usuario?.rol)) {
      return next(new HttpError(403, 'No tienes permiso para esta acción'));
    }
    next();
  };
}
