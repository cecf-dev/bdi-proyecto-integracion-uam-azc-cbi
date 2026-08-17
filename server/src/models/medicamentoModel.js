/**
 * BDI - Modelo de Medicamento (Capa de Datos)
 * 
 * Funciones para interactuar con la tabla `medicamentos` (botiquín).
 * El estado de caducidad se calcula automáticamente a partir de la
 * fecha de caducidad: 'vigente', 'por_vencer' (≤ 30 días) o 'caducado'.
 */

const { pool } = require('../config/db');

const UMBRAL_POR_VENCER_DIAS = 30;

/**
 * Calcula el estado de caducidad de un medicamento.
 * @param {string|Date|null} fechaCaducidad
 * @returns {'vigente'|'por_vencer'|'caducado'}
 */
const computeEstado = (fechaCaducidad) => {
  if (!fechaCaducidad) return 'vigente';

  const fecha = new Date(fechaCaducidad);
  if (Number.isNaN(fecha.getTime())) return 'vigente';

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const diasRestantes = Math.ceil((fecha - hoy) / 86400000);

  if (diasRestantes < 0) return 'caducado';
  if (diasRestantes <= UMBRAL_POR_VENCER_DIAS) return 'por_vencer';
  return 'vigente';
};

/**
 * Calcula los días restantes hasta la caducidad (negativo si ya caducó).
 * @param {string|Date|null} fechaCaducidad
 * @returns {number|null} null si no hay fecha
 */
const diasRestantes = (fechaCaducidad) => {
  if (!fechaCaducidad) return null;
  const fecha = new Date(fechaCaducidad);
  if (Number.isNaN(fecha.getTime())) return null;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return Math.ceil((fecha - hoy) / 86400000);
};

/**
 * Aplica el estado calculado a un registro leído de la BD,
 * garantizando que las alertas estén siempre al día.
 */
const rowToMedicamento = (row) => ({
  ...row,
  estado: computeEstado(row.fecha_caducidad),
});

