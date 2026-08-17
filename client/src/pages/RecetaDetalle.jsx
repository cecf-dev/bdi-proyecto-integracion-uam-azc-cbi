import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../services/api';

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

export default function RecetaDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [receta, setReceta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Edición
  const [editando, setEditando] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState(null);

  // Eliminación
  const [deleting, setDeleting] = useState(false);

  const cargarReceta = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get(`/recetas/${id}`);
      setReceta(response.data);
    } catch (err) {
      console.error(err);
      setError(err?.message || 'No se pudo cargar la receta.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    cargarReceta();
  }, [cargarReceta]);

  const iniciarEdicion = () => {
    setEditForm({
      paciente_nombre: receta.paciente_nombre || '',
      fecha_emision: receta.fecha_emision ? String(receta.fecha_emision).slice(0, 10) : '',
      medico_cedula: receta.medico_cedula || '',
      diagnostico: receta.diagnostico || '',
      medicamentos: (receta.medicamentos || []).map((m) => ({
        nombre_medicamento: m.nombre_medicamento || '',
        dosis: m.dosis || '',
        indicaciones: m.indicaciones || '',
      })),
    });
    setEditError(null);
    setEditando(true);
  };

  const cancelarEdicion = () => {
    setEditando(false);
    setEditForm(null);
    setEditError(null);
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleMedicamentoChange = (index, field, value) => {
    const nuevos = [...editForm.medicamentos];
    nuevos[index] = { ...nuevos[index], [field]: value };
    setEditForm((prev) => ({ ...prev, medicamentos: nuevos }));
  };

  const addMedicamento = () => {
    setEditForm((prev) => ({
      ...prev,
      medicamentos: [...prev.medicamentos, { nombre_medicamento: '', dosis: '', indicaciones: '' }],
    }));
  };

  const removeMedicamento = (index) => {
    const nuevos = [...editForm.medicamentos];
    nuevos.splice(index, 1);
    setEditForm((prev) => ({ ...prev, medicamentos: nuevos }));
  };

  const guardarEdicion = async (e) => {
    e.preventDefault();
    setEditSaving(true);
    setEditError(null);

    try {
      const response = await api.put(`/recetas/${id}`, editForm);
      setReceta(response.data);
      setEditando(false);
    } catch (err) {
      console.error(err);
      setEditError(err?.message || 'No se pudo actualizar la receta.');
    } finally {
      setEditSaving(false);
    }
  };

  const eliminarReceta = async () => {
    const confirmacion = window.confirm(
      '¿Eliminar esta receta de tu historial? Esta acción no se puede deshacer.'
    );
    if (!confirmacion) return;

    setDeleting(true);
    setError(null);

    try {
      await api.delete(`/recetas/${id}`);
      navigate('/recetas');
    } catch (err) {
      console.error(err);
      setError(err?.message || 'No se pudo eliminar la receta.');
      setDeleting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4 py-8 animate-fade-in">
      {/* Botón de regreso (estático y amplio) */}
      <Link
        to="/recetas"
        className="inline-block w-full sm:w-auto py-3 px-6 bg-surface-100 hover:bg-surface-200 text-surface-700 font-bold rounded-xl transition-colors active:bg-surface-300 mb-6 text-center"
      >
        ← Volver al historial
      </Link>

      {loading && (
        <div className="text-center py-16">
          <div className="w-10 h-10 mx-auto border-4 border-surface-200 border-t-primary-500 rounded-full animate-spin"></div>
          <p className="text-surface-500 mt-4 text-sm">Cargando receta...</p>
        </div>
      )}

      {!loading && error && (
        <div className="p-6 bg-red-50 border-2 border-red-200 rounded-2xl text-center">
          <p className="text-red-700 font-medium mb-4">{error}</p>
          <button
            onClick={cargarReceta}
            className="w-full py-4 px-6 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-colors active:bg-red-800"
          >
            Reintentar
          </button>
        </div>
      )}

      {!loading && !error && receta && (
        <div className="flex flex-col gap-6">
          {/* Imagen original de la receta */}
          {receta.imagen_base64 && (
            <div className="bg-white rounded-2xl shadow-lg border border-surface-200 overflow-hidden">
              <img
                src={receta.imagen_base64}
                alt="Receta médica original"
                className="w-full max-h-96 object-contain bg-surface-100"
              />
            </div>
          )}

          {/* Formulario de edición (reemplaza temporalmente los datos) */}
          {editando && editForm && (
            <section className="bg-white rounded-2xl shadow-lg border border-surface-200 p-4 sm:p-6">
              <h2 className="text-lg font-bold text-surface-800 mb-4">Editar receta</h2>

              <form onSubmit={guardarEdicion} className="flex flex-col gap-4">
                <div>
                  <label className="block text-sm font-medium text-surface-700 mb-1">Nombre del Paciente</label>
                  <input
                    type="text"
                    name="paciente_nombre"
                    value={editForm.paciente_nombre}
                    onChange={handleEditChange}
                    className="w-full bg-surface-50 border border-surface-200 rounded-lg px-4 py-3 text-surface-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-surface-700 mb-1">Fecha de Emisión</label>
                  <input
                    type="date"
                    name="fecha_emision"
                    value={editForm.fecha_emision}
                    onChange={handleEditChange}
                    className="w-full bg-surface-50 border border-surface-200 rounded-lg px-4 py-3 text-surface-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-surface-700 mb-1">Cédula Profesional</label>
                  <input
                    type="text"
                    name="medico_cedula"
                    value={editForm.medico_cedula}
                    onChange={handleEditChange}
                    className="w-full bg-surface-50 border border-surface-200 rounded-lg px-4 py-3 text-surface-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-surface-700 mb-1">Diagnóstico</label>
                  <textarea
                    name="diagnostico"
                    value={editForm.diagnostico}
                    onChange={handleEditChange}
                    rows="2"
                    className="w-full bg-surface-50 border border-surface-200 rounded-lg px-4 py-3 text-surface-900 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                  />
                </div>

                {/* Medicamentos editables */}
                <div className="space-y-3 mt-2">
                  <div className="flex justify-between items-center border-b border-surface-100 pb-1">
                    <h3 className="text-sm font-bold text-primary-700 uppercase tracking-wider">
                      Medicamentos ({editForm.medicamentos.length})
                    </h3>
                    <button
                      type="button"
                      onClick={addMedicamento}
                      className="text-xs bg-surface-100 hover:bg-surface-200 text-surface-700 font-medium py-1 px-3 rounded-full transition-colors"
                    >
                      + Agregar
                    </button>
                  </div>

                  {editForm.medicamentos.map((med, index) => (
                    <div key={index} className="bg-surface-50 border border-surface-200 p-4 rounded-xl relative">
                      <button
                        type="button"
                        onClick={() => removeMedicamento(index)}
                        className="absolute top-2 right-2 text-surface-400 hover:text-red-500 p-1"
                        aria-label="Eliminar medicamento"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>

                      <div className="space-y-3 pt-2">
                        <div>
                          <label className="block text-xs font-semibold text-surface-500 mb-1">Medicamento</label>
                          <input
                            type="text"
                            value={med.nombre_medicamento}
                            onChange={(e) => handleMedicamentoChange(index, 'nombre_medicamento', e.target.value)}
                            className="w-full bg-white border border-surface-200 rounded-lg px-3 py-2 text-sm text-surface-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-surface-500 mb-1">Dosis / Presentación</label>
                          <input
                            type="text"
                            value={med.dosis}
                            onChange={(e) => handleMedicamentoChange(index, 'dosis', e.target.value)}
                            className="w-full bg-white border border-surface-200 rounded-lg px-3 py-2 text-sm text-surface-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-surface-500 mb-1">Indicaciones</label>
                          <textarea
                            value={med.indicaciones}
                            onChange={(e) => handleMedicamentoChange(index, 'indicaciones', e.target.value)}
                            rows="2"
                            className="w-full bg-white border border-surface-200 rounded-lg px-3 py-2 text-sm text-surface-900 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {editError && (
                  <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
                    {editError}
                  </div>
                )}

                <div className="flex flex-col gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={editSaving}
                    className="w-full py-4 px-6 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl transition-colors active:bg-primary-800 disabled:opacity-60 disabled:cursor-wait"
                  >
                    {editSaving ? 'Guardando...' : 'Guardar Cambios'}
                  </button>
                  <button
                    type="button"
                    onClick={cancelarEdicion}
                    disabled={editSaving}
                    className="w-full py-4 px-6 bg-surface-100 hover:bg-surface-200 text-surface-700 font-bold rounded-xl transition-colors active:bg-surface-300 disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </section>
          )}

          {/* Datos clínicos (ocultos durante la edición) */}
          {!editando && (
          <section className="bg-white rounded-2xl shadow-lg border border-surface-200 p-4 sm:p-6">
            <div className="flex items-start justify-between gap-3 mb-4">
              <h1 className="text-xl font-bold text-surface-900">
                {receta.paciente_nombre || 'Paciente no especificado'}
              </h1>
              <span
                className={`flex-shrink-0 text-xs font-semibold px-3 py-1 rounded-full border ${ESTADOS_BADGE[receta.estado] || ESTADOS_BADGE.pendiente}`}
              >
                {ESTADOS_TEXTO[receta.estado] || receta.estado}
              </span>
            </div>

            <dl className="flex flex-col gap-3">
              <div>
                <dt className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Fecha de emisión</dt>
                <dd className="text-sm text-surface-800 mt-0.5">{formatearFecha(receta.fecha_emision)}</dd>
              </div>

              {receta.medico_nombre && (
                <div>
                  <dt className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Médico</dt>
                  <dd className="text-sm text-surface-800 mt-0.5">{receta.medico_nombre}</dd>
                </div>
              )}

              {receta.medico_cedula && (
                <div>
                  <dt className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Cédula profesional</dt>
                  <dd className="text-sm text-surface-800 mt-0.5">{receta.medico_cedula}</dd>
                </div>
              )}

              {receta.diagnostico && (
                <div>
                  <dt className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Diagnóstico</dt>
                  <dd className="text-sm text-surface-800 mt-0.5">{receta.diagnostico}</dd>
                </div>
              )}

              {receta.codigo_cie10 && (
                <div>
                  <dt className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Código CIE-10</dt>
                  <dd className="text-sm text-surface-800 mt-0.5">{receta.codigo_cie10}</dd>
                </div>
              )}

              <div>
                <dt className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Registrada el</dt>
                <dd className="text-sm text-surface-800 mt-0.5">
                  {new Date(receta.created_at).toLocaleString('es-MX', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </dd>
              </div>
            </dl>
          </section>
          )}

          {/* Medicamentos prescritos (ocultos durante la edición) */}
          {!editando && (
          <section className="bg-white rounded-2xl shadow-lg border border-surface-200 p-4 sm:p-6">
            <h2 className="text-lg font-bold text-surface-800 mb-4">
              Medicamentos ({receta.medicamentos?.length || 0})
            </h2>

            {(!receta.medicamentos || receta.medicamentos.length === 0) ? (
              <p className="text-sm text-surface-500 text-center py-4">
                Esta receta no tiene medicamentos registrados.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {receta.medicamentos.map((med) => (
                  <article key={med.id} className="border border-surface-200 rounded-xl p-4">
                    <h3 className="text-sm font-bold text-surface-900">{med.nombre_medicamento}</h3>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-surface-500 mt-1">
                      {med.dosis && <span>Dosis: {med.dosis}</span>}
                      {med.frecuencia && <span>Frecuencia: {med.frecuencia}</span>}
                      {med.duracion && <span>Duración: {med.duracion}</span>}
                    </div>
                    {med.indicaciones && (
                      <p className="text-sm text-surface-600 mt-2 bg-surface-50 rounded-lg p-3">
                        {med.indicaciones}
                      </p>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>
          )}

          {/* Acciones finales */}
          {!editando && (
          <div className="flex flex-col gap-3 pb-4">
            <button
              onClick={iniciarEdicion}
              className="w-full py-4 px-6 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl transition-colors active:bg-primary-800"
            >
              Editar receta
            </button>
            <button
              onClick={eliminarReceta}
              disabled={deleting}
              className="w-full py-4 px-6 bg-red-50 hover:bg-red-100 text-red-600 font-bold rounded-xl border border-red-200 transition-colors active:bg-red-200 disabled:opacity-50 disabled:cursor-wait"
            >
              {deleting ? 'Eliminando...' : 'Eliminar receta'}
            </button>
            <Link
              to="/inventario"
              className="w-full py-4 px-6 bg-surface-100 hover:bg-surface-200 text-surface-700 font-bold rounded-xl text-center transition-colors active:bg-surface-300"
            >
              Gestionar mi botiquín
            </Link>
            <Link
              to="/recetas"
              className="w-full py-4 px-6 bg-surface-100 hover:bg-surface-200 text-surface-700 font-bold rounded-xl text-center transition-colors active:bg-surface-300"
            >
              Ver todas mis recetas
            </Link>
          </div>
          )}
        </div>
      )}
    </div>
  );
}
