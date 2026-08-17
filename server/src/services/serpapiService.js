/**
 * BDI - Servicio SerpApi
 * 
 * Integración con SerpApi para búsquedas de precios (Google Shopping)
 * y farmacias físicas cercanas (Google Maps).
 */

const { getJson } = require('serpapi');
const config = require('../config/env');

const serpapiService = {
  /**
   * Busca ofertas de precios de un medicamento en Google Shopping (MX).
   * @param {string} medicamento
   * @returns {Promise<Array<Object>>} Ofertas normalizadas
   */
  async buscarPreciosMedicamento(medicamento) {
    if (!config.serpApiKey) {
      const error = new Error('SerpApi no está configurada en el servidor (SERPAPI_KEY)');
      error.statusCode = 503;
      throw error;
    }

    try {
      const data = await getJson({
        engine: 'google_shopping',
        q: medicamento,
        api_key: config.serpApiKey,
        gl: 'mx',
        hl: 'es',
        google_domain: 'google.com.mx',
      });

      const resultados = (data.shopping_results || [])
        .slice(0, 20)
        .map((r) => ({
          titulo: r.title || null,
          precio: r.price || (r.extracted_price ? `$${r.extracted_price}` : null),
          tienda: r.source || null,
          link: r.link || null,
          imagen: r.thumbnail || null,
        }))
        .filter((r) => r.titulo);

      return resultados;
    } catch (error) {
      console.error('Error en SerpApi (google_shopping):', error.message);
      const err = new Error('No se pudo consultar los precios. Inténtalo de nuevo.');
      err.statusCode = 502;
      throw err;
    }
  },

  /**
   * Busca farmacias físicas cerca de una coordenada (Google Maps).
   * @param {number} lat
   * @param {number} lng
   * @returns {Promise<Array<Object>>} Farmacias con coordenadas para Leaflet
   */
  async buscarFarmaciasCercanas(lat, lng) {
    if (!config.serpApiKey) {
      const error = new Error('SerpApi no está configurada en el servidor (SERPAPI_KEY)');
      error.statusCode = 503;
      throw error;
    }

    try {
      const data = await getJson({
        engine: 'google_maps',
        q: 'farmacias',
        ll: `@${lat},${lng},14z`,
        type: 'search',
        hl: 'es',
        api_key: config.serpApiKey,
      });

      const resultados = (data.local_results || [])
        .slice(0, 15)
        .map((r) => ({
          nombre: r.title || null,
          direccion: r.address || null,
          lat: r.gps_coordinates?.latitude ?? null,
          lng: r.gps_coordinates?.longitude ?? null,
          rating: r.rating ?? null,
          reviews: r.reviews ?? null,
          telefono: r.phone ?? null,
          abierto: r.open_state ?? null,
        }))
        .filter((r) => r.nombre);

      return resultados;
    } catch (error) {
      console.error('Error en SerpApi (google_maps):', error.message);
      const err = new Error('No se pudieron obtener las farmacias cercanas. Inténtalo de nuevo.');
      err.statusCode = 502;
      throw err;
    }
  },
};

module.exports = serpapiService;