const medicamentoModel = {
  /**
   * Crea un medicamento en el botiquín del usuario.
   * @param {number} usuarioId
   * @param {Object} data - Campos normalizados del medicamento
   * @returns {Promise<Object>} Medicamento creado
   */
  async create(usuarioId, data) {
    const estado = computeEstado(data.fecha_caducidad);

    const [result] = await pool.query(
      `INSERT INTO medicamentos
         (usuario_id, nombre, principio_activo, presentacion, dosis, cantidad,
          unidad, fecha_caducidad, lote, codigo_barras, notas, estado)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        usuarioId,
        data.nombre,
        data.principio_activo || null,
        data.presentacion || null,
        data.dosis || null,
        data.cantidad,
        data.unidad || 'piezas',
        data.fecha_caducidad || null,
        data.lote || null,
        data.codigo_barras || null,
        data.notas || null,
        estado,
      ]
    );

    return this.findById(result.insertId, usuarioId);
  },

  /**
   * Crea varios medicamentos de forma atómica (todo o nada).
   * Usado por la conexión receta → botiquín (endpoint batch).
   * 
   * @param {number} usuarioId
   * @param {Array<Object>} items - Arreglo de medicamentos normalizados
   * @returns {Promise<Array<Object>>} Medicamentos creados
   */
  async createMany(usuarioId, items) {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const ids = [];
      for (const data of items) {
        const estado = computeEstado(data.fecha_caducidad);

        const [result] = await connection.query(
          `INSERT INTO medicamentos
             (usuario_id, nombre, principio_activo, presentacion, dosis, cantidad,
              unidad, fecha_caducidad, lote, codigo_barras, notas, estado)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            usuarioId,
            data.nombre,
            data.principio_activo || null,
            data.presentacion || null,
            data.dosis || null,
            data.cantidad,
            data.unidad || 'piezas',
            data.fecha_caducidad || null,
            data.lote || null,
            data.codigo_barras || null,
            data.notas || null,
            estado,
          ]
        );

        ids.push(result.insertId);
      }

      await connection.commit();

      // Devolver los registros completos con estado calculado
      if (ids.length === 0) return [];
      const [rows] = await pool.query(
        'SELECT * FROM medicamentos WHERE id IN (?) AND usuario_id = ?',
        [ids, usuarioId]
      );
      return rows.map(rowToMedicamento);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  /**
   * Busca un medicamento por ID verificando que pertenezca al usuario.
   * @param {number} id
   * @param {number} usuarioId
   * @returns {Promise<Object|null>}
   */
  async findById(id, usuarioId) {
    const [rows] = await pool.query(
      'SELECT * FROM medicamentos WHERE id = ? AND usuario_id = ?',
      [id, usuarioId]
    );
    return rows.length > 0 ? rowToMedicamento(rows[0]) : null;
  },

  /**
   * Lista todo el botiquín del usuario.
   * Orden: sin caducidad al final, luego por fecha más próxima.
   * @param {number} usuarioId
   * @returns {Promise<Array<Object>>}
   */
  async findByUsuario(usuarioId) {
    const [rows] = await pool.query(
      `SELECT * FROM medicamentos
        WHERE usuario_id = ?
        ORDER BY (fecha_caducidad IS NULL) ASC, fecha_caducidad ASC, nombre ASC`,
      [usuarioId]
    );
    return rows.map(rowToMedicamento);
  },

  /**
   * Lista las alertas de caducidad del usuario: medicamentos ya caducados
   * o que vencen dentro de los próximos `dias` días, ordenados por urgencia.
   * 
   * @param {number} usuarioId
   * @param {number} [dias=30] - Umbral de días para "por vencer"
   * @returns {Promise<Array<Object>>} Alertas con dias_restantes
   */
  async findAlertas(usuarioId, dias = 30) {
    const [rows] = await pool.query(
      `SELECT id, nombre, dosis, presentacion, cantidad, unidad, fecha_caducidad
         FROM medicamentos
        WHERE usuario_id = ?
          AND fecha_caducidad IS NOT NULL
          AND fecha_caducidad <= (CURDATE() + INTERVAL ? DAY)
        ORDER BY fecha_caducidad ASC, nombre ASC`,
      [usuarioId, dias]
    );

    return rows.map((row) => ({
      ...row,
      estado: computeEstado(row.fecha_caducidad),
      dias_restantes: diasRestantes(row.fecha_caducidad),
    }));
  },

  /**
   * Actualiza un medicamento (solo si pertenece al usuario).
   * @param {number} id
   * @param {number} usuarioId
   * @param {Object} data - Campos normalizados del medicamento
   * @returns {Promise<Object|null>} Medicamento actualizado o null si no existe
   */
  async update(id, usuarioId, data) {
    const estado = computeEstado(data.fecha_caducidad);

    const [result] = await pool.query(
      `UPDATE medicamentos
          SET nombre = ?, principio_activo = ?, presentacion = ?, dosis = ?,
              cantidad = ?, unidad = ?, fecha_caducidad = ?, lote = ?,
              codigo_barras = ?, notas = ?, estado = ?
        WHERE id = ? AND usuario_id = ?`,
      [
        data.nombre,
        data.principio_activo || null,
        data.presentacion || null,
        data.dosis || null,
        data.cantidad,
        data.unidad || 'piezas',
        data.fecha_caducidad || null,
        data.lote || null,
        data.codigo_barras || null,
        data.notas || null,
        estado,
        id,
        usuarioId,
      ]
    );

    return result.affectedRows > 0 ? this.findById(id, usuarioId) : null;
  },

  /**
   * Elimina un medicamento (solo si pertenece al usuario).
   * @param {number} id
   * @param {number} usuarioId
   * @returns {Promise<boolean>} true si se eliminó
   */
  async remove(id, usuarioId) {
    const [result] = await pool.query(
      'DELETE FROM medicamentos WHERE id = ? AND usuario_id = ?',
      [id, usuarioId]
    );
    return result.affectedRows > 0;
  },
};

module.exports = medicamentoModel;
