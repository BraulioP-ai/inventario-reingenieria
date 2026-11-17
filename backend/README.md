# API — Sistema de Inventario (reingeniería)

API REST en Node.js + Express sobre MySQL 8. Sustituye la lógica que el sistema original (VB6 + Access) tenía mezclada en los formularios.

## Requisitos

- Node.js 20 o superior
- MySQL 8.0.16+ o MariaDB 10.6+ encendido

## Instalación y arranque

Lo normal es usar los comandos de la raíz del repositorio (`npm install` y `npm start`). Desde esta carpeta:

    npm install
    npm start       # o: npm run dev (con recarga automática)

La primera vez, `npm start` pregunta los datos de conexión a MySQL, los guarda en `.env`, crea la BD `inventario_web` con los datos de ejemplo si no existe y deja la API en `http://localhost:3000/api`. También puedes crear el `.env` a mano a partir de `.env.example`.

Opciones: `npm start -- --reset` (recarga los datos de ejemplo), `--configurar`, `--puerto <n>`, `--no-abrir`, `--ayuda`.

## Pruebas

    npm test

Son 16 pruebas de integración contra la BD real (login, permisos, validaciones, flujo de stock, inyección SQL, reportes), probadas en MySQL 8.0 y MariaDB 10.11. Agregan algunos registros; para dejar los datos como al inicio, usa `npm start -- --reset --si`.

## Estructura

    src/
      index.js      punto de entrada
      server.js     arranque: configuración, BD, puerto libre, navegador
      arranque/     asistente de conexión, instalación de la BD, diagnóstico de errores
      recursos.js   scripts SQL y frontend (del disco o embebidos en el ejecutable)
      config/       env.js (configuración), db.js (pool de conexiones)
      middleware/   auth.js (JWT y roles), error-handler.js
      routes/       una ruta por recurso + esquemas.js (validaciones)
      services/     acceso a datos (SQL parametrizado)
      app.js        arma la aplicación Express
    test/           pruebas de integración

Capas: **ruta** (recibe y valida) → **servicio** (reglas y SQL) → **BD** (integridad, triggers y vistas).

## Autenticación

`POST /api/auth/login` devuelve un token. Todas las demás rutas (salvo `/api/salud`) piden el encabezado:

    Authorization: Bearer <token>

| Rol | Puede |
|---|---|
| ADMIN | Todo |
| ALMACEN | Consultar todo y registrar movimientos |

## Endpoints

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| GET | /api/salud | público | Estado de la API y la BD |
| POST | /api/auth/login | público | `{ email, password }` → `{ token, usuario }` |
| GET | /api/auth/me | todos | Usuario de la sesión |
| GET | /api/categorias | todos | Lista (`?todos=true` incluye inactivas, solo ADMIN) |
| POST / PUT / DELETE | /api/categorias[/:id] | ADMIN | Alta, cambio, baja lógica |
| GET | /api/marcas | todos | Igual que categorías |
| POST / PUT / DELETE | /api/marcas[/:id] | ADMIN | Igual que categorías |
| GET | /api/productos | todos | Filtros: `categoria`, `marca`, `q` (modelo/descripción), `bajoMinimo=true` |
| GET | /api/productos/:id | todos | Detalle |
| POST | /api/productos | ADMIN | Alta; `stock_inicial` opcional genera una ENTRADA |
| PUT | /api/productos/:id | ADMIN | Cambios (el stock **no** se edita aquí) |
| DELETE | /api/productos/:id | ADMIN | Baja lógica |
| GET | /api/movimientos | todos | Filtros: `producto`, `tipo`, `desde`, `hasta` (AAAA-MM-DD), `pagina`, `porPagina` |
| POST | /api/movimientos | ADMIN, ALMACEN | `{ id_producto, tipo, cantidad, costo_unitario?, nota? }` |
| GET | /api/reportes/resumen | todos | Valor de inventario, unidades, alertas, últimos 30 días |
| GET | /api/reportes/por-categoria | todos | Valor y unidades por categoría |
| GET | /api/reportes/movimientos-por-mes | todos | Entradas y salidas por mes |
| GET | /api/reportes/inventario.csv | todos | Exporta el inventario para Excel |
| GET / POST / PUT | /api/usuarios[/:id] | ADMIN | Gestión de usuarios |

## Códigos de respuesta

| Código | Cuándo |
|---|---|
| 400 | Datos inválidos (incluye `detalles` por campo) |
| 401 | Sin sesión, token inválido o credenciales incorrectas |
| 403 | El rol no tiene permiso |
| 404 | No existe el recurso |
| 409 | Conflicto: duplicado, stock insuficiente, registro en uso |

## Qué cambió respecto al VB6

| Problema en el original | Solución |
|---|---|
| Ruta del .mdb fija en el código | Variables de entorno (`.env`) |
| SQL armado concatenando texto del ComboBox | Consultas parametrizadas (`?`) |
| Lógica en eventos del formulario (`DblClick`, `Form_Load`) | Capa de servicios separada de la interfaz |
| Validación solo en el formulario | Validación en el servidor (zod) y en la BD (CHECK, FK, triggers) |
| Sin usuarios ni permisos | Login con JWT, contraseñas con bcrypt, roles |
| Costo total calculado y guardado como texto | Se calcula al consultar |
| Stock editable a mano | Solo cambia por movimientos, con usuario y fecha |
| Exportación FlexGrid → Excel | Endpoint CSV compatible con Excel |
