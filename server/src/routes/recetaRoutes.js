/**
 * BDI - Rutas de Recetas (IA)
 */

const express = require('express');
const router = express.Router();
const recetaController = require('../controllers/recetaController');
const authMiddleware = require('../middlewares/authMiddleware');

// Proteger las rutas con el middleware de autenticación
router.use(authMiddleware);

/**
 * POST /api/recetas/analizar
 * Recibe application/json con la imagenBase64 y la procesa.
 */
router.post('/analizar', recetaController.analizarReceta);

/**
 * POST /api/recetas/guardar
 * Persiste la receta validada por el usuario junto con sus medicamentos.
 */
router.post('/guardar', recetaController.guardarReceta);

/**
 * GET /api/recetas
 * Historial de recetas del usuario autenticado (con paginación).
 */
router.get('/', recetaController.listarRecetas);

/**
 * GET /api/recetas/:id
 * Detalle completo de una receta (con imagen y medicamentos).
 */
router.get('/:id', recetaController.obtenerReceta);

/**
 * PUT /api/recetas/:id
 * Actualiza los datos clínicos y medicamentos de una receta.
 */
router.put('/:id', recetaController.actualizarReceta);

/**
 * DELETE /api/recetas/:id
 * Elimina una receta del historial.
 */
router.delete('/:id', recetaController.eliminarReceta);

module.exports = router;
