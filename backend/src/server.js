import http from 'node:http';
import { spawn } from 'node:child_process';
import { crearApp } from './app.js';
import { env, existeConfig, guardarConfig, recargarEnv, rutaConfig } from './config/env.js';
import { cerrarPool, conectar, iniciarPool } from './config/db.js';
import { explicarError } from './arranque/diagnostico.js';
import { estadoBd, instalarBd } from './arranque/instalar-bd.js';
import {
  amarillo, confirmar, esperarEnter, interactivo, negritas, preguntar, preguntarOculto, rojo, tenue, verde,
} from './arranque/consola.js';
import { enEjecutable, version } from './recursos.js';

const ayuda = () => `
Sistema de Inventario ${version()}

Uso: inventario [opciones]

  --configurar     Vuelve a preguntar los datos de conexión a MySQL
  --reset          Borra la base de datos y la recarga con los datos de ejemplo
  --si             No pide confirmación (útil con --reset)
  --puerto <n>     Puerto web (por defecto 3000)
  --no-abrir       No abre el navegador automáticamente
  --version        Muestra la versión
  --ayuda, -h      Muestra esta ayuda

Requisito: un servidor MySQL 8.0.16+ o MariaDB 10.6+ encendido.
La primera vez el programa pide los datos de conexión, crea la base de datos
y carga los datos de ejemplo. La configuración se guarda en:
  ${rutaConfig()}
`;

function leerArgumentos(argv) {
  const a = { configurar: false, reset: false, si: false, abrir: true, ayuda: false, version: false, puerto: null };
  for (let i = 0; i < argv.length; i++) {
    const x = argv[i];
    if (x === '--configurar') a.configurar = true;
    else if (x === '--reset') a.reset = true;
    else if (x === '--si' || x === '-y') a.si = true;
    else if (x === '--no-abrir') a.abrir = false;
    else if (x === '--ayuda' || x === '--help' || x === '-h') a.ayuda = true;
    else if (x === '--version' || x === '-v') a.version = true;
    else if (x === '--puerto') a.puerto = Number(argv[++i]);
    else if (x.startsWith('--puerto=')) a.puerto = Number(x.split('=')[1]);
    else throw new Error(`Opción desconocida: ${x} (usa --ayuda)`);
  }
  if (a.puerto !== null && !(a.puerto > 0 && a.puerto < 65536)) throw new Error('--puerto debe ser un número entre 1 y 65535');
  return a;
}

class Salida extends Error {
  constructor(mensaje) { super(mensaje); this.salida = true; }
}

async function asistente() {
  console.log(`\n${negritas('Conexión a MySQL')}  ${tenue('(Enter para dejar el valor entre corchetes)')}`);
  const host = await preguntar('Servidor', env.db.host || '127.0.0.1');
  const puerto = await preguntar('Puerto de MySQL', String(env.db.port || 3306));
  const usuario = await preguntar('Usuario', env.db.user || 'root');
  const contrasena = await preguntarOculto('Contraseña (vacía si no tiene)');
  guardarConfig({
    DB_HOST: host, DB_PORT: puerto, DB_USER: usuario, DB_PASSWORD: contrasena, DB_SOCKET: '',
  });
}

// Conecta a MySQL; si falla, explica por qué y (si hay terminal) vuelve a preguntar.
async function conectarConAyuda(forzarAsistente) {
  const puedePreguntar = interactivo();
  if (forzarAsistente || !env.db.user) {
    if (!puedePreguntar) {
      throw new Salida(`Falta configurar la conexión a MySQL. Edita ${rutaConfig()} (DB_USER, DB_PASSWORD) o ejecuta el programa en una terminal.`);
    }
    if (!existeConfig()) console.log(tenue('\nPrimera vez que se ejecuta: hay que indicar cómo entrar a MySQL.'));
    await asistente();
  }

  for (;;) {
    try {
      process.stdout.write(tenue(`Conectando a MySQL (${env.db.user}@${env.db.socketPath ?? `${env.db.host}:${env.db.port}`})... `));
      const r = await conectar(env.db);
      console.log(verde('ok'));
      if (r.cfg.socketPath && r.cfg.socketPath !== env.db.socketPath) {
        guardarConfig({ DB_SOCKET: r.cfg.socketPath }); // la próxima vez entra directo por el socket
      }
      return r;
    } catch (err) {
      console.log(rojo('falló'));
      console.log(`\n${explicarError(err, env.db).map((l) => `  ${l}`).join('\n')}\n`);
      if (!puedePreguntar) throw new Salida(`No se pudo conectar a MySQL. Revisa ${rutaConfig()}.`);
      const accion = await preguntar('¿[R]eintentar, [c]ambiar datos de conexión o [s]alir?', 'r');
      if (/^s/i.test(accion)) throw new Salida('');
      if (/^c/i.test(accion)) await asistente();
    }
  }
}

