/**
 * BDI - Controlador de Inventario (Botiquín)
 * 
 * Lógica de negocio para el CRUD de medicamentos del usuario autenticado
 * y para el análisis con IA de fotografías de empaques de medicamentos.
 */

const Groq = require('groq-sdk');
const sharp = require('sharp');
const medicamentoModel = require('../models/medicamentoModel');

// Inicializar SDK de Groq con la variable de entorno
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

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

/**
 * Sanea la respuesta de la IA: normaliza tipos, fechas y unidades
 * para que los datos sean compatibles con normalizarDatos() al guardar.
 * 
 * @param {Object} data - JSON devuelto por Groq
 * @returns {Array<Object>} Medicamentos extraídos listos para el formulario
 */
const sanitizarExtraidos = (data) => {
  const lista = Array.isArray(data?.medicamentos) ? data.medicamentos : [];

  return lista
    .slice(0, 20)
    .map((m) => {
      const campoTexto = (v) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);

      // Fecha: aceptar solo YYYY-MM-DD (o el prefijo de una fecha ISO)
      let fecha = campoTexto(m?.fecha_caducidad);
      if (fecha) {
        const match = fecha.match(/^(\d{4})-(\d{2})-(\d{2})/);
        fecha = match ? `${match[1]}-${match[2]}-${match[3]}` : null;
      }

      // Unidad: normalizar contra la lista permitida (default 'piezas')
      let unidad = campoTexto(m?.unidad)?.toLowerCase() || 'piezas';
      if (!UNIDADES_PERMITIDAS.includes(unidad)) unidad = 'piezas';

      let cantidad = parseInt(m?.cantidad, 10);
      if (Number.isNaN(cantidad) || cantidad < 0 || cantidad > 999999) cantidad = 0;

      return {
        nombre: campoTexto(m?.nombre),
        principio_activo: campoTexto(m?.principio_activo),
        dosis: campoTexto(m?.dosis),
        presentacion: campoTexto(m?.presentacion),
        cantidad,
        unidad,
        fecha_caducidad: fecha,
        lote: campoTexto(m?.lote),
        codigo_barras: campoTexto(m?.codigo_barras),
        notas: campoTexto(m?.notas),
      };
    })
    .filter((m) => m.nombre);
};

/**
 * Comprime la imagen (data URL) antes de enviarla a Groq:
 * reduce resolución y la convierte a JPEG para consumir menos tokens
 * (importante en el plan gratuito de Groq) y acelerar el análisis.
 * Si la imagen no es válida o falla el procesamiento, devuelve la original.
 * 
 * @param {string} dataUrl - Imagen en Base64 con prefijo data:image/...
 * @returns {Promise<string>} Data URL comprimido (JPEG) u original
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
    console.warn('No se pudo comprimir la imagen; se enviará la original:', error.message);
    return dataUrl;
  }
};

const inventarioController = {
  /**
   * POST /api/inventario/analizar
   * Recibe una foto (Base64) de un empaque de medicamento y la envía a
   * Llama 3 Vision (Groq) para extraer sus datos clave. Devuelve los
   * medicamentos detectados; el guardado real lo hace el usuario desde
   * el formulario (POST /api/inventario), reutilizando la validación humana.
   */
  async analizar(req, res, next) {
    try {
      const usuarioId = req.user?.id;
      if (!usuarioId) {
        const error = new Error('Usuario no autenticado');
        error.statusCode = 401;
        throw error;
      }

      const { imagenBase64 } = req.body;

      // Validar que la cadena base64 no venga vacía
      if (!imagenBase64 || typeof imagenBase64 !== 'string') {
        const error = new Error('No se ha proporcionado la imagen en Base64 o el formato es incorrecto');
        error.statusCode = 400;
        throw error;
      }

      // Comprimir la imagen para reducir consumo de tokens de Groq
      const imagenComprimida = await comprimirImagen(imagenBase64);
      console.log('Enviando imagen de medicamento a Llama 3 Vision (Groq)...');

      // System Prompt estricto para asegurar JSON y campos normalizados
      const systemPrompt = `
      Eres un experto farmacéutico. Analiza la imagen de un empaque de medicamento (caja, frasco o blíster) y extrae sus datos clave.
      REGLA CRÍTICA ABSOLUTA: devuelve ÚNICAMENTE un objeto JSON válido, sin explicaciones ni texto adicional fuera del JSON.
      Estructura exacta del JSON:
      { "medicamentos": [ { "nombre": "Nombre comercial", "principio_activo": "Principio activo", "dosis": "Dosis por unidad", "presentacion": "Presentacion", "cantidad": 0, "unidad": "piezas", "fecha_caducidad": "YYYY-MM-DD", "lote": "Lote", "codigo_barras": "Codigo de barras", "notas": "Observaciones" } ] }
      REGLAS ADICIONALES:
      - Si hay varios medicamentos visibles en la imagen, devuélvelos TODOS en el arreglo.
      - Si un dato no es legible, usa "" para texto o 0 para cantidad. NUNCA inventes datos.
      - Si la fecha de caducidad solo muestra mes y año, usa el último día de ese mes (YYYY-MM-DD).
      - Si no se detecta ningún medicamento, devuelve { "medicamentos": [] }.
      `;

      // Petición a Groq con reintento ante fallos de validación JSON del modelo
      let completion;
      const maxIntentos = 2;

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
                  { type: "text", text: "Analiza este empaque de medicamento y devuelve el JSON solicitado." },
                  {
                    type: "image_url",
                    image_url: {
                      url: imagenComprimida
                    }
                  }
                ]
              }
            ],
            model: "qwen/qwen3.6-27b",
            temperature: 0.1,
            response_format: { type: "json_object" }
          });
          break;
        } catch (apiError) {
          const esFalloJson = apiError?.code === 'json_validate_failed';
          if (!esFalloJson || intento === maxIntentos) throw apiError;
          console.warn(`Groq falló la validación JSON (intento ${intento}); reintentando...`);
        }
      }

      // Parsear la respuesta y manejar errores
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

      // Sanear los datos extraídos para el formulario del cliente
      const medicamentos = sanitizarExtraidos(jsonData);

      console.log(`Análisis de medicamento exitoso: ${medicamentos.length} detectado(s)`);

      res.status(200).json({
        success: true,
        message: medicamentos.length > 0
          ? `Se detectaron ${medicamentos.length} medicamento(s) en la imagen.`
          : 'No se detectaron medicamentos en la imagen.',
        data: { medicamentos }
      });

    } catch (error) {
      console.error('Error en analizar medicamento (Groq API):', error);
      if (!error.statusCode) {
        error.statusCode = 500;
        error.message = 'Error interno al comunicarse con el motor de Inteligencia Artificial.';
      }
      next(error);
    }
  },

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
