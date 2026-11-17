// Pruebas de integración de la API contra la BD real.
// OJO: agregan algunos registros de prueba. Para volver a los datos originales,
// recarga bd/01_esquema.sql y bd/02_datos.sql.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
const { crearApp } = await import('../src/app.js');
const { cerrarPool } = await import('../src/config/db.js');

let servidor, base, tokenAdmin, tokenAlmacen;
const sufijo = Date.now().toString(36).toUpperCase();

async function api(ruta, { token, ...opciones } = {}) {
  const res = await fetch(base + ruta, {
    ...opciones,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: opciones.body ? JSON.stringify(opciones.body) : undefined,
  });
  const tipo = res.headers.get('content-type') ?? '';
  const cuerpo = tipo.includes('json') ? await res.json() : await res.text();
  return { status: res.status, cuerpo, headers: res.headers };
}

before(async () => {
  servidor = crearApp().listen(0);
  base = `http://localhost:${servidor.address().port}/api`;
  tokenAdmin = (await api('/auth/login', { method: 'POST', body: { email: 'admin@inventario.local', password: 'Admin123*' } })).cuerpo.token;
  tokenAlmacen = (await api('/auth/login', { method: 'POST', body: { email: 'almacen@inventario.local', password: 'Almacen123*' } })).cuerpo.token;
});

after(async () => {
  servidor.close();
  await cerrarPool();
});

test('salud: la API responde y hay conexión a BD', async () => {
  const r = await api('/salud');
  assert.equal(r.status, 200);
  assert.equal(r.cuerpo.bd, 'conectada');
});

test('login: credenciales correctas devuelven token y rol', async () => {
  assert.ok(tokenAdmin);
  assert.ok(tokenAlmacen);
  const me = await api('/auth/me', { token: tokenAdmin });
  assert.equal(me.cuerpo.rol, 'ADMIN');
});

test('login: contraseña incorrecta o correo inexistente → 401', async () => {
  const a = await api('/auth/login', { method: 'POST', body: { email: 'admin@inventario.local', password: 'mala' } });
  const b = await api('/auth/login', { method: 'POST', body: { email: 'nadie@x.com', password: 'mala' } });
  assert.equal(a.status, 401);
  assert.equal(b.status, 401);
});

test('sin token → 401; token alterado → 401', async () => {
  assert.equal((await api('/productos')).status, 401);
  assert.equal((await api('/productos', { token: tokenAdmin + 'x' })).status, 401);
});

test('productos: lista con datos calculados (costo_total, bajo_minimo)', async () => {
  const r = await api('/productos', { token: tokenAlmacen });
  assert.equal(r.status, 200);
  assert.equal(r.cuerpo.length >= 20, true);
  const p = r.cuerpo[0];
  assert.equal(p.costo_total, Math.round(p.stock_actual * p.costo_unitario * 100) / 100);
  assert.equal(typeof p.bajo_minimo, 'boolean');
});

test('productos: filtros por categoría, marca, texto y bajo mínimo', async () => {
  const cat = await api('/productos?categoria=1', { token: tokenAdmin });
  assert.ok(cat.cuerpo.every((p) => p.id_categoria === 1));
  const marca = await api('/productos?marca=1', { token: tokenAdmin });
  assert.ok(marca.cuerpo.every((p) => p.marca === 'Samsung'));
  const q = await api('/productos?q=Minisplit', { token: tokenAdmin });
  assert.equal(q.cuerpo.length, 2);
  const bajo = await api('/productos?bajoMinimo=true', { token: tokenAdmin });
  assert.ok(bajo.cuerpo.length > 0 && bajo.cuerpo.every((p) => p.bajo_minimo));
});

test('seguridad: la búsqueda no es vulnerable a inyección SQL', async () => {
  // En el VB6 esto se concatenaba al WHERE. Aquí es solo texto a buscar.
  const r = await api(`/productos?q=${encodeURIComponent("' OR '1'='1")}`, { token: tokenAdmin });
  assert.equal(r.status, 200);
  assert.equal(r.cuerpo.length, 0);
});

test('permisos: ALMACEN no puede crear productos ni ver usuarios', async () => {
  const p = await api('/productos', { method: 'POST', token: tokenAlmacen, body: {} });
  const u = await api('/usuarios', { token: tokenAlmacen });
  assert.equal(p.status, 403);
  assert.equal(u.status, 403);
});

test('validación: datos inválidos → 400 con detalle por campo', async () => {
  const r = await api('/productos', {
    method: 'POST', token: tokenAdmin,
    body: { id_categoria: 'x', modelo: '', costo_unitario: -5 },
  });
  assert.equal(r.status, 400);
  const campos = r.cuerpo.detalles.map((d) => d.campo);
  for (const c of ['id_categoria', 'id_marca', 'modelo', 'descripcion', 'costo_unitario']) {
    assert.ok(campos.includes(c), `falta error en ${c}`);
  }
});

