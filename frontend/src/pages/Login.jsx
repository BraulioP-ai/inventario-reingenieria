import { useState } from 'react';
import { useAuth } from '../auth.jsx';
import { Alerta, Campo } from '../components.jsx';

export default function Login() {
  const { entrar, aviso } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e) => {
    e.preventDefault();
    setEnviando(true);
    setError('');
    try {
      await entrar(email, password);
    } catch (err) {
      setError(err.status === 401 ? 'Usuario o contraseña incorrectos' : err.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="pantalla-login">
      <form className="tarjeta-login" onSubmit={enviar}>
        <div className="marca marca-login">
          <span className="logo" aria-hidden="true">▣</span>
          <div>
            <strong>Sistema de Inventario</strong>
            <small>Inicia sesión para continuar</small>
          </div>
        </div>

        <Alerta tipo="info">{aviso}</Alerta>
        <Alerta>{error}</Alerta>

        <Campo etiqueta="Usuario (correo)">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            autoComplete="username" required autoFocus />
        </Campo>
        <Campo etiqueta="Contraseña">
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password" required />
        </Campo>

        <button className="btn btn-primario btn-bloque" disabled={enviando}>
          {enviando ? 'Entrando…' : 'Iniciar sesión'}
        </button>

        <details className="ayuda-demo">
          <summary>Usuarios de prueba</summary>
          <p><code>admin@inventario.local</code> / <code>Admin123*</code></p>
          <p><code>almacen@inventario.local</code> / <code>Almacen123*</code></p>
        </details>
      </form>
    </div>
  );
}
