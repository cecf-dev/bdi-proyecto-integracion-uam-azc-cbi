/**
 * BDI - Modelo de Farmacias (Capa de Datos)
 * 
 * Funciones para interactuar con la tabla `busquedas_precios`
 * (historial de búsquedas de precios).
 */

const { pool } = require('../config/db');

const farmaciaModel = {
  /**
   * Registra una búsqueda de precios en el historial.
   * @param {number} usuarioId
   * @param {Object} datos
   * @param {string} datos.medicamentoNombre
   * @param {Array<Object>} datos.resultados
   * @param {string} datos.fuente - 'google_shopping'
   * @returns {Promise<number>} ID de la búsqueda creada
   */
  async createBusqueda(usuarioId, { medicamentoNombre, resultados, fuente }) {
    const [result] = await pool.query(
      `INSERT INTO busquedas_precios (usuario_id, medicamento_nombre, resultados, fuente)
       VALUES (?, ?, ?, ?)`,
      [usuarioId, medicamentoNombre, JSON.stringify(resultados), fuente]
    );
    return result.insertId;
  },

  /**
   * Historial de búsquedas del usuario (sin el payload completo de resultados).
   * @param {number} usuarioId
   * @param {number} [limite=10]
   * @returns {Promise<Array<Object>>}
   */
  async findHistorial(usuarioId, limite = 10) {
    const [rows] = await pool.query(
      `SELECT id, medicamento_nombre, fuente, created_at,
              JSON_LENGTH(resultados) AS num_resultados
         FROM busquedas_precios
        WHERE usuario_id = ?
        ORDER BY created_at DESC
        LIMIT ?`,
      [usuarioId, limite]
    );
    return rows;
  },
};

module.exports = farmaciaModel;
