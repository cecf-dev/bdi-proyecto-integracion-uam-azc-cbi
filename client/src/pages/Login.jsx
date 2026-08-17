import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSuccess = async (credentialResponse) => {
    setIsLoading(true);
    setError('');
    
    // El token JWT que nos da Google
    const { credential } = credentialResponse;
    
    // Enviamos el token a nuestro backend
    const result = await loginWithGoogle(credential);
    
    if (result.success) {
      // Si todo sale bien, redirigimos al dashboard (futuro) o home
      navigate('/dashboard');
    } else {
      setError(result.message);
      setIsLoading(false);
    }
  };

  const handleError = () => {
    setError('Falló la conexión con Google. Inténtalo de nuevo.');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-50 p-4">
      <div className="glass-card w-full max-w-md p-8 text-center animate-slide-up">
        
        {/* Ícono Logo */}
        <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-primary-500 to-accent-500 
                        flex items-center justify-center shadow-lg shadow-primary-500/30">
          <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
        </div>

        <h1 className="text-3xl font-display font-bold text-surface-900 mb-2">
          Bienvenido a BDI
        </h1>
        <p className="text-surface-500 mb-8">
          Inicia sesión para gestionar tu salud
        </p>

        {error && (
          <div className="mb-6 p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg">
            {error}
          </div>
        )}

        <div className="flex justify-center mb-4">
          {isLoading ? (
            <div className="flex items-center gap-2 text-primary-600">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>Autenticando...</span>
            </div>
          ) : (
            <GoogleLogin
              onSuccess={handleSuccess}
              onError={handleError}
              useOneTap
              shape="pill"
              theme="outline"
              size="large"
              text="continue_with"
            />
          )}
        </div>

        <p className="mt-8 text-xs text-surface-400">
          Al iniciar sesión, aceptas nuestros Términos de Servicio y Política de Privacidad.
        </p>
      </div>
    </div>
  );
}
