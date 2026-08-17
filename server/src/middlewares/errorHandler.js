/**
 * BDI - Middleware de Manejo de Errores
 * 
 * Captura todos los errores no manejados y devuelve una respuesta
 * JSON consistente. En desarrollo incluye el stack trace.
 */

/**
 * Middleware para rutas no encontradas (404).
 * Se registra después de todas las rutas definidas.
 */
const notFound = (req, res, next) => {
  const error = new Error(`Ruta no encontrada: ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
};

/**
 * Middleware global de manejo de errores.
 * Captura cualquier error lanzado en la cadena de middlewares/rutas.
 * 
 * @param {Error} err - Error capturado
 * @param {import('express').Request} req 
 * @param {import('express').Response} res 
 * @param {import('express').NextFunction} next 
 */
const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Error interno del servidor';

  console.error(`❌ [${statusCode}] ${message}`);
  if (process.env.NODE_ENV === 'development' && err.stack) {
    console.error(err.stack);
  }

  res.status(statusCode).json({
    success: false,
    error: {
      message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    },
  });
};

module.exports = { notFound, errorHandler };
