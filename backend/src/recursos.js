import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Recursos que necesita el servidor: los scripts SQL y el frontend compilado.
// - Desde el código fuente se leen del disco (bd/ y frontend/dist/).
// - En el ejecutable vienen embebidos (los inyecta scripts/construir-ejecutable.mjs).

const embebidos = () => globalThis.__INVENTARIO_RECURSOS__ ?? null;

export const enEjecutable = () => Boolean(embebidos());

// Raíz del repositorio (solo tiene sentido cuando NO es el ejecutable).
const raiz = () => fileURLToPath(new URL('../../', import.meta.url));

export function leerSql(nombre) {
  const e = embebidos();
  if (e) return e.sql[nombre];
  return fs.readFileSync(path.join(raiz(), 'bd', nombre), 'utf8');
}

export function frontend() {
  const e = embebidos();
  if (e) return { tipo: 'memoria', archivos: e.frontend };
  const dist = path.join(raiz(), 'frontend', 'dist');
  return fs.existsSync(path.join(dist, 'index.html')) ? { tipo: 'disco', dist } : null;
}

export function version() {
  const e = embebidos();
  if (e) return e.version;
  try {
    return JSON.parse(fs.readFileSync(path.join(raiz(), 'package.json'), 'utf8')).version;
  } catch {
    return 'dev';
  }
}
