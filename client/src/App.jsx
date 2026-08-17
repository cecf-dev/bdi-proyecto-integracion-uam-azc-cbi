import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/layout/Navbar';
import Home from './pages/Home';
import Login from './pages/Login';
import { useAuth } from './context/AuthContext';

import RecetaScanner from './pages/RecetaScanner';
import HistorialRecetas from './pages/HistorialRecetas';
import Inventario from './pages/Inventario';
import Farmacias from './pages/Farmacias';
import Dashboard from './pages/Dashboard';
import RecetaDetalle from './pages/RecetaDetalle';

/**
 * Componente para proteger rutas privadas
 */
const PrivateRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Cargando...</div>;
  }

  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

/**
 * App - Componente raíz del Botiquín Digital Inteligente
 */
function App() {
  return (
    <Router>
      <div className="min-h-screen bg-surface-50">
        <Navbar />

        <main>
          <Routes>
            {/* Rutas Públicas */}
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />

            {/* Rutas Privadas (Protegidas) */}
            <Route
              path="/escaner"
              element={
                <PrivateRoute>
                  <RecetaScanner />
                </PrivateRoute>
              }
            />

            <Route
              path="/recetas"
              element={
                <PrivateRoute>
                  <HistorialRecetas />
                </PrivateRoute>
              }
            />

            <Route
              path="/recetas/:id"
              element={
                <PrivateRoute>
                  <RecetaDetalle />
                </PrivateRoute>
              }
            />

            <Route
              path="/inventario"
              element={
                <PrivateRoute>
                  <Inventario />
                </PrivateRoute>
              }
            />

            <Route
              path="/farmacias"
              element={
                <PrivateRoute>
                  <Farmacias />
                </PrivateRoute>
              }
            />
            
            <Route
              path="/dashboard"
              element={
                <PrivateRoute>
                  <Dashboard />
                </PrivateRoute>
              }
            />

          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
