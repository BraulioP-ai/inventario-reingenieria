-- =====================================================================
--  Sistema de Inventario - Reingeniería
--  Origen:  Inventory Management System (VB6 + MS Access, inventory_br.mdb)
--  Destino: MySQL 8.x (compatible con MariaDB 10.6+)
--  Script 1 de 2: estructura (tablas, llaves, triggers, vistas)
-- =====================================================================

SET NAMES utf8mb4;

DROP DATABASE IF EXISTS inventario_web;
CREATE DATABASE inventario_web
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
USE inventario_web;

-- ---------------------------------------------------------------------
--  Catálogos (en el original eran texto libre repetido en cada fila)
-- ---------------------------------------------------------------------
CREATE TABLE categorias (
  id_categoria  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre        VARCHAR(60)  NOT NULL,
  descripcion   VARCHAR(255) NULL,
  activo        BOOLEAN      NOT NULL DEFAULT TRUE,
  creado_en     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_categorias_nombre UNIQUE (nombre)
) ENGINE=InnoDB;

CREATE TABLE marcas (
  id_marca   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre     VARCHAR(60) NOT NULL,
  activo     BOOLEAN     NOT NULL DEFAULT TRUE,
  creado_en  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_marcas_nombre UNIQUE (nombre)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
--  Usuarios (el sistema original no tenía autenticación)
-- ---------------------------------------------------------------------
CREATE TABLE usuarios (
  id_usuario     INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre         VARCHAR(100) NOT NULL,
  email          VARCHAR(120) NOT NULL,
  password_hash  CHAR(60)     NOT NULL,              -- bcrypt
  rol            ENUM('ADMIN','ALMACEN') NOT NULL DEFAULT 'ALMACEN',
  activo         BOOLEAN      NOT NULL DEFAULT TRUE,
  creado_en      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_usuarios_email UNIQUE (email)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
--  Productos (antes: tabla Inventory)
--  * Total Cost ya no se guarda: se calcula en la vista v_inventario
--  * stock_actual lo mantienen los triggers de movimientos
-- ---------------------------------------------------------------------
CREATE TABLE productos (
  id_producto     INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  id_categoria    INT UNSIGNED  NOT NULL,
  id_marca        INT UNSIGNED  NOT NULL,
  modelo          VARCHAR(60)   NOT NULL,
  descripcion     VARCHAR(255)  NOT NULL,
  costo_unitario  DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  stock_actual    INT UNSIGNED  NOT NULL DEFAULT 0,
  stock_minimo    INT UNSIGNED  NOT NULL DEFAULT 0,
  activo          BOOLEAN       NOT NULL DEFAULT TRUE,
  creado_en       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
                                 ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT uq_productos_modelo  UNIQUE (id_marca, modelo),
  CONSTRAINT ck_productos_costo   CHECK (costo_unitario >= 0),
  CONSTRAINT fk_productos_categoria FOREIGN KEY (id_categoria)
    REFERENCES categorias(id_categoria) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_productos_marca FOREIGN KEY (id_marca)
    REFERENCES marcas(id_marca) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE INDEX ix_productos_categoria ON productos(id_categoria);
CREATE INDEX ix_productos_marca     ON productos(id_marca);

-- ---------------------------------------------------------------------
--  Movimientos (antes: tabla Stock, con columnas Stock In / Stock Out)
--  Ahora un movimiento = una fila con tipo ENTRADA o SALIDA
-- ---------------------------------------------------------------------
CREATE TABLE movimientos (
  id_movimiento   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  id_producto     INT UNSIGNED  NOT NULL,
  id_usuario      INT UNSIGNED  NOT NULL,
  tipo            ENUM('ENTRADA','SALIDA') NOT NULL,
  cantidad        INT UNSIGNED  NOT NULL,
  costo_unitario  DECIMAL(10,2) NOT NULL,  -- costo al momento del movimiento
  fecha           DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  nota            VARCHAR(255)  NULL,
  CONSTRAINT ck_movimientos_cantidad CHECK (cantidad > 0),
  CONSTRAINT ck_movimientos_costo    CHECK (costo_unitario >= 0),
  CONSTRAINT fk_movimientos_producto FOREIGN KEY (id_producto)
    REFERENCES productos(id_producto) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_movimientos_usuario FOREIGN KEY (id_usuario)
    REFERENCES usuarios(id_usuario) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE INDEX ix_movimientos_producto_fecha ON movimientos(id_producto, fecha);
CREATE INDEX ix_movimientos_fecha          ON movimientos(fecha);

-- ---------------------------------------------------------------------
--  Triggers: el stock se actualiza solo y nunca queda negativo
-- ---------------------------------------------------------------------
DELIMITER $$

CREATE TRIGGER trg_movimientos_validar
BEFORE INSERT ON movimientos
FOR EACH ROW
BEGIN
  DECLARE v_stock INT UNSIGNED;
  SELECT stock_actual INTO v_stock
    FROM productos WHERE id_producto = NEW.id_producto FOR UPDATE;
  IF NEW.tipo = 'SALIDA' AND NEW.cantidad > v_stock THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Stock insuficiente para registrar la salida';
  END IF;
END$$

CREATE TRIGGER trg_movimientos_aplicar
AFTER INSERT ON movimientos
FOR EACH ROW
BEGIN
  IF NEW.tipo = 'ENTRADA' THEN
    UPDATE productos
       SET stock_actual   = stock_actual + NEW.cantidad,
           costo_unitario = NEW.costo_unitario
     WHERE id_producto = NEW.id_producto;
  ELSE
    UPDATE productos
       SET stock_actual = stock_actual - NEW.cantidad
     WHERE id_producto = NEW.id_producto;
  END IF;
END$$

DELIMITER ;

-- ---------------------------------------------------------------------
--  Vistas (sustituyen los cálculos que el VB6 hacía en el formulario)
-- ---------------------------------------------------------------------
CREATE VIEW v_inventario AS
SELECT p.id_producto,
       c.nombre                         AS categoria,
       m.nombre                         AS marca,
       p.modelo,
       p.descripcion,
       p.stock_actual,
       p.stock_minimo,
       p.costo_unitario,
       p.stock_actual * p.costo_unitario AS costo_total,
       (p.stock_actual <= p.stock_minimo) AS bajo_minimo
  FROM productos p
  JOIN categorias c ON c.id_categoria = p.id_categoria
  JOIN marcas     m ON m.id_marca     = p.id_marca
 WHERE p.activo = TRUE;

CREATE VIEW v_kardex AS
SELECT mv.id_movimiento,
       mv.fecha,
       mv.tipo,
       c.nombre  AS categoria,
       m.nombre  AS marca,
       p.modelo,
       p.descripcion,
       mv.cantidad,
       mv.costo_unitario,
       mv.cantidad * mv.costo_unitario AS importe,
       u.nombre  AS usuario,
       mv.nota
  FROM movimientos mv
  JOIN productos  p ON p.id_producto  = mv.id_producto
  JOIN categorias c ON c.id_categoria = p.id_categoria
  JOIN marcas     m ON m.id_marca     = p.id_marca
  JOIN usuarios   u ON u.id_usuario   = mv.id_usuario;
