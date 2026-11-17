import { Router } from 'express';
import { permitir } from '../middleware/auth.js';
import * as usuarios from '../services/usuarios.service.js';
import * as E from './esquemas.js';

const router = Router();
router.use(permitir('ADMIN'));

router.get('/', async (req, res) => res.json(await usuarios.listar()));

router.get('/:id', async (req, res) => {
  const { id } = E.idParam.parse(req.params);
  res.json(await usuarios.obtener(id));
});

router.post('/', async (req, res) => {
  res.status(201).json(await usuarios.crear(E.usuarioNuevo.parse(req.body)));
});

router.put('/:id', async (req, res) => {
  const { id } = E.idParam.parse(req.params);
  res.json(await usuarios.actualizar(id, E.usuarioCambios.parse(req.body), req.usuario.id));
});

export default router;
