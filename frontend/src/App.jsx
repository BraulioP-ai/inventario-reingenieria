import { Navigate, NavLink, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Productos from './pages/Productos.jsx';
import Movimientos from './pages/Movimientos.jsx';
import Reportes from './pages/Reportes.jsx';
import Catalogos from './pages/Catalogos.jsx';
import Usuarios from './pages/Usuarios.jsx';

const MENU = [
  { a: '/', texto: 'Dashboard' },
  { a: '/productos', texto: 'Productos' },
  { a: '/movimientos', texto: 'Movimientos' },
  { a: '/reportes', texto: 'Reportes' },
  { a: '/catalogos', texto: 'Categorías y marcas', admin: true },
  { a: '/usuarios', texto: 'Usuarios', admin: true },
];

export default function App() {
  const { usuario, esAdmin, salir } = useAuth();

  if (!usuario) return <Login />;

  return (
    <div className="layout">
      <aside className="menu">
        <div className="marca">
          <span className="logo" aria-hidden="true">▣</span>
          <div>
            <strong>Inventario</strong>
            <small>Electrodomésticos</small>
          </div>
        </div>
        <nav>
          {MENU.filter((m) => !m.admin || esAdmin).map((m) => (
            <NavLink key={m.a} to={m.a} end={m.a === '/'}>{m.texto}</NavLink>
          ))}
        </nav>
        <div className="sesion">
          <div>
            <strong>{usuario.nombre}</strong>
            <span className={`rol rol-${usuario.rol.toLowerCase()}`}>{usuario.rol === 'ADMIN' ? 'Admin' : 'Almacén'}</span>
          </div>
          <button className="btn btn-claro" onClick={salir}>Cerrar sesión</button>
        </div>
      </aside>

      <main className="contenido">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/productos" element={<Productos />} />
          <Route path="/movimientos" element={<Movimientos />} />
          <Route path="/reportes" element={<Reportes />} />
          <Route path="/catalogos" element={esAdmin ? <Catalogos /> : <Navigate to="/" />} />
          <Route path="/usuarios" element={esAdmin ? <Usuarios /> : <Navigate to="/" />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
    </div>
  );
}
