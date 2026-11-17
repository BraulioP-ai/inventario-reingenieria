import bcrypt from 'bcryptjs';
import { query } from '../config/db.js';
import { HttpError, noEncontrado } from '../utils/http-error.js';

const COLUMNAS = 'id_usuario, nombre, email, rol, activo, creado_en';
const normalizar = (u) => ({ ...u, activo: Boolean(u.activo) });

export async function buscarPorEmail(email) {
  const [u] = await query('SELECT * FROM usuarios WHERE email = ?', [email]);
  return u;
}

export async function listar() {
  return (await query(`SELECT ${COLUMNAS} FROM usuarios ORDER BY nombre`)).map(normalizar);
}

export async function obtener(id) {
  const [u] = await query(`SELECT ${COLUMNAS} FROM usuarios WHERE id_usuario = ?`, [id]);
  if (!u) throw noEncontrado('Usuario');
  return normalizar(u);
}

export async function crear({ nombre, email, password, rol }) {
  const hash = await bcrypt.hash(password, 10);
  const r = await query(
    'INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES (?, ?, ?, ?)',
    [nombre, email, hash, rol],
  );
  return obtener(r.insertId);
}

export async function actualizar(id, datos, idSolicitante) {
  if (id === idSolicitante && (datos.activo === false || (datos.rol && datos.rol !== 'ADMIN'))) {
    throw new HttpError(409, 'No puedes desactivarte ni quitarte el rol de administrador');
  }
  const cambios = {};
  for (const c of ['nombre', 'email', 'rol', 'activo']) {
    if (datos[c] !== undefined) cambios[c] = datos[c];
  }
  if (datos.password) cambios.password_hash = await bcrypt.hash(datos.password, 10);

  const claves = Object.keys(cambios);
  if (claves.length) {
    const r = await query(
      `UPDATE usuarios SET ${claves.map((c) => `${c} = ?`).join(', ')} WHERE id_usuario = ?`,
      [...Object.values(cambios), id],
    );
    if (r.affectedRows === 0) throw noEncontrado('Usuario');
  }
  return obtener(id);
}
