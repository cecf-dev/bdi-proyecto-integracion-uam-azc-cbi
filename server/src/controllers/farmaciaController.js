/**
 * BDI - Controlador de Farmacias
 * 
 * Lógica de búsqueda de precios (SerpApi Google Shopping),
 * farmacias cercanas (SerpApi Google Maps) e historial.
 */

const serpapiService = require('../services/serpapiService');
const farmaciaModel = require('../models/farmaciaModel');

/**
 * Valida que un valor sea una coordenada válida.
 * @param {*} valor
 * @param {number} min
 * @param {number} max
 * @returns {boolean}
 */
const esCoordenada = (valor, min, max) => {
  const n = typeof valor === 'number' ? valor : parseFloat(valor);
  return Number.isFinite(n) && n >= min && n <= max;
};

const farmaciaController = {
  /**
   * POST /api/farmacias/buscar
   * Busca precios de un medicamento y registra la búsqueda en el historial.
   */
  async buscarPrecios(req, res, next) {
    try {
      const usuarioId = req.user?.id;
      if (!usuarioId) {
        const error = new Error('Usuario no autenticado');
        error.statusCode = 401;
        throw error;
      }

      const medicamento = typeof req.body.medicamento === 'string'
        ? req.body.medicamento.trim()
        : '';

      if (!medicamento) {
        const error = new Error('El nombre del medicamento es obligatorio');
        error.statusCode = 400;
        throw error;
      }
      if (medicamento.length > 100) {
        const error = new Error('El nombre del medicamento no puede exceder 100 caracteres');
        error.statusCode = 400;
        throw error;
      }

      const resultados = await serpapiService.buscarPreciosMedicamento(medicamento);

      // Registrar en el historial (Capa de Datos)
      const busquedaId = await farmaciaModel.createBusqueda(usuarioId, {
        medicamentoNombre: medicamento,
        resultados,
        fuente: 'google_shopping',
      });

      res.json({
        success: true,
        message: `Se encontraron ${resultados.length} ofertas para "${medicamento}".`,
        data: resultados,
        busqueda_id: busquedaId,
      });
    } catch (error) {
      console.error('Error en buscarPrecios:', error);
      if (!error.statusCode) {
        error.statusCode = 500;
        error.message = 'Error interno al buscar precios.';
      }
      next(error);
    }
  },

  /**
   * POST /api/farmacias/cercanas
   * Busca farmacias físicas cerca de una coordenada (para Leaflet).
   */
  async buscarCercanas(req, res, next) {
    try {
      const usuarioId = req.user?.id;
      if (!usuarioId) {
        const error = new Error('Usuario no autenticado');
        error.statusCode = 401;
        throw error;
      }

      const { lat, lng } = req.body;

      if (!esCoordenada(lat, -90, 90) || !esCoordenada(lng, -180, 180)) {
        const error = new Error('Coordenadas inválidas. Proporciona lat y lng válidos.');
        error.statusCode = 400;
        throw error;
      }

      const resultados = await serpapiService.buscarFarmaciasCercanas(
        Number(lat),
        Number(lng)
      );

      res.json({
        success: true,
        message: `Se encontraron ${resultados.length} farmacias cercanas.`,
        data: resultados,
      });
    } catch (error) {
      console.error('Error en buscarCercanas:', error);
      if (!error.statusCode) {
        error.statusCode = 500;
        error.message = 'Error interno al buscar farmacias cercanas.';
      }
      next(error);
    }
  },

  /**
   * GET /api/farmacias/historial
   * Historial de búsquedas de precios del usuario (últimas 10).
   */
  async historial(req, res, next) {
    try {
      const usuarioId = req.user?.id;
      if (!usuarioId) {
        const error = new Error('Usuario no autenticado');
        error.statusCode = 401;
        throw error;
      }

      const historial = await farmaciaModel.findHistorial(usuarioId, 10);

      res.json({
        success: true,
        message: 'Historial de búsquedas obtenido correctamente.',
        data: historial,
      });
    } catch (error) {
      console.error('Error en historial farmacias:', error);
      if (!error.statusCode) {
        error.statusCode = 500;
        error.message = 'Error interno al consultar el historial de búsquedas.';
      }
      next(error);
    }
  },
};

module.exports = farmaciaController;
