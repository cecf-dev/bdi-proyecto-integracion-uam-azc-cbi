/**
 * BDI - Controlador de Notificaciones
 * 
 * Preferencias de notificación por usuario y envío de correo de prueba.
 * El recordatorio diario automático lo ejecuta el scheduler (server.js).
 */

const notificacionModel = require('../models/notificacionModel');
const notificacionService = require('../services/notificacionService');

const notificacionController = {
  /**
   * GET /api/notificaciones/preferencias
   * Devuelve el correo, nombre y preferencias de notificación del usuario.
   */
  async obtenerPreferencias(req, res, next) {
    try {
      const usuarioId = req.user?.id;
      if (!usuarioId) {
        const error = new Error('Usuario no autenticado');
        error.statusCode = 401;
        throw error;
      }

      const prefs = await notificacionModel.getPreferencias(usuarioId);

      if (!prefs) {
        const error = new Error('Usuario no encontrado');
        error.statusCode = 404;
        throw error;
      }

      res.json({
        success: true,
        message: 'Preferencias de notificación obtenidas correctamente.',
        data: prefs,
      });
    } catch (error) {
      console.error('Error en obtenerPreferencias:', error);
      if (!error.statusCode) {
        error.statusCode = 500;
        error.message = 'Error interno al obtener las preferencias de notificación.';
      }
      next(error);
    }
  },

  /**
   * PUT /api/notificaciones/preferencias
   * Actualiza las preferencias de notificación del usuario.
   * Body: { notif_activas: boolean, notif_umbral_dias: 1..365 }
   */
  async actualizarPreferencias(req, res, next) {
    try {
      const usuarioId = req.user?.id;
      if (!usuarioId) {
        const error = new Error('Usuario no autenticado');
        error.statusCode = 401;
        throw error;
      }

      const { notif_activas, notif_umbral_dias } = req.body;

      if (typeof notif_activas !== 'boolean') {
        const error = new Error('El campo "notif_activas" debe ser un booleano (true/false)');
        error.statusCode = 400;
        throw error;
      }

      let umbral = parseInt(notif_umbral_dias, 10);
      if (Number.isNaN(umbral) || umbral < 1) umbral = 30;
      if (umbral > 365) umbral = 365;

      const prefs = await notificacionModel.updatePreferencias(usuarioId, {
        notif_activas,
        notif_umbral_dias: umbral,
      });

      if (!prefs) {
        const error = new Error('Usuario no encontrado');
        error.statusCode = 404;
        throw error;
      }

      res.json({
        success: true,
        message: 'Preferencias de notificación actualizadas correctamente.',
        data: prefs,
      });
    } catch (error) {
      console.error('Error en actualizarPreferencias:', error);
      if (!error.statusCode) {
        error.statusCode = 500;
        error.message = 'Error interno al actualizar las preferencias de notificación.';
      }
      next(error);
    }
  },

  /**
   * POST /api/notificaciones/probar
   * Envía un correo de prueba al usuario autenticado con su resumen real
   * de alertas. Permite verificar la entrega sin spamear a otros usuarios.
   */
  async probar(req, res, next) {
    try {
      const usuarioId = req.user?.id;
      if (!usuarioId) {
        const error = new Error('Usuario no autenticado');
        error.statusCode = 401;
        throw error;
      }

      const resultado = await notificacionService.enviarCorreoPrueba({ id: usuarioId });

      res.json({
        success: true,
        message: `Correo de prueba enviado a ${resultado.enviado_a}.`,
        data: resultado,
      });
    } catch (error) {
      console.error('Error en probar notificación:', error);
      if (!error.statusCode) {
        error.statusCode = 500;
        error.message = 'Error interno al enviar el correo de prueba.';
      }
      next(error);
    }
  },
};

module.exports = notificacionController;
