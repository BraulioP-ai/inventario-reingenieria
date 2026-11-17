// Genera ejecutables de un solo archivo para Windows y Linux.
//
//   npm run ejecutables                 → Windows x64 y Linux x64
//   npm run ejecutables -- linux-x64    → solo los destinos indicados
//
// Pasos: compila el frontend, empaqueta backend + frontend + scripts SQL en un
// solo .cjs con esbuild y lo convierte en ejecutable con pkg (incluye Node.js,
// así que en la computadora destino solo se necesita MySQL).

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const BUILD = path.join(RAIZ, 'build');
const DIST = path.join(RAIZ, 'dist');
const NODE = 'node22';
const DESTINOS = {
  'windows-x64': { pkg: `${NODE}-win-x64`, archivo: 'inventario.exe' },
  'linux-x64': { pkg: `${NODE}-linux-x64`, archivo: 'inventario' },
  'linux-arm64': { pkg: `${NODE}-linux-arm64`, archivo: 'inventario' },
};

const pedidos = process.argv.slice(2).length ? process.argv.slice(2) : ['windows-x64', 'linux-x64'];
for (const d of pedidos) {
  if (!DESTINOS[d]) throw new Error(`Destino desconocido: ${d}. Opciones: ${Object.keys(DESTINOS).join(', ')}`);
}

const { version } = JSON.parse(fs.readFileSync(path.join(RAIZ, 'package.json'), 'utf8'));
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const ejecutar = (cmd, args, cwd = RAIZ) => execFileSync(cmd, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' });

console.log(`\n▸ Sistema de Inventario ${version}: ${pedidos.join(', ')}`);
fs.rmSync(BUILD, { recursive: true, force: true });
fs.mkdirSync(BUILD, { recursive: true });
fs.mkdirSync(DIST, { recursive: true });

// 1. Frontend
console.log('\n▸ Compilando el frontend');
ejecutar(npm, ['run', 'build'], path.join(RAIZ, 'frontend'));

// 2. Recursos embebidos: frontend/dist y los scripts SQL
function leerCarpeta(dir, base = dir, salida = {}) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const ruta = path.join(dir, e.name);
    if (e.isDirectory()) leerCarpeta(ruta, base, salida);
    else salida[`/${path.relative(base, ruta).split(path.sep).join('/')}`] = fs.readFileSync(ruta).toString('base64');
  }
  return salida;
}
const recursos = {
  version,
  frontend: leerCarpeta(path.join(RAIZ, 'frontend', 'dist')),
  sql: Object.fromEntries(['01_esquema.sql', '02_datos.sql']
    .map((f) => [f, fs.readFileSync(path.join(RAIZ, 'bd', f), 'utf8')])),
};
fs.writeFileSync(path.join(BUILD, 'recursos.json'), JSON.stringify(recursos));
// recursos.js los lee en tiempo de ejecución, así que el orden de los imports no importa.
fs.writeFileSync(path.join(BUILD, 'entrada.mjs'), [
  "import recursos from './recursos.json';",
  "import { main } from '../backend/src/server.js';",
  '',
  'globalThis.__INVENTARIO_RECURSOS__ = recursos;',
  'main();',
  '',
].join('\n'));

// 3. Un solo archivo JavaScript con todo el backend y sus dependencias
console.log('\n▸ Empaquetando backend + frontend + SQL');
const r = await build({
  entryPoints: [path.join(BUILD, 'entrada.mjs')],
  outfile: path.join(BUILD, 'inventario.cjs'),
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  nodePaths: [path.join(RAIZ, 'backend', 'node_modules')],
  logLevel: 'error',
  legalComments: 'none',
  minify: true,
  metafile: true,
});
const kb = (fs.statSync(path.join(BUILD, 'inventario.cjs')).size / 1024).toFixed(0);
console.log(`  build/inventario.cjs (${kb} KB, ${Object.keys(r.metafile.inputs).length} módulos)`);

// 4. Ejecutables con pkg (descarga Node.js para cada plataforma la primera vez)
const pkgBin = path.join(RAIZ, 'node_modules', '.bin', process.platform === 'win32' ? 'pkg.cmd' : 'pkg');
const LEEME = fs.readFileSync(path.join(RAIZ, 'scripts', 'LEEME.txt'), 'utf8').replaceAll('{{VERSION}}', version);

for (const d of pedidos) {
  const { pkg, archivo } = DESTINOS[d];
  const carpeta = path.join(DIST, `inventario-${version}-${d}`);
  fs.rmSync(carpeta, { recursive: true, force: true });
  fs.mkdirSync(carpeta, { recursive: true });
  console.log(`\n▸ ${d}`);
  ejecutar(pkgBin, [path.join(BUILD, 'inventario.cjs'), '--targets', pkg, '--output', path.join(carpeta, archivo), '--no-bytecode', '--public', '--public-packages', '*']);
  fs.writeFileSync(path.join(carpeta, 'LEEME.txt'), d.startsWith('windows') ? LEEME.replace(/\n/g, '\r\n') : LEEME);

  // Comprimido para distribuir: .zip en Windows, .tar.gz en Linux (conserva el permiso de ejecución)
  const nombre = path.basename(carpeta);
  if (d.startsWith('windows')) {
    fs.rmSync(`${carpeta}.zip`, { force: true });
    if (process.platform === 'win32') {
      ejecutar('powershell', ['-NoProfile', '-Command', `Compress-Archive -Path '${carpeta}' -DestinationPath '${carpeta}.zip'`]);
    } else {
      ejecutar('zip', ['-qr', `${nombre}.zip`, nombre], DIST);
    }
  } else {
    ejecutar('tar', ['-czf', `${nombre}.tar.gz`, nombre], DIST);
  }
}

console.log('\n▸ Listo. Archivos en dist/:');
for (const f of fs.readdirSync(DIST).filter((f) => /\.(zip|tar\.gz)$/.test(f))) {
  console.log(`  ${f}  (${(fs.statSync(path.join(DIST, f)).size / 1048576).toFixed(1)} MB)`);
}
