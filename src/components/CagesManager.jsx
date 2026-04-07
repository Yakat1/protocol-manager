import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Plus, Trash2, Calendar, Pill, CheckSquare, Square, Save, Activity, X, Share2 } from 'lucide-react';

export default function CagesManager({ state, updateState }) {
  const cages = state.cages || [];

  const addCage = () => {
    const newCage = {
      id: uuidv4(),
      name: `Jaula ${cages.length + 1}`,
      headcount: 5,
      treatment: '',
      lastTreatmentDate: '',
      startDate: new Date().toISOString().split('T')[0],
      checklist: [
        { id: uuidv4(), text: 'Agua y Alimento verificado', done: false },
        { id: uuidv4(), text: 'Limpieza de cama', done: false }
      ]
    };
    updateState({ cages: [...cages, newCage] });
  };

  const removeCage = (id) => {
    if (confirm('¿Seguro que deseas eliminar esta jaula?')) {
      updateState({ cages: cages.filter(c => c.id !== id) });
    }
  };

  const updateCage = (id, newProps) => {
    updateState({
      cages: cages.map(c => c.id === id ? { ...c, ...newProps } : c)
    });
  };

  const getAgeText = (startDate) => {
    if (!startDate) return 'Sin fecha';
    const start = new Date(startDate);
    const now = new Date();
    // Reset times to compare just days
    start.setHours(0,0,0,0);
    now.setHours(0,0,0,0);
    const diffTime = now - start;
    if (diffTime < 0) return 'Fecha futura';
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const weeks = Math.floor(diffDays / 7);
    const days = diffDays % 7;
    return `${weeks} sem, ${days} días`;
  };

  const toggleChecklist = (cageId, itemId) => {
    const cage = cages.find(c => c.id === cageId);
    if(!cage) return;
    const newChecklist = cage.checklist.map(i => i.id === itemId ? { ...i, done: !i.done } : i);
    updateCage(cageId, { checklist: newChecklist });
  };

  const removeItem = (cageId, itemId) => {
    const cage = cages.find(c => c.id === cageId);
    if(!cage) return;
    updateCage(cageId, { checklist: cage.checklist.filter(i => i.id !== itemId) });
  };

  const addItem = (cageId, e) => {
    if (e.key === 'Enter' && e.target.value.trim() !== '') {
      const cage = cages.find(c => c.id === cageId);
      const newItem = { id: uuidv4(), text: e.target.value.trim(), done: false };
      updateCage(cageId, { checklist: [...(cage.checklist || []), newItem] });
      e.target.value = '';
    }
  };

  const exportToSubjects = (cage) => {
    const num = parseInt(cage.headcount) || 0;
    if(num <= 0) {
      alert('La jaula no tiene animales para exportar.');
      return;
    }
    
    if(confirm(`¿Estás seguro de que deseas exportar y crear ${num} sujetos individuales para "${cage.name}"?`)) {
      const newSubjects = [];
      for(let i = 1; i <= num; i++) {
        newSubjects.push({
          id: uuidv4(),
          name: `${cage.name}, Rata ${i}`,
          group: cage.name,
          measurements: {},
          images: []
        });
      }
      updateState({ subjects: [...(state.subjects || []), ...newSubjects] });
      alert(`Se han creado ${num} sujetos exitosamente en la pestaña "Sujetos Individuales".`);
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3 style={{ color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Activity size={20} color="var(--accent)" />
          Gestión de Jaulas y Crecimiento
        </h3>
        <button className="btn btn-primary" onClick={addCage}>
          <Plus size={16} /> Añadir Jaula
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
        {cages.length === 0 && (
          <div style={{ color: 'var(--text-secondary)', padding: '20px', gridColumn: '1 / -1', textAlign: 'center', background: 'rgba(0,0,0,0.1)', borderRadius: '8px' }}>
            No hay jaulas registradas. Crea una para agrupar tus modelos.
          </div>
        )}

        {cages.map(cage => (
          <div key={cage.id} className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px' }}>
              <input 
                className="input-field"
                style={{ fontSize: '1.2rem', fontWeight: 600, background: 'transparent', border: 'none', padding: '0', maxWidth: '180px' }}
                value={cage.name}
                onChange={e => updateCage(cage.id, { name: e.target.value })}
                placeholder="Nombre de Jaula"
              />
              <div style={{ display: 'flex', gap: '4px' }}>
                <button className="btn-icon" onClick={() => exportToSubjects(cage)} style={{ color: 'var(--accent)' }} title="Exportar a Sujetos Individuales"><Share2 size={16} /></button>
                <button className="btn-icon" onClick={() => removeCage(cage.id)} style={{ color: 'var(--danger)' }} title="Eliminar Jaula"><Trash2 size={16} /></button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}># Animales</label>
                <input 
                  type="number"
                  min="0"
                  className="input-field"
                  style={{ width: '100%', padding: '6px' }}
                  value={cage.headcount || 0}
                  onChange={e => updateCage(cage.id, { headcount: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>Fecha de Inicio</label>
                <input 
                  type="date"
                  className="input-field"
                  style={{ width: '100%', padding: '6px', fontSize: '0.8rem' }}
                  value={cage.startDate || ''}
                  onChange={e => updateCage(cage.id, { startDate: e.target.value })}
                />
              </div>
            </div>

            <div style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: '6px', padding: '10px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>Edad / Tiempo en Jaula</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--accent)' }}>
                {getAgeText(cage.startDate)}
              </div>
            </div>

            <div style={{ marginTop: '4px' }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Pill size={12} /> Tratamiento Diario / Protocolo
              </label>
              <input 
                type="text"
                className="input-field"
                style={{ width: '100%', padding: '6px', marginTop: '4px' }}
                placeholder="Ej. Estatinas 5mg/kg"
                value={cage.treatment || ''}
                onChange={e => updateCage(cage.id, { treatment: e.target.value })}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Calendar size={12} /> Último Tratamiento o Chequeo
              </label>
              <input 
                type="date"
                className="input-field"
                style={{ width: '100%', padding: '6px', marginTop: '4px', fontSize: '0.8rem' }}
                value={cage.lastTreatmentDate || ''}
                onChange={e => updateCage(cage.id, { lastTreatmentDate: e.target.value })}
              />
            </div>

            <div style={{ marginTop: '10px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '10px' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-primary)', display: 'block', marginBottom: '8px' }}>
                Tracker Personalizable
              </label>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '120px', overflowY: 'auto', marginBottom: '8px' }}>
                {(cage.checklist || []).map(item => (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
                    <div onClick={() => toggleChecklist(cage.id, item.id)} style={{ cursor: 'pointer', color: item.done ? 'var(--accent)' : 'var(--text-secondary)' }}>
                      {item.done ? <CheckSquare size={16} /> : <Square size={16} />}
                    </div>
                    <span style={{ flex: 1, textDecoration: item.done ? 'line-through' : 'none', opacity: item.done ? 0.6 : 1 }}>
                      {item.text}
                    </span>
                    <button className="btn-icon" onClick={() => removeItem(cage.id, item.id)} style={{ padding: 0 }}><X size={14}/></button>
                  </div>
                ))}
              </div>
              
              <input 
                type="text" 
                className="input-field" 
                placeholder="+ Enter para añadir nuevo ítem..." 
                style={{ width: '100%', padding: '6px', fontSize: '0.8rem' }}
                onKeyDown={(e) => addItem(cage.id, e)}
              />
            </div>

          </div>
        ))}
      </div>
    </div>
  );
}
