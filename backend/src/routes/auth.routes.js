import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { autenticar, firmarToken } from '../middleware/auth.js';
import * as usuarios from '../services/usuarios.service.js';
import { HttpError } from '../utils/http-error.js';
import * as E from './esquemas.js';

const router = Router();

// Hash ficticio para que un correo inexistente tarde lo mismo que uno real.
const HASH_FICTICIO = '$2b$10$1wHZ1rqYUzl4K8aj9RFwZuw4kIBylWZkJLpCyFhZMOsE1GnlQFYMa';

router.post('/login', async (req, res) => {
  const { email, password } = E.login.parse(req.body);
  const usuario = await usuarios.buscarPorEmail(email);
  const ok = await bcrypt.compare(password, usuario?.password_hash ?? HASH_FICTICIO);

  if (!usuario || !ok || !usuario.activo) {
    throw new HttpError(401, 'Correo o contraseña incorrectos');
  }
  res.json({
    token: firmarToken(usuario),
    usuario: { id_usuario: usuario.id_usuario, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol },
  });
});

router.get('/me', autenticar, async (req, res) => {
  res.json(await usuarios.obtener(req.usuario.id));
});

export default router;
