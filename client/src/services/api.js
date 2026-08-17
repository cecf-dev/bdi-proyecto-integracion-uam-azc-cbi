/**
 * BDI - Servicio de API
 * 
 * Instancia centralizada de Axios para comunicarse con el backend.
 * Todas las peticiones del frontend deben pasar por aquí.
 */

import axios from 'axios';

/**
 * Instancia de Axios preconfigurada.
 * - Base URL desde variable de entorno
 * - Headers por defecto
 * - Interceptores para auth y manejo de errores
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  timeout: 30000, // 30 segundos (uploads de imágenes pueden tardar)
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Interceptor de Request:
 * Agrega el token JWT a cada petición si existe.
 */
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('bdi_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

/**
 * Interceptor de Response:
 * Maneja errores globalmente (401 = sesión expirada, etc.)
 */
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response) {
      const { status, data } = error.response;

      // Token expirado o inválido
      if (status === 401) {
        localStorage.removeItem('bdi_token');
        window.location.href = '/login';
      }

      return Promise.reject({
        status,
        message: data?.error?.message || 'Error del servidor',
      });
    }

    // Error de red
    return Promise.reject({
      status: 0,
      message: 'Error de conexión. Verifica tu conexión a internet.',
    });
  }
);

export default api;
