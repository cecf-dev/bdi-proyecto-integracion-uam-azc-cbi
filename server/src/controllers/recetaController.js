/**
 * BDI - Controlador de Recetas (IA)
 * 
 * Controlador encargado de procesar la petición de análisis de receta
 * utilizando la API de Groq (Llama 3 Vision).
 */

const Groq = require('groq-sdk');
const sharp = require('sharp');
const config = require('../config/env');
const recetaModel = require('../models/recetaModel');

// Inicializar SDK con la variable de entorno
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

/**
 * Comprime la imagen (data URL) antes de enviarla a Groq para reducir
 * el consumo de tokens y asegurar compatibilidad con el límite de cuota.
 *
 * @param {string} dataUrl - Imagen en Base64 con prefijo data:image/...
 * @returns {Promise<string>} Data URL comprimido o el original si falla
 */
const comprimirImagen = async (dataUrl) => {
  try {
    const coincidencia = dataUrl.match(/^data:image\/[\w.+-]+;base64,(.+)$/);
    if (!coincidencia) return dataUrl;

    const buffer = Buffer.from(coincidencia[1], 'base64');
    const comprimido = await sharp(buffer)
      .resize({ width: 1280, height: 1280, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();

    return `data:image/jpeg;base64,${comprimido.toString('base64')}`;
  } catch (error) {
    console.warn('No se pudo comprimir la imagen de la receta; se enviará la original:', error.message);
    return dataUrl;
  }
};

const recetaController = {
  /**
   * POST /api/recetas/analizar
   * Recibe la imagen en formato Base64 enviada desde el cliente (application/json),
   * valida su existencia y la envía a Groq Vision para extraer los datos médicos
   * devolviendo un JSON estructurado.
   */
  async analizarReceta(req, res, next) {
    try {
      const { imagenBase64 } = req.body;

      // 1. Validar que la cadena base64 no venga vacía
      if (!imagenBase64 || typeof imagenBase64 !== 'string') {
        const error = new Error('No se ha proporcionado la imagen en Base64 o el formato es incorrecto');
        error.statusCode = 400;
        throw error;
      }

      // Comprimir la imagen antes de enviar a Groq para optimizar tokens
      const imagenComprimida = await comprimirImagen(imagenBase64);
      console.log('Enviando imagen Base64 a IA Vision (Groq)...');

      // 2. Definir el System Prompt robusto para asegurar JSON
      const systemPrompt = `
      Eres un experto analista de datos clínicos. Tu objetivo es analizar la imagen de una receta médica y extraer sus datos clave.
      
      REGLA CRÍTICA ABSOLUTA: Debes devolver ÚNICAMENTE un objeto JSON válido.
      No incluyas explicaciones, saludos, bloques de markdown (\`\`\`json) ni ningún otro texto fuera del JSON puro.
      
      La estructura del JSON debe ser exactamente esta:
      {
        "paciente_nombre": "Nombre completo del paciente o null si no se detecta",
        "fecha_emision": "Fecha de la receta (ej. YYYY-MM-DD) o null si no se detecta",
        "medico_nombre": "Nombre del médico o null si no se detecta",
        "medico_cedula": "Cédula profesional del médico o null si no se detecta",
        "diagnostico": "Diagnóstico principal descrito en la receta o null",
        "medicamentos": [
          {
            "nombre_medicamento": "Nombre del medicamento",
            "dosis": "Dosis (ej. 500mg) o null",
            "indicaciones": "Instrucciones de toma completas o null"
          }
        ]
      }
      `;

      // 3. Petición a Groq con reintento ante fallos de formato JSON
      let completion;
      const maxIntentos = 2;
      const modeloIa = config.groqModel || process.env.GROQ_MODEL || "qwen/qwen3.8-27b";

      for (let intento = 1; intento <= maxIntentos; intento++) {
        try {
          completion = await groq.chat.completions.create({
            messages: [
              {
                role: "system",
                content: systemPrompt
              },
              {
                role: "user",
                content: [
                  { type: "text", text: "Analiza esta receta médica y devuelve el JSON solicitado." },
                  {
                    type: "image_url",
                    image_url: {
                      url: imagenComprimida
                    }
                  }
                ]
              }
            ],
            model: modeloIa,
            temperature: 0.1,
            max_tokens: 800,
            response_format: { type: "json_object" }
          });
          break;
        } catch (apiError) {
          const esFalloJson = apiError?.code === 'json_validate_failed';
          if (!esFalloJson || intento === maxIntentos) throw apiError;
          console.warn(`Groq falló validación JSON en receta (intento ${intento}); reintentando...`);
        }
      }

      // 4. Parsear la respuesta y manejar errores
      const aiResponse = completion.choices[0].message.content;
      let jsonData;

      try {
        jsonData = JSON.parse(aiResponse);
      } catch (parseError) {
        console.error('La IA no devolvió un JSON válido:', aiResponse);
        const error = new Error('El análisis de IA falló al estructurar los datos (JSON inválido)');
        error.statusCode = 500;
        throw error;
      }

      console.log('Análisis exitoso:', jsonData);

      // 5. Respuesta HTTP 200 de éxito
      res.status(200).json({
        success: true,
        message: 'Receta analizada correctamente por Inteligencia Artificial.',
        data: jsonData
      });

    } catch (error) {
      console.error('Error en analizarReceta (Groq API):', error);
      if (error?.status === 429 || error?.code === 'rate_limit_exceeded') {
        error.statusCode = 429;
        error.message = 'El motor de IA está procesando demasiadas solicitudes en este momento. Por favor, espera unos segundos e inténtalo de nuevo.';
      } else if (!error.statusCode) {
        error.statusCode = 500;
        error.message = 'Error interno al comunicarse con el motor de Inteligencia Artificial.';
      }
      next(error);
    }
  },

  /**
   * POST /api/recetas/guardar
   * Recibe los datos validados por el usuario (FormularioValidacion) junto
   * con la imagen original en Base64 y los persiste en la base de datos.
   * La receta y sus medicamentos se insertan de forma transaccional.
   */
  async guardarReceta(req, res, next) {
    try {
      const {
        imagenBase64,
        paciente_nombre,
        fecha_emision,
        medico_nombre,
        medico_cedula,
        diagnostico,
        codigo_cie10,
        medicamentos,
      } = req.body;

      // 1. Validar imagen obligatoria
      if (!imagenBase64 || typeof imagenBase64 !== 'string') {
        const error = new Error('No se ha proporcionado la imagen de la receta en Base64');
        error.statusCode = 400;
        throw error;
      }

      // 2. Validar usuario autenticado (proviene del JWT en authMiddleware)
      const usuarioId = req.user?.id;
      if (!usuarioId) {
        const error = new Error('Usuario no autenticado');
        error.statusCode = 401;
        throw error;
      }

      // 3. Validar estructura del arreglo de medicamentos
      if (!Array.isArray(medicamentos)) {
        const error = new Error('El campo "medicamentos" debe ser un arreglo');
        error.statusCode = 400;
        throw error;
      }

      // Filtrar medicamentos sin nombre (vacíos) antes de guardar
      const medicamentosValidos = medicamentos.filter(
        (med) =>
          med &&
          typeof med.nombre_medicamento === 'string' &&
          med.nombre_medicamento.trim() !== ''
      );

      // 4. Validar formato de fecha (opcional pero debe ser YYYY-MM-DD)
      if (fecha_emision && !/^\d{4}-\d{2}-\d{2}$/.test(fecha_emision)) {
        const error = new Error('La fecha de emisión debe tener el formato YYYY-MM-DD');
        error.statusCode = 400;
        throw error;
      }

      // 5. Construir el objeto de datos clínicos confirmados
      const datosValidados = {
        paciente_nombre: paciente_nombre || null,
        fecha_emision: fecha_emision || null,
        medico_nombre: medico_nombre || null,
        medico_cedula: medico_cedula || null,
        diagnostico: diagnostico || null,
        codigo_cie10: codigo_cie10 || null,
      };

      // 6. Persistir de forma transaccional (Capa de Datos)
      const recetaGuardada = await recetaModel.createConMedicamentos({
        usuarioId,
        imagenBase64,
        datosValidados,
        medicamentos: medicamentosValidos,
      });

      console.log('Receta guardada en BD con ID:', recetaGuardada.id);

      // 7. Respuesta HTTP 201 de éxito
      res.status(201).json({
        success: true,
        message: 'Receta guardada correctamente en el historial médico.',
        data: recetaGuardada,
      });

    } catch (error) {
      console.error('Error en guardarReceta:', error);
      if (!error.statusCode) {
        error.statusCode = 500;
        error.message = 'Error interno al guardar la receta en la base de datos.';
      }
      next(error);
    }
  },

  /**
   * GET /api/recetas
   * Lista el historial de recetas del usuario autenticado con paginación.
   * Query params opcionales: page (default 1) y limit (default 10, máx. 50).
   */
  async listarRecetas(req, res, next) {
    try {
      // 1. Usuario autenticado (proviene del JWT en authMiddleware)
      const usuarioId = req.user?.id;
      if (!usuarioId) {
        const error = new Error('Usuario no autenticado');
        error.statusCode = 401;
        throw error;
      }

      // 2. Parsear y sanear parámetros de paginación
      let page = parseInt(req.query.page, 10);
      let limit = parseInt(req.query.limit, 10);

      if (Number.isNaN(page) || page < 1) page = 1;
      if (Number.isNaN(limit) || limit < 1) limit = 10;
      if (limit > 50) limit = 50;

      const offset = (page - 1) * limit;

      // 3. Consultar la página actual en la Capa de Datos
      const { recetas, total } = await recetaModel.findByUsuario(usuarioId, {
        limite: limit,
        offset,
      });

      // 4. Respuesta HTTP 200 con metadatos de paginación
      res.json({
        success: true,
        message: 'Historial de recetas obtenido correctamente.',
        data: recetas,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });

    } catch (error) {
      console.error('Error en listarRecetas:', error);
      if (!error.statusCode) {
        error.statusCode = 500;
        error.message = 'Error interno al consultar el historial de recetas.';
      }
      next(error);
    }
  },

  /**
   * GET /api/recetas/:id
   * Devuelve una receta completa (con imagen Base64 y medicamentos)
   * verificando que pertenezca al usuario autenticado.
   */
  async obtenerReceta(req, res, next) {
    try {
      const usuarioId = req.user?.id;
      if (!usuarioId) {
        const error = new Error('Usuario no autenticado');
        error.statusCode = 401;
        throw error;
      }

      const id = parseInt(req.params.id, 10);
      if (Number.isNaN(id) || id < 1) {
        const error = new Error('ID de receta inválido');
        error.statusCode = 400;
        throw error;
      }

      const receta = await recetaModel.findByIdUsuario(id, usuarioId);

      if (!receta) {
        const error = new Error('Receta no encontrada');
        error.statusCode = 404;
        throw error;
      }

      res.json({
        success: true,
        message: 'Receta obtenida correctamente.',
        data: receta,
      });
    } catch (error) {
      console.error('Error en obtenerReceta:', error);
      if (!error.statusCode) {
        error.statusCode = 500;
        error.message = 'Error interno al consultar la receta.';
      }
      next(error);
    }
  },

  /**
   * PUT /api/recetas/:id
   * Actualiza los datos clínicos y medicamentos de una receta existente.
   * La imagen original no se modifica.
   */
  async actualizarReceta(req, res, next) {
    try {
      const usuarioId = req.user?.id;
      if (!usuarioId) {
        const error = new Error('Usuario no autenticado');
        error.statusCode = 401;
        throw error;
      }

      const id = parseInt(req.params.id, 10);
      if (Number.isNaN(id) || id < 1) {
        const error = new Error('ID de receta inválido');
        error.statusCode = 400;
        throw error;
      }

      const {
        paciente_nombre,
        fecha_emision,
        medico_nombre,
        medico_cedula,
        diagnostico,
        codigo_cie10,
        medicamentos,
      } = req.body;

      // Validar estructura del arreglo de medicamentos
      if (!Array.isArray(medicamentos)) {
        const error = new Error('El campo "medicamentos" debe ser un arreglo');
        error.statusCode = 400;
        throw error;
      }

      const medicamentosValidos = medicamentos.filter(
        (med) =>
          med &&
          typeof med.nombre_medicamento === 'string' &&
          med.nombre_medicamento.trim() !== ''
      );

      // Validar formato de fecha (opcional, acepta YYYY-MM-DD o ISO)
      let fechaNormalizada = typeof fecha_emision === 'string' ? fecha_emision.trim() : '';
      if (fechaNormalizada) {
        const match = fechaNormalizada.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (match) {
          fechaNormalizada = `${match[1]}-${match[2]}-${match[3]}`;
        } else {
          const error = new Error('La fecha de emisión debe tener el formato YYYY-MM-DD');
          error.statusCode = 400;
          throw error;
        }
      }

      const datosValidados = {
        paciente_nombre: paciente_nombre || null,
        fecha_emision: fechaNormalizada || null,
        medico_nombre: medico_nombre || null,
        medico_cedula: medico_cedula || null,
        diagnostico: diagnostico || null,
        codigo_cie10: codigo_cie10 || null,
      };

      const receta = await recetaModel.update(id, usuarioId, datosValidados, medicamentosValidos);

      if (!receta) {
        const error = new Error('Receta no encontrada');
        error.statusCode = 404;
        throw error;
      }

      res.json({
        success: true,
        message: 'Receta actualizada correctamente.',
        data: receta,
      });
    } catch (error) {
      console.error('Error en actualizarReceta:', error);
      if (!error.statusCode) {
        error.statusCode = 500;
        error.message = 'Error interno al actualizar la receta.';
      }
      next(error);
    }
  },

  /**
   * DELETE /api/recetas/:id
   * Elimina una receta del historial (y sus medicamentos en cascada).
   */
  async eliminarReceta(req, res, next) {
    try {
      const usuarioId = req.user?.id;
      if (!usuarioId) {
        const error = new Error('Usuario no autenticado');
        error.statusCode = 401;
        throw error;
      }

      const id = parseInt(req.params.id, 10);
      if (Number.isNaN(id) || id < 1) {
        const error = new Error('ID de receta inválido');
        error.statusCode = 400;
        throw error;
      }

      const eliminada = await recetaModel.remove(id, usuarioId);

      if (!eliminada) {
        const error = new Error('Receta no encontrada');
        error.statusCode = 404;
        throw error;
      }

      res.json({
        success: true,
        message: 'Receta eliminada del historial correctamente.',
      });
    } catch (error) {
      console.error('Error en eliminarReceta:', error);
      if (!error.statusCode) {
        error.statusCode = 500;
        error.message = 'Error interno al eliminar la receta.';
      }
      next(error);
    }
  }
};

module.exports = recetaController;
