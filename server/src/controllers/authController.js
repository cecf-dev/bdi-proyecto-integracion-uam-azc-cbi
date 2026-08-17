/**
 * BDI - Controlador de Autenticación
 * 
 * Lógica para verificar el token OAuth de Google y generar el JWT local.
 */

const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const config = require('../config/env');
const userModel = require('../models/userModel');

// Instancia del cliente OAuth2 de Google
const client = new OAuth2Client(config.googleClientId);

/**
 * Función auxiliar para generar nuestro propio JWT.
 * @param {Object} user 
 * @returns {string} Token firmado
 */
const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email, rol: user.rol },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );
};

const authController = {
  /**
   * POST /api/auth/google
   * Recibe el 'credential' desde el frontend, lo verifica con Google
   * y devuelve un JWT de nuestra app junto con los datos del usuario.
   */
  async googleLogin(req, res, next) {
    try {
      const { credential } = req.body;

      if (!credential) {
        const error = new Error('Token de Google no proporcionado');
        error.statusCode = 400;
        throw error;
      }

      // 1. Verificar el token directamente con la librería de Google
      const ticket = await client.verifyIdToken({
        idToken: credential,
        audience: config.googleClientId,
      });

      // 2. Extraer información del payload de Google
      const payload = ticket.getPayload();
      const { sub: googleId, email, name, picture } = payload;

      // 3. Buscar si el usuario ya existe en nuestra base de datos
      let user = await userModel.findByEmail(email);

      if (user) {
        // Usuario existente: actualizamos sus datos (nombre y foto por si cambiaron)
        await userModel.updateData(user.id, { nombre: name, avatarUrl: picture });
        user.nombre = name;
        user.avatar_url = picture;
      } else {
        // Usuario nuevo: lo creamos en la base de datos
        user = await userModel.create({
          googleId,
          email,
          nombre: name,
          avatarUrl: picture,
        });
      }

      // 4. Generar el JWT para la sesión local
      const token = generateToken(user);

      // 5. Responder al cliente
      res.status(200).json({
        success: true,
        message: 'Autenticación exitosa',
        token,
        user: {
          id: user.id,
          nombre: user.nombre,
          email: user.email,
          avatarUrl: user.avatar_url,
          rol: user.rol,
        }
      });

    } catch (error) {
      console.error('Error en googleLogin:', error);
      // Personalizar el error si es fallo de verificación de Google
      if (error.message.includes('Token used too late') || error.message.includes('Invalid token signature')) {
        error.message = 'Token de Google inválido o expirado';
        error.statusCode = 401;
      }
      next(error);
    }
  },

  /**
   * GET /api/auth/me
   * Devuelve los datos del usuario autenticado (requiere middleware de autenticación).
   */
  async getProfile(req, res, next) {
    try {
      const userId = req.user.id; // Viene del JWT middleware
      const user = await userModel.findById(userId);

      if (!user) {
        const error = new Error('Usuario no encontrado');
        error.statusCode = 404;
        throw error;
      }

      res.json({
        success: true,
        user: {
          id: user.id,
          nombre: user.nombre,
          email: user.email,
          avatarUrl: user.avatar_url,
          rol: user.rol,
        }
      });
    } catch (error) {
      next(error);
    }
  }
};

module.exports = authController;
