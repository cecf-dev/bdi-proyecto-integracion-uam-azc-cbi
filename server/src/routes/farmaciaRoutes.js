/**
 * BDI - Rutas de Farmacias (SerpApi + Leaflet)
 */

const express = require('express');
const router = express.Router();
const farmaciaController = require('../controllers/farmaciaController');
const authMiddleware = require('../middlewares/authMiddleware');

// Proteger las rutas con el middleware de autenticación
router.use(authMiddleware);

/**
 * POST /api/farmacias/buscar
 * Busca precios de un medicamento (Google Shopping).
 */
router.post('/buscar', farmaciaController.buscarPrecios);

/**
 * POST /api/farmacias/cercanas
 * Busca farmacias físicas cerca de una coordenada (Google Maps).
 */
router.post('/cercanas', farmaciaController.buscarCercanas);

/**
 * GET /api/farmacias/historial
 * Historial de búsquedas de precios del usuario.
 */
router.get('/historial', farmaciaController.historial);

module.exports = router;
