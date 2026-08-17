/**
 * BDI - Middleware de Autenticación
 * 
 * Verifica que las peticiones a rutas protegidas incluyan un JWT válido
 * en la cabecera Authorization (formato: Bearer <token>).
 */

const jwt = require('jsonwebtoken');
const config = require('../config/env');

const authMiddleware = (req, res, next) => {
  try {
    // Extraer el token de la cabecera
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      const error = new Error('Acceso denegado. Se requiere token de autenticación.');
      error.statusCode = 401;
      throw error;
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      const error = new Error('Token no proporcionado.');
      error.statusCode = 401;
      throw error;
    }

    // Verificar el token
    const decoded = jwt.verify(token, config.jwtSecret);
    
    // Adjuntar los datos decodificados al request (req.user)
    req.user = decoded;
    
    // Continuar al siguiente middleware/controlador
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      error.message = 'La sesión ha expirado. Por favor, inicia sesión nuevamente.';
    } else if (error.name === 'JsonWebTokenError') {
      error.message = 'Token inválido.';
    }
    error.statusCode = 401;
    next(error);
  }
};

module.exports = authMiddleware;