test('flujo completo: crear producto con stock inicial, entrada, salida y stock insuficiente', async () => {
  const nuevo = await api('/productos', {
    method: 'POST', token: tokenAdmin,
    body: { id_categoria: 4, id_marca: 6, modelo: `TEST-${sufijo}`, descripcion: 'Producto de prueba', costo_unitario: 1000, stock_minimo: 2, stock_inicial: 5 },
  });
  assert.equal(nuevo.status, 201);
  assert.equal(nuevo.cuerpo.stock_actual, 5);
  const id = nuevo.cuerpo.id_producto;

  const entrada = await api('/movimientos', { method: 'POST', token: tokenAlmacen, body: { id_producto: id, tipo: 'ENTRADA', cantidad: 3, costo_unitario: 1100 } });
  assert.equal(entrada.status, 201);
  assert.equal(entrada.cuerpo.usuario, 'Encargado de Almacén');

  const salida = await api('/movimientos', { method: 'POST', token: tokenAlmacen, body: { id_producto: id, tipo: 'SALIDA', cantidad: 6 } });
  assert.equal(salida.status, 201);
  assert.equal(salida.cuerpo.costo_unitario, 1100); // toma el costo vigente

  const p = (await api(`/productos/${id}`, { token: tokenAdmin })).cuerpo;
  assert.equal(p.stock_actual, 2);
  assert.equal(p.costo_unitario, 1100);
  assert.equal(p.bajo_minimo, true);

  const excedida = await api('/movimientos', { method: 'POST', token: tokenAlmacen, body: { id_producto: id, tipo: 'SALIDA', cantidad: 3 } });
  assert.equal(excedida.status, 409);
  assert.match(excedida.cuerpo.error, /Stock insuficiente/);

  const kardex = await api(`/movimientos?producto=${id}`, { token: tokenAdmin });
  assert.equal(kardex.cuerpo.total, 3);
});

test('productos: el stock no se puede editar directamente', async () => {
  const r = await api('/productos/1', { method: 'PUT', token: tokenAdmin, body: { stock_actual: 999 } });
  assert.equal(r.status, 400);
});

test('productos: modelo duplicado en la misma marca → 409', async () => {
  const r = await api('/productos', {
    method: 'POST', token: tokenAdmin,
    body: { id_categoria: 1, id_marca: 1, modelo: 'UN55DU7000', descripcion: 'dup', costo_unitario: 1 },
  });
  assert.equal(r.status, 409);
});

test('catálogos: crear, editar y dar de baja una marca', async () => {
  const c = await api('/marcas', { method: 'POST', token: tokenAdmin, body: { nombre: `Marca ${sufijo}` } });
  assert.equal(c.status, 201);
  const id = c.cuerpo.id_marca;
  const e = await api(`/marcas/${id}`, { method: 'PUT', token: tokenAdmin, body: { nombre: `Marca ${sufijo} B` } });
  assert.equal(e.cuerpo.nombre, `Marca ${sufijo} B`);
  const d = await api(`/marcas/${id}`, { method: 'DELETE', token: tokenAdmin });
  assert.equal(d.cuerpo.activo, false);
  const lista = await api('/marcas', { token: tokenAdmin });
  assert.ok(!lista.cuerpo.some((m) => m.id_marca === id));
});

test('movimientos: paginación y filtros por tipo y fecha', async () => {
  const r = await api('/movimientos?tipo=SALIDA&desde=2026-10-01&hasta=2026-10-31&porPagina=10&pagina=2', { token: tokenAdmin });
  assert.equal(r.status, 200);
  assert.equal(r.cuerpo.datos.length, 10);
  assert.equal(r.cuerpo.pagina, 2);
  assert.ok(r.cuerpo.datos.every((m) => m.tipo === 'SALIDA'));
});

test('reportes: resumen, por categoría, por mes y CSV', async () => {
  const res = await api('/reportes/resumen', { token: tokenAlmacen });
  assert.ok(res.cuerpo.valor_inventario > 0);
  assert.ok(res.cuerpo.bajo_minimo > 0);
  const cat = await api('/reportes/por-categoria', { token: tokenAlmacen });
  assert.ok(cat.cuerpo.length >= 7);
  const mes = await api('/reportes/movimientos-por-mes', { token: tokenAlmacen });
  assert.ok(mes.cuerpo.some((m) => m.mes === '2026-09'));
  const csv = await api('/reportes/inventario.csv', { token: tokenAlmacen });
  assert.match(csv.headers.get('content-disposition'), /inventario_.*\.csv/);
  assert.ok(csv.cuerpo.includes('Categoría,Marca,Modelo'));
});

test('usuarios: el admin crea uno nuevo y no puede desactivarse a sí mismo', async () => {
  const u = await api('/usuarios', {
    method: 'POST', token: tokenAdmin,
    body: { nombre: 'Prueba', email: `prueba.${sufijo}@inventario.local`, password: 'Prueba1234', rol: 'ALMACEN' },
  });
  assert.equal(u.status, 201);
  assert.equal(u.cuerpo.password_hash, undefined);
  const yo = (await api('/auth/me', { token: tokenAdmin })).cuerpo.id_usuario;
  const r = await api(`/usuarios/${yo}`, { method: 'PUT', token: tokenAdmin, body: { activo: false } });
  assert.equal(r.status, 409);
});
