import { Router } from 'express';
import { permitir } from '../middleware/auth.js';
import * as movimientos from '../services/movimientos.service.js';
import * as E from './esquemas.js';

const router = Router();

router.get('/', async (req, res) => {
  res.json(await movimientos.listar(E.movimientosQuery.parse(req.query)));
});

router.get('/:id', async (req, res) => {
  const { id } = E.idParam.parse(req.params);
  res.json(await movimientos.obtener(id));
});

router.post('/', permitir('ADMIN', 'ALMACEN'), async (req, res) => {
  const datos = E.movimientoNuevo.parse(req.body);
  res.status(201).json(await movimientos.registrar(datos, req.usuario.id));
});

export default router;
