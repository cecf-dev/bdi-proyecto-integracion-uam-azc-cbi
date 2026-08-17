/**
 * BDI - Rutas de Inventario (Botiquín)
 */

const express = require('express');
const router = express.Router();
const inventarioController = require('../controllers/inventarioController');
const authMiddleware = require('../middlewares/authMiddleware');

// Proteger las rutas con el middleware de autenticación
router.use(authMiddleware);

/**
 * GET /api/inventario
 * Lista el botiquín del usuario con resumen de alertas de caducidad.
 */
router.get('/', inventarioController.listar);

/**
 * GET /api/inventario/alertas
 * Recordatorios de caducidad (umbral configurable en días).
 */
router.get('/alertas', inventarioController.alertas);

/**
 * POST /api/inventario
 * Agrega un medicamento al botiquín.
 */
router.post('/', inventarioController.crear);

/**
 * POST /api/inventario/batch
 * Agrega un lote de medicamentos al botiquín (transaccional).
 * Usado por la conexión receta → botiquín.
 */
router.post('/batch', inventarioController.crearBatch);

/**
 * PUT /api/inventario/:id
 * Actualiza un medicamento del botiquín.
 */
router.put('/:id', inventarioController.actualizar);

/**
 * DELETE /api/inventario/:id
 * Elimina un medicamento del botiquín.
 */
router.delete('/:id', inventarioController.eliminar);

module.exports = router;
