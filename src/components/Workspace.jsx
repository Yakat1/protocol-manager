import React from 'react';
import VariablesManager from './VariablesManager';
import ImageGallery from './ImageGallery';
import { Download, Upload, Save } from 'lucide-react';

export default function Workspace({ state, setState, activeSubjectId, onExportCSV, onExportBackup, onImportBackup }) {
  if (!activeSubjectId) {
    return (
      <div className="empty-state">
        <h2 style={{color: 'var(--text-primary)'}}>Bienvenido al Asistente de Protocolo</h2>
        <p>Selecciona o crea un sujeto en la barra lateral para comenzar a registrar datos experimentales.</p>
        
        <div style={{marginTop: '40px', display: 'flex', gap: '16px'}}>
          <button className="btn" onClick={onExportCSV} title="Exportar tabulados a CSV para Excel">
            <Download size={16} /> Exportar CSV
          </button>
          <button className="btn btn-primary" onClick={onExportBackup}>
            <Save size={16} /> Respaldar Datos (JSON)
          </button>
          <label className="btn" style={{cursor: 'pointer'}}>
            <Upload size={16} /> Importar Respaldo
            <input type="file" accept=".json" style={{display: 'none'}} onChange={onImportBackup} />
          </label>
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
