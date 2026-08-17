-- ===================================
-- BDI - Esquema de Base de Datos (v3)
-- Botiquín Digital Inteligente
-- ===================================
-- Ejecutar: mysql -u root -p < database/schema.sql
-- Motor: InnoDB | Charset: utf8mb4 (soporta acentos españoles y emojis)

-- Crear la base de datos si no existe
CREATE DATABASE IF NOT EXISTS bdi_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE bdi_db;

-- ===================================
-- Tabla: usuarios
-- Datos de autenticación (Google OAuth) y perfil
-- ===================================
CREATE TABLE IF NOT EXISTS usuarios (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  google_id VARCHAR(255) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  nombre VARCHAR(255) NOT NULL,
  avatar_url TEXT,
  rol ENUM('paciente', 'admin') NOT NULL DEFAULT 'paciente',
  notif_activas TINYINT(1) NOT NULL DEFAULT 1,
  notif_umbral_dias INT UNSIGNED NOT NULL DEFAULT 30,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_email (email),
  INDEX idx_google_id (google_id)
) ENGINE=InnoDB;

-- ===================================
-- Tabla: medicamentos
-- Inventario personal del botiquín del usuario
-- ===================================
CREATE TABLE IF NOT EXISTS medicamentos (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT UNSIGNED NOT NULL,
  nombre VARCHAR(255) NOT NULL,
  principio_activo VARCHAR(255),
  presentacion VARCHAR(255),
  dosis VARCHAR(100),
  cantidad INT NOT NULL DEFAULT 0,
  unidad VARCHAR(50) NOT NULL DEFAULT 'piezas',
  fecha_caducidad DATE,
  lote VARCHAR(100),
  codigo_barras VARCHAR(100),
  notas TEXT,
  imagen_url TEXT,
  estado ENUM('vigente', 'por_vencer', 'caducado') NOT NULL DEFAULT 'vigente',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_medicamentos_usuario
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,

  INDEX idx_usuario (usuario_id),
  INDEX idx_caducidad (fecha_caducidad),
  INDEX idx_estado (estado)
) ENGINE=InnoDB;

-- ===================================
-- Tabla: recetas
-- Historial de recetas médicas digitalizadas.
-- La imagen se guarda en Base64 (JSON pesado, sin Multer):
-- LONGTEXT admite hasta ~4 GB, necesario para fotografías.
-- ===================================
CREATE TABLE IF NOT EXISTS recetas (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT UNSIGNED NOT NULL,
  imagen_base64 LONGTEXT NOT NULL,
  texto_extraido LONGTEXT,
  datos_estructurados JSON,
  paciente_nombre VARCHAR(255),
  medico_nombre VARCHAR(255),
  medico_cedula VARCHAR(100),
  fecha_emision DATE,
  diagnostico TEXT,
  codigo_cie10 VARCHAR(20),
  estado ENUM('pendiente', 'procesada', 'error') NOT NULL DEFAULT 'pendiente',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_recetas_usuario
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,

  INDEX idx_usuario_receta (usuario_id),
  INDEX idx_estado_receta (estado)
) ENGINE=InnoDB;

-- ===================================
-- Tabla: receta_medicamentos
-- Relación 1:N entre recetas y medicamentos prescritos
-- ===================================
CREATE TABLE IF NOT EXISTS receta_medicamentos (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  receta_id INT UNSIGNED NOT NULL,
  nombre_medicamento VARCHAR(255) NOT NULL,
  dosis VARCHAR(100),
  frecuencia VARCHAR(255),
  duracion VARCHAR(100),
  indicaciones TEXT,

  CONSTRAINT fk_recetamed_receta
    FOREIGN KEY (receta_id) REFERENCES recetas(id) ON DELETE CASCADE,

  INDEX idx_receta (receta_id)
) ENGINE=InnoDB;

-- ===================================
-- Tabla: busquedas_precios
-- Historial de búsquedas de precios en farmacias (SerpApi)
-- ===================================
CREATE TABLE IF NOT EXISTS busquedas_precios (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT UNSIGNED NOT NULL,
  medicamento_nombre VARCHAR(255) NOT NULL,
  resultados JSON,
  fuente VARCHAR(100) NOT NULL DEFAULT 'google_shopping',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_busquedas_usuario
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,

  INDEX idx_usuario_busqueda (usuario_id)
) ENGINE=InnoDB;

-- ===================================
-- MIGRACIONES: aplicar si la BD ya existía con un esquema anterior.
-- Para automatizar la migración actual ejecutar: database/migraciones/003_notificaciones_usuarios.sql
-- ===================================
-- v1 → v2:
-- ALTER TABLE recetas CHANGE COLUMN imagen_url imagen_base64 LONGTEXT NOT NULL;
-- ALTER TABLE recetas ADD COLUMN paciente_nombre VARCHAR(255) AFTER datos_estructurados;

-- Mensaje de confirmación
SELECT 'Esquema BDI v3 creado exitosamente' AS resultado;
