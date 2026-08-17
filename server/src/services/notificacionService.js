/**
 * BDI - Servicio de Notificaciones de Caducidad
 * 
 * Orquesta el recordatorio diario por correo: busca los destinatarios
 * activos, calcula sus alertas de caducidad (reutilizando la lógica del
 * inventario) y envía el correo con Nodemailer.
 * 
 * También expone el envío de un correo de prueba a un usuario específico
 * (endpoint protegido), para verificar la entrega sin spamear.
 */

const notificacionModel = require('../models/notificacionModel');
const medicamentoModel = require('../models/medicamentoModel');
const emailService = require('./emailService');

/**
 * Envía el recordatorio diario a todos los usuarios con notificaciones
 * activas que tengan alertas de caducidad. Los envíos son secuenciales
 * para no exceder los límites de envío del SMTP (Gmail: ~500 correos/día).
 * 
 * @returns {Promise<Object>} Resumen { destinatarios, conAlertas, enviados, errores }
 */
const enviarResumenDiario = async () => {
  const destinatarios = await notificacionModel.findDestinatarios();

  const resumen = {
    destinatarios: destinatarios.length,
    conAlertas: 0,
    enviados: 0,
    omitidosSinAlertas: 0,
    errores: [],
  };

  for (const usuario of destinatarios) {
    try {
      const alertas = await medicamentoModel.findAlertas(usuario.id, usuario.notif_umbral_dias);

      if (alertas.length === 0) {
        resumen.omitidosSinAlertas += 1;
        continue;
      }

      resumen.conAlertas += 1;

      const html = emailService.construirHtml({
        nombre: usuario.nombre,
        alertas,
        umbralDias: usuario.notif_umbral_dias,
      });

      await emailService.enviarCorreo({
        to: usuario.email,
        subject: `BDI: ${alertas.length} medicamento(s) caducado(s) o por vencer`,
        html,
      });

      resumen.enviados += 1;
    } catch (error) {
      console.error(`Error al notificar a ${usuario.email}:`, error.message);
      resumen.errores.push({ email: usuario.email, error: error.message });
    }
  }

  return resumen;
};

/**
 * Envía un correo de prueba al usuario autenticado con su resumen real
 * de alertas (o un mensaje de "todo en orden" si no tiene alertas).
 * 
 * @param {Object} usuario - { id, email, nombre } (datos verificados del modelo)
 * @returns {Promise<Object>} { enviado_a, alertas_incluidas }
 */
const enviarCorreoPrueba = async (usuario) => {
  const prefs = await notificacionModel.getPreferencias(usuario.id);

  if (!prefs) {
    const error = new Error('Usuario no encontrado');
    error.statusCode = 404;
    throw error;
  }

  if (!prefs.email) {
    const error = new Error('Tu cuenta no tiene un correo electrónico asociado');
    error.statusCode = 400;
    throw error;
  }

  const alertas = await medicamentoModel.findAlertas(usuario.id, prefs.notif_umbral_dias);

  const html = emailService.construirHtml({
    nombre: prefs.nombre,
    alertas,
    umbralDias: prefs.notif_umbral_dias,
    esPrueba: true,
  });

  await emailService.enviarCorreo({
    to: prefs.email,
    subject: alertas.length > 0
      ? `BDI [Prueba]: ${alertas.length} medicamento(s) caducado(s) o por vencer`
      : 'BDI [Prueba]: todo en orden en tu botiquín',
    html,
  });

  return { enviado_a: prefs.email, alertas_incluidas: alertas.length };
};

module.exports = { enviarResumenDiario, enviarCorreoPrueba };
