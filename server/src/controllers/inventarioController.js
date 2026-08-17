/**
 * BDI - Controlador de Inventario (Botiquín)
 * 
 * Lógica de negocio para el CRUD de medicamentos del usuario autenticado.
 */

const medicamentoModel = require('../models/medicamentoModel');

const UNIDADES_PERMITIDAS = ['piezas', 'tabletas', 'capsulas', 'ml', 'mg', 'sobres', 'tubos', 'frascos'];

/**
 * Normaliza y valida los campos del medicamento recibidos del cliente.
 * Lanza errores con statusCode para el errorHandler.
 * 
 * @param {Object} body - req.body
 * @returns {Object} Datos normalizados listos para el modelo
 */
const normalizarDatos = (body) => {
  const nombre = typeof body.nombre === 'string' ? body.nombre.trim() : '';

  if (!nombre) {
    const error = new Error('El nombre del medicamento es obligatorio');
    error.statusCode = 400;
    throw error;
  }
  if (nombre.length > 255) {
    const error = new Error('El nombre del medicamento no puede exceder 255 caracteres');
    error.statusCode = 400;
    throw error;
  }

  // Cantidad: entero >= 0 (default 0)
  let cantidad = parseInt(body.cantidad, 10);
  if (Number.isNaN(cantidad)) cantidad = 0;
  if (cantidad < 0 || cantidad > 999999) {
    const error = new Error('La cantidad debe ser un número entre 0 y 999999');
    error.statusCode = 400;
    throw error;
  }

  // Unidad: validar contra lista permitida (default 'piezas')
  let unidad = typeof body.unidad === 'string' ? body.unidad.trim().toLowerCase() : '';
  if (!unidad) unidad = 'piezas';
  if (!UNIDADES_PERMITIDAS.includes(unidad)) {
    const error = new Error(`Unidad inválida. Valores permitidos: ${UNIDADES_PERMITIDAS.join(', ')}`);
    error.statusCode = 400;
    throw error;
  }

  // Fecha de caducidad: opcional. Acepta 'YYYY-MM-DD' o ISO ('YYYY-MM-DDTHH:mm...')
  // y la normaliza a 'YYYY-MM-DD'.
  let fecha_caducidad = typeof body.fecha_caducidad === 'string' ? body.fecha_caducidad.trim() : '';
  if (fecha_caducidad) {
    const match = fecha_caducidad.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      fecha_caducidad = `${match[1]}-${match[2]}-${match[3]}`;
    } else {
      const error = new Error('La fecha de caducidad debe tener el formato YYYY-MM-DD');
      error.statusCode = 400;
      throw error;
    }
  }

  const campoTexto = (valor) => (typeof valor === 'string' && valor.trim() !== '' ? valor.trim() : null);

  return {
    nombre,
    principio_activo: campoTexto(body.principio_activo),
    presentacion: campoTexto(body.presentacion),
    dosis: campoTexto(body.dosis),
    cantidad,
    unidad,
    fecha_caducidad: fecha_caducidad || null,
    lote: campoTexto(body.lote),
    codigo_barras: campoTexto(body.codigo_barras),
    notas: campoTexto(body.notas),
  };
};

