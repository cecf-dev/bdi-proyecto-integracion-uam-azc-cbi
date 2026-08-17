import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const ESTADOS_BADGE = {
  vigente: 'bg-green-100 text-green-700 border-green-200',
  por_vencer: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  caducado: 'bg-red-100 text-red-700 border-red-200',
};

const ESTADOS_TEXTO = {
  vigente: 'Vigente',
  por_vencer: 'Por vencer',
  caducado: 'Caducado',
};

const UNIDADES = ['piezas', 'tabletas', 'capsulas', 'ml', 'mg', 'sobres', 'tubos', 'frascos'];

const FORM_INICIAL = {
  nombre: '',
  principio_activo: '',
  dosis: '',
  presentacion: '',
  cantidad: '0',
  unidad: 'piezas',
  fecha_caducidad: '',
  lote: '',
  codigo_barras: '',
  notas: '',
};

const formatearFecha = (fecha) => {
  if (!fecha) return 'Sin caducidad';
  const d = new Date(fecha);
  if (Number.isNaN(d.getTime())) return String(fecha);
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
};

export default function Inventario() {
  const [medicamentos, setMedicamentos] = useState([]);
  const [resumen, setResumen] = useState({ total: 0, vigentes: 0, porVencer: 0, caducados: 0 });
  const [alertas, setAlertas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(FORM_INICIAL);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  const cargarInventario = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [response, alertasResp] = await Promise.all([
        api.get('/inventario'),
        api.get('/inventario/alertas?dias=30'),
      ]);
      setMedicamentos(response.data);
      setResumen(response.resumen);
      setAlertas(alertasResp.data);
    } catch (err) {
      console.error(err);
      setError(err?.message || 'No se pudo cargar el inventario.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargarInventario();
  }, [cargarInventario]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const abrirFormNuevo = () => {
    setForm(FORM_INICIAL);
    setEditingId(null);
    setFormError(null);
    setShowForm(true);
  };

  const abrirFormEdicion = (med) => {
    setForm({
      nombre: med.nombre || '',
      principio_activo: med.principio_activo || '',
      dosis: med.dosis || '',
      presentacion: med.presentacion || '',
      cantidad: String(med.cantidad ?? 0),
      unidad: med.unidad || 'piezas',
      fecha_caducidad: med.fecha_caducidad ? String(med.fecha_caducidad).slice(0, 10) : '',
      lote: med.lote || '',
      codigo_barras: med.codigo_barras || '',
      notas: med.notas || '',
    });
    setEditingId(med.id);
    setFormError(null);
    setShowForm(true);
  };

  const cerrarForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormError(null);
  };

  const guardar = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);

    const payload = { ...form, cantidad: parseInt(form.cantidad, 10) || 0 };

    try {
      if (editingId) {
        await api.put(`/inventario/${editingId}`, payload);
      } else {
        await api.post('/inventario', payload);
      }
      cerrarForm();
      await cargarInventario();
    } catch (err) {
      console.error(err);
      setFormError(err?.message || 'No se pudo guardar el medicamento.');
    } finally {
      setSaving(false);
    }
  };

  const eliminar = async (med) => {
    const confirmacion = window.confirm(
      `¿Eliminar "${med.nombre}" de tu botiquín? Esta acción no se puede deshacer.`
    );
    if (!confirmacion) return;

    try {
      await api.delete(`/inventario/${med.id}`);
      await cargarInventario();
    } catch (err) {
      console.error(err);
      setError(err?.message || 'No se pudo eliminar el medicamento.');
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4 py-8 animate-fade-in">
      <div className="mb-6 text-center">
        <h1 className="text-3xl font-display font-bold text-surface-900 mb-2">
          Mi Botiquín
        </h1>
        <p className="text-surface-500">Inventario de medicamentos y alertas de caducidad.</p>
      </div>

      {/* Resumen de alertas (estático) */}
      {!loading && !error && (
        <div className="grid grid-cols-4 gap-2 mb-6">
          <div className="bg-white rounded-xl border border-surface-200 p-3 text-center">
            <p className="text-xl font-bold text-surface-800">{resumen.total}</p>
            <p className="text-[11px] text-surface-500 font-medium">Total</p>
          </div>
          <div className="bg-white rounded-xl border border-green-200 p-3 text-center">
            <p className="text-xl font-bold text-green-700">{resumen.vigentes}</p>
            <p className="text-[11px] text-green-600 font-medium">Vigentes</p>
          </div>
          <div className="bg-white rounded-xl border border-yellow-200 p-3 text-center">
            <p className="text-xl font-bold text-yellow-700">{resumen.porVencer}</p>
            <p className="text-[11px] text-yellow-600 font-medium">Por vencer</p>
          </div>
          <div className="bg-white rounded-xl border border-red-200 p-3 text-center">
            <p className="text-xl font-bold text-red-700">{resumen.caducados}</p>
            <p className="text-[11px] text-red-600 font-medium">Caducados</p>
          </div>
        </div>
      )}

      {/* Banner de alertas de caducidad (notificación proactiva, estática) */}
      {!loading && !error && alertas.length > 0 && (
        <div className="mb-6 rounded-2xl border-2 overflow-hidden animate-fade-in">
          <div className="bg-red-600 text-white px-4 py-3 flex items-center gap-2">
            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-sm font-bold">
              {alertas.length === 1 ? 'Tienes 1 medicamento que requiere atención' : `Tienes ${alertas.length} medicamentos que requieren atención`}
            </p>
          </div>
          <div className="bg-white px-4 py-3 flex flex-col gap-2">
            {alertas.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-3 border-b border-surface-100 py-2 last:border-b-0">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-surface-900 truncate">{a.nombre}</p>
                  <p className="text-xs text-surface-500">
                    {a.dias_restantes < 0
                      ? `Caducó hace ${Math.abs(a.dias_restantes)} día(s)`
                      : a.dias_restantes === 0
                      ? 'Caduca hoy'
                      : `Caduca en ${a.dias_restantes} día(s)`}
                  </p>
                </div>
                <span
                  className={`flex-shrink-0 text-xs font-semibold px-3 py-1 rounded-full border ${
                    a.estado === 'caducado'
                      ? 'bg-red-100 text-red-700 border-red-200'
                      : 'bg-yellow-100 text-yellow-700 border-yellow-200'
                  }`}
                >
                  {a.estado === 'caducado' ? 'Caducado' : 'Por vencer'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Botón agregar / cancelar (estático y amplio) */}
      {!showForm ? (
        <button
          onClick={abrirFormNuevo}
          className="w-full py-4 px-6 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl shadow-lg shadow-primary-500/30 transition-colors active:bg-primary-800 mb-6"
        >
          + Agregar Medicamento
        </button>
      ) : (
        <div className="bg-white rounded-2xl shadow-lg border border-surface-200 p-4 sm:p-6 mb-6">
          <h2 className="text-lg font-bold text-surface-800 mb-4">
            {editingId ? 'Editar Medicamento' : 'Nuevo Medicamento'}
          </h2>

          <form onSubmit={guardar} className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">Nombre *</label>
              <input
                type="text"
                name="nombre"
                value={form.nombre}
                onChange={handleChange}
                required
                className="w-full bg-surface-50 border border-surface-200 rounded-lg px-4 py-3 text-surface-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Ej. Paracetamol"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">Principio Activo</label>
              <input
                type="text"
                name="principio_activo"
                value={form.principio_activo}
                onChange={handleChange}
                className="w-full bg-surface-50 border border-surface-200 rounded-lg px-4 py-3 text-surface-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Ej. Acetaminofén"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-surface-700 mb-1">Dosis</label>
                <input
                  type="text"
                  name="dosis"
                  value={form.dosis}
                  onChange={handleChange}
                  className="w-full bg-surface-50 border border-surface-200 rounded-lg px-4 py-3 text-surface-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Ej. 500mg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-700 mb-1">Presentación</label>
                <input
                  type="text"
                  name="presentacion"
                  value={form.presentacion}
                  onChange={handleChange}
                  className="w-full bg-surface-50 border border-surface-200 rounded-lg px-4 py-3 text-surface-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Ej. Tabletas"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-surface-700 mb-1">Cantidad *</label>
                <input
                  type="number"
                  name="cantidad"
                  min="0"
                  value={form.cantidad}
                  onChange={handleChange}
                  required
                  className="w-full bg-surface-50 border border-surface-200 rounded-lg px-4 py-3 text-surface-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-700 mb-1">Unidad</label>
                <select
                  name="unidad"
                  value={form.unidad}
                  onChange={handleChange}
                  className="w-full bg-surface-50 border border-surface-200 rounded-lg px-4 py-3 text-surface-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  {UNIDADES.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">Fecha de Caducidad</label>
              <input
                type="date"
                name="fecha_caducidad"
                value={form.fecha_caducidad}
                onChange={handleChange}
                className="w-full bg-surface-50 border border-surface-200 rounded-lg px-4 py-3 text-surface-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-surface-700 mb-1">Lote</label>
                <input
                  type="text"
                  name="lote"
                  value={form.lote}
                  onChange={handleChange}
                  className="w-full bg-surface-50 border border-surface-200 rounded-lg px-4 py-3 text-surface-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-700 mb-1">Código de Barras</label>
                <input
                  type="text"
                  name="codigo_barras"
                  value={form.codigo_barras}
                  onChange={handleChange}
                  className="w-full bg-surface-50 border border-surface-200 rounded-lg px-4 py-3 text-surface-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">Notas</label>
              <textarea
                name="notas"
                value={form.notas}
                onChange={handleChange}
                rows="2"
                className="w-full bg-surface-50 border border-surface-200 rounded-lg px-4 py-3 text-surface-900 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                placeholder="Ej. Guardar en refrigeración"
              />
            </div>

            {formError && (
              <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
                {formError}
              </div>
            )}

            <div className="flex flex-col gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="w-full py-4 px-6 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl transition-colors active:bg-primary-800 disabled:opacity-60 disabled:cursor-wait"
              >
                {saving ? 'Guardando...' : editingId ? 'Guardar Cambios' : 'Agregar al Botiquín'}
              </button>
              <button
                type="button"
                onClick={cerrarForm}
                disabled={saving}
                className="w-full py-4 px-6 bg-surface-100 hover:bg-surface-200 text-surface-700 font-bold rounded-xl transition-colors active:bg-surface-300 disabled:opacity-50"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Estado de carga (estático) */}
      {loading && (
        <div className="text-center py-16">
          <div className="w-10 h-10 mx-auto border-4 border-surface-200 border-t-primary-500 rounded-full animate-spin"></div>
          <p className="text-surface-500 mt-4 text-sm">Cargando inventario...</p>
        </div>
      )}

      {/* Error global con reintento */}
      {!loading && error && (
        <div className="p-6 bg-red-50 border-2 border-red-200 rounded-2xl text-center">
          <p className="text-red-700 font-medium mb-4">{error}</p>
          <button
            onClick={cargarInventario}
            className="w-full py-4 px-6 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-colors active:bg-red-800"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Estado vacío */}
      {!loading && !error && medicamentos.length === 0 && !showForm && (
        <div className="bg-white rounded-2xl shadow-lg border border-surface-200 p-10 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-surface-100 flex items-center justify-center text-surface-400">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-surface-700 mb-2">Tu botiquín está vacío</h3>
          <p className="text-sm text-surface-500">
            Agrega tus medicamentos para llevar el control de existencias y caducidad.
          </p>
        </div>
      )}

      {/* Lista de medicamentos (una sola columna) */}
      {!loading && !error && medicamentos.length > 0 && (
        <div className="flex flex-col gap-4">
          {medicamentos.map((med) => (
            <article
              key={med.id}
              className="bg-white rounded-2xl shadow-md border border-surface-200 overflow-hidden"
            >
              <div className="p-5">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <h3 className="text-lg font-bold text-surface-900 truncate">{med.nombre}</h3>
                    {med.dosis && (
                      <p className="text-sm text-surface-500">{med.dosis}{med.presentacion ? ` · ${med.presentacion}` : ''}</p>
                    )}
                  </div>
                  <span
                    className={`flex-shrink-0 text-xs font-semibold px-3 py-1 rounded-full border ${ESTADOS_BADGE[med.estado] || ESTADOS_BADGE.vigente}`}
                  >
                    {ESTADOS_TEXTO[med.estado] || med.estado}
                  </span>
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-surface-500 mb-3">
                  <span className="font-semibold text-surface-700">
                    {med.cantidad} {med.unidad}
                  </span>
                  <span>Caduca: {formatearFecha(med.fecha_caducidad)}</span>
                  {med.lote && <span>Lote: {med.lote}</span>}
                </div>

                {med.notas && (
                  <p className="text-xs text-surface-400 italic mb-3">{med.notas}</p>
                )}

                <div className="flex gap-3 pt-3 border-t border-surface-100">
                  <button
                    onClick={() => abrirFormEdicion(med)}
                    className="w-full py-3 px-4 bg-surface-100 hover:bg-surface-200 text-surface-700 font-bold rounded-xl transition-colors active:bg-surface-300"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => eliminar(med)}
                    className="w-full py-3 px-4 bg-red-50 hover:bg-red-100 text-red-600 font-bold rounded-xl transition-colors active:bg-red-200"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
