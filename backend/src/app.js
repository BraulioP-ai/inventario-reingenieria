import path from 'node:path';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import { env } from './config/env.js';
import { query } from './config/db.js';
import { autenticar } from './middleware/auth.js';
import { errorHandler, notFound } from './middleware/error-handler.js';
import authRoutes from './routes/auth.routes.js';
import { rutasCatalogo } from './routes/catalogos.routes.js';
import productosRoutes from './routes/productos.routes.js';
import movimientosRoutes from './routes/movimientos.routes.js';
import reportesRoutes from './routes/reportes.routes.js';
import usuariosRoutes from './routes/usuarios.routes.js';
import * as E from './routes/esquemas.js';
import { enEjecutable, frontend } from './recursos.js';

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
};

// Sirve el frontend embebido en el ejecutable (sin archivos en disco).
function servirDesdeMemoria(archivos) {
  const cache = new Map(Object.entries(archivos).map(([ruta, b64]) => [ruta, Buffer.from(b64, 'base64')]));
  return (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    let ruta = req.path;
    if (!cache.has(ruta)) ruta = '/index.html'; // rutas de React (SPA)
    res.type(TIPOS[path.extname(ruta)] ?? 'application/octet-stream');
    if (ruta.startsWith('/assets/')) res.set('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(cache.get(ruta));
  };
}

export function crearApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.corsOrigin }));
  app.use(express.json({ limit: '100kb' }));
  if (process.env.NODE_ENV !== 'test' && !enEjecutable()) app.use(morgan('dev'));

  app.get('/api/salud', async (req, res) => {
    await query('SELECT 1');
    res.json({ estado: 'ok', bd: 'conectada' });
  });

  app.use('/api/auth', authRoutes);

  // Todo lo demás requiere sesión
  app.use('/api', autenticar);
  app.use('/api/categorias', rutasCatalogo('categorias', E.categoria));
  app.use('/api/marcas', rutasCatalogo('marcas', E.marca));
  app.use('/api/productos', productosRoutes);
  app.use('/api/movimientos', movimientosRoutes);
  app.use('/api/reportes', reportesRoutes);
  app.use('/api/usuarios', usuariosRoutes);
  app.use('/api', notFound);

  // Frontend: embebido (ejecutable) o desde frontend/dist (código fuente).
  // Así la aplicación completa corre con un solo comando en un solo puerto.
  const web = frontend();
  if (web?.tipo === 'memoria') {
    app.use(servirDesdeMemoria(web.archivos));
  } else if (web?.tipo === 'disco') {
    app.use(express.static(web.dist));
    app.get(/^(?!\/api\/).*/, (req, res) => res.sendFile(path.join(web.dist, 'index.html')));
  } else {
    app.get('/', (req, res) => res.type('text').send(
      'La API funciona, pero falta compilar el frontend.\nEjecuta "npm run build" en la raíz del proyecto y reinicia.'));
  }

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
