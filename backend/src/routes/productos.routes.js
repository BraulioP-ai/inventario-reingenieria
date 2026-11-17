import { Router } from 'express';
import { permitir } from '../middleware/auth.js';
import * as productos from '../services/productos.service.js';
import * as E from './esquemas.js';

const router = Router();

router.get('/', async (req, res) => {
  res.json(await productos.listar(E.productosQuery.parse(req.query)));
});

router.get('/:id', async (req, res) => {
  const { id } = E.idParam.parse(req.params);
  res.json(await productos.obtener(id));
});

router.post('/', permitir('ADMIN'), async (req, res) => {
  const datos = E.productoNuevo.parse(req.body);
  res.status(201).json(await productos.crear(datos, req.usuario.id));
});

router.put('/:id', permitir('ADMIN'), async (req, res) => {
  const { id } = E.idParam.parse(req.params);
  res.json(await productos.actualizar(id, E.productoCambios.parse(req.body)));
});

router.delete('/:id', permitir('ADMIN'), async (req, res) => {
  const { id } = E.idParam.parse(req.params);
  res.json(await productos.desactivar(id));
});

export default router;
