import { z } from 'zod';

// Validaciones del lado del servidor. En el VB6 solo se validaba en el formulario.
const texto = (max) => z.string().trim().min(1, 'Es obligatorio').max(max);
const id = z.coerce.number().int().positive();
const dinero = z.coerce.number().min(0, 'No puede ser negativo').max(99999999.99)
  .transform((n) => Math.round(n * 100) / 100);
const entero = z.coerce.number().int().min(0, 'No puede ser negativo');
const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato AAAA-MM-DD');
const booleanoQuery = z.enum(['true', 'false', '1', '0']).transform((v) => v === 'true' || v === '1');

export const idParam = z.object({ id });

export const login = z.object({
  email: z.string().trim().toLowerCase().email('Correo inválido'),
  password: z.string().min(1, 'Es obligatoria'),
});

export const categoria = z.object({
  nombre: texto(60),
  descripcion: z.string().trim().max(255).nullish(),
});
export const marca = z.object({ nombre: texto(60) });
export const catalogoParcial = (esquema) => esquema.partial().extend({ activo: z.boolean().optional() });

export const productoNuevo = z.object({
  id_categoria: id,
  id_marca: id,
  modelo: texto(60),
  descripcion: texto(255),
  costo_unitario: dinero,
  stock_minimo: entero.default(0),
  stock_inicial: entero.default(0),
});
export const productoCambios = productoNuevo
  .omit({ stock_inicial: true })
  .partial()
  .extend({ activo: z.boolean().optional() })
  .strict(); // rechaza "stock_actual": el stock solo cambia con movimientos

export const productosQuery = z.object({
  categoria: id.optional(),
  marca: id.optional(),
  q: z.string().trim().max(60).optional(),
  bajoMinimo: booleanoQuery.optional(),
});

export const movimientoNuevo = z.object({
  id_producto: id,
  tipo: z.enum(['ENTRADA', 'SALIDA']),
  cantidad: z.coerce.number().int().positive('Debe ser mayor a 0'),
  costo_unitario: dinero.optional(),
  nota: z.string().trim().max(255).optional(),
});

export const movimientosQuery = z.object({
  producto: id.optional(),
  tipo: z.enum(['ENTRADA', 'SALIDA']).optional(),
  desde: fecha.optional(),
  hasta: fecha.optional(),
  pagina: z.coerce.number().int().positive().default(1),
  porPagina: z.coerce.number().int().min(1).max(100).default(25),
});

const password = z.string().min(8, 'Mínimo 8 caracteres').max(72);
export const usuarioNuevo = z.object({
  nombre: texto(100),
  email: z.string().trim().toLowerCase().email('Correo inválido').max(120),
  password,
  rol: z.enum(['ADMIN', 'ALMACEN']).default('ALMACEN'),
});
export const usuarioCambios = usuarioNuevo.partial().extend({ activo: z.boolean().optional() });
