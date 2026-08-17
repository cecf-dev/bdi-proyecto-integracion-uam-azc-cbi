/**
 * BDI - Configuración de Express
 * 
 * Configura la aplicación Express con middlewares de seguridad,
 * logging, parsing y rutas. Exporta la instancia para server.js.
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

// Middlewares propios
const { notFound, errorHandler } = require('./middlewares/errorHandler');

// Rutas
const healthRoutes = require('./routes/healthRoutes');
const authRoutes = require('./routes/authRoutes');

// Crear instancia de Express
const app = express();

// ===================================
// Middlewares de Seguridad
// ===================================

// Helmet: configura headers HTTP de seguridad
app.use(helmet());

// CORS: permite peticiones del frontend en desarrollo
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ===================================
// Middlewares de Parsing
// ===================================

// JSON body parser (límite 10MB para imágenes en base64)
app.use(express.json({ limit: '10mb' }));

// URL-encoded parser
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ===================================
// Logging
// ===================================

// Morgan: logging de peticiones HTTP
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// ===================================
// Rutas de la API
// ===================================

app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);

const recetaRoutes = require('./routes/recetaRoutes');
const inventarioRoutes = require('./routes/inventarioRoutes');
const farmaciaRoutes = require('./routes/farmaciaRoutes');
const notificacionRoutes = require('./routes/notificacionRoutes');

// Rutas futuras se agregarán aquí:
app.use('/api/recetas', recetaRoutes);
app.use('/api/inventario', inventarioRoutes);
app.use('/api/farmacias', farmaciaRoutes);
app.use('/api/notificaciones', notificacionRoutes);
// app.use('/api/ia', iaRoutes);

// ===================================
// Manejo de Errores
// ===================================

app.use(notFound);
app.use(errorHandler);

module.exports = app;
