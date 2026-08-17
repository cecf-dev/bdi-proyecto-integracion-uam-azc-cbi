/**
 * BDI - Modelo de Usuario
 * 
 * Funciones para interactuar con la tabla `usuarios` en MySQL.
 */

const { pool } = require('../config/db');

const userModel = {
  /**
   * Busca un usuario por su email.
   * @param {string} email
   * @returns {Promise<Object|null>}
   */
  async findByEmail(email) {
    const [rows] = await pool.query('SELECT * FROM usuarios WHERE email = ?', [email]);
    return rows.length > 0 ? rows[0] : null;
  },

  /**
   * Busca un usuario por su ID interno.
   * @param {number} id
   * @returns {Promise<Object|null>}
   */
  async findById(id) {
    const [rows] = await pool.query('SELECT * FROM usuarios WHERE id = ?', [id]);
    return rows.length > 0 ? rows[0] : null;
  },

  /**
   * Crea un nuevo usuario tras autenticarse con Google.
   * @param {Object} userData
   * @param {string} userData.googleId
   * @param {string} userData.email
   * @param {string} userData.nombre
   * @param {string} userData.avatarUrl
   * @returns {Promise<Object>} El usuario recién creado
   */
  async create(userData) {
    const { googleId, email, nombre, avatarUrl } = userData;
    const [result] = await pool.query(
      `INSERT INTO usuarios (google_id, email, nombre, avatar_url)
       VALUES (?, ?, ?, ?)`,
      [googleId, email, nombre, avatarUrl]
    );

    // Retorna el usuario creado (buscándolo por ID autogenerado)
    return this.findById(result.insertId);
  },

  /**
   * Actualiza el timestamp del último inicio de sesión u otros datos (ej. avatar).
   * Útil por si el usuario cambia su foto en Google.
   * @param {number} id 
   * @param {Object} dataToUpdate
   */
  async updateData(id, dataToUpdate) {
    const { nombre, avatarUrl } = dataToUpdate;
    await pool.query(
      `UPDATE usuarios SET nombre = ?, avatar_url = ? WHERE id = ?`,
      [nombre, avatarUrl, id]
    );
  }
};

module.exports = userModel;
