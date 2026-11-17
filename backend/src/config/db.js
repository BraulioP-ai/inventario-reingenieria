import fs from 'node:fs';
import mysql from 'mysql2/promise';
import { env } from './env.js';

// Ubicaciones habituales del socket de MySQL/MariaDB en Linux y macOS.
const SOCKETS = [
  '/run/mysqld/mysqld.sock',          // Debian, Ubuntu, Arch, MariaDB
  '/var/run/mysqld/mysqld.sock',
  '/var/lib/mysql/mysql.sock',        // Fedora, RHEL, openSUSE
  '/tmp/mysql.sock',                  // macOS (Homebrew)
  '/opt/lampp/var/mysql/mysql.sock',  // XAMPP para Linux
];

export function socketLocal() {
  if (process.platform === 'win32') return null;
  return SOCKETS.find((s) => {
    try {
      return fs.statSync(s).isSocket();
    } catch {
      return false;
    }
  }) ?? null;
}

const esLocal = (host) => ['localhost', '127.0.0.1', '::1'].includes(host);

function opciones(cfg, { conBase }) {
  const base = {
    user: cfg.user,
    password: cfg.password,
    charset: 'utf8mb4',
    decimalNumbers: true, // DECIMAL llega como número, no como texto
    timezone: 'local',
    connectTimeout: 8000,
    ...(conBase ? { database: cfg.database } : {}),
  };
  return cfg.socketPath ? { ...base, socketPath: cfg.socketPath } : { ...base, host: cfg.host, port: cfg.port };
}

// Abre una conexión suelta (sin base de datos seleccionada).
// Si MySQL no responde por TCP en esta máquina, reintenta por el socket Unix:
// en algunas distros el servidor viene configurado sin red (skip-networking).
export async function conectar(cfg = env.db) {
  try {
    return { conexion: await mysql.createConnection(opciones(cfg, { conBase: false })), cfg };
  } catch (err) {
    const socket = !cfg.socketPath && esLocal(cfg.host)
      && ['ECONNREFUSED', 'ETIMEDOUT', 'EHOSTUNREACH'].includes(err.code) && socketLocal();
    if (!socket) throw err;
    const porSocket = { ...cfg, socketPath: socket };
    return { conexion: await mysql.createConnection(opciones(porSocket, { conBase: false })), cfg: porSocket };
  }
}

// Pool de conexiones: reemplaza a los controles ADO del formulario VB6.
// Es un "export let": los módulos que lo importan ven el valor actual.
export let pool = null;

export function iniciarPool(cfg = env.db) {
  pool = mysql.createPool({ ...opciones(cfg, { conBase: true }), waitForConnections: true, connectionLimit: 10 });
  return pool;
}

export const obtenerPool = () => pool ?? iniciarPool();

export async function cerrarPool() {
  if (pool) await pool.end();
  pool = null;
}

// Atajo: siempre consultas parametrizadas (los "?" se escapan en el driver).
export async function query(sql, params = []) {
  const [rows] = await obtenerPool().execute(sql, params);
  return rows;
}
