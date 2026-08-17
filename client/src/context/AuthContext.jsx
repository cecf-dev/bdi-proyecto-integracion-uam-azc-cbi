import { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';
import { googleLogout } from '@react-oauth/google';

// Crear el contexto
const AuthContext = createContext();

// Hook personalizado para usar el contexto
export const useAuth = () => {
  return useContext(AuthContext);
};

// Proveedor del contexto
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  // Al cargar la app, verifica si hay un token válido en localStorage
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('bdi_token');
      
      if (token) {
        try {
          // Pide los datos del usuario al backend usando el token
          const response = await api.get('/auth/me');
          setUser(response.user);
          setIsAuthenticated(true);
        } catch (error) {
          console.error("Token inválido o expirado:", error);
          logout(); // Limpia estado si falla
        }
      }
      
      setLoading(false);
    };

    checkAuth();
  }, []);

  // Función para manejar el login (recibe el token OAuth de Google)
  const loginWithGoogle = async (credential) => {
    try {
      const response = await api.post('/auth/google', { credential });
      
      // Guarda el JWT devuelto por el backend
      localStorage.setItem('bdi_token', response.token);
      
      setUser(response.user);
      setIsAuthenticated(true);
      return { success: true };
    } catch (error) {
      console.error("Error en login:", error);
      return { success: false, message: error.message || 'Error al iniciar sesión' };
    }
  };

  // Función para cerrar sesión
  const logout = () => {
    googleLogout(); // Limpia estado interno de la librería de Google
    localStorage.removeItem('bdi_token'); // Elimina nuestro JWT
    setUser(null);
    setIsAuthenticated(false);
  };

  const value = {
    user,
    isAuthenticated,
    loading,
    loginWithGoogle,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
