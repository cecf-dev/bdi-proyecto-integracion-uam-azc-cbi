/**
 * BDI - Modelo de Notificaciones (Capa de Datos)
 * 
 * Funciones para leer/actualizar las preferencias de notificación por
 * correo del usuario (tabla `usuarios`) y para obtener la lista de
 * destinatarios del recordatorio diario.
 */

const { pool } = require('../config/db');

const notificacionModel = {
  /**
   * Obtiene las preferencias de notificación del usuario.
   * @param {number} usuarioId
   * @returns {Promise<Object|null>} { email, nombre, notif_activas, notif_umbral_dias }
   */
  async getPreferencias(usuarioId) {
    const [rows] = await pool.query(
      `SELECT email, nombre, notif_activas, notif_umbral_dias
         FROM usuarios
        WHERE id = ?`,
      [usuarioId]
    );
    if (rows.length === 0) return null;

    return {
      email: rows[0].email,
      nombre: rows[0].nombre,
      notif_activas: Boolean(rows[0].notif_activas),
      notif_umbral_dias: rows[0].notif_umbral_dias,
    };
  },

  /**
   * Actualiza las preferencias de notificación del usuario.
   * @param {number} usuarioId
   * @param {Object} prefs - { notif_activas: boolean, notif_umbral_dias: number }
   * @returns {Promise<Object|null>} Preferencias actualizadas o null si el usuario no existe
   */
  async updatePreferencias(usuarioId, prefs) {
    const [result] = await pool.query(
      `UPDATE usuarios
          SET notif_activas = ?, notif_umbral_dias = ?
        WHERE id = ?`,
      [prefs.notif_activas ? 1 : 0, prefs.notif_umbral_dias, usuarioId]
    );

    return result.affectedRows > 0 ? this.getPreferencias(usuarioId) : null;
  },

  /**
   * Lista los usuarios que deben recibir el recordatorio diario:
   * notificaciones activas y con un correo válido registrado.
   * @returns {Promise<Array<Object>>} [{ id, email, nombre, notif_umbral_dias }]
   */
  async findDestinatarios() {
    const [rows] = await pool.query(
      `SELECT id, email, nombre, notif_umbral_dias
         FROM usuarios
        WHERE notif_activas = 1
          AND email IS NOT NULL
          AND email <> ''
        ORDER BY id ASC`
    );
    return rows;
  },
};

module.exports = notificacionModel;
