import { useState } from 'react';
import { Link } from 'react-router-dom';

export default function FormularioValidacion({ initialData, onConfirm, onCancel, onAddToInventory }) {
  // Aseguramos que la estructura base exista para evitar errores si la IA devuelve null en algún campo
  const [formData, setFormData] = useState({
    paciente_nombre: initialData?.paciente_nombre || '',
    fecha_emision: initialData?.fecha_emision || '',
    medico_cedula: initialData?.medico_cedula || '',
    diagnostico: initialData?.diagnostico || '',
    medicamentos: initialData?.medicamentos || []
  });

  const [showSuccess, setShowSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const [inventoryState, setInventoryState] = useState('idle'); // idle | adding | added | skipped | error
  const [inventoryError, setInventoryError] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleMedicamentoChange = (index, field, value) => {
    const nuevosMedicamentos = [...formData.medicamentos];
    nuevosMedicamentos[index] = {
      ...nuevosMedicamentos[index],
      [field]: value
    };
    setFormData(prev => ({
      ...prev,
      medicamentos: nuevosMedicamentos
    }));
  };

  const addMedicamento = () => {
    setFormData(prev => ({
      ...prev,
      medicamentos: [...prev.medicamentos, { nombre_medicamento: '', dosis: '', indicaciones: '' }]
    }));
  };

  const removeMedicamento = (index) => {
    const nuevosMedicamentos = [...formData.medicamentos];
    nuevosMedicamentos.splice(index, 1);
    setFormData(prev => ({
      ...prev,
      medicamentos: nuevosMedicamentos
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveError(null);

    try {
      // Persistir la receta a través del componente padre (POST /api/recetas/guardar)
      if (onConfirm) {
        await onConfirm(formData);
      }

      console.log('--- Datos Finales Validados y Guardados ---');
      console.log(formData);

      setShowSuccess(true);
    } catch (err) {
      console.error('Error al guardar la receta:', err);
      setSaveError(err?.message || 'No se pudo guardar la receta. Inténtalo de nuevo.');
    } finally {
      setIsSaving(false);
    }
  };

  // Agregar los medicamentos de la receta al botiquín (endpoint batch)
  const handleAddToInventory = async () => {
    setInventoryState('adding');
    setInventoryError(null);

    const items = formData.medicamentos
      .filter((med) => med?.nombre_medicamento && med.nombre_medicamento.trim() !== '')
      .map((med) => ({
        nombre: med.nombre_medicamento.trim(),
        dosis: med.dosis?.trim() || null,
        notas: med.indicaciones?.trim() || null,
        cantidad: 0,
        unidad: 'piezas',
      }));

    try {
      await onAddToInventory(items);
      setInventoryState('added');
    } catch (err) {
      console.error('Error al agregar medicamentos al botiquín:', err);
      setInventoryState('error');
      setInventoryError(err?.message || 'No se pudieron agregar los medicamentos al botiquín.');
    }
  };

  if (showSuccess) {
    const tieneMedicamentos = formData.medicamentos.some(
      (med) => med?.nombre_medicamento && med.nombre_medicamento.trim() !== ''
    );

    return (
      <div className="bg-green-50 border-2 border-green-500 rounded-2xl p-8 text-center animate-fade-in my-8 shadow-lg shadow-green-500/20">
        <div className="w-20 h-20 mx-auto bg-green-500 rounded-full flex items-center justify-center mb-4 shadow-inner text-white">
          <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-2xl font-bold text-green-800 mb-2">¡Receta Validada!</h3>
        <p className="text-green-600 font-medium">Tu receta se guardó correctamente en tu historial médico.</p>

        {/* Opción: agregar medicamentos al botiquín */}
        {tieneMedicamentos && onAddToInventory && inventoryState !== 'added' && inventoryState !== 'skipped' && (
          <div className="mt-6 text-left bg-white/80 rounded-xl p-4 border border-green-200">
            <p className="text-sm text-green-800 font-semibold mb-3">
              ¿Quieres agregar los medicamentos de esta receta a tu botiquín?
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={handleAddToInventory}
                disabled={inventoryState === 'adding'}
                className="w-full py-4 px-6 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl transition-colors active:bg-green-800 disabled:opacity-60 disabled:cursor-wait"
              >
                {inventoryState === 'adding' ? 'Agregando...' : 'Agregar al Botiquín'}
              </button>
              <button
                onClick={() => setInventoryState('skipped')}
                disabled={inventoryState === 'adding'}
                className="w-full py-4 px-6 bg-white hover:bg-green-100 text-green-700 font-bold rounded-xl border border-green-200 transition-colors active:bg-green-200 disabled:opacity-50"
              >
                No, gracias
              </button>
            </div>
          </div>
        )}

        {inventoryState === 'added' && (
          <p className="mt-4 text-sm font-semibold text-green-700 bg-white/80 rounded-lg p-3 border border-green-200">
            Medicamentos agregados a tu botiquín correctamente.
          </p>
        )}

        {inventoryState === 'error' && (
          <p className="mt-4 text-sm text-red-700 bg-red-50 rounded-lg p-3 border border-red-200 text-left">
            {inventoryError}
          </p>
        )}

        {/* Acciones finales (estáticas y amplias) */}
        <div className="mt-6 flex flex-col gap-3">
          <Link
            to="/recetas"
            className="w-full py-4 px-6 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl transition-colors active:bg-green-800 text-center"
          >
            Ver mis recetas
          </Link>
          {onCancel && (
            <button
              onClick={onCancel}
              className="w-full py-4 px-6 bg-white hover:bg-green-100 text-green-700 font-bold rounded-xl border border-green-200 transition-colors active:bg-green-200"
            >
              Escanear otra receta
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-surface-200 mt-6 animate-slide-up">
      <div className="bg-surface-50 p-4 border-b border-surface-200">
        <h2 className="text-xl font-bold text-surface-800 flex items-center gap-2">
          <svg className="w-5 h-5 text-accent-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Revisión de Receta
        </h2>
        <p className="text-xs text-surface-500 mt-1">
          La IA ha extraído estos datos. Por favor, verifica y corrige si es necesario.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="p-4 sm:p-6 flex flex-col gap-5">
        
        {/* Datos Generales */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-primary-700 uppercase tracking-wider border-b border-surface-100 pb-1">Datos Generales</h3>
          
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">Nombre del Paciente</label>
            <input 
              type="text" 
              name="paciente_nombre"
              value={formData.paciente_nombre || ''} 
              onChange={handleChange}
              className="w-full bg-surface-50 border border-surface-200 rounded-lg px-4 py-3 text-surface-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-shadow"
              placeholder="Ej. Juan Pérez"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">Fecha de Emisión</label>
            <input 
              type="date" 
              name="fecha_emision"
              value={formData.fecha_emision || ''} 
              onChange={handleChange}
              className="w-full bg-surface-50 border border-surface-200 rounded-lg px-4 py-3 text-surface-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-shadow"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">Cédula Profesional</label>
            <input 
              type="text" 
              name="medico_cedula"
              value={formData.medico_cedula || ''} 
              onChange={handleChange}
              className="w-full bg-surface-50 border border-surface-200 rounded-lg px-4 py-3 text-surface-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-shadow"
              placeholder="Ej. 1234567"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">Diagnóstico</label>
            <textarea 
              name="diagnostico"
              value={formData.diagnostico || ''} 
              onChange={handleChange}
              rows="2"
              className="w-full bg-surface-50 border border-surface-200 rounded-lg px-4 py-3 text-surface-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-shadow resize-none"
              placeholder="Ej. Faringitis aguda"
            />
          </div>
        </div>

        {/* Medicamentos */}
        <div className="space-y-4 mt-2">
          <div className="flex justify-between items-center border-b border-surface-100 pb-1">
            <h3 className="text-sm font-bold text-primary-700 uppercase tracking-wider">Medicamentos ({formData.medicamentos.length})</h3>
            <button 
              type="button" 
              onClick={addMedicamento}
              className="text-xs bg-surface-100 hover:bg-surface-200 text-surface-700 font-medium py-1 px-3 rounded-full transition-colors"
            >
              + Agregar
            </button>
          </div>

          <div className="flex flex-col gap-4">
            {formData.medicamentos.map((med, index) => (
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
                      value={med.nombre_medicamento || ''} 
                      onChange={(e) => handleMedicamentoChange(index, 'nombre_medicamento', e.target.value)}
                      className="w-full bg-white border border-surface-200 rounded-lg px-3 py-2 text-sm text-surface-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-surface-500 mb-1">Dosis / Presentación</label>
                    <input 
                      type="text" 
                      value={med.dosis || ''} 
                      onChange={(e) => handleMedicamentoChange(index, 'dosis', e.target.value)}
                      className="w-full bg-white border border-surface-200 rounded-lg px-3 py-2 text-sm text-surface-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-surface-500 mb-1">Indicaciones</label>
                    <textarea 
                      value={med.indicaciones || ''} 
                      onChange={(e) => handleMedicamentoChange(index, 'indicaciones', e.target.value)}
                      rows="2"
                      className="w-full bg-white border border-surface-200 rounded-lg px-3 py-2 text-sm text-surface-900 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                    />
                  </div>
                </div>
              </div>
            ))}
            
            {formData.medicamentos.length === 0 && (
              <p className="text-sm text-center text-surface-400 py-4 italic">
                No se detectaron medicamentos. Usa el botón "+ Agregar".
              </p>
            )}
          </div>
        </div>

        {/* Error de guardado (estático, no desplaza la interfaz) */}
        {saveError && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex gap-3 items-start">
            <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>{saveError}</span>
          </div>
        )}

        {/* Botones de Acción (Estáticos y amplios) */}
        <div className="pt-6 pb-2 border-t border-surface-100 flex flex-col sm:flex-row gap-3">
          {onCancel && (
            <button 
              type="button" 
              onClick={onCancel}
              disabled={isSaving}
              className="w-full py-4 px-6 bg-surface-100 hover:bg-surface-200 text-surface-700 font-bold rounded-xl transition-colors order-2 sm:order-1 active:bg-surface-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Escanear de nuevo
            </button>
          )}
          <button 
            type="submit" 
            disabled={isSaving}
            className="w-full py-4 px-6 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl shadow-lg shadow-primary-500/30 transition-colors order-1 sm:order-2 active:bg-primary-800 disabled:opacity-60 disabled:cursor-wait"
          >
            {isSaving ? 'Guardando...' : 'Confirmar y Guardar'}
          </button>
        </div>

      </form>
    </div>
  );
}
