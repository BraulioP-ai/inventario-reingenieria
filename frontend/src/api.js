// Cliente de la API: agrega el token y convierte los errores en mensajes legibles.
const CLAVE = 'inventario.sesion';

export function leerSesion() {
  try {
    return JSON.parse(localStorage.getItem(CLAVE));
  } catch {
    return null;
  }
}

export function guardarSesion(sesion) {
  try {
    if (sesion) localStorage.setItem(CLAVE, JSON.stringify(sesion));
    else localStorage.removeItem(CLAVE);
  } catch {
    /* almacenamiento no disponible: la sesión dura solo mientras la pestaña esté abierta */
  }
}

export class ApiError extends Error {
  constructor(status, mensaje, detalles) {
    super(mensaje);
    this.status = status;
    this.detalles = detalles;
  }
}

let alExpirar = () => {};
export const onSesionExpirada = (fn) => { alExpirar = fn; };

export async function api(ruta, { metodo = 'GET', datos, crudo = false } = {}) {
  const token = leerSesion()?.token;
  const res = await fetch(`/api${ruta}`, {
    method: metodo,
    headers: {
      ...(datos ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: datos ? JSON.stringify(datos) : undefined,
  });

  if (!res.ok) {
    const cuerpo = await res.json().catch(() => ({}));
    if (res.status === 401 && token && ruta !== '/auth/login') alExpirar();
    const detalle = cuerpo.detalles?.map((d) => `${d.campo}: ${d.mensaje}`).join(' · ');
    throw new ApiError(res.status, cuerpo.error ?? `Error ${res.status}`, detalle);
  }
  if (crudo) return res;
  return res.status === 204 ? null : res.json();
}

// Descarga un archivo protegido (p. ej. el CSV de inventario).
export async function descargar(ruta, nombre) {
  const res = await api(ruta, { crudo: true });
  const url = URL.createObjectURL(await res.blob());
  const a = Object.assign(document.createElement('a'), { href: url, download: nombre });
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const dinero = (n) =>
  Number(n ?? 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

export const fechaHora = (f) =>
  new Date(f).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });
