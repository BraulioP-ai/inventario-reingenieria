# Base de datos — inventario_web

Reingeniería de `inventory_br.mdb` (MS Access, VB6) a MySQL 8.

## Cargar

El sistema la crea solo la primera vez que arranca (y `--reset` la recarga). Para hacerlo a mano:

    mysql -u root -p < 01_esquema.sql          # Linux, macOS, CMD
    mysql -u root -p < 02_datos.sql

    mysql -u root -p -e "source bd/01_esquema.sql"   # PowerShell (no acepta "<")
    mysql -u root -p -e "source bd/02_datos.sql"

`01_esquema.sql` borra y recrea la BD `inventario_web`. Probado en MySQL 8.0 y MariaDB 10.11.

Usuarios de prueba:
- admin@inventario.local / Admin123* (ADMIN)
- almacen@inventario.local / Almacen123* (ALMACEN)

## Contenido

| Objeto | Tipo | Propósito |
|---|---|---|
| categorias, marcas | tabla | Catálogos (antes texto repetido) |
| productos | tabla | Antes `Inventory` |
| movimientos | tabla | Antes `Stock` (Stock In / Stock Out) |
| usuarios | tabla | Nuevo: el original no tenía login |
| trg_movimientos_validar | trigger | Rechaza salidas mayores al stock |
| trg_movimientos_aplicar | trigger | Actualiza stock y costo al registrar un movimiento |
| v_inventario | vista | Inventario con costo total calculado y alerta de stock mínimo |
| v_kardex | vista | Historial de movimientos con importe |

Datos de ejemplo: 7 categorías, 8 marcas, 20 productos, 158 movimientos (sep–oct 2026), 2 usuarios.

## Mapeo original → nuevo

| Original (Access) | Nuevo (MySQL) | Cambio |
|---|---|---|
| Inventory.Category | categorias.nombre + productos.id_categoria | Normalizado, FK |
| Inventory.Brand | marcas.nombre + productos.id_marca | Normalizado, FK |
| Inventory.Item Description | productos.descripcion | — |
| Inventory.Model Number | productos.modelo | Único por marca |
| Inventory.Stock | productos.stock_actual | Lo mantienen los triggers |
| Inventory.CPU | productos.costo_unitario | DECIMAL en lugar de texto |
| Inventory.TCost | v_inventario.costo_total | Se calcula, no se guarda |
| Stock.Date | movimientos.fecha | DATETIME en lugar de texto dd/mm/yyyy |
| Stock.Category/Brand/Description/Model | movimientos.id_producto | Se elimina la duplicación |
| Stock.Stock In / Stock Out | movimientos.tipo + cantidad | Un movimiento por fila |
| — | movimientos.id_usuario | Nuevo: trazabilidad |
| — | productos.stock_minimo | Nuevo: alertas de resurtido |

## Normalización

- **1FN:** valores atómicos y PK en todas las tablas (el original no tenía PK).
- **2FN:** sin dependencias parciales (todas las PK son simples).
- **3FN:** categoría y marca salen a sus propias tablas; el costo total (dato derivado) deja de almacenarse.
