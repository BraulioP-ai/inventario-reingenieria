import readline from 'node:readline';

// Utilidades de terminal para el asistente de configuración.

export const interactivo = () => Boolean(process.stdin.isTTY && process.stdout.isTTY);

const color = (codigo) => (texto) => (process.stdout.isTTY && !process.env.NO_COLOR ? `\x1b[${codigo}m${texto}\x1b[0m` : texto);
export const verde = color('32');
export const rojo = color('31');
export const amarillo = color('33');
export const negritas = color('1');
export const tenue = color('2');

export async function preguntar(texto, porDefecto = '') {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const sufijo = porDefecto !== '' ? tenue(` [${porDefecto}]`) : '';
  const respuesta = await new Promise((resolve) => rl.question(`  ${texto}${sufijo}: `, resolve));
  rl.close();
  return respuesta.trim() || porDefecto;
}

// Pide un texto sin mostrarlo (muestra * por cada carácter).
export function preguntarOculto(texto) {
  return new Promise((resolve) => {
    const entrada = process.stdin;
    process.stdout.write(`  ${texto}: `);
    let valor = '';
    entrada.setRawMode(true);
    entrada.resume();
    entrada.setEncoding('utf8');

    const terminar = () => {
      entrada.removeListener('data', alEscribir);
      entrada.setRawMode(false);
      entrada.pause();
      process.stdout.write('\n');
      resolve(valor);
    };

    function alEscribir(trozo) {
      for (const c of trozo) {
        if (c === '\r' || c === '\n') return terminar();
        if (c === '\u0003') { // Ctrl+C
          entrada.setRawMode(false);
          process.stdout.write('\n');
          process.exit(130);
        }
        if (c === '\u007f' || c === '\b') {
          if (valor) {
            valor = valor.slice(0, -1);
            process.stdout.write('\b \b');
          }
          continue;
        }
        if (c < ' ') continue;
        valor += c;
        process.stdout.write('*');
      }
    }
    entrada.on('data', alEscribir);
  });
}

export async function confirmar(texto) {
  const r = await preguntar(`${texto} (s/n)`, 'n');
  return /^s/i.test(r);
}

// En Windows, al hacer doble clic al .exe la ventana se cierra al terminar:
// esperamos un Enter para que alcance a leer el mensaje.
export async function esperarEnter() {
  if (!interactivo()) return;
  await preguntar(tenue('Presiona Enter para cerrar'));
}