async function prepararBd(conexion, args) {
  const nombre = env.db.database;
  const [[{ v }]] = await conexion.query('SELECT VERSION() AS v');
  console.log(tenue(`Servidor: ${v}`));

  const estado = await estadoBd(conexion, nombre);
  let instalar = estado !== 'ok';

  if (args.reset && estado === 'ok') {
    instalar = args.si || !interactivo()
      || await confirmar(amarillo(`Esto BORRA la base "${nombre}" y la deja con los datos de ejemplo. ¿Continuar?`));
    if (!instalar) console.log(tenue('Reset cancelado; se usan los datos actuales.'));
  }
  if (!instalar) {
    console.log(tenue(`Base de datos "${nombre}" lista.`));
    return;
  }

  const motivo = { 'sin-bd': 'no existe', incompleta: 'está incompleta', 'sin-datos': 'está vacía', ok: 'reset solicitado' }[estado];
  console.log(`Creando la base de datos "${nombre}" (${motivo})...`);
  try {
    await instalarBd(conexion, (archivo, n) => console.log(tenue(`  ${archivo}: ${n} sentencias`)));
  } catch (err) {
    console.log(`\n${explicarError(err, env.db).map((l) => `  ${l}`).join('\n')}\n`);
    throw new Salida('No se pudo crear la base de datos.');
  }
  console.log(verde('Base de datos creada con los datos de ejemplo.'));
}

// Escucha en el puerto pedido o en el siguiente libre (nunca en el de MySQL).
async function escuchar(app, inicial, evitar) {
  for (let p = inicial; p < inicial + 20; p++) {
    if (evitar.includes(p)) {
      console.log(amarillo(`El puerto ${p} es el de MySQL; el sistema web usará otro (revisa PORT en la configuración).`));
      continue;
    }
    const servidor = http.createServer(app);
    const ok = await new Promise((resolve) => {
      servidor.once('error', (e) => resolve(e.code === 'EADDRINUSE' || e.code === 'EACCES' ? false : Promise.reject(e)));
      servidor.listen(p, () => resolve(true));
    });
    if (ok) return { servidor, puerto: p };
    console.log(amarillo(`El puerto ${p} está ocupado; probando ${p + 1}...`));
  }
  throw new Salida(`No hay puertos libres entre ${inicial} y ${inicial + 19}. Usa --puerto <n>.`);
}

function abrirNavegador(url) {
  const [cmd, args, extra] = process.platform === 'win32'
    ? ['cmd', ['/c', 'start', '""', url], { windowsVerbatimArguments: true }]
    : process.platform === 'darwin' ? ['open', [url], {}] : ['xdg-open', [url], {}];
  try {
    const p = spawn(cmd, args, { stdio: 'ignore', detached: true, windowsHide: true, ...extra });
    p.on('error', () => {}); // sin entorno gráfico: no pasa nada
    p.unref();
  } catch { /* ignorar */ }
}

export async function main(argv = process.argv.slice(2)) {
  let args;
  try {
    args = leerArgumentos(argv);
  } catch (e) {
    console.error(rojo(e.message));
    process.exitCode = 2;
    return;
  }
  if (args.ayuda) return console.log(ayuda());
  if (args.version) return console.log(version());

  console.log(negritas(`\nSistema de Inventario ${version()}`));
  console.log(tenue(`Configuración: ${rutaConfig()}`));

  try {
    recargarEnv();
    const { conexion, cfg } = await conectarConAyuda(args.configurar);
    try {
      await prepararBd(conexion, args);
    } finally {
      await conexion.end();
    }

    if (!env.jwt.secret || env.jwt.secret.startsWith('cambia_este')) guardarConfig({});

    iniciarPool({ ...env.db, socketPath: cfg.socketPath });
    const { servidor, puerto } = await escuchar(crearApp(), args.puerto ?? env.port, [cfg.port]);
    const url = `http://localhost:${puerto}`;

    console.log(`
${verde(negritas('Sistema listo.'))} Abre en el navegador:  ${negritas(url)}

  Admin:    admin@inventario.local   / Admin123*
  Almacén:  almacen@inventario.local / Almacen123*

${tenue('Para detenerlo cierra esta ventana o presiona Ctrl+C.')}
`);
    if (args.abrir) abrirNavegador(url);

    const cerrar = () => servidor.close(() => cerrarPool().finally(() => process.exit(0)));
    process.on('SIGINT', cerrar);
    process.on('SIGTERM', cerrar);
  } catch (e) {
    if (!e.salida) console.error(rojo(`\nError inesperado: ${e.stack ?? e.message}`));
    else if (e.message) console.error(rojo(`\n${e.message}`));
    process.exitCode = 1;
    if (enEjecutable()) await esperarEnter();
  }
}
