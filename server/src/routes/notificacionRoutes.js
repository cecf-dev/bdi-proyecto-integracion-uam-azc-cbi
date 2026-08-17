/**
 * BDI - Rutas de Notificaciones
 */

const express = require('express');
const router = express.Router();
const notificacionController = require('../controllers/notificacionController');
const authMiddleware = require('../middlewares/authMiddleware');

// Proteger las rutas con el middleware de autenticación
router.use(authMiddleware);

/**
 * GET /api/notificaciones/preferencias
 * Preferencias de notificación del usuario autenticado.
 */
router.get('/preferencias', notificacionController.obtenerPreferencias);

/**
 * PUT /api/notificaciones/preferencias
 * Actualiza las preferencias de notificación del usuario.
 */
router.put('/preferencias', notificacionController.actualizarPreferencias);

/**
 * POST /api/notificaciones/probar
 * Envía un correo de prueba al usuario autenticado.
 */
router.post('/probar', notificacionController.probar);

module.exports = router;
