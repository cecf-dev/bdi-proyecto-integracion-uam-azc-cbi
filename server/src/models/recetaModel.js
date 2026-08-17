/**
 * BDI - Modelo de Receta (Capa de Datos)
 * 
 * Funciones para interactuar con las tablas `recetas` y
 * `receta_medicamentos` en MySQL. Las operaciones de escritura
 * se realizan dentro de una transacción para garantizar la
 * integridad: si falla la inserción de los medicamentos,
 * la receta tampoco se guarda.
 */

const { pool } = require('../config/db');

const recetaModel = {
  /**
   * Crea una receta junto con sus medicamentos prescritos de forma atómica.
   * 
   * @param {Object} params
   * @param {number} params.usuarioId - ID del usuario autenticado (JWT)
   * @param {string} params.imagenBase64 - Imagen original en Base64 (data URL)
   * @param {Object} params.datosValidados - Datos clínicos confirmados por el usuario
   * @param {Array<Object>} params.medicamentos - Arreglo de medicamentos prescritos
   * @returns {Promise<Object>} La receta creada con sus medicamentos
   */
  async createConMedicamentos({ usuarioId, imagenBase64, datosValidados, medicamentos }) {
    // Obtener una conexión dedicada para controlar la transacción
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // 1. Insertar la receta en estado 'procesada'
      const [result] = await connection.query(
        `INSERT INTO recetas
           (usuario_id, imagen_base64, datos_estructurados, paciente_nombre,
            medico_nombre, medico_cedula, fecha_emision, diagnostico, codigo_cie10, estado)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'procesada')`,
        [
          usuarioId,
          imagenBase64,
          JSON.stringify(datosValidados),
          datosValidados.paciente_nombre || null,
          datosValidados.medico_nombre || null,
          datosValidados.medico_cedula || null,
          datosValidados.fecha_emision || null,
          datosValidados.diagnostico || null,
          datosValidados.codigo_cie10 || null,
        ]
      );

      const recetaId = result.insertId;

      // 2. Insertar los medicamentos prescritos (bulk insert)
      if (medicamentos.length > 0) {
        const values = medicamentos.map((med) => [
          recetaId,
          med.nombre_medicamento,
          med.dosis || null,
          med.frecuencia || null,
          med.duracion || null,
          med.indicaciones || null,
        ]);

        await connection.query(
          `INSERT INTO receta_medicamentos
             (receta_id, nombre_medicamento, dosis, frecuencia, duracion, indicaciones)
           VALUES ?`,
          [values]
        );
      }

      // 3. Confirmar todo si ambas inserciones fueron exitosas
      await connection.commit();

      return this.findById(recetaId);
    } catch (error) {
      // Revertir todo si algo falló
      await connection.rollback();
      throw error;
    } finally {
      // Siempre liberar la conexión de vuelta al pool
      connection.release();
    }
  },

  /**
   * Busca una receta por su ID incluyendo sus medicamentos.
   * No devuelve la imagen en Base64 por ser un campo pesado.
   * 
   * @param {number} id
   * @returns {Promise<Object|null>}
   */
  async findById(id) {
    const [rows] = await pool.query(
      `SELECT id, usuario_id, paciente_nombre, medico_nombre, medico_cedula,
              fecha_emision, diagnostico, codigo_cie10, estado, created_at
         FROM recetas
        WHERE id = ?`,
      [id]
    );

    if (rows.length === 0) return null;

    const receta = rows[0];

    const [medicamentos] = await pool.query(
      `SELECT nombre_medicamento, dosis, frecuencia, duracion, indicaciones
         FROM receta_medicamentos
        WHERE receta_id = ?`,
      [id]
    );

    receta.medicamentos = medicamentos;
    return receta;
  },

  /**
   * Busca una receta completa por ID verificando que pertenezca al usuario.
   * Incluye la imagen en Base64 y todos los medicamentos prescritos.
   * 
   * @param {number} id
   * @param {number} usuarioId - Dueño de la receta (JWT)
   * @returns {Promise<Object|null>}
   */
  async findByIdUsuario(id, usuarioId) {
    const [rows] = await pool.query(
      `SELECT id, usuario_id, imagen_base64, texto_extraido, datos_estructurados,
              paciente_nombre, medico_nombre, medico_cedula, fecha_emision,
              diagnostico, codigo_cie10, estado, created_at, updated_at
         FROM recetas
        WHERE id = ? AND usuario_id = ?`,
      [id, usuarioId]
    );

    if (rows.length === 0) return null;

    const receta = rows[0];

    const [medicamentos] = await pool.query(
      `SELECT id, nombre_medicamento, dosis, frecuencia, duracion, indicaciones
         FROM receta_medicamentos
        WHERE receta_id = ?`,
      [id]
    );

    receta.medicamentos = medicamentos;
    return receta;
  },

  /**
   * Actualiza los datos clínicos de una receta y reemplaza sus medicamentos
   * de forma atómica (solo si pertenece al usuario).
   * 
   * @param {number} id
   * @param {number} usuarioId - Dueño de la receta (JWT)
   * @param {Object} datosValidados - Datos clínicos normalizados
   * @param {Array<Object>} medicamentos - Nuevos medicamentos prescritos
   * @returns {Promise<Object|null>} Receta actualizada o null si no existe
   */
  async update(id, usuarioId, datosValidados, medicamentos) {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // 1. Actualizar los datos clínicos (updated_at se actualiza automáticamente)
      const [result] = await connection.query(
        `UPDATE recetas
            SET paciente_nombre = ?, medico_nombre = ?, medico_cedula = ?,
                fecha_emision = ?, diagnostico = ?, codigo_cie10 = ?
          WHERE id = ? AND usuario_id = ?`,
        [
          datosValidados.paciente_nombre || null,
          datosValidados.medico_nombre || null,
          datosValidados.medico_cedula || null,
          datosValidados.fecha_emision || null,
          datosValidados.diagnostico || null,
          datosValidados.codigo_cie10 || null,
          id,
          usuarioId,
        ]
      );

      if (result.affectedRows === 0) {
        await connection.rollback();
        return null;
      }

      // 2. Reemplazar los medicamentos (borrar los anteriores e insertar los nuevos)
      await connection.query('DELETE FROM receta_medicamentos WHERE receta_id = ?', [id]);

      if (medicamentos.length > 0) {
        const values = medicamentos.map((med) => [
          id,
          med.nombre_medicamento,
          med.dosis || null,
          med.frecuencia || null,
          med.duracion || null,
          med.indicaciones || null,
        ]);

        await connection.query(
          `INSERT INTO receta_medicamentos
             (receta_id, nombre_medicamento, dosis, frecuencia, duracion, indicaciones)
           VALUES ?`,
          [values]
        );
      }

      await connection.commit();

      return this.findByIdUsuario(id, usuarioId);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  /**
   * Elimina una receta del historial (solo si pertenece al usuario).
   * Los medicamentos asociados se eliminan en cascada por la FK.
   * 
   * @param {number} id
   * @param {number} usuarioId
   * @returns {Promise<boolean>} true si se eliminó
   */
  async remove(id, usuarioId) {
    const [result] = await pool.query(
      'DELETE FROM recetas WHERE id = ? AND usuario_id = ?',
      [id, usuarioId]
    );
    return result.affectedRows > 0;
  },

  /**
   * Lista las recetas de un usuario con paginación.
   * No devuelve la imagen en Base64 por ser un campo pesado.
   * 
   * @param {number} usuarioId - ID del usuario autenticado
   * @param {Object} [opciones]
   * @param {number} [opciones.limite=10] - Recetas por página
   * @param {number} [opciones.offset=0] - Registros a saltar
   * @returns {Promise<{recetas: Array<Object>, total: number}>}
   */
  async findByUsuario(usuarioId, { limite = 10, offset = 0 } = {}) {
    // Total de recetas del usuario (para calcular páginas)
    const [totalRows] = await pool.query(
      'SELECT COUNT(*) AS total FROM recetas WHERE usuario_id = ?',
      [usuarioId]
    );
    const total = totalRows[0].total;

    // Página actual, ordenada de la más reciente a la más antigua
    const [recetas] = await pool.query(
      `SELECT id, paciente_nombre, medico_nombre, medico_cedula, fecha_emision,
              diagnostico, codigo_cie10, estado, created_at
         FROM recetas
        WHERE usuario_id = ?
        ORDER BY created_at DESC, id DESC
        LIMIT ? OFFSET ?`,
      [usuarioId, limite, offset]
    );

    // Cargar los medicamentos de todas las recetas de la página (1 sola consulta)
    if (recetas.length > 0) {
      const ids = recetas.map((r) => r.id);
      const [meds] = await pool.query(
        `SELECT receta_id, nombre_medicamento, dosis, indicaciones
           FROM receta_medicamentos
          WHERE receta_id IN (?)`,
        [ids]
      );

      const medsPorReceta = {};
      meds.forEach((m) => {
        if (!medsPorReceta[m.receta_id]) medsPorReceta[m.receta_id] = [];
        medsPorReceta[m.receta_id].push(m);
      });

      recetas.forEach((r) => {
        r.medicamentos = medsPorReceta[r.id] || [];
      });
    }

    return { recetas, total };
  },
};

module.exports = recetaModel;
