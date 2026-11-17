import { useState } from 'react';
import { api, dinero } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Alerta, Campo, Encabezado, Modal, Vacio, useDatos } from '../components.jsx';

const FILTROS_VACIOS = { q: '', categoria: '', marca: '', bajoMinimo: false };

export default function Productos() {
  const { esAdmin } = useAuth();
  const [filtros, setFiltros] = useState(FILTROS_VACIOS);
  const [editando, setEditando] = useState(null); // null | 'nuevo' | producto
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');

  const catalogos = useDatos(async () => {
    const [categorias, marcas] = await Promise.all([api('/categorias'), api('/marcas')]);
    return { categorias, marcas };
  });

  const params = new URLSearchParams();
  if (filtros.q) params.set('q', filtros.q);
  if (filtros.categoria) params.set('categoria', filtros.categoria);
  if (filtros.marca) params.set('marca', filtros.marca);
  if (filtros.bajoMinimo) params.set('bajoMinimo', 'true');
  const consulta = params.toString();

  const productos = useDatos(() => api(`/productos?${consulta}`), [consulta]);
  const cambiar = (campo) => (e) =>
    setFiltros({ ...filtros, [campo]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  const darDeBaja = async (p) => {
    if (!window.confirm(`¿Dar de baja "${p.marca} ${p.modelo}"? Su historial se conserva.`)) return;
    try {
      await api(`/productos/${p.id_producto}`, { metodo: 'DELETE' });
      setMensaje(`Producto ${p.modelo} dado de baja.`);
      productos.recargar();
    } catch (e) {
      setError(e.message);
    }
  };

  const total = productos.datos?.reduce((s, p) => s + p.costo_total, 0) ?? 0;

  return (
    <>
      <Encabezado titulo="Productos" subtitulo="Consulta de existencias. El costo total se calcula como existencia × costo unitario.">
        {esAdmin && <button className="btn btn-primario" onClick={() => setEditando('nuevo')}>+ Nuevo producto</button>}
      </Encabezado>

      <Alerta tipo="exito" onCerrar={() => setMensaje('')}>{mensaje}</Alerta>
      <Alerta onCerrar={() => setError('')}>{error || productos.error}</Alerta>

      <section className="filtros">
        <input type="search" placeholder="Buscar por modelo o descripción…" value={filtros.q} onChange={cambiar('q')} aria-label="Buscar" />
        <select value={filtros.categoria} onChange={cambiar('categoria')} aria-label="Categoría">
          <option value="">Todas las categorías</option>
          {catalogos.datos?.categorias.map((c) => <option key={c.id_categoria} value={c.id_categoria}>{c.nombre}</option>)}
        </select>
        <select value={filtros.marca} onChange={cambiar('marca')} aria-label="Marca">
          <option value="">Todas las marcas</option>
          {catalogos.datos?.marcas.map((m) => <option key={m.id_marca} value={m.id_marca}>{m.nombre}</option>)}
        </select>
        <label className="check">
          <input type="checkbox" checked={filtros.bajoMinimo} onChange={cambiar('bajoMinimo')} /> Solo bajo mínimo
        </label>
        <button className="btn btn-claro" onClick={() => setFiltros(FILTROS_VACIOS)}>Limpiar</button>
      </section>

      <section className="panel">
        {productos.datos?.length === 0 ? <Vacio>No hay productos con esos filtros.</Vacio> : (
          <div className="tabla-scroll">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Categoría</th><th>Marca</th><th>Modelo</th><th>Descripción</th>
                  <th className="num">Stock</th><th className="num">Costo unitario</th><th className="num">Costo total</th>
                  {esAdmin && <th />}
                </tr>
              </thead>
              <tbody>
                {productos.datos?.map((p) => (
                  <tr key={p.id_producto}>
                    <td>{p.categoria}</td>
                    <td>{p.marca}</td>
                    <td><code>{p.modelo}</code></td>
                    <td>{p.descripcion}</td>
                    <td className="num">
                      <span className={`pastilla ${p.bajo_minimo ? 'pastilla-alerta' : 'pastilla-ok'}`}
                        title={`Mínimo: ${p.stock_minimo}`}>{p.stock_actual}</span>
                    </td>
                    <td className="num">{dinero(p.costo_unitario)}</td>
                    <td className="num"><strong>{dinero(p.costo_total)}</strong></td>
                    {esAdmin && (
                      <td className="acciones-fila">
                        <button className="btn btn-chico" onClick={() => setEditando(p)}>Editar</button>
                        <button className="btn btn-chico btn-peligro" onClick={() => darDeBaja(p)}>Dar de baja</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              {productos.datos?.length > 0 && (
                <tfoot>
                  <tr>
                    <td colSpan={6}>{productos.datos.length} productos</td>
                    <td className="num"><strong>{dinero(total)}</strong></td>
                    {esAdmin && <td />}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </section>

      {editando && catalogos.datos && (
        <FormProducto
          producto={editando === 'nuevo' ? null : editando}
          catalogos={catalogos.datos}
          onCerrar={() => setEditando(null)}
          onGuardado={(p, nuevo) => {
            setEditando(null);
            setMensaje(`Producto ${p.modelo} ${nuevo ? 'creado' : 'actualizado'}.`);
            productos.recargar();
          }}
        />
      )}
    </>
  );
}

function FormProducto({ producto, catalogos, onCerrar, onGuardado }) {
  const nuevo = !producto;
  const [f, setF] = useState({
    id_categoria: producto?.id_categoria ?? '',
    id_marca: producto?.id_marca ?? '',
    modelo: producto?.modelo ?? '',
    descripcion: producto?.descripcion ?? '',
    costo_unitario: producto?.costo_unitario ?? '',
    stock_minimo: producto?.stock_minimo ?? 0,
  });
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const cambiar = (campo) => (e) => setF({ ...f, [campo]: e.target.value });

  const guardar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    setError('');
    try {
      const p = nuevo
        ? await api('/productos', { metodo: 'POST', datos: f })
        : await api(`/productos/${producto.id_producto}`, { metodo: 'PUT', datos: f });
      onGuardado(p, nuevo);
    } catch (err) {
      setError(err.status === 409 ? 'Ya existe un producto con ese modelo en esa marca.' : `${err.message}${err.detalles ? ` (${err.detalles})` : ''}`);
      setGuardando(false);
    }
  };

  return (
    <Modal titulo={nuevo ? 'Nuevo producto' : `Editar ${producto.modelo}`} onCerrar={onCerrar}>
      <form onSubmit={guardar} className="formulario">
        <Alerta>{error}</Alerta>
        <div className="fila-campos">
          <Campo etiqueta="Categoría">
            <select value={f.id_categoria} onChange={cambiar('id_categoria')} required>
              <option value="">Selecciona…</option>
              {catalogos.categorias.map((c) => <option key={c.id_categoria} value={c.id_categoria}>{c.nombre}</option>)}
            </select>
          </Campo>
          <Campo etiqueta="Marca">
            <select value={f.id_marca} onChange={cambiar('id_marca')} required>
              <option value="">Selecciona…</option>
              {catalogos.marcas.map((m) => <option key={m.id_marca} value={m.id_marca}>{m.nombre}</option>)}
            </select>
          </Campo>
        </div>
        <Campo etiqueta="Modelo">
          <input value={f.modelo} onChange={cambiar('modelo')} maxLength={60} required />
        </Campo>
        <Campo etiqueta="Descripción">
          <input value={f.descripcion} onChange={cambiar('descripcion')} maxLength={255} required />
        </Campo>
        <div className="fila-campos">
          <Campo etiqueta="Costo unitario (MXN)">
            <input type="number" min="0" step="0.01" value={f.costo_unitario} onChange={cambiar('costo_unitario')} required />
          </Campo>
          <Campo etiqueta="Stock mínimo">
            <input type="number" min="0" step="1" value={f.stock_minimo} onChange={cambiar('stock_minimo')} required />
          </Campo>
        </div>
        <p className="nota">
          {nuevo
            ? 'La existencia inicia en cero; se incrementa registrando una entrada en Movimientos.'
            : `Existencia actual: ${producto.stock_actual}. Para cambiarla registra una entrada o salida.`}
        </p>
        <footer className="pie-modal">
          <button type="button" className="btn btn-claro" onClick={onCerrar}>Cancelar</button>
          <button className="btn btn-primario" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar'}</button>
        </footer>
      </form>
    </Modal>
  );
}
