-- ===================================
-- BDI - Migración 003: Notificaciones por correo
-- Agrega preferencias de notificación a la tabla `usuarios`.
-- Ejecutar UNA SOLA VEZ sobre una BD existente (esquema v2):
--   mysql -u root -p bdi_db < database/migraciones/003_notificaciones_usuarios.sql
-- ===================================

USE bdi_db;

ALTER TABLE usuarios
  ADD COLUMN notif_activas TINYINT(1) NOT NULL DEFAULT 1 AFTER rol;

ALTER TABLE usuarios
  ADD COLUMN notif_umbral_dias INT UNSIGNED NOT NULL DEFAULT 30 AFTER notif_activas;

SELECT 'Migración 003 aplicada: columnas notif_activas y notif_umbral_dias agregadas a usuarios' AS resultado;
