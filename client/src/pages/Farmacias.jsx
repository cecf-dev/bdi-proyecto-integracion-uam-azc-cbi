import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import api from '../services/api';

const iconoFarmacia = L.divIcon({ className: 'bdi-pin', iconSize: [30, 30], iconAnchor: [15, 15], popupAnchor: [0, -20] });
const iconoUsuario = L.divIcon({ className: 'bdi-pin-usuario', iconSize: [22, 22], iconAnchor: [11, 11] });

const obtenerPosicion = () =>
  new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Tu navegador no soporta geolocalización.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) =>
        reject(
          new Error(
            err.code === 1
              ? 'Permiso de ubicación denegado. Actívalo para ver farmacias cercanas.'
              : 'No se pudo obtener tu ubicación. Inténtalo de nuevo.'
          )
        ),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });

export default function Farmacias() {
  // Búsqueda de precios
  const [medicamento, setMedicamento] = useState('');
  const [ofertas, setOfertas] = useState([]);
  const [precioLoading, setPrecioLoading] = useState(false);
  const [precioError, setPrecioError] = useState(null);
  const [busquedaHecha, setBusquedaHecha] = useState(false);

  // Farmacias cercanas + mapa
  const [farmacias, setFarmacias] = useState([]);
  const [posicion, setPosicion] = useState(null);
  const [mapaLoading, setMapaLoading] = useState(false);
  const [mapaError, setMapaError] = useState(null);

  // Historial
  const [historial, setHistorial] = useState([]);

  // Reconocimiento por voz (dictado del nombre del medicamento)
  const {
    transcript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition,
  } = useSpeechRecognition();

  useEffect(() => {
    // Al terminar el dictado (manual o silencio), volcar el texto al input
    if (!listening && transcript.trim()) {
      setMedicamento(transcript.trim());
      resetTranscript();
    }
  }, [listening, transcript, resetTranscript]);

  const toggleDictado = () => {
    if (listening) {
      SpeechRecognition.stopListening();
    } else {
      resetTranscript();
      SpeechRecognition.startListening({ language: 'es-MX', continuous: false });
    }
  };

  useEffect(() => {
    const cargarHistorial = async () => {
      try {
        const response = await api.get('/farmacias/historial');
        setHistorial(response.data);
      } catch (err) {
        console.error('No se pudo cargar el historial de búsquedas:', err);
      }
    };
    cargarHistorial();
  }, []);

  const buscarPrecios = async (e) => {
    e.preventDefault();
    if (!medicamento.trim()) return;

    setPrecioLoading(true);
    setPrecioError(null);
    setBusquedaHecha(true);

    try {
      const response = await api.post('/farmacias/buscar', { medicamento: medicamento.trim() });
      setOfertas(response.data);

      const hist = await api.get('/farmacias/historial');
      setHistorial(hist.data);
    } catch (err) {
      console.error(err);
      setOfertas([]);
      setPrecioError(err?.message || 'No se pudo realizar la búsqueda de precios.');
    } finally {
      setPrecioLoading(false);
    }
  };

  const ubicarme = async () => {
    setMapaLoading(true);
    setMapaError(null);

    try {
      const pos = await obtenerPosicion();
      const response = await api.post('/farmacias/cercanas', pos);
      setPosicion(pos);
      setFarmacias(response.data);
    } catch (err) {
      console.error(err);
      setFarmacias([]);
      setMapaError(err?.message || 'No se pudieron obtener las farmacias cercanas.');
    } finally {
      setMapaLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4 py-8 animate-fade-in">
      <div className="mb-6 text-center">
        <h1 className="text-3xl font-display font-bold text-surface-900 mb-2">
          Farmacias y Precios
        </h1>
        <p className="text-surface-500">
          Compara precios de medicamentos y encuentra farmacias cercanas.
        </p>
      </div>

      {/* ============ Sección 1: Buscar precios ============ */}
      <section className="bg-white rounded-2xl shadow-lg border border-surface-200 p-4 sm:p-6 mb-6">
        <h2 className="text-lg font-bold text-surface-800 mb-4">Buscar precios de un medicamento</h2>

        <form onSubmit={buscarPrecios} className="flex flex-col gap-3">
          <input
            type="text"
            value={medicamento}
            onChange={(e) => setMedicamento(e.target.value)}
            placeholder="Ej. Paracetamol 500mg"
            className="w-full bg-surface-50 border border-surface-200 rounded-lg px-4 py-3 text-surface-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />

          {/* Botón de dictado por voz (estático y amplio) */}
          {browserSupportsSpeechRecognition && (
            <button
              type="button"
              onClick={toggleDictado}
              disabled={precioLoading}
              className={`w-full py-4 px-6 font-bold rounded-xl border transition-colors active:opacity-90 disabled:opacity-50 ${
                listening
                  ? 'bg-red-50 border-red-300 text-red-700 hover:bg-red-100'
                  : 'bg-surface-50 border-surface-200 text-surface-700 hover:bg-surface-100'
              }`}
            >
              <span className="inline-flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-14 0M12 18v3m-3 0h6m-3-3a9 9 0 01-9-9m18 0a9 9 0 01-9 9" />
                </svg>
                {listening ? 'Escuchando... toca para terminar' : 'Dictar nombre del medicamento'}
              </span>
            </button>
          )}

          <button
            type="submit"
            disabled={precioLoading || !medicamento.trim()}
            className="w-full py-4 px-6 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl transition-colors active:bg-primary-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {precioLoading ? 'Buscando...' : 'Buscar Precios'}
          </button>
        </form>

        {precioError && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
            {precioError}
          </div>
        )}

        {!precioLoading && !precioError && busquedaHecha && ofertas.length === 0 && (
          <p className="mt-4 text-sm text-center text-surface-500 py-4">
            No se encontraron ofertas para este medicamento.
          </p>
        )}

        {ofertas.length > 0 && (
          <div className="mt-4 flex flex-col gap-3">
            {ofertas.map((oferta, index) => (
              <article key={index} className="border border-surface-200 rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-surface-900 line-clamp-2">{oferta.titulo}</h3>
                    <p className="text-xs text-surface-500 mt-1">{oferta.tienda || 'Tienda no especificada'}</p>
                  </div>
                  {oferta.precio && (
                    <span className="flex-shrink-0 text-lg font-bold text-primary-700">{oferta.precio}</span>
                  )}
                </div>
                {oferta.link && (
                  <a
                    href={oferta.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block mt-3 text-sm font-semibold text-primary-600 hover:text-primary-700 underline"
                  >
                    Ver oferta
                  </a>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      {/* ============ Sección 2: Farmacias cercanas + mapa ============ */}
      <section className="bg-white rounded-2xl shadow-lg border border-surface-200 p-4 sm:p-6 mb-6">
        <h2 className="text-lg font-bold text-surface-800 mb-4">Farmacias cercanas a ti</h2>

        <button
          onClick={ubicarme}
          disabled={mapaLoading}
          className="w-full py-4 px-6 bg-accent-600 hover:bg-accent-700 text-white font-bold rounded-xl transition-colors active:bg-accent-800 disabled:opacity-60 disabled:cursor-wait"
        >
          {mapaLoading ? 'Buscando farmacias...' : 'Usar mi ubicación'}
        </button>

        {mapaError && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
            {mapaError}
          </div>
        )}

        {posicion && farmacias.length > 0 && (
          <div className="mt-4 flex flex-col gap-4">
            <MapContainer
              center={[posicion.lat, posicion.lng]}
              zoom={14}
              scrollWheelZoom={false}
              className="h-72 w-full rounded-2xl z-0"
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <Marker position={[posicion.lat, posicion.lng]} icon={iconoUsuario}>
                <Popup>Tu ubicación</Popup>
              </Marker>
              {farmacias
                .filter((f) => f.lat != null && f.lng != null)
                .map((f, index) => (
                  <Marker key={index} position={[f.lat, f.lng]} icon={iconoFarmacia}>
                    <Popup>
                      <strong>{f.nombre}</strong>
                      <br />
                      {f.direccion || ''}
                    </Popup>
                  </Marker>
                ))}
            </MapContainer>

            <div className="flex flex-col gap-3">
              {farmacias.map((f, index) => (
                <article key={index} className="border border-surface-200 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-sm font-semibold text-surface-900">{f.nombre}</h3>
                    {f.rating != null && (
                      <span className="flex-shrink-0 text-xs font-bold text-yellow-600 bg-yellow-50 border border-yellow-200 px-2 py-1 rounded-full">
                        ★ {f.rating}
                      </span>
                    )}
                  </div>
                  {f.direccion && <p className="text-xs text-surface-500 mt-1">{f.direccion}</p>}
                  {f.telefono && <p className="text-xs text-surface-500 mt-1">Tel: {f.telefono}</p>}
                  {f.abierto && <p className="text-xs text-green-600 font-medium mt-1">{f.abierto}</p>}
                </article>
              ))}
            </div>
          </div>
        )}

        {posicion && !mapaLoading && !mapaError && farmacias.length === 0 && (
          <p className="mt-4 text-sm text-center text-surface-500 py-4">
            No se encontraron farmacias cercanas.
          </p>
        )}
      </section>

      {/* ============ Sección 3: Historial ============ */}
      {historial.length > 0 && (
        <section className="bg-white rounded-2xl shadow-lg border border-surface-200 p-4 sm:p-6">
          <h2 className="text-lg font-bold text-surface-800 mb-4">Búsquedas recientes</h2>
          <div className="flex flex-col gap-2">
            {historial.map((b) => (
              <div key={b.id} className="flex items-center justify-between border-b border-surface-100 py-2 last:border-b-0">
                <div>
                  <p className="text-sm font-semibold text-surface-800">{b.medicamento_nombre}</p>
                  <p className="text-xs text-surface-500">
                    {b.num_resultados} ofertas · {new Date(b.created_at).toLocaleDateString('es-MX')}
                  </p>
                </div>
                <span className="text-xs font-medium text-surface-400 bg-surface-100 px-2 py-1 rounded-full">
                  {b.fuente === 'google_shopping' ? 'Google Shopping' : b.fuente}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
