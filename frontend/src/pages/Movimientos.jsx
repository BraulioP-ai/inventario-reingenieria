import { useState } from 'react';
import { api, dinero, fechaHora } from '../api.js';
import { Alerta, Campo, Encabezado, Modal, Vacio, useDatos } from '../components.jsx';
import { TipoMov } from './Dashboard.jsx';

const FILTROS_VACIOS = { producto: '', tipo: '', desde: '', hasta: '' };

export default function Movimientos() {
  const [filtros, setFiltros] = useState(FILTROS_VACIOS);
  const [pagina, setPagina] = useState(1);
  const [registrando, setRegistrando] = useState(null); // null | 'ENTRADA' | 'SALIDA'
  const [mensaje, setMensaje] = useState('');

  const productos = useDatos(() => api('/productos'));

  const params = new URLSearchParams({ pagina, porPagina: 15 });
  Object.entries(filtros).forEach(([k, v]) => v && params.set(k, v));
  const consulta = params.toString();
  const historial = useDatos(() => api(`/movimientos?${consulta}`), [consulta]);

  const cambiar = (campo) => (e) => {
    setFiltros({ ...filtros, [campo]: e.target.value });
    setPagina(1);
  };

  return (
    <>
      <Encabezado titulo="Movimientos" subtitulo="Entradas y salidas de mercancía. La existencia se actualiza automáticamente.">
        <button className="btn btn-entrada" onClick={() => setRegistrando('ENTRADA')}>↑ Nueva entrada</button>
        <button className="btn btn-salida" onClick={() => setRegistrando('SALIDA')}>↓ Nueva salida</button>
      </Encabezado>

      <Alerta tipo="exito" onCerrar={() => setMensaje('')}>{mensaje}</Alerta>
      <Alerta>{historial.error}</Alerta>

      <section className="filtros">
        <select value={filtros.producto} onChange={cambiar('producto')} aria-label="Producto">
          <option value="">Todos los productos</option>
          {productos.datos?.map((p) => <option key={p.id_producto} value={p.id_producto}>{p.marca} {p.modelo}</option>)}
        </select>
        <select value={filtros.tipo} onChange={cambiar('tipo')} aria-label="Tipo">
          <option value="">Entradas y salidas</option>
          <option value="ENTRADA">Solo entradas</option>
          <option value="SALIDA">Solo salidas</option>
        </select>
        <label className="campo-linea">Desde <input type="date" value={filtros.desde} onChange={cambiar('desde')} /></label>
        <label className="campo-linea">Hasta <input type="date" value={filtros.hasta} onChange={cambiar('hasta')} /></label>
        <button className="btn btn-claro" onClick={() => { setFiltros(FILTROS_VACIOS); setPagina(1); }}>Limpiar</button>
      </section>

      <section className="panel">
        {historial.datos?.datos.length === 0 ? <Vacio>No hay movimientos con esos filtros.</Vacio> : (
          <div className="tabla-scroll">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Fecha y hora</th><th>Tipo</th><th>Producto</th>
                  <th className="num">Cantidad</th><th className="num">Costo unit.</th><th className="num">Importe</th>
                  <th>Usuario</th><th>Nota</th>
                </tr>
              </thead>
              <tbody>
                {historial.datos?.datos.map((m) => (
                  <tr key={m.id_movimiento}>
                    <td>{fechaHora(m.fecha)}</td>
                    <td><TipoMov tipo={m.tipo} /></td>
                    <td><strong>{m.marca} {m.modelo}</strong><br /><small>{m.descripcion}</small></td>
                    <td className="num">{m.cantidad}</td>
                    <td className="num">{dinero(m.costo_unitario)}</td>
                    <td className="num">{dinero(m.importe)}</td>
                    <td>{m.usuario}</td>
                    <td><small>{m.nota}</small></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {historial.datos?.paginas > 1 && (
          <nav className="paginacion">
            <button className="btn btn-claro btn-chico" disabled={pagina <= 1} onClick={() => setPagina(pagina - 1)}>← Anterior</button>
            <span>Página {historial.datos.pagina} de {historial.datos.paginas} · {historial.datos.total} movimientos</span>
            <button className="btn btn-claro btn-chico" disabled={pagina >= historial.datos.paginas} onClick={() => setPagina(pagina + 1)}>Siguiente →</button>
          </nav>
        )}
      </section>

      {registrando && productos.datos && (
        <FormMovimiento
          tipo={registrando}
          productos={productos.datos}
          onCerrar={() => setRegistrando(null)}
          onRegistrado={(m) => {
            setRegistrando(null);
            setMensaje(`${m.tipo === 'ENTRADA' ? 'Entrada' : 'Salida'} registrada: ${m.cantidad} × ${m.marca} ${m.modelo}.`);
            setPagina(1);
            productos.recargar();
            historial.recargar();
          }}
        />
      )}
    </>
  );
}

function FormMovimiento({ tipo, productos, onCerrar, onRegistrado }) {
  const entrada = tipo === 'ENTRADA';
  const [f, setF] = useState({ id_producto: '', cantidad: 1, costo_unitario: '', nota: '' });
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const elegido = productos.find((p) => String(p.id_producto) === String(f.id_producto));

  const cambiar = (campo) => (e) => {
    const valor = e.target.value;
    const siguiente = { ...f, [campo]: valor };
    if (campo === 'id_producto') {
      const p = productos.find((x) => String(x.id_producto) === valor);
      siguiente.costo_unitario = p?.costo_unitario ?? '';
    }
    setF(siguiente);
  };

  const registrar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    setError('');
    const datos = { id_producto: Number(f.id_producto), tipo, cantidad: Number(f.cantidad) };
    if (entrada && f.costo_unitario !== '') datos.costo_unitario = Number(f.costo_unitario);
    if (f.nota.trim()) datos.nota = f.nota.trim();
    try {
      onRegistrado(await api('/movimientos', { metodo: 'POST', datos }));
    } catch (err) {
      setError(err.message);
      setGuardando(false);
    }
  };

  return (
    <Modal titulo={entrada ? 'Registrar entrada' : 'Registrar salida'} onCerrar={onCerrar}>
      <form onSubmit={registrar} className="formulario">
        <Alerta>{error}</Alerta>
        <Campo etiqueta="Producto">
          <select value={f.id_producto} onChange={cambiar('id_producto')} required autoFocus>
            <option value="">Selecciona…</option>
            {productos.map((p) => (
              <option key={p.id_producto} value={p.id_producto}>
                {p.marca} {p.modelo} — {p.descripcion} (stock: {p.stock_actual})
              </option>
            ))}
          </select>
        </Campo>
        {elegido && (
          <p className="nota">
            Existencia actual: <strong>{elegido.stock_actual}</strong> · Costo vigente: {dinero(elegido.costo_unitario)}
          </p>
        )}
        <div className="fila-campos">
          <Campo etiqueta="Cantidad">
            <input type="number" min="1" step="1" value={f.cantidad} onChange={cambiar('cantidad')} required />
          </Campo>
          {entrada && (
            <Campo etiqueta="Costo unitario (MXN)">
              <input type="number" min="0" step="0.01" value={f.costo_unitario} onChange={cambiar('costo_unitario')} required />
            </Campo>
          )}
        </div>
        <Campo etiqueta="Nota (opcional)">
          <input value={f.nota} onChange={cambiar('nota')} maxLength={255}
            placeholder={entrada ? 'Ej. Resurtido proveedor' : 'Ej. Venta mostrador'} />
        </Campo>
        <footer className="pie-modal">
          <button type="button" className="btn btn-claro" onClick={onCerrar}>Cancelar</button>
          <button className={`btn ${entrada ? 'btn-entrada' : 'btn-salida'}`} disabled={guardando}>
            {guardando ? 'Registrando…' : 'Registrar'}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
