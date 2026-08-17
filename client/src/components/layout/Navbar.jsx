import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();

  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-surface-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">

          {/* Logo y Nombre */}
          <div className="flex-shrink-0 flex items-center">
            <Link to="/" className="flex items-center gap-2 group">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-accent-500 
                              flex items-center justify-center text-white font-bold text-lg
                              group-hover:shadow-lg group-hover:shadow-primary-500/30 transition-all">
                +
              </div>
              <span className="font-display font-bold text-xl text-surface-800">
                BDI
              </span>
            </Link>
          </div>

          {/* Menú Usuario */}
          <div className="flex items-center gap-4">
            {isAuthenticated && user ? (
              <div className="flex items-center gap-4">
                {/* Enlaces rápidos (se expandirán luego) */}
                <Link to="/dashboard" className="text-sm font-medium text-surface-600 hover:text-primary-600">
                  Dashboard
                </Link>

                <Link to="/recetas" className="text-sm font-medium text-surface-600 hover:text-primary-600">
                  Recetas
                </Link>

                <Link to="/inventario" className="text-sm font-medium text-surface-600 hover:text-primary-600">
                  Inventario
                </Link>

                <Link to="/farmacias" className="text-sm font-medium text-surface-600 hover:text-primary-600">
                  Farmacias
                </Link>

                <div className="h-6 w-px bg-surface-200"></div>

                {/* Perfil */}
                <div className="flex items-center gap-3">
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-semibold text-surface-800 leading-none mb-1">
                      {user.nombre}
                    </p>
                    <p className="text-xs text-surface-500 leading-none">
                      {user.rol === 'admin' ? 'Administrador' : 'Paciente'}
                    </p>
                  </div>

                  {user.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt="Perfil"
                      className="w-10 h-10 rounded-full border-2 border-surface-100 object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold">
                      {user.nombre.charAt(0).toUpperCase()}
                    </div>
                  )}

                  <button
                    onClick={logout}
                    className="p-2 text-surface-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Cerrar Sesión"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                  </button>
                </div>
              </div>
            ) : (
              <Link to="/login" className="btn-primary py-2 px-5 text-sm">
                Iniciar Sesión
              </Link>
            )}
          </div>

        </div>
      </div>
    </nav>
  );
}