const inventarioController = {
  /**
   * GET /api/inventario
   * Lista el botiquín del usuario con resumen de alertas de caducidad.
   */
  async listar(req, res, next) {
    try {
      const usuarioId = req.user?.id;
      if (!usuarioId) {
        const error = new Error('Usuario no autenticado');
        error.statusCode = 401;
        throw error;
      }

      const medicamentos = await medicamentoModel.findByUsuario(usuarioId);

      // Resumen para alertas de caducidad
      const resumen = {
        total: medicamentos.length,
        vigentes: medicamentos.filter((m) => m.estado === 'vigente').length,
        porVencer: medicamentos.filter((m) => m.estado === 'por_vencer').length,
        caducados: medicamentos.filter((m) => m.estado === 'caducado').length,
      };

      res.json({
        success: true,
        message: 'Inventario obtenido correctamente.',
        data: medicamentos,
        resumen,
      });
    } catch (error) {
      console.error('Error en listar inventario:', error);
      if (!error.statusCode) {
        error.statusCode = 500;
        error.message = 'Error interno al consultar el inventario.';
      }
      next(error);
    }
  },

  /**
   * GET /api/inventario/alertas
   * Recordatorios de caducidad: medicamentos caducados o por vencer
   * dentro de un umbral configurable de días (default 30, máx. 365).
   */
  async alertas(req, res, next) {
    try {
      const usuarioId = req.user?.id;
      if (!usuarioId) {
        const error = new Error('Usuario no autenticado');
        error.statusCode = 401;
        throw error;
      }

      let dias = parseInt(req.query.dias, 10);
      if (Number.isNaN(dias) || dias < 1) dias = 30;
      if (dias > 365) dias = 365;

      const alertas = await medicamentoModel.findAlertas(usuarioId, dias);

      const resumen = {
        total: alertas.length,
        caducados: alertas.filter((a) => a.estado === 'caducado').length,
        porVencer: alertas.filter((a) => a.estado === 'por_vencer').length,
      };

      res.json({
        success: true,
        message: `Se encontraron ${alertas.length} recordatorios de caducidad.`,
        data: alertas,
        resumen,
        umbral_dias: dias,
      });
    } catch (error) {
      console.error('Error en alertas de inventario:', error);
      if (!error.statusCode) {
        error.statusCode = 500;
        error.message = 'Error interno al consultar las alertas de caducidad.';
      }
      next(error);
    }
  },

  /**
   * POST /api/inventario
   * Agrega un medicamento al botiquín.
   */
  async crear(req, res, next) {
    try {
      const usuarioId = req.user?.id;
      if (!usuarioId) {
        const error = new Error('Usuario no autenticado');
        error.statusCode = 401;
        throw error;
      }

      const datos = normalizarDatos(req.body);
      const medicamento = await medicamentoModel.create(usuarioId, datos);

      console.log('Medicamento creado en inventario con ID:', medicamento.id);

      res.status(201).json({
        success: true,
        message: 'Medicamento agregado al botiquín correctamente.',
        data: medicamento,
      });
    } catch (error) {
      console.error('Error en crear medicamento:', error);
      if (!error.statusCode) {
        error.statusCode = 500;
        error.message = 'Error interno al agregar el medicamento.';
      }
      next(error);
    }
  },

  /**
   * POST /api/inventario/batch
   * Agrega varios medicamentos al botiquín de forma transaccional.
   * Usado por la conexión receta → botiquín.
   */
  async crearBatch(req, res, next) {
    try {
      const usuarioId = req.user?.id;
      if (!usuarioId) {
        const error = new Error('Usuario no autenticado');
        error.statusCode = 401;
        throw error;
      }

      const { medicamentos } = req.body;

      if (!Array.isArray(medicamentos) || medicamentos.length === 0) {
        const error = new Error('El campo "medicamentos" debe ser un arreglo no vacío');
        error.statusCode = 400;
        throw error;
      }

      if (medicamentos.length > 50) {
        const error = new Error('No se pueden agregar más de 50 medicamentos por lote');
        error.statusCode = 400;
        throw error;
      }

      // Normalizar y validar cada elemento (lanza 400 si alguno es inválido)
      const datos = medicamentos.map((item) => normalizarDatos(item));

      // Persistir todo o nada
      const creados = await medicamentoModel.createMany(usuarioId, datos);

      console.log(`Lote de ${creados.length} medicamentos agregado al botiquín`);

      res.status(201).json({
        success: true,
        message: `${creados.length} medicamento(s) agregado(s) al botiquín.`,
        data: creados,
      });
    } catch (error) {
      console.error('Error en crearBatch:', error);
      if (!error.statusCode) {
        error.statusCode = 500;
        error.message = 'Error interno al agregar el lote de medicamentos.';
      }
      next(error);
    }
  },

  /**
   * PUT /api/inventario/:id
   * Actualiza un medicamento del botiquín.
   */
  async actualizar(req, res, next) {
    try {
      const usuarioId = req.user?.id;
      if (!usuarioId) {
        const error = new Error('Usuario no autenticado');
        error.statusCode = 401;
        throw error;
      }

      const id = parseInt(req.params.id, 10);
      if (Number.isNaN(id) || id < 1) {
        const error = new Error('ID de medicamento inválido');
        error.statusCode = 400;
        throw error;
      }

      const datos = normalizarDatos(req.body);
      const medicamento = await medicamentoModel.update(id, usuarioId, datos);

      if (!medicamento) {
        const error = new Error('Medicamento no encontrado');
        error.statusCode = 404;
        throw error;
      }

      res.json({
        success: true,
        message: 'Medicamento actualizado correctamente.',
        data: medicamento,
      });
    } catch (error) {
      console.error('Error en actualizar medicamento:', error);
      if (!error.statusCode) {
        error.statusCode = 500;
        error.message = 'Error interno al actualizar el medicamento.';
      }
      next(error);
    }
  },

  /**
   * DELETE /api/inventario/:id
   * Elimina un medicamento del botiquín.
   */
  async eliminar(req, res, next) {
    try {
      const usuarioId = req.user?.id;
      if (!usuarioId) {
        const error = new Error('Usuario no autenticado');
        error.statusCode = 401;
        throw error;
      }

      const id = parseInt(req.params.id, 10);
      if (Number.isNaN(id) || id < 1) {
        const error = new Error('ID de medicamento inválido');
        error.statusCode = 400;
        throw error;
      }

      const eliminado = await medicamentoModel.remove(id, usuarioId);

      if (!eliminado) {
        const error = new Error('Medicamento no encontrado');
        error.statusCode = 404;
        throw error;
      }

      res.json({
        success: true,
        message: 'Medicamento eliminado del botiquín correctamente.',
      });
    } catch (error) {
      console.error('Error en eliminar medicamento:', error);
      if (!error.statusCode) {
        error.statusCode = 500;
        error.message = 'Error interno al eliminar el medicamento.';
      }
      next(error);
    }
  },
};

module.exports = inventarioController;
