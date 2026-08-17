import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

const LIMITE = 10;

const ESTADOS_BADGE = {
  procesada: 'bg-green-100 text-green-700 border-green-200',
  pendiente: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  error: 'bg-red-100 text-red-700 border-red-200',
};

const ESTADOS_TEXTO = {
  procesada: 'Procesada',
  pendiente: 'Pendiente',
  error: 'Error',
};

const formatearFecha = (fecha) => {
  if (!fecha) return 'Sin fecha';
  const d = new Date(fecha);
  if (Number.isNaN(d.getTime())) return String(fecha);
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
};

export default function HistorialRecetas() {
  const [recetas, setRecetas] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: LIMITE, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const cargarRecetas = useCallback(async (page) => {
    setLoading(true);
    setError(null);
    try {
      // El interceptor de api.js devuelve response.data directamente
      const response = await api.get(`/recetas?page=${page}&limit=${LIMITE}`);
      setRecetas(response.data);
      setPagination(response.pagination);
    } catch (err) {
      console.error(err);
      setError(err?.message || 'No se pudo cargar el historial de recetas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargarRecetas(1);
  }, [cargarRecetas]);

  const irPagina = (page) => {
    if (page >= 1 && page <= pagination.totalPages && page !== pagination.page) {
      cargarRecetas(page);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4 py-8 animate-fade-in">
      <div className="mb-6 text-center">
        <h1 className="text-3xl font-display font-bold text-surface-900 mb-2">
          Mis Recetas
        </h1>
        <p className="text-surface-500">
          Historial de recetas médicas digitalizadas.
        </p>
      </div>

      {/* Estado de carga (estático, sin desplazamientos) */}
      {loading && (
        <div className="text-center py-16">
          <div className="w-10 h-10 mx-auto border-4 border-surface-200 border-t-primary-500 rounded-full animate-spin"></div>
          <p className="text-surface-500 mt-4 text-sm">Cargando historial...</p>
        </div>
      )}

      {/* Error con reintento (botón estático y amplio) */}
      {!loading && error && (
        <div className="p-6 bg-red-50 border-2 border-red-200 rounded-2xl text-center">
          <p className="text-red-700 font-medium mb-4">{error}</p>
          <button
            onClick={() => cargarRecetas(1)}
            className="w-full py-4 px-6 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-colors active:bg-red-800"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Estado vacío */}
      {!loading && !error && recetas.length === 0 && (
        <div className="bg-white rounded-2xl shadow-lg border border-surface-200 p-10 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-surface-100 flex items-center justify-center text-surface-400">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-surface-700 mb-2">Aún no tienes recetas</h3>
          <p className="text-sm text-surface-500 mb-6">
            Escanea tu primera receta médica para comenzar tu historial.
          </p>
          <Link
            to="/escaner"
            className="block w-full py-4 px-6 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl text-center transition-colors active:bg-primary-800"
          >
            Escanear Receta
          </Link>
        </div>
      )}

      {/* Lista de recetas (una sola columna, cards apiladas) */}
      {!loading && !error && recetas.length > 0 && (
        <div className="flex flex-col gap-4">
          {recetas.map((receta) => (
            <article
              key={receta.id}
              className="bg-white rounded-2xl shadow-md border border-surface-200 overflow-hidden"
            >
              <Link to={`/recetas/${receta.id}`} className="block p-5 hover:bg-surface-50 transition-colors">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <h2 className="text-lg font-bold text-surface-900 truncate">
                      {receta.paciente_nombre || 'Paciente no especificado'}
                    </h2>
                    <p className="text-xs text-surface-500 mt-0.5">
                      {formatearFecha(receta.fecha_emision)}
                      {receta.medico_cedula ? ` · Cédula ${receta.medico_cedula}` : ''}
                    </p>
                  </div>
                  <span
                    className={`flex-shrink-0 text-xs font-semibold px-3 py-1 rounded-full border ${ESTADOS_BADGE[receta.estado] || ESTADOS_BADGE.pendiente}`}
                  >
                    {ESTADOS_TEXTO[receta.estado] || receta.estado}
                  </span>
                </div>

                {receta.diagnostico && (
                  <p className="text-sm text-surface-600 mb-3">
                    <span className="font-semibold text-surface-700">Diagnóstico: </span>
                    {receta.diagnostico}
                  </p>
                )}

                {/* Medicamentos de la receta */}
                {receta.medicamentos && receta.medicamentos.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {receta.medicamentos.map((med, index) => (
                      <span
                        key={index}
                        className="text-xs bg-primary-50 text-primary-700 border border-primary-100 font-medium px-3 py-1.5 rounded-full"
                      >
                        {med.nombre_medicamento}
                        {med.dosis ? ` · ${med.dosis}` : ''}
                      </span>
                    ))}
                  </div>
                )}

                <p className="mt-3 text-right text-xs font-semibold text-primary-600">
                  Ver detalle →
                </p>
              </Link>
            </article>
          ))}

          {/* Paginación: botones estáticos y amplios */}
          {pagination.totalPages > 1 && (
            <div className="pt-2 pb-4 flex flex-col gap-3">
              <div className="flex gap-3">
                <button
                  onClick={() => irPagina(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                  className="w-full py-4 px-6 bg-white border border-surface-200 text-surface-700 font-bold rounded-xl transition-colors hover:bg-surface-100 active:bg-surface-200 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Anterior
                </button>
                <button
                  onClick={() => irPagina(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages}
                  className="w-full py-4 px-6 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl transition-colors active:bg-primary-800 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Siguiente
                </button>
              </div>
              <p className="text-center text-xs text-surface-500">
                Página {pagination.page} de {pagination.totalPages} · {pagination.total} recetas
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
