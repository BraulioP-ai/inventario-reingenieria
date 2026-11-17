import { query } from '../config/db.js';

export async function resumen() {
  const [inv] = await query(`
    SELECT COUNT(*)                         AS productos,
           COALESCE(SUM(stock_actual), 0)   AS unidades,
           COALESCE(SUM(costo_total), 0)    AS valor_inventario,
           COALESCE(SUM(bajo_minimo), 0)    AS bajo_minimo
      FROM v_inventario`);

  const [mov] = await query(`
    SELECT COALESCE(SUM(tipo = 'ENTRADA'), 0) AS entradas,
           COALESCE(SUM(tipo = 'SALIDA'), 0)  AS salidas,
           COALESCE(SUM(CASE WHEN tipo = 'SALIDA' THEN cantidad * costo_unitario END), 0) AS importe_salidas
      FROM movimientos
     WHERE fecha >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)`);

  return {
    productos: Number(inv.productos),
    unidades: Number(inv.unidades),
    valor_inventario: Number(inv.valor_inventario),
    bajo_minimo: Number(inv.bajo_minimo),
    ultimos_30_dias: {
      entradas: Number(mov.entradas),
      salidas: Number(mov.salidas),
      importe_salidas: Number(mov.importe_salidas),
    },
  };
}

export async function porCategoria() {
  return query(`
    SELECT categoria, COUNT(*) AS productos,
           SUM(stock_actual) AS unidades, SUM(costo_total) AS valor
      FROM v_inventario
     GROUP BY categoria
     ORDER BY valor DESC`);
}

export async function movimientosPorMes() {
  return query(`
    SELECT DATE_FORMAT(fecha, '%Y-%m') AS mes, tipo,
           SUM(cantidad) AS unidades, SUM(cantidad * costo_unitario) AS importe
      FROM movimientos
     GROUP BY mes, tipo
     ORDER BY mes, tipo`);
}

// Sustituye la exportación FlexGrid -> Excel del sistema original.
export async function inventarioCsv() {
  const filas = await query(`
    SELECT categoria, marca, modelo, descripcion, stock_actual, stock_minimo,
           costo_unitario, costo_total
      FROM v_inventario
     ORDER BY categoria, marca, modelo`);

  const encabezado = ['Categoría', 'Marca', 'Modelo', 'Descripción', 'Stock',
    'Stock mínimo', 'Costo unitario', 'Costo total'];
  const celda = (v) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lineas = [encabezado, ...filas.map(Object.values)].map((f) => f.map(celda).join(','));
  return '﻿' + lineas.join('\r\n'); // BOM para que Excel respete acentos
}
