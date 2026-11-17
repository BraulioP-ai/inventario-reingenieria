import { createContext, useContext, useEffect, useState } from 'react';
import { api, guardarSesion, leerSesion, onSesionExpirada } from './api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [sesion, setSesion] = useState(leerSesion);
  const [aviso, setAviso] = useState('');

  const salir = (mensaje = '') => {
    guardarSesion(null);
    setSesion(null);
    setAviso(mensaje);
  };

  useEffect(() => {
    onSesionExpirada(() => salir('Tu sesión expiró. Inicia sesión de nuevo.'));
  }, []);

  const entrar = async (email, password) => {
    const datos = await api('/auth/login', { metodo: 'POST', datos: { email, password } });
    guardarSesion(datos);
    setSesion(datos);
    setAviso('');
  };

  const usuario = sesion?.usuario ?? null;
  const esAdmin = usuario?.rol === 'ADMIN';

  return (
    <AuthContext.Provider value={{ usuario, esAdmin, entrar, salir: () => salir(), aviso }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
