import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const formatearFecha = (fecha) => {
  if (!fecha) return 'Sin fecha';
  const d = new Date(fecha);
  if (Number.isNaN(d.getTime())) return String(fecha);
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
};

export default function Dashboard() {
  const { user } = useAuth();

  const [resumen, setResumen] = useState(null);
  const [alertas, setAlertas] = useState([]);
  const [recetas, setRecetas] = useState([]);
  const [totalRecetas, setTotalRecetas] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [prefsNotif, setPrefsNotif] = useState(null);
  const [notifActivas, setNotifActivas] = useState(true);
  const [umbralInput, setUmbralInput] = useState(30);
  const [guardandoNotif, setGuardandoNotif] = useState(false);
  const [probandoCorreo, setProbandoCorreo] = useState(false);
  const [notifMsg, setNotifMsg] = useState(null);

  const cargarPreferencias = useCallback(async () => {
    try {
      const resp = await api.get('/notificaciones/preferencias');
      setPrefsNotif(resp.data);
      setNotifActivas(resp.data.notif_activas);
      setUmbralInput(resp.data.notif_umbral_dias);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const guardarPreferencias = async () => {
    setGuardandoNotif(true);
    setNotifMsg(null);
    try {
      const resp = await api.put('/notificaciones/preferencias', {
        notif_activas: notifActivas,
        notif_umbral_dias: umbralInput,
      });
      setPrefsNotif(resp.data);
      setNotifMsg({ tipo: 'ok', texto: 'Preferencias guardadas correctamente.' });
    } catch (err) {
      setNotifMsg({ tipo: 'error', texto: err?.message || 'No se pudieron guardar las preferencias.' });
    } finally {
      setGuardandoNotif(false);
    }
  };

  const enviarCorreoPrueba = async () => {
    setProbandoCorreo(true);
    setNotifMsg(null);
    try {
      const resp = await api.post('/notificaciones/probar');
      setNotifMsg({ tipo: 'ok', texto: resp.message });
    } catch (err) {
      setNotifMsg({ tipo: 'error', texto: err?.message || 'No se pudo enviar el correo de prueba.' });
    } finally {
      setProbandoCorreo(false);
    }
  };

  const cargarDatos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Inventario (resumen), recordatorios de caducidad y recetas recientes
      const [inv, alertasResp, rec] = await Promise.all([
        api.get('/inventario'),
        api.get('/inventario/alertas?dias=30'),
        api.get('/recetas?page=1&limit=5'),
      ]);

      setResumen(inv.resumen);
      setAlertas(alertasResp.data);
      setRecetas(rec.data);
      setTotalRecetas(rec.pagination.total);
    } catch (err) {
      console.error(err);
      setError(err?.message || 'No se pudieron cargar los datos del panel.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargarDatos();
    cargarPreferencias();
  }, [cargarDatos, cargarPreferencias]);

  const accesos = [
    { to: '/escaner', label: 'Escanear Receta', desc: 'Digitaliza una receta con IA', primary: true },
    { to: '/inventario', label: 'Mi Botiquín', desc: 'Medicamentos y caducidades', primary: false },
    { to: '/recetas', label: 'Mis Recetas', desc: 'Historial médico digital', primary: false },
    { to: '/farmacias', label: 'Farmacias', desc: 'Precios y farmacias cercanas', primary: false },
  ];

  return (
    <div className="max-w-2xl mx-auto p-4 py-8 animate-fade-in">
      {/* Saludo */}
      <div className="mb-6">
        <h1 className="text-3xl font-display font-bold text-surface-900 mb-1">
          Hola, {user?.nombre ? user.nombre.split(' ')[0] : 'bienvenido'}
        </h1>
        <p className="text-surface-500">Este es el estado actual de tu salud digital.</p>
      </div>

      {/* Estado de carga (estático) */}
      {loading && (
        <div className="text-center py-16">
          <div className="w-10 h-10 mx-auto border-4 border-surface-200 border-t-primary-500 rounded-full animate-spin"></div>
          <p className="text-surface-500 mt-4 text-sm">Cargando tu panel...</p>
        </div>
      )}

      {/* Error con reintento */}
      {!loading && error && (
        <div className="p-6 bg-red-50 border-2 border-red-200 rounded-2xl text-center">
          <p className="text-red-700 font-medium mb-4">{error}</p>
          <button
            onClick={cargarDatos}
            className="w-full py-4 px-6 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-colors active:bg-red-800"
          >
            Reintentar
          </button>
        </div>
      )}

      {!loading && !error && (
        <div className="flex flex-col gap-6">
          {/* Resumen numérico */}
          {resumen && (
            <div className="grid grid-cols-4 gap-2">
              <div className="bg-white rounded-xl border border-surface-200 p-3 text-center">
                <p className="text-xl font-bold text-surface-800">{totalRecetas}</p>
                <p className="text-[11px] text-surface-500 font-medium">Recetas</p>
              </div>
              <div className="bg-white rounded-xl border border-surface-200 p-3 text-center">
                <p className="text-xl font-bold text-surface-800">{resumen.total}</p>
                <p className="text-[11px] text-surface-500 font-medium">Medicamentos</p>
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

          {/* Accesos rápidos (una sola columna, botones estáticos y amplios) */}
          <div className="flex flex-col gap-3">
            {accesos.map((a) => (
              <Link
                key={a.to}
                to={a.to}
                className={
                  a.primary
                    ? 'w-full py-4 px-6 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl text-left shadow-lg shadow-primary-500/30 transition-colors active:bg-primary-800'
                    : 'w-full py-4 px-6 bg-white border border-surface-200 text-surface-800 font-bold rounded-xl text-left hover:bg-surface-50 transition-colors active:bg-surface-100'
                }
              >
                <span className="block text-base">{a.label}</span>
                <span className={a.primary ? 'block text-xs text-primary-100 font-normal mt-0.5' : 'block text-xs text-surface-500 font-normal mt-0.5'}>
                  {a.desc}
                </span>
              </Link>
            ))}
          </div>

          {/* Alertas de caducidad */}
          <section className="bg-white rounded-2xl shadow-lg border border-surface-200 p-4 sm:p-6">
            <h2 className="text-lg font-bold text-surface-800 mb-4">Alertas de caducidad</h2>

            {alertas.length === 0 ? (
              <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl p-4">
                <svg className="w-6 h-6 text-green-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-green-700 font-medium">Todo en orden. Ningún medicamento caducado o por vencer.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {alertas.map((med) => (
                  <div
                    key={med.id}
                    className={`flex items-center justify-between gap-3 rounded-xl border p-3 ${
                      med.estado === 'caducado' ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-surface-900 truncate">{med.nombre}</p>
                      <p className="text-xs text-surface-500">
                        {med.dias_restantes < 0
                          ? `Caducó hace ${Math.abs(med.dias_restantes)} día(s)`
                          : med.dias_restantes === 0
                          ? 'Caduca hoy'
                          : `Caduca en ${med.dias_restantes} día(s)`}
                      </p>
                    </div>
                    <span
                      className={`flex-shrink-0 text-xs font-semibold px-3 py-1 rounded-full border ${
                        med.estado === 'caducado'
                          ? 'bg-red-100 text-red-700 border-red-200'
                          : 'bg-yellow-100 text-yellow-700 border-yellow-200'
                      }`}
                    >
                      {med.estado === 'caducado' ? 'Caducado' : 'Por vencer'}
                    </span>
                  </div>
                ))}

                <Link
                  to="/inventario"
                  className="mt-2 w-full py-4 px-6 bg-surface-100 hover:bg-surface-200 text-surface-700 font-bold rounded-xl text-center transition-colors active:bg-surface-300"
                >
                  Gestionar mi botiquín
                </Link>
              </div>
            )}
          </section>

          {/* Notificaciones por correo (una sola columna, controles estáticos y amplios) */}
          <section className="bg-white rounded-2xl shadow-lg border border-surface-200 p-4 sm:p-6">
            <h2 className="text-lg font-bold text-surface-800 mb-1">Notificaciones por correo</h2>
            <p className="text-xs text-surface-500 mb-4">
              Recordatorio diario automático de medicamentos caducados o por vencer
              {prefsNotif?.email ? ` a ${prefsNotif.email}` : ''}.
            </p>

            <label className="flex items-center justify-between gap-3 p-3 rounded-xl bg-surface-50 border border-surface-200 cursor-pointer">
              <span className="text-sm font-medium text-surface-700">Recibir recordatorio diario</span>
              <input
                type="checkbox"
                checked={notifActivas}
                onChange={(e) => setNotifActivas(e.target.checked)}
                className="w-6 h-6 rounded border-surface-300 text-primary-600 focus:ring-primary-500"
              />
            </label>

            <label className="block mt-3">
              <span className="text-sm font-medium text-surface-700">Avisar con cuántos días de anticipación</span>
              <input
                type="number"
                min={1}
                max={365}
                value={umbralInput}
                onChange={(e) => setUmbralInput(parseInt(e.target.value, 10) || 30)}
                className="mt-1 w-full p-3 border border-surface-200 rounded-xl text-surface-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 outline-none"
              />
            </label>

            <button
              onClick={guardarPreferencias}
              disabled={guardandoNotif}
              className="mt-4 w-full py-4 px-6 bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white font-bold rounded-xl transition-colors active:bg-primary-800"
            >
              {guardandoNotif ? 'Guardando...' : 'Guardar preferencias'}
            </button>

            <button
              onClick={enviarCorreoPrueba}
              disabled={probandoCorreo}
              className="mt-3 w-full py-4 px-6 bg-white border border-surface-200 hover:bg-surface-50 disabled:opacity-60 text-surface-800 font-bold rounded-xl transition-colors active:bg-surface-100"
            >
              {probandoCorreo ? 'Enviando...' : 'Enviar correo de prueba'}
            </button>

            {notifMsg && (
              <p
                className={`mt-3 text-sm font-medium p-3 rounded-xl border ${
                  notifMsg.tipo === 'ok'
                    ? 'bg-green-50 border-green-200 text-green-700'
                    : 'bg-red-50 border-red-200 text-red-700'
                }`}
              >
                {notifMsg.texto}
              </p>
            )}
          </section>

          {/* Recetas recientes */}
          <section className="bg-white rounded-2xl shadow-lg border border-surface-200 p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-surface-800">Recetas recientes</h2>
              {totalRecetas > 0 && (
                <Link to="/recetas" className="text-sm font-semibold text-primary-600 hover:text-primary-700">
                  Ver todas
                </Link>
              )}
            </div>

            {recetas.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-sm text-surface-500 mb-4">Aún no tienes recetas digitalizadas.</p>
                <Link
                  to="/escaner"
                  className="block w-full py-4 px-6 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl text-center transition-colors active:bg-primary-800"
                >
                  Escanear mi primera receta
                </Link>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {recetas.map((receta) => (
                  <Link
                    key={receta.id}
                    to={`/recetas/${receta.id}`}
                    className="block border-b border-surface-100 py-3 last:border-b-0 hover:bg-surface-50 rounded-lg px-2 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-surface-900 truncate">
                          {receta.paciente_nombre || 'Paciente no especificado'}
                        </p>
                        <p className="text-xs text-surface-500">
                          {formatearFecha(receta.fecha_emision)}
                          {receta.diagnostico ? ` · ${receta.diagnostico}` : ''}
                        </p>
                      </div>
                      {receta.medicamentos?.length > 0 && (
                        <span className="flex-shrink-0 text-xs font-medium text-primary-700 bg-primary-50 border border-primary-100 px-2 py-1 rounded-full">
                          {receta.medicamentos.length} med
                        </span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
