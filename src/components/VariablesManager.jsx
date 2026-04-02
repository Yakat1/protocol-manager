import React, { useState } from 'react';
import { Settings, Plus, X } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

export default function VariablesManager({ state, setState }) {
  const [isOpen, setIsOpen] = useState(false);
  const [newVar, setNewVar] = useState({ name: '', unit: '', type: 'number' });

  const addVariable = () => {
    if (!newVar.name.trim()) return;
    const variable = { id: uuidv4(), name: newVar.name, unit: newVar.unit, type: newVar.type };
    setState({ ...state, variables: [...state.variables, variable] });
    setNewVar({ name: '', unit: '', type: 'number' });
  };

  const removeVariable = (id) => {
    setState({ 
      ...state, 
      variables: state.variables.filter(v => v.id !== id) 
    });
  };

  if (!isOpen) {
    return (
      <button className="btn" style={{marginBottom: '20px'}} onClick={() => setIsOpen(true)}>
        <Settings size={16} /> Configurar Variables del Protocolo
      </button>
    );
  }

  return (
    <div className="glass-panel variables-manager">
      <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '16px'}}>
        <h3 className="section-title" style={{margin: 0}}>Gestor de Variables Globales</h3>
        <button className="btn-icon" onClick={() => setIsOpen(false)}><X size={18}/></button>
      </div>
      
      {state.variables.map(v => (
        <div key={v.id} className="variable-row">
          <input className="input-field" value={v.name} disabled />
          <input className="input-field" value={v.unit} disabled placeholder="Sin unidad" />
          <input className="input-field" value={v.type === 'number' ? 'Numérico' : 'Texto'} disabled />
          <button className="btn-icon" style={{color: 'var(--danger)'}} onClick={() => removeVariable(v.id)}>
            <X size={16}/>
          </button>
        </div>
      ))}

      <div className="variable-row" style={{marginTop: '20px', borderTop: '1px solid var(--panel-border)', paddingTop: '20px'}}>
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
        <button className="btn btn-primary" onClick={addVariable}>
          <Plus size={16}/> Añadir
        </button>
      </div>
    </div>
  );
}
