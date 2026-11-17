import { leerSql } from '../recursos.js';

const TABLAS = ['categorias', 'marcas', 'usuarios', 'productos', 'movimientos'];

// Divide un script .sql en sentencias. Respeta "DELIMITER", que es un comando
// del cliente mysql (no de SQL) y se usa para los triggers.
export function dividirSql(texto) {
  const sentencias = [];
  let delimitador = ';';
  let actual = [];

  const cerrar = (bloque) => {
    const s = bloque.trim();
    const util = s.split('\n').some((l) => l.trim() && !/^\s*(--|#)/.test(l));
    if (util) sentencias.push(s);
  };

  for (const linea of texto.split(/\r?\n/)) {
    const cambio = linea.match(/^\s*DELIMITER\s+(\S+)\s*$/i);
    if (cambio) {
      delimitador = cambio[1];
      continue;
    }
    actual.push(linea);
    const limpia = linea.trimEnd();
    const esComentario = /^\s*(--|#)/.test(limpia);
    if (!esComentario && limpia.endsWith(delimitador)) {
      const bloque = actual.join('\n').trimEnd();
      cerrar(bloque.slice(0, -delimitador.length));
      actual = [];
    }
  }
  cerrar(actual.join('\n'));
  return sentencias;
}

// 'ok' | 'sin-bd' | 'incompleta' | 'sin-datos'
export async function estadoBd(conexion, nombre) {
  const [esquemas] = await conexion.query(
    'SELECT COUNT(*) AS n FROM information_schema.schemata WHERE schema_name = ?', [nombre]);
  if (Number(esquemas[0].n) === 0) return 'sin-bd';

  const [tablas] = await conexion.query(
    'SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = ? AND table_name IN (?)',
    [nombre, TABLAS]);
  if (Number(tablas[0].n) < TABLAS.length) return 'incompleta';

  const [usuarios] = await conexion.query(`SELECT COUNT(*) AS n FROM \`${nombre}\`.usuarios`);
  return Number(usuarios[0].n) === 0 ? 'sin-datos' : 'ok';
}

// Ejecuta 01_esquema.sql (borra y recrea la BD) y 02_datos.sql.
export async function instalarBd(conexion, alAvanzar = () => {}) {
  for (const archivo of ['01_esquema.sql', '02_datos.sql']) {
    const sentencias = dividirSql(leerSql(archivo));
    alAvanzar(archivo, sentencias.length);
    for (const s of sentencias) {
      await conexion.query(s);
    }
  }
}
