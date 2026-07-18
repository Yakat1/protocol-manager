import React, { useState } from 'react';
import { Settings, Plus, X, Tag } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

export default function VariablesManager({ state, updateState }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('variables');
  const [newVar, setNewVar] = useState({ name: '', unit: '', type: 'number', appliesTo: [] });
  const [newModel, setNewModel] = useState('');

  const variables = state.variables || [];
  const modelTypes = state.modelTypes || [];

  const addVariable = () => {
    if (!newVar.name.trim()) return;
    const variable = { 
      id: uuidv4(), 
      name: newVar.name, 
      unit: newVar.unit, 
      type: newVar.type,
      appliesTo: newVar.appliesTo
    };
    updateState({ variables: [...variables, variable] });
    setNewVar({ name: '', unit: '', type: 'number', appliesTo: [] });
  };

  const removeVariable = (id) => {
    updateState({ variables: variables.filter(v => v.id !== id) });
  };

  const addModelType = () => {
    if (!newModel.trim()) return;
    const type = { id: uuidv4(), name: newModel };
    updateState({ modelTypes: [...modelTypes, type] });
    setNewModel('');
  };

  const removeModelType = (id) => {
    updateState({ modelTypes: modelTypes.filter(m => m.id !== id) });
  };

  const toggleAppliesTo = (modelId) => {
    if (newVar.appliesTo.includes(modelId)) {
      setNewVar({ ...newVar, appliesTo: newVar.appliesTo.filter(id => id !== modelId) });
    } else {
      setNewVar({ ...newVar, appliesTo: [...newVar.appliesTo, modelId] });
    }
  };

  if (!isOpen) {
    return (
      <button className="btn" style={{marginBottom: '20px'}} onClick={() => setIsOpen(true)}>
        <Settings size={16} /> Configurar Gestor (Solo Admin)
      </button>
    );
  }

  return (
    <div className="glass-panel variables-manager">
      <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '16px'}}>
        <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
          <h3 className="section-title" style={{margin: 0}}>Ajustes Avanzados</h3>
          <div style={{display: 'flex', gap: '4px', marginLeft: '16px'}}>
            <button className={`btn ${activeTab === 'variables' ? 'btn-primary' : ''}`} onClick={() => setActiveTab('variables')}>Variables</button>
            <button className={`btn ${activeTab === 'models' ? 'btn-primary' : ''}`} onClick={() => setActiveTab('models')}>Líneas / Modelos</button>
          </div>
        </div>
        <button className="btn-icon" onClick={() => setIsOpen(false)}><X size={18}/></button>
      </div>
      
      {activeTab === 'models' && (
        <div>
          <p style={{fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '12px'}}>
            Define las líneas o tipos de muestra biológica (ej. Ratas Wistar, Células HeLa, Paciente Humano).
          </p>
          
          <div style={{display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px'}}>
            {modelTypes.map(m => (
              <div key={m.id} style={{display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg-card)', borderRadius: '6px', alignItems: 'center'}}>
                <span style={{fontWeight: 500}}><Tag size={14} style={{display:'inline', marginRight:'6px'}}/>{m.name}</span>
                <button className="btn-icon" style={{color: 'var(--danger)'}} onClick={() => removeModelType(m.id)}><X size={16}/></button>
              </div>
            ))}
            {modelTypes.length === 0 && <span style={{fontSize: '0.85rem', color: 'var(--text-secondary)'}}>No hay modelos creados.</span>}
          </div>

          <div style={{display: 'flex', gap: '8px'}}>
            <input 
              className="input-field" 
              style={{flex: 1}}
              placeholder="Nueva Línea (ej. C57BL/6)" 
              value={newModel}
              onChange={e => setNewModel(e.target.value)}
            />
            <button className="btn btn-primary" onClick={addModelType}><Plus size={16}/> Añadir</button>
          </div>
        </div>
      )}

      {activeTab === 'variables' && (
        <div>
          {variables.map(v => (
            <div key={v.id} className="variable-row" style={{marginBottom: '8px'}}>
              <input className="input-field" value={v.name} disabled style={{flex: 2}} />
              <input className="input-field" value={v.unit} disabled placeholder="Sin unidad" style={{flex: 1}} />
              <div style={{flex: 2, fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center'}}>
                {v.appliesTo && v.appliesTo.length > 0 ? 
                  `Aplica a: ${v.appliesTo.map(id => modelTypes.find(m => m.id === id)?.name).filter(Boolean).join(', ')}` 
                  : 'Aplica a: Todos'}
              </div>
              <button className="btn-icon" style={{color: 'var(--danger)'}} onClick={() => removeVariable(v.id)}>
                <X size={16}/>
              </button>
            </div>
          ))}

          <div style={{marginTop: '20px', borderTop: '1px solid var(--panel-border)', paddingTop: '20px', display: 'flex', flexDirection: 'column', gap: '12px'}}>
            <div className="variable-row" style={{margin: 0}}>
              <input 
                className="input-field" 
                placeholder="Nombre ej. Peso, Glucosa" 
                value={newVar.name}
                onChange={e => setNewVar({...newVar, name: e.target.value})}
              />
              <input 
                className="input-field" 
                placeholder="Unidad ej. g, mg/dL" 
                value={newVar.unit}
                onChange={e => setNewVar({...newVar, unit: e.target.value})}
              />
              <select 
                className="input-field" 
                value={newVar.type}
                onChange={e => setNewVar({...newVar, type: e.target.value})}
              >
                <option value="number">Numérico</option>
                <option value="text">Texto</option>
              </select>
            </div>
            
            {modelTypes.length > 0 && (
              <div style={{background: 'var(--bg-card)', padding: '12px', borderRadius: '6px'}}>
                <span style={{fontSize: '0.8rem', fontWeight: 500, marginBottom: '8px', display: 'block'}}>Esta variable aplica a: (Dejar vacío para TODOS)</span>
                <div style={{display: 'flex', gap: '12px', flexWrap: 'wrap'}}>
                  {modelTypes.map(m => (
                    <label key={m.id} style={{fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer'}}>
                      <input 
                        type="checkbox" 
                        checked={newVar.appliesTo.includes(m.id)}
                        onChange={() => toggleAppliesTo(m.id)}
                      />
                      {m.name}
                    </label>
                  ))}
                </div>
              </div>
            )}

            <button className="btn btn-primary" onClick={addVariable} style={{alignSelf: 'flex-start'}}>
              <Plus size={16}/> Añadir Variable
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
