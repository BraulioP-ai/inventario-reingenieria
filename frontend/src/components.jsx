import { useCallback, useEffect, useState } from 'react';

// Carga datos de la API y expone estado de carga, error y una función para recargar.
export function useDatos(cargar, deps = []) {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);

  const recargar = useCallback(async () => {
    setCargando(true);
    try {
      setDatos(await cargar());
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => { recargar(); }, [recargar]);
  return { datos, error, cargando, recargar };
}

export function Alerta({ tipo = 'error', children, onCerrar }) {
  if (!children) return null;
  return (
    <div className={`alerta alerta-${tipo}`} role={tipo === 'error' ? 'alert' : 'status'}>
      <span>{children}</span>
      {onCerrar && <button className="cerrar" onClick={onCerrar} aria-label="Cerrar">×</button>}
    </div>
  );
}

export function Modal({ titulo, onCerrar, children }) {
  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && onCerrar();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onCerrar]);

  return (
    <div className="fondo-modal" onMouseDown={(e) => e.target === e.currentTarget && onCerrar()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={titulo}>
        <header>
          <h2>{titulo}</h2>
          <button className="cerrar" onClick={onCerrar} aria-label="Cerrar">×</button>
        </header>
        {children}
      </div>
    </div>
  );
}

export function Campo({ etiqueta, children }) {
  return (
    <label className="campo">
      <span>{etiqueta}</span>
      {children}
    </label>
  );
}

export function Encabezado({ titulo, subtitulo, children }) {
  return (
    <header className="encabezado">
      <div>
        <h1>{titulo}</h1>
        {subtitulo && <p>{subtitulo}</p>}
      </div>
      <div className="acciones">{children}</div>
    </header>
  );
}

export function Vacio({ children }) {
  return <p className="vacio">{children}</p>;
}
