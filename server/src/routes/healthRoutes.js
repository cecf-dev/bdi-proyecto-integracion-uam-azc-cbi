/**
 * BDI - Rutas de Health Check
 * 
 * Endpoint para verificar que el servidor está activo
 * y puede conectar con la base de datos.
 */

const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');

/**
 * GET /api/health
 * 
 * Verifica el estado del servidor y la conexión a MySQL.
 * Retorna información básica del sistema.
 */
router.get('/', async (req, res) => {
  let dbStatus = 'disconnected';

  try {
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    dbStatus = 'connected';
  } catch (error) {
    dbStatus = `error: ${error.message}`;
  }

  res.json({
    success: true,
    data: {
      service: 'BDI API',
      version: '1.0.0',
      status: 'running',
      database: dbStatus,
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString(),
    },
  });
});

module.exports = router;
