/**
 * BDI - Servicio de Correo Electrónico
 * 
 * Envío de correos con Nodemailer a través de SMTP (Gmail por defecto).
 * Incluye la plantilla HTML responsiva del recordatorio de caducidad.
 * El frontend NUNCA llama a este servicio directamente; solo el backend.
 */

const nodemailer = require('nodemailer');
const config = require('../config/env');

const MESES_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/**
 * Formatea una fecha 'YYYY-MM-DD' a 'd mmm yyyy' en español.
 * @param {string|null} fecha
 * @returns {string}
 */
const formatearFecha = (fecha) => {
  if (!fecha) return 'sin fecha';
  const d = new Date(`${fecha}T00:00:00`);
  if (Number.isNaN(d.getTime())) return String(fecha);
  return `${d.getDate()} ${MESES_ES[d.getMonth()]} ${d.getFullYear()}`;
};

/**
 * Texto legible de urgencia según los días restantes.
 * @param {number} diasRestantes - Negativo si ya caducó
 * @returns {string}
 */
const textoUrgencia = (diasRestantes) => {
  if (diasRestantes < 0) return `Caducó hace ${Math.abs(diasRestantes)} día(s)`;
  if (diasRestantes === 0) return 'Caduca hoy';
  return `Caduca en ${diasRestantes} día(s)`;
};

/**
 * Verifica que el SMTP esté configurado.
 * Lanza error 503 si faltan credenciales (el usuario aún no configura su App Password).
 */
const validarConfiguracion = () => {
  if (!config.smtp.user || !config.smtp.password) {
    const error = new Error(
      'El envío de correos no está configurado. Agrega SMTP_USER y SMTP_PASS (App Password de Gmail) en server/.env'
    );
    error.statusCode = 503;
    throw error;
  }
};

/**
 * Crea el transporter de Nodemailer. Se crea por envío para
 * reflejar cambios de configuración sin reiniciar.
 * @returns {import('nodemailer').Transporter}
 */
const createTransport = () => {
  validarConfiguracion();

  return nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: {
      user: config.smtp.user,
      pass: config.smtp.password,
    },
  });
};

/**
 * Construye el HTML responsivo (una columna, estilos inline) del correo.
 * @param {Object} params
 * @param {string} params.nombre - Nombre del usuario
 * @param {Array<Object>} params.alertas - Medicamentos en alerta
 * @param {number} params.umbralDias - Umbral configurado por el usuario
 * @param {boolean} [params.esPrueba=false] - Marca el correo como prueba
 * @returns {string} HTML completo
 */
const construirHtml = ({ nombre, alertas, umbralDias, esPrueba = false }) => {
  const filas = alertas
    .map((m) => {
      const esCaducado = m.estado === 'caducado';
      const colorFondo = esCaducado ? '#fef2f2' : '#fffbeb';
      const colorBorde = esCaducado ? '#fecaca' : '#fde68a';
      const colorTitulo = esCaducado ? '#7f1d1d' : '#78350f';
      const colorTexto = esCaducado ? '#b91c1c' : '#92400e';

      const detalle = [
        `Vence el ${formatearFecha(m.fecha_caducidad)}`,
        m.dosis ? ` · ${m.dosis}` : '',
        m.presentacion ? ` · ${m.presentacion}` : '',
      ].join('');

      return `
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:10px;">
        <tr>
          <td style="background-color:${colorFondo};border:1px solid ${colorBorde};border-radius:10px;padding:12px 14px;">
            <p style="margin:0;font-size:14px;color:${colorTitulo};font-weight:bold;line-height:1.4;">
              ${m.nombre}${m.cantidad != null ? ` (${m.cantidad} ${m.unidad || 'piezas'})` : ''}
            </p>
            <p style="margin:2px 0 0;font-size:12px;color:${colorTexto};line-height:1.4;">${detalle}</p>
            <p style="margin:6px 0 0;font-size:12px;font-weight:bold;color:${colorTexto};">
              ${textoUrgencia(m.dias_restantes)}
            </p>
          </td>
        </tr>
      </table>`;
    })
    .join('');

  const cuerpo =
    alertas.length > 0
      ? `
        <p style="margin:0 0 16px;color:#334155;font-size:14px;line-height:1.6;">
          Hola <strong>${nombre}</strong>, estos medicamentos de tu botiquín están
          <strong>caducados o por vencer</strong> (umbral configurado: ${umbralDias} días):
        </p>
        ${filas}
        <p style="margin:20px 0 0;color:#64748b;font-size:12px;line-height:1.6;">
          Abre la aplicación BDI para gestionar tu botiquín y descartar los medicamentos caducados.
        </p>`
      : `
        <p style="margin:0;color:#334155;font-size:14px;line-height:1.6;">
          Hola <strong>${nombre}</strong>, todo en orden: ningún medicamento de tu botiquín
          está caducado ni por vencer (umbral configurado: ${umbralDias} días).
        </p>`;

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Botiquín Digital Inteligente</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:24px 16px;">
    <div style="background-color:#0f766e;border-radius:12px 12px 0 0;padding:20px 24px;">
      <h1 style="margin:0;color:#ffffff;font-size:19px;line-height:1.3;">&#127973;&#65039; Botiquín Digital Inteligente</h1>
      <p style="margin:6px 0 0;color:#ccfbf1;font-size:13px;">
        ${esPrueba ? 'Correo de prueba de notificaciones' : 'Recordatorio diario de caducidad de medicamentos'}
      </p>
    </div>
    <div style="background-color:#ffffff;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;padding:20px 24px;">
      ${cuerpo}
    </div>
    <p style="text-align:center;color:#94a3b8;font-size:11px;line-height:1.5;margin:16px 0 0;">
      Este correo se envía automáticamente una vez al día. Puedes ajustar o desactivar
      las notificaciones desde el panel principal de BDI.
    </p>
  </div>
</body>
</html>`.trim();
};

const emailService = {
  /**
   * Envía un correo electrónico.
   * @param {Object} params
   * @param {string} params.to - Dirección del destinatario
   * @param {string} params.subject - Asunto
   * @param {string} params.html - Contenido HTML
   * @returns {Promise<Object>} Información del envío (nodemailer)
   */
  async enviarCorreo({ to, subject, html }) {
    const transporter = createTransport();

    const info = await transporter.sendMail({
      from: config.smtp.from || config.smtp.user,
      to,
      subject,
      html,
    });

    console.log(`📧 Correo enviado a ${to} (messageId: ${info.messageId})`);
    return info;
  },

  construirHtml,
};

module.exports = emailService;
