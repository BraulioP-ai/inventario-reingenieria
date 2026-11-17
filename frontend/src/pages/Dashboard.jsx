import { Link } from 'react-router-dom';
import { api, dinero, fechaHora } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Alerta, Encabezado, Vacio, useDatos } from '../components.jsx';

export default function Dashboard() {
  const { usuario } = useAuth();
  const { datos, error } = useDatos(async () => {
    const [resumen, bajos, recientes] = await Promise.all([
      api('/reportes/resumen'),
      api('/productos?bajoMinimo=true'),
      api('/movimientos?porPagina=6'),
    ]);
    return { resumen, bajos, recientes: recientes.datos };
  });

  return (
    <>
      <Encabezado titulo="Dashboard" subtitulo={`Hola, ${usuario.nombre}. Este es el estado actual del inventario.`} />
      <Alerta>{error}</Alerta>

      {datos && (
        <>
          <section className="kpis">
            <Kpi titulo="Valor del inventario" valor={dinero(datos.resumen.valor_inventario)} />
            <Kpi titulo="Productos activos" valor={datos.resumen.productos} />
            <Kpi titulo="Unidades en existencia" valor={datos.resumen.unidades.toLocaleString('es-MX')} />
            <Kpi titulo="Bajo stock mínimo" valor={datos.resumen.bajo_minimo} alerta={datos.resumen.bajo_minimo > 0} />
          </section>

          <div className="dos-columnas">
            <section className="panel">
              <header className="panel-titulo">
                <h2>Productos por resurtir</h2>
                <Link to="/productos">Ver productos →</Link>
              </header>
              {datos.bajos.length === 0 ? <Vacio>Ningún producto está bajo su mínimo.</Vacio> : (
                <table className="tabla">
                  <thead><tr><th>Producto</th><th className="num">Stock</th><th className="num">Mínimo</th></tr></thead>
                  <tbody>
                    {datos.bajos.map((p) => (
                      <tr key={p.id_producto}>
                        <td><strong>{p.marca} {p.modelo}</strong><br /><small>{p.descripcion}</small></td>
                        <td className="num"><span className="pastilla pastilla-alerta">{p.stock_actual}</span></td>
                        <td className="num">{p.stock_minimo}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>

            <section className="panel">
              <header className="panel-titulo">
                <h2>Últimos movimientos</h2>
                <Link to="/movimientos">Ver historial →</Link>
              </header>
              <table className="tabla">
                <thead><tr><th>Fecha</th><th>Producto</th><th>Tipo</th><th className="num">Cant.</th></tr></thead>
                <tbody>
                  {datos.recientes.map((m) => (
                    <tr key={m.id_movimiento}>
                      <td><small>{fechaHora(m.fecha)}</small></td>
                      <td>{m.marca} {m.modelo}</td>
                      <td><TipoMov tipo={m.tipo} /></td>
                      <td className="num">{m.cantidad}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>
        </>
      )}
    </>
  );
}

function Kpi({ titulo, valor, alerta }) {
  return (
    <div className={`kpi ${alerta ? 'kpi-alerta' : ''}`}>
      <span>{titulo}</span>
      <strong>{valor}</strong>
    </div>
  );
}

export function TipoMov({ tipo }) {
  return (
    <span className={`pastilla ${tipo === 'ENTRADA' ? 'pastilla-entrada' : 'pastilla-salida'}`}>
      {tipo === 'ENTRADA' ? '↑ Entrada' : '↓ Salida'}
    </span>
  );
}
