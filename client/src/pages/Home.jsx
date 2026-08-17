import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-64px)] px-4">
      <div className="text-center animate-fade-in">
        {/* Ícono */}
        <div className="w-24 h-24 mx-auto mb-8 rounded-3xl bg-gradient-to-br from-primary-500 to-accent-500 
                        flex items-center justify-center shadow-2xl shadow-primary-500/30">
          <svg className="w-12 h-12 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
        </div>

        {/* Título */}
        <h1 className="text-5xl font-display font-bold mb-4">
          <span className="text-gradient-primary">Botiquín Digital</span>
          <br />
          <span className="text-surface-700">Inteligente</span>
        </h1>

        {/* Subtítulo */}
        <p className="text-lg text-surface-500 max-w-md mx-auto mb-10 leading-relaxed">
          Digitaliza tus recetas médicas, gestiona tu inventario de medicamentos
          y encuentra farmacias cercanas con precios accesibles.
        </p>

        {/* Badges de estado */}
        <div className="flex flex-wrap gap-3 justify-center mb-10">
          <span className="badge-primary">🧠 IA Multimodal</span>
          <span className="badge-accent">📋 Recetas Digitales</span>
          <span className="badge-warning">🗺️ Geolocalización</span>
          <span className="badge-danger">💊 Control de Caducidad</span>
        </div>

        {/* Botones de acción */}
        <div className="flex gap-4 justify-center">
          <Link to="/login" className="btn-primary">
            Comenzar
          </Link>
          <button className="btn-secondary">
            Más Información
          </button>
        </div>
      </div>

      {/* Footer temporal */}
      <footer className="absolute bottom-6 text-sm text-surface-400">
        BDI v1.0 — UAM Azcapotzalco · Proyecto de Integración
      </footer>
    </div>
  );
}
