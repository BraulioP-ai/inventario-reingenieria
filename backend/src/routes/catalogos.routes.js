import { Router } from 'express';
import { permitir } from '../middleware/auth.js';
import { crearServicioCatalogo } from '../services/catalogos.service.js';
import * as E from './esquemas.js';

// Fábrica de rutas CRUD para un catálogo (categorías o marcas).
export function rutasCatalogo(clave, esquema) {
  const servicio = crearServicioCatalogo(clave);
  const parcial = E.catalogoParcial(esquema);
  const router = Router();

  router.get('/', async (req, res) => {
    const incluirInactivos = req.query.todos === 'true' && req.usuario.rol === 'ADMIN';
    res.json(await servicio.listar({ incluirInactivos }));
  });

  router.get('/:id', async (req, res) => {
    const { id } = E.idParam.parse(req.params);
    res.json(await servicio.obtener(id));
  });

  router.post('/', permitir('ADMIN'), async (req, res) => {
    res.status(201).json(await servicio.crear(esquema.parse(req.body)));
  });

  router.put('/:id', permitir('ADMIN'), async (req, res) => {
    const { id } = E.idParam.parse(req.params);
    res.json(await servicio.actualizar(id, parcial.parse(req.body)));
  });

  router.delete('/:id', permitir('ADMIN'), async (req, res) => {
    const { id } = E.idParam.parse(req.params);
    res.json(await servicio.desactivar(id));
  });

  return router;
}
