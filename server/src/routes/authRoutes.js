/**
 * BDI - Rutas de Autenticación
 */

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middlewares/authMiddleware');

/**
 * POST /api/auth/google
 * Endpoint para recibir y validar el token de Google.
 */
router.post('/google', authController.googleLogin);

/**
 * GET /api/auth/me
 * Endpoint para obtener el perfil del usuario actual (Requiere Token).
 */
router.get('/me', authMiddleware, authController.getProfile);

module.exports = router;
