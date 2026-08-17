import { useState, useRef } from 'react';
import api from '../services/api';
import FormularioValidacion from '../components/FormularioValidacion';
export default function RecetaScanner() {
  const [file, setFile] = useState(null);
  const [base64Image, setBase64Image] = useState(null);
  const [preview, setPreview] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState(null);
  
  const [isScanning, setIsScanning] = useState(false);
  const [results, setResults] = useState(null);

  const fileInputRef = useRef(null);

  // Manejo de Drag & Drop
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  // Manejo de Input File tradicional
  const handleFileInput = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const handleFileSelect = (selectedFile) => {
    // Validar tipo
    if (!selectedFile.type.startsWith('image/')) {
      setError('Por favor, selecciona una imagen (JPG, PNG).');
      return;
    }
    
    setError(null);
    setFile(selectedFile);
    
    // Usar FileReader para obtener Base64 en el cliente
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target.result;
      setPreview(result);
      
      // La cadena Base64 incluye el prefijo 'data:image/...;base64,'
      setBase64Image(result);
      
      console.log('Imagen convertida a Base64 en el cliente (preview):', result.substring(0, 50) + '...');
    };
    reader.onerror = () => {
      setError('Ocurrió un error al leer el archivo.');
    };
    reader.readAsDataURL(selectedFile);
  };

  const removeFile = () => {
    setFile(null);
    setPreview(null);
    setBase64Image(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Reinicio completo del flujo (limpia imagen, resultados y errores)
  const handleReset = () => {
    removeFile();
    setResults(null);
    setError(null);
  };

  const handleSimulateSend = async () => {
    if (!base64Image) return;
    
    setIsScanning(true);
    setError(null);
    setResults(null);

    try {
      // Enviamos el payload como JSON (axios lo hace por defecto con objetos)
      const response = await api.post('/recetas/analizar', {
        imagenBase64: base64Image
      });

      // El interceptor de api.js ya devuelve response.data directamente:
      // { success, message, data: { paciente_nombre, fecha_emision, ... } }
      setResults(response.data);
      console.log('Respuesta del backend:', response);
      
    } catch (err) {
      console.error(err);
      setError(err.message || 'Error al comunicarse con el backend.');
    } finally {
      setIsScanning(false);
    }
  };

  // Guardado real: envía los datos validados + imagen original al backend
  const handleConfirmReceta = async (formData) => {
    const response = await api.post('/recetas/guardar', {
      ...formData,
      imagenBase64: base64Image
    });

    console.log('Receta guardada en BD:', response.data);
    return response.data;
  };

  // Conexión receta → botiquín: agrega los medicamentos en lote
  const handleAddToInventory = async (items) => {
    const response = await api.post('/inventario/batch', {
      medicamentos: items
    });

    console.log('Medicamentos agregados al botiquín:', response.data);
    return response.data;
  };

  return (
    <div className="max-w-4xl mx-auto p-4 py-8 animate-fade-in">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-display font-bold text-surface-900 mb-2">
          Escáner de Recetas Inteligente
        </h1>
        <p className="text-surface-500 max-w-2xl mx-auto">
          Sube una foto de tu receta médica. (Procesamiento local a Base64)
        </p>
      </div>

      <div className="max-w-2xl mx-auto space-y-6">
        
        {/* Zona de Subida e Imagen */}
        {!preview ? (
          <div 
            className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer h-80 flex flex-col items-center justify-center
              ${isDragging ? 'border-primary-500 bg-primary-50 scale-[1.02]' : 'border-surface-300 hover:border-primary-400 hover:bg-surface-50'}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input 
              type="file" 
              ref={fileInputRef}
              onChange={handleFileInput}
              accept="image/*"
              className="hidden"
            />
            
            <div className="w-16 h-16 rounded-full bg-surface-100 flex items-center justify-center mb-4 text-surface-500">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
              </svg>
            </div>
            
            <p className="text-surface-700 font-medium mb-1">
              Haz clic o arrastra tu receta aquí
            </p>
            <p className="text-xs text-surface-400">
              La imagen se convertirá a Base64 en el navegador.
            </p>
          </div>
        ) : (
          <div className="relative glass-card rounded-2xl overflow-hidden shadow-lg h-96 flex flex-col">
            <div className="flex-grow overflow-hidden relative">
              <img 
                src={preview} 
                alt="Vista previa de receta" 
                className="w-full h-full object-contain bg-surface-100"
              />
            </div>
            
            <div className="p-4 bg-white border-t border-surface-200 flex justify-between items-center">
              <button 
                onClick={removeFile}
                className="text-surface-500 hover:text-red-500 font-medium text-sm transition-colors"
              >
                Remover Imagen
              </button>
              <button 
                onClick={handleSimulateSend}
                className="btn-primary py-2 px-6"
              >
                Continuar (Simulado)
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-100 text-sm flex gap-3 items-start animate-slide-up">
            <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* Depuración Visual del Base64 */}
        {base64Image && !results && (
          <div className="mt-6 p-4 bg-surface-900 text-surface-300 rounded-lg overflow-hidden shadow-inner">
            <p className="text-xs font-mono break-all line-clamp-3">
              <span className="text-accent-400 font-bold">Estado base64Image (fragmento):</span> {base64Image}
            </p>
          </div>
        )}

        {/* Zona de Resultados de la API -> Formulario de Validación */}
        {results && (
          <FormularioValidacion 
            initialData={results} 
            onConfirm={handleConfirmReceta}
            onAddToInventory={handleAddToInventory}
            onCancel={handleReset} 
          />
        )}
      </div>
    </div>
  );
}
