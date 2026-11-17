import { useState } from 'react';
import { api } from '../api.js';
import { Alerta, Encabezado, Vacio, useDatos } from '../components.jsx';

export default function Catalogos() {
  return (
    <>
      <Encabezado titulo="Categorías y marcas" subtitulo="Catálogos únicos que antes eran texto repetido en cada registro." />
      <div className="dos-columnas">
        <Catalogo recurso="categorias" idCampo="id_categoria" titulo="Categorías" singular="categoría" />
        <Catalogo recurso="marcas" idCampo="id_marca" titulo="Marcas" singular="marca" />
      </div>
    </>
  );
}

function Catalogo({ recurso, idCampo, titulo, singular }) {
  const lista = useDatos(() => api(`/${recurso}`));
  const [nuevo, setNuevo] = useState('');
  const [editando, setEditando] = useState(null); // { id, nombre }
  const [error, setError] = useState('');

  const ejecutar = async (accion) => {
    setError('');
    try {
      await accion();
      lista.recargar();
      return true;
    } catch (e) {
      setError(e.status === 409 ? `Ya existe una ${singular} con ese nombre.` : e.message);
      return false;
    }
  };

  const agregar = async (e) => {
    e.preventDefault();
    if (await ejecutar(() => api(`/${recurso}`, { metodo: 'POST', datos: { nombre: nuevo } }))) setNuevo('');
  };

  const guardarEdicion = async (e) => {
    e.preventDefault();
    if (await ejecutar(() => api(`/${recurso}/${editando.id}`, { metodo: 'PUT', datos: { nombre: editando.nombre } }))) {
      setEditando(null);
    }
  };

  const eliminar = (item) => {
    if (item.productos > 0) {
      setError(`No se puede eliminar "${item.nombre}": tiene ${item.productos} producto(s) asociados.`);
      return;
    }
    if (window.confirm(`¿Eliminar la ${singular} "${item.nombre}"?`)) {
      ejecutar(() => api(`/${recurso}/${item[idCampo]}`, { metodo: 'DELETE' }));
    }
  };

  return (
    <section className="panel">
      <header className="panel-titulo"><h2>{titulo}</h2></header>
      <Alerta onCerrar={() => setError('')}>{error || lista.error}</Alerta>

      <form className="fila-agregar" onSubmit={agregar}>
        <input value={nuevo} onChange={(e) => setNuevo(e.target.value)} placeholder={`Nueva ${singular}…`}
          maxLength={60} required aria-label={`Nueva ${singular}`} />
        <button className="btn btn-primario">Agregar</button>
      </form>

      {lista.datos?.length === 0 ? <Vacio>Sin registros.</Vacio> : (
        <table className="tabla">
          <thead><tr><th>Nombre</th><th className="num">Productos</th><th /></tr></thead>
          <tbody>
            {lista.datos?.map((item) => (
              <tr key={item[idCampo]}>
                {editando?.id === item[idCampo] ? (
                  <td colSpan={3}>
                    <form className="fila-agregar" onSubmit={guardarEdicion}>
                      <input value={editando.nombre} onChange={(e) => setEditando({ ...editando, nombre: e.target.value })}
                        maxLength={60} required autoFocus aria-label="Nombre" />
                      <button className="btn btn-primario btn-chico">Guardar</button>
                      <button type="button" className="btn btn-claro btn-chico" onClick={() => setEditando(null)}>Cancelar</button>
                    </form>
                  </td>
                ) : (
                  <>
                    <td>{item.nombre}</td>
                    <td className="num">{item.productos}</td>
                    <td className="acciones-fila">
                      <button className="btn btn-chico" onClick={() => setEditando({ id: item[idCampo], nombre: item.nombre })}>Editar</button>
                      <button className="btn btn-chico btn-peligro" onClick={() => eliminar(item)}>Eliminar</button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
