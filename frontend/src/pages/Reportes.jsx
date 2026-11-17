import { useState } from 'react';
import { api, descargar, dinero } from '../api.js';
import { Alerta, Encabezado, useDatos } from '../components.jsx';

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const nombreMes = (m) => {
  const [a, n] = m.split('-');
  return `${MESES[Number(n) - 1]} ${a}`;
};

export default function Reportes() {
  const [error, setError] = useState('');
  const [exportando, setExportando] = useState(false);

  const { datos, error: errorCarga } = useDatos(async () => {
    const [porCategoria, porMes] = await Promise.all([
      api('/reportes/por-categoria'),
      api('/reportes/movimientos-por-mes'),
    ]);
    // Agrupa entradas y salidas del mismo mes en una sola fila
    const meses = {};
    for (const r of porMes) {
      meses[r.mes] ??= { mes: r.mes, ENTRADA: { unidades: 0, importe: 0 }, SALIDA: { unidades: 0, importe: 0 } };
      meses[r.mes][r.tipo] = { unidades: Number(r.unidades), importe: Number(r.importe) };
    }
    return { porCategoria, porMes: Object.values(meses) };
  });

  const exportar = async () => {
    setExportando(true);
    setError('');
    try {
      await descargar('/reportes/inventario.csv', `inventario_${new Date().toISOString().slice(0, 10)}.csv`);
    } catch (e) {
      setError(e.message);
    } finally {
      setExportando(false);
    }
  };

  const maxValor = Math.max(1, ...(datos?.porCategoria.map((c) => Number(c.valor)) ?? [1]));
  const totalValor = datos?.porCategoria.reduce((s, c) => s + Number(c.valor), 0) ?? 0;

  return (
    <>
      <Encabezado titulo="Reportes" subtitulo="Resumen del inventario por categoría y de los movimientos por mes.">
        <button className="btn btn-primario" onClick={exportar} disabled={exportando}>
          {exportando ? 'Generando…' : '⤓ Exportar inventario a Excel'}
        </button>
      </Encabezado>
      <Alerta>{error || errorCarga}</Alerta>

      {datos && (
        <>
          <section className="panel">
            <header className="panel-titulo"><h2>Valor del inventario por categoría</h2></header>
            <table className="tabla">
              <thead>
                <tr><th>Categoría</th><th className="num">Productos</th><th className="num">Unidades</th><th className="num">Valor</th><th className="col-barra" /></tr>
              </thead>
              <tbody>
                {datos.porCategoria.map((c) => (
                  <tr key={c.categoria}>
                    <td>{c.categoria}</td>
                    <td className="num">{c.productos}</td>
                    <td className="num">{c.unidades}</td>
                    <td className="num">{dinero(c.valor)}</td>
                    <td className="col-barra">
                      <div className="barra"><span style={{ width: `${(Number(c.valor) / maxValor) * 100}%` }} /></div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr><td colSpan={3}>Total</td><td className="num"><strong>{dinero(totalValor)}</strong></td><td /></tr>
              </tfoot>
            </table>
          </section>

          <section className="panel">
            <header className="panel-titulo"><h2>Movimientos por mes</h2></header>
            <table className="tabla">
              <thead>
                <tr>
                  <th>Mes</th>
                  <th className="num">Unidades que entraron</th><th className="num">Importe entradas</th>
                  <th className="num">Unidades que salieron</th><th className="num">Importe salidas</th>
                </tr>
              </thead>
              <tbody>
                {datos.porMes.map((m) => (
                  <tr key={m.mes}>
                    <td>{nombreMes(m.mes)}</td>
                    <td className="num">{m.ENTRADA.unidades}</td>
                    <td className="num">{dinero(m.ENTRADA.importe)}</td>
                    <td className="num">{m.SALIDA.unidades}</td>
                    <td className="num">{dinero(m.SALIDA.importe)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </>
  );
}
