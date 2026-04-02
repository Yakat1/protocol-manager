import React from 'react';
import { v4 as uuidv4 } from 'uuid';
import VariablesManager from './VariablesManager';
import ImageGallery from './ImageGallery';
import { Download, Upload, Save, Plus, Users } from 'lucide-react';

export default function Workspace({ state, setState, activeSubjectId, setActiveSubjectId, onExportCSV, onExportBackup, onImportBackup }) {
  if (!activeSubjectId) {
    const addSubject = () => {
      const newSubject = {
        id: uuidv4(),
        name: `Muestra ${state.subjects.length + 1}`,
        group: 'Control',
        measurements: {},
        images: []
      };
      setState({ ...state, subjects: [...state.subjects, newSubject] });
      setActiveSubjectId(newSubject.id);
    };

    return (
      <div className="workspace-header" style={{flexDirection: 'column', height: '100%'}}>
        <div style={{marginBottom: '24px'}}>
          <h1 style={{color: 'var(--text-primary)', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '8px'}}>
            <Users size={28} color="var(--accent)" /> Gestión de Sujetos Experimentales
          </h1>
          <p style={{color: 'var(--text-secondary)', margin: 0}}>Crea nuevos sujetos, asignales un grupo experimental y registra sus variables en vivo.</p>
        </div>

        <div className="glass-panel" style={{display: 'flex', flexWrap: 'wrap', gap: '16px', padding: '24px', alignItems: 'flex-start'}}>
          <button 
            onClick={addSubject} 
            style={{
              padding: '20px', 
              border: '2px dashed var(--accent)', 
              borderRadius: '12px', 
              background: 'rgba(59, 130, 246, 0.05)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s',
              minWidth: '200px'
            }}
            onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)'; }}
            onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(59, 130, 246, 0.05)'; }}
          >
            <Plus size={32} color="var(--accent)" />
            <span style={{fontWeight: 600}}>Añadir Nuevo Sujeto</span>
            <span style={{fontSize: '0.8rem', color: 'var(--text-secondary)'}}>Crear ficha de datos</span>
          </button>

          {state.subjects.map(subj => (
            <div 
              key={subj.id}
              className="glass-panel"
              onClick={() => setActiveSubjectId(subj.id)}
              style={{
                padding: '20px',
                borderRadius: '12px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                minWidth: '200px',
                transition: 'all 0.2s',
                border: '1px solid var(--panel-border)'
              }}
              onMouseOver={(e) => { e.currentTarget.style.borderColor = 'var(--text-secondary)'; }}
              onMouseOut={(e) => { e.currentTarget.style.borderColor = 'var(--panel-border)'; }}
            >
              <span style={{fontWeight: 'bold', fontSize: '1.1rem', color: 'var(--text-primary)'}}>{subj.name}</span>
              <span style={{fontSize: '0.85rem', color: 'var(--text-secondary)'}}>Grupo: {subj.group || 'Sin grupo'}</span>
              <span style={{fontSize: '0.8rem', color: 'var(--accent)', marginTop: '8px', fontWeight: 500}}>
                 Ver ficha →
              </span>
            </div>
          ))}
        </div>

        <div style={{marginTop: 'auto', paddingTop: '40px', display: 'flex', gap: '16px'}}>
          <button className="btn" onClick={onExportCSV} title="Exportar tabulados a CSV para Excel">
            <Download size={16} /> Exportar CSV
          </button>
          <button className="btn btn-primary" onClick={onExportBackup}>
            <Save size={16} /> Respaldar Datos (JSON)
          </button>
        </div>
      </div>
    );
  }

  const subjectIndex = state.subjects.findIndex(s => s.id === activeSubjectId);
  const subject = state.subjects[subjectIndex];

  const updateSubjectName = (e) => {
    const newSubjects = [...state.subjects];
    newSubjects[subjectIndex] = { ...subject, name: e.target.value };
    setState({ ...state, subjects: newSubjects });
  };

  const updateMeasurement = (varId, val) => {
    const newSubjects = [...state.subjects];
    newSubjects[subjectIndex] = {
      ...subject,
      measurements: { ...subject.measurements, [varId]: val }
    };
    setState({ ...state, subjects: newSubjects });
  };

  return (
    <>
      <div className="workspace-header">
        <div>
          <input 
            className="input-field"
            style={{fontSize: '1.8rem', fontWeight: 600, background: 'transparent', border: 'none', padding: 0, marginBottom: '4px', color: 'var(--text-primary)'}}
            value={subject.name}
            onChange={updateSubjectName}
            placeholder="Nombre del Sujeto (ej. Ratón 1)"
          />
          <div style={{display: 'flex', alignItems: 'center', marginBottom: '8px', gap: '8px'}}>
            <span style={{color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 500}}>Grupo Exp:</span>
            <input 
              className="input-field"
              style={{fontSize: '0.9rem', padding: '4px 8px', maxWidth: '150px'}}
              value={subject.group || ''}
              onChange={(e) => {
                const newSubjects = [...state.subjects];
                newSubjects[subjectIndex] = { ...subject, group: e.target.value };
                setState({ ...state, subjects: newSubjects });
              }}
              placeholder="Ej. Control"
            />
          </div>
          <div className="workspace-subtitle">Registra las variables y adjunta evidencias para este sujeto.</div>
        </div>
        <div style={{display: 'flex', gap: '8px'}}>
          <button className="btn" onClick={onExportCSV}>
            <Download size={16} /> Exportar CSV
          </button>
        </div>
      </div>

      <VariablesManager state={state} setState={setState} />

      <h3 className="section-title">Registro de Datos</h3>
      <div className="glass-panel" style={{padding: '24px', marginBottom: '40px'}}>
        <div className="data-grid">
          {state.variables.map(v => (
            <div key={v.id} className="input-group">
              <label className="input-label">
                {v.name} {v.unit && <span style={{color: 'var(--text-secondary)'}}>({v.unit})</span>}
              </label>
              <input 
                className="input-field" 
                type={v.type === 'number' ? 'number' : 'text'}
                value={subject.measurements[v.id] ?? ''}
                onChange={(e) => updateMeasurement(v.id, e.target.value)}
                placeholder={`Ingresa ${v.name.toLowerCase()}`}
              />
            </div>
          ))}
          {state.variables.length === 0 && (
            <div style={{color: 'var(--text-secondary)', gridColumn: '1 / -1'}}>
              No hay variables definidas. Créalas en el Gestor de Variables arriba.
            </div>
          )}
        </div>
      </div>

      <h3 className="section-title">Carga de Evidencia (Western Blot, Microscopía, etc.)</h3>
      <ImageGallery 
        subject={subject} 
        onUpdateImages={(images) => {
          const newSubjects = [...state.subjects];
          newSubjects[subjectIndex] = { ...subject, images };
          setState({ ...state, subjects: newSubjects });
        }}
      />
    </>
  );
}
