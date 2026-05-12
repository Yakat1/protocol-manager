import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Plus, Trash2, Edit2, TestTube, Activity, Save, X, FlaskConical, Calendar, MapPin, Beaker } from 'lucide-react';

const SAMPLE_TYPES = ['Plasma', 'Suero', 'Lisado Celular', 'Cerebro', 'Hígado', 'Riñón', 'Corazón', 'Músculo', 'Orina', 'Heces', 'LCR', 'Otro...'];
const ASSAY_TYPES = ['Western Blot', 'ELISA', 'Cuantificación BCA', 'Cuantificación Bradford', 'PCR / RT-qPCR', 'Nitritos (Griess)', 'Inmunohistoquímica', 'Actividad Enzimática', 'Otro...'];

export default function SubjectSamples({ subject, updateSubject }) {
  const [editingSampleId, setEditingSampleId] = useState(null);
  const [editingAssayId, setEditingAssayId] = useState(null);

  // Formularios temporales
  const [tempSample, setTempSample] = useState({});
  const [tempAssay, setTempAssay] = useState({});

  const samples = subject.samples || [];

  // --- Sample Actions ---
  const addSample = () => {
    const newSample = {
      id: uuidv4(),
      type: 'Lisado Celular',
      customType: '',
      extractionDate: new Date().toISOString().split('T')[0],
      volume_amount: '',
      storageLocation: '',
      notes: '',
      assays: []
    };
    updateSubject({ ...subject, samples: [newSample, ...samples] });
    setEditingSampleId(newSample.id);
    setTempSample(newSample);
  };

  const saveSample = () => {
    const updatedSamples = samples.map(s => s.id === tempSample.id ? tempSample : s);
    updateSubject({ ...subject, samples: updatedSamples });
    setEditingSampleId(null);
  };

  const removeSample = (sampleId) => {
    if (confirm('¿Eliminar esta muestra y todo su registro de ensayos?')) {
      updateSubject({ ...subject, samples: samples.filter(s => s.id !== sampleId) });
    }
  };

  // --- Assay Actions ---
  const addAssay = (sampleId) => {
    const newAssay = {
      id: uuidv4(),
      type: 'Western Blot',
      customType: '',
      target: '',
      date: new Date().toISOString().split('T')[0],
      result: '',
      notes: ''
    };
    const updatedSamples = samples.map(s => {
      if (s.id === sampleId) {
        return { ...s, assays: [newAssay, ...(s.assays || [])] };
      }
      return s;
    });
    updateSubject({ ...subject, samples: updatedSamples });
    setEditingAssayId(newAssay.id);
    setTempAssay(newAssay);
  };

  const saveAssay = (sampleId) => {
    const updatedSamples = samples.map(s => {
      if (s.id === sampleId) {
        return { ...s, assays: s.assays.map(a => a.id === tempAssay.id ? tempAssay : a) };
      }
      return s;
    });
    updateSubject({ ...subject, samples: updatedSamples });
    setEditingAssayId(null);
  };

  const removeAssay = (sampleId, assayId) => {
    if (confirm('¿Eliminar este ensayo?')) {
      const updatedSamples = samples.map(s => {
        if (s.id === sampleId) {
          return { ...s, assays: s.assays.filter(a => a.id !== assayId) };
        }
        return s;
      });
      updateSubject({ ...subject, samples: updatedSamples });
    }
  };

  return (
    <div className="subject-samples-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3 className="section-title" style={{ marginBottom: 0 }}>Repositorio de Muestras Extraídas</h3>
        <button className="btn btn-primary" onClick={addSample}>
          <Plus size={16} /> Añadir Muestra
        </button>
      </div>

      {samples.length === 0 ? (
        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <TestTube size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
          <p>No hay muestras registradas para este sujeto.</p>
          <p style={{ fontSize: '0.85rem' }}>Registra extracciones de plasma, lisados u órganos para rastrear los ensayos.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {samples.map((sample) => {
            const isEditingSample = editingSampleId === sample.id;
            const assays = sample.assays || [];

            return (
              <div key={sample.id} className="glass-panel" style={{ padding: '16px', borderLeft: '4px solid var(--accent)' }}>
                {isEditingSample ? (
                  // --- Formulario de Edición de Muestra ---
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: 'rgba(0,0,0,0.1)', padding: '12px', borderRadius: '8px' }}>
                    <div className="input-group">
                      <label className="input-label">Tipo de Muestra</label>
                      <select 
                        className="input-field" 
                        value={tempSample.type} 
                        onChange={e => setTempSample({...tempSample, type: e.target.value})}
                      >
                        {SAMPLE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                      {tempSample.type === 'Otro...' && (
                        <input className="input-field" style={{marginTop:'4px'}} placeholder="Especificar tipo" value={tempSample.customType || ''} onChange={e => setTempSample({...tempSample, customType: e.target.value})} />
                      )}
                    </div>
                    <div className="input-group">
                      <label className="input-label">Fecha de Extracción</label>
                      <input type="date" className="input-field" value={tempSample.extractionDate || ''} onChange={e => setTempSample({...tempSample, extractionDate: e.target.value})} />
                    </div>
                    <div className="input-group">
                      <label className="input-label">Volumen / Cantidad</label>
                      <input type="text" className="input-field" placeholder="Ej. 500 µL, 20 mg" value={tempSample.volume_amount || ''} onChange={e => setTempSample({...tempSample, volume_amount: e.target.value})} />
                    </div>
                    <div className="input-group">
                      <label className="input-label">Ubicación (Almacenamiento)</label>
                      <input type="text" className="input-field" placeholder="Ej. Cajón 2, Rack A" value={tempSample.storageLocation || ''} onChange={e => setTempSample({...tempSample, storageLocation: e.target.value})} />
                    </div>
                    <div className="input-group" style={{ gridColumn: '1 / -1' }}>
                      <label className="input-label">Notas Adicionales</label>
                      <input type="text" className="input-field" placeholder="Ej. Buffer RIPA + Proteasas" value={tempSample.notes || ''} onChange={e => setTempSample({...tempSample, notes: e.target.value})} />
                    </div>
                    <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                      <button className="btn" onClick={() => setEditingSampleId(null)}><X size={16}/> Cancelar</button>
                      <button className="btn btn-primary" onClick={saveSample}><Save size={16}/> Guardar</button>
                    </div>
                  </div>
                ) : (
                  // --- Vista Lectura de Muestra ---
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                      <div>
                        <h4 style={{ margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <TestTube size={18} color="var(--accent)"/> 
                          {sample.type === 'Otro...' ? sample.customType : sample.type}
                        </h4>
                        <div style={{ display: 'flex', gap: '16px', fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '8px' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Calendar size={12}/> {sample.extractionDate}</span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Beaker size={12}/> {sample.volume_amount || '--'}</span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><MapPin size={12}/> {sample.storageLocation || '--'}</span>
                        </div>
                        {sample.notes && <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '8px 0 0 0', fontStyle: 'italic' }}>{sample.notes}</p>}
                      </div>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button className="btn-icon" onClick={() => { setTempSample(sample); setEditingSampleId(sample.id); }}><Edit2 size={16}/></button>
                        <button className="btn-icon" onClick={() => removeSample(sample.id)} style={{color: 'var(--danger)'}}><Trash2 size={16}/></button>
                      </div>
                    </div>

                    {/* --- Lista de Ensayos para esta Muestra --- */}
                    <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '6px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <h5 style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <FlaskConical size={14}/> Ensayos Realizados ({assays.length})
                        </h5>
                        <button className="btn" style={{ padding: '4px 8px', fontSize: '0.75rem' }} onClick={() => addAssay(sample.id)}>
                          <Plus size={14}/> Registrar Ensayo
                        </button>
                      </div>

                      {assays.length === 0 ? (
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>Aún no se han realizado ensayos con esta muestra.</div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {assays.map((assay) => {
                            const isEditingAssay = editingAssayId === assay.id;
                            return isEditingAssay ? (
                              <div key={assay.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', background: 'rgba(255,255,255,0.05)', padding: '8px', borderRadius: '6px', border: '1px solid var(--panel-border)' }}>
                                <div className="input-group">
                                  <label className="input-label">Tipo de Ensayo</label>
                                  <select className="input-field" value={tempAssay.type} onChange={e => setTempAssay({...tempAssay, type: e.target.value})}>
                                    {ASSAY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                  </select>
                                  {tempAssay.type === 'Otro...' && (
                                    <input className="input-field" style={{marginTop:'4px'}} placeholder="Especificar" value={tempAssay.customType || ''} onChange={e => setTempAssay({...tempAssay, customType: e.target.value})} />
                                  )}
                                </div>
                                <div className="input-group">
                                  <label className="input-label">Blanco / Target (Ej. p-AKT, Proteína)</label>
                                  <input type="text" className="input-field" value={tempAssay.target || ''} onChange={e => setTempAssay({...tempAssay, target: e.target.value})} />
                                </div>
                                <div className="input-group">
                                  <label className="input-label">Fecha del Ensayo</label>
                                  <input type="date" className="input-field" value={tempAssay.date || ''} onChange={e => setTempAssay({...tempAssay, date: e.target.value})} />
                                </div>
                                <div className="input-group">
                                  <label className="input-label">Resultado / Concentración</label>
                                  <input type="text" className="input-field" placeholder="Ej. 2.5 ug/uL, Expresión Alta" value={tempAssay.result || ''} onChange={e => setTempAssay({...tempAssay, result: e.target.value})} />
                                </div>
                                <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                  <button className="btn" onClick={() => setEditingAssayId(null)}><X size={14}/> Cancelar</button>
                                  <button className="btn btn-primary" onClick={() => saveAssay(sample.id)}><Save size={14}/> Guardar</button>
                                </div>
                              </div>
                            ) : (
                              <div key={assay.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '8px 12px', borderRadius: '4px', borderLeft: '3px solid #3b82f6', fontSize: '0.85rem' }}>
                                <div>
                                  <strong style={{ color: 'var(--text-primary)' }}>{assay.type === 'Otro...' ? assay.customType : assay.type}</strong>
                                  <span style={{ color: 'var(--accent)', marginLeft: '8px', fontWeight: 600 }}>{assay.target}</span>
                                  <div style={{ color: 'var(--text-secondary)', marginTop: '4px', fontSize: '0.8rem' }}>
                                    <span>{assay.date}</span>
                                    {assay.result && <span style={{ marginLeft: '12px', color: '#10b981' }}>➔ {assay.result}</span>}
                                  </div>
                                </div>
                                <div style={{ display: 'flex', gap: '4px' }}>
                                  <button className="btn-icon" onClick={() => { setTempAssay(assay); setEditingAssayId(assay.id); }} style={{ padding: '4px' }}><Edit2 size={14}/></button>
                                  <button className="btn-icon" onClick={() => removeAssay(sample.id, assay.id)} style={{ padding: '4px', color: 'var(--danger)' }}><Trash2 size={14}/></button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
