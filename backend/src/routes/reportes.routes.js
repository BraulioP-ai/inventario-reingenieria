import { Router } from 'express';
import * as reportes from '../services/reportes.service.js';

const router = Router();

router.get('/resumen', async (req, res) => res.json(await reportes.resumen()));
router.get('/por-categoria', async (req, res) => res.json(await reportes.porCategoria()));
router.get('/movimientos-por-mes', async (req, res) => res.json(await reportes.movimientosPorMes()));

router.get('/inventario.csv', async (req, res) => {
  const hoy = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="inventario_${hoy}.csv"`);
  res.send(await reportes.inventarioCsv());
});

export default router;
