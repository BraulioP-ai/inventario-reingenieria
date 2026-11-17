import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { enEjecutable } from '../recursos.js';

// Dónde vive el archivo de configuración:
//  - ejecutable:     inventario.env junto al ejecutable
//  - código fuente:  backend/.env
// La variable INVENTARIO_CONFIG permite indicar otra ruta.
function rutaPorDefecto() {
  if (process.pkg) return path.join(path.dirname(process.execPath), 'inventario.env');
  if (enEjecutable()) return path.resolve('inventario.env');
  return fileURLToPath(new URL('../../.env', import.meta.url));
}

export const rutaConfig = () => process.env.INVENTARIO_CONFIG ?? rutaPorDefecto();

function leerArchivo() {
  try {
    return dotenv.parse(fs.readFileSync(rutaConfig()));
  } catch {
    return {};
  }
}

function construir(archivo) {
  // Las variables de entorno tienen prioridad sobre el archivo.
  const v = (clave, porDefecto) => process.env[clave] ?? archivo[clave] ?? porDefecto;
  return {
    port: Number(v('PORT', 3000)),
    corsOrigin: v('CORS_ORIGIN', 'http://localhost:5173'),
    db: {
      // 127.0.0.1 en lugar de "localhost": en varias distros "localhost" resuelve
      // primero a ::1 (IPv6) y MySQL solo escucha en IPv4.
      host: v('DB_HOST', '127.0.0.1'),
      port: Number(v('DB_PORT', 3306)),
      user: v('DB_USER', ''),
      password: v('DB_PASSWORD', ''),
      database: v('DB_NAME', 'inventario_web'),
      socketPath: v('DB_SOCKET', '') || undefined,
    },
    jwt: {
      secret: v('JWT_SECRET', ''),
      expiresIn: v('JWT_EXPIRES_IN', '8h'),
    },
  };
}

// Objeto mutable: recargarEnv() lo actualiza en su lugar para que todos los módulos vean el cambio.
export const env = construir(leerArchivo());

export function recargarEnv() {
  Object.assign(env, construir(leerArchivo()));
}

export const existeConfig = () => fs.existsSync(rutaConfig());

// Escribe un valor entre comillas que dotenv lea literal (sin expandir nada).
function entrecomillar(valor) {
  const s = String(valor ?? '');
  if (s === '') return '';
  if (/^[\w.@:/+-]+$/.test(s)) return s;
  const comilla = ["'", '"', '`'].find((c) => !s.includes(c)) ?? "'";
  return `${comilla}${s}${comilla}`;
}

export function guardarConfig(cambios) {
  const actual = { ...leerArchivo(), ...cambios };
  if (!actual.JWT_SECRET || actual.JWT_SECRET.startsWith('cambia_este')) {
    actual.JWT_SECRET = crypto.randomBytes(32).toString('hex');
  }
  const lineas = [
    '# Configuración del Sistema de Inventario',
    '# Generada automáticamente. Puedes editarla a mano o volver a preguntar',
    '# los datos de conexión arrancando con la opción --configurar',
    '',
    '# Servidor web (puerto donde abre el sistema; NO es el puerto de MySQL)',
    `PORT=${actual.PORT ?? 3000}`,
    '',
    '# Base de datos',
    `DB_HOST=${entrecomillar(actual.DB_HOST ?? '127.0.0.1')}`,
    `DB_PORT=${actual.DB_PORT ?? 3306}`,
    `DB_USER=${entrecomillar(actual.DB_USER ?? '')}`,
    `DB_PASSWORD=${entrecomillar(actual.DB_PASSWORD ?? '')}`,
    `DB_SOCKET=${entrecomillar(actual.DB_SOCKET ?? '')}`,
    `DB_NAME=${actual.DB_NAME ?? 'inventario_web'}`,
    '',
    '# Sesiones',
    `JWT_SECRET=${actual.JWT_SECRET}`,
    `JWT_EXPIRES_IN=${actual.JWT_EXPIRES_IN ?? '8h'}`,
    '',
  ];
  if (actual.CORS_ORIGIN) lineas.splice(6, 0, `CORS_ORIGIN=${actual.CORS_ORIGIN}`);
  fs.writeFileSync(rutaConfig(), lineas.join('\n'), { mode: 0o600 });
  recargarEnv();
}
