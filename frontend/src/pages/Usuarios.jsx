import { useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Alerta, Campo, Encabezado, Modal, useDatos } from '../components.jsx';

export default function Usuarios() {
  const { usuario: yo } = useAuth();
  const lista = useDatos(() => api('/usuarios'));
  const [editando, setEditando] = useState(null); // null | 'nuevo' | usuario
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');

  const alternarActivo = async (u) => {
    setError('');
    try {
      await api(`/usuarios/${u.id_usuario}`, { metodo: 'PUT', datos: { activo: !u.activo } });
      setMensaje(`Usuario ${u.nombre} ${u.activo ? 'desactivado' : 'activado'}.`);
      lista.recargar();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <>
      <Encabezado titulo="Usuarios" subtitulo="Cuentas con acceso al sistema y su rol.">
        <button className="btn btn-primario" onClick={() => setEditando('nuevo')}>+ Nuevo usuario</button>
      </Encabezado>
      <Alerta tipo="exito" onCerrar={() => setMensaje('')}>{mensaje}</Alerta>
      <Alerta onCerrar={() => setError('')}>{error || lista.error}</Alerta>

      <section className="panel">
        <table className="tabla">
          <thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Estado</th><th /></tr></thead>
          <tbody>
            {lista.datos?.map((u) => (
              <tr key={u.id_usuario} className={u.activo ? '' : 'inactivo'}>
                <td>{u.nombre}{u.id_usuario === yo.id_usuario && <small> (tú)</small>}</td>
                <td>{u.email}</td>
                <td><span className={`rol rol-${u.rol.toLowerCase()}`}>{u.rol === 'ADMIN' ? 'Admin' : 'Almacén'}</span></td>
                <td>{u.activo ? <span className="pastilla pastilla-ok">Activo</span> : <span className="pastilla">Inactivo</span>}</td>
                <td className="acciones-fila">
                  <button className="btn btn-chico" onClick={() => setEditando(u)}>Editar</button>
                  {u.id_usuario !== yo.id_usuario && (
                    <button className={`btn btn-chico ${u.activo ? 'btn-peligro' : ''}`} onClick={() => alternarActivo(u)}>
                      {u.activo ? 'Desactivar' : 'Activar'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {editando && (
        <FormUsuario
          usuario={editando === 'nuevo' ? null : editando}
          esYo={editando !== 'nuevo' && editando.id_usuario === yo.id_usuario}
          onCerrar={() => setEditando(null)}
          onGuardado={(u, nuevo) => {
            setEditando(null);
            setMensaje(`Usuario ${u.nombre} ${nuevo ? 'creado' : 'actualizado'}.`);
            lista.recargar();
          }}
        />
      )}
    </>
  );
}

function FormUsuario({ usuario, esYo, onCerrar, onGuardado }) {
  const nuevo = !usuario;
  const [f, setF] = useState({
    nombre: usuario?.nombre ?? '',
    email: usuario?.email ?? '',
    rol: usuario?.rol ?? 'ALMACEN',
    password: '',
  });
  const [error, setError] = useState('');
  const cambiar = (campo) => (e) => setF({ ...f, [campo]: e.target.value });

  const guardar = async (e) => {
    e.preventDefault();
    setError('');
    const datos = { ...f };
    if (!nuevo && !datos.password) delete datos.password;
    try {
      const u = nuevo
        ? await api('/usuarios', { metodo: 'POST', datos })
        : await api(`/usuarios/${usuario.id_usuario}`, { metodo: 'PUT', datos });
      onGuardado(u, nuevo);
    } catch (err) {
      setError(err.status === 409 && !esYo ? 'Ya existe un usuario con ese correo.' : `${err.message}${err.detalles ? ` (${err.detalles})` : ''}`);
    }
  };

  return (
    <Modal titulo={nuevo ? 'Nuevo usuario' : `Editar ${usuario.nombre}`} onCerrar={onCerrar}>
      <form onSubmit={guardar} className="formulario">
        <Alerta>{error}</Alerta>
        <Campo etiqueta="Nombre completo">
          <input value={f.nombre} onChange={cambiar('nombre')} maxLength={100} required autoFocus />
        </Campo>
        <Campo etiqueta="Correo (usuario para iniciar sesión)">
          <input type="email" value={f.email} onChange={cambiar('email')} maxLength={120} required />
        </Campo>
        <div className="fila-campos">
          <Campo etiqueta="Rol">
            <select value={f.rol} onChange={cambiar('rol')} disabled={esYo}>
              <option value="ALMACEN">Almacén</option>
              <option value="ADMIN">Admin</option>
            </select>
          </Campo>
          <Campo etiqueta={nuevo ? 'Contraseña' : 'Nueva contraseña (opcional)'}>
            <input type="password" value={f.password} onChange={cambiar('password')}
              minLength={8} maxLength={72} required={nuevo} autoComplete="new-password" />
          </Campo>
        </div>
        <p className="nota">La contraseña debe tener al menos 8 caracteres. Se guarda cifrada (bcrypt).</p>
        <footer className="pie-modal">
          <button type="button" className="btn btn-claro" onClick={onCerrar}>Cancelar</button>
          <button className="btn btn-primario">Guardar</button>
        </footer>
      </form>
    </Modal>
  );
}
