import React, { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Plus, Trash2, Microscope, Image as ImageIcon, Archive, Clock, Search, Box, ExternalLink } from 'lucide-react';
import { compressImage } from '../utils/imageCompressor';
import './CellCulture.css';

const DEFAULT_ACTIONS = ['Descongelar', 'Pasaje / Split', 'Congelar', 'Cambio de Medio', 'AdiciÃ³n de Tratamiento', 'ObservaciÃ³n'];

export default function CellCulture({ state, updateState }) {
  const [showConfig, setShowConfig] = useState(false);
  const [activeCultureId, setActiveCultureId] = useState(null);
  const [printMode, setPrintMode] = useState(null); // 'single' | 'all'
  const [customPrompt, setCustomPrompt] = useState(null); // { message, defaultValue, onConfirm }

  const askUser = (message, defaultValue, onConfirm) => {
    setCustomPrompt({ message, defaultValue, onConfirm });
  };
  
  const cultures = state?.cultures || [];
  const logs = state?.cultureLogs || [];
  const actionsList = state?.cultureActions || DEFAULT_ACTIONS;
  const inventory = state?.inventory || [];
  
  const protocols = (state?.cultureProtocols || []).map(p => {
    if (typeof p === 'string') return { id: p, name: p, description: '', materialsIds: [] };
    return p;
  });

  // MigraciÃ³n automÃ¡tica de logs viejos y auto-selecciÃ³n
  useEffect(() => {
    if (state && cultures.length === 0 && logs.length > 0) {
      if (!logs[0].cultureId) {
        const newCultures = [];
        const updatedLogs = [...logs];
        const uniqueLines = [...new Set(updatedLogs.map(l => l.cellLine || 'Desconocido'))];
        uniqueLines.forEach(lineName => {
          const cId = uuidv4();
          newCultures.push({ id: cId, cellLine: lineName, dateStarted: new Date().toISOString().split('T')[0], status: 'Activo' });
          updatedLogs.forEach(l => { if ((l.cellLine || 'Desconocido') === lineName) l.cultureId = cId; });
        });
        updateState({ cultures: newCultures, cultureLogs: updatedLogs });
        setActiveCultureId(newCultures[0]?.id);
      }
    } else if (!activeCultureId && cultures.length > 0) {
      setActiveCultureId(cultures[0].id);
    }
  }, [cultures.length, logs.length, activeCultureId]);

  useEffect(() => {
    if (printMode) {
      const timer = setTimeout(() => {
        window.print();
        setPrintMode(null);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [printMode]);

  // == LÃ³gica de Cultivos ==
  const addCulture = () => {
    askUser('Nombre de la Placa o LÃ­nea (Ej. HUVEC P3)', '', (name) => {
      if (name) {
        const newC = { id: uuidv4(), cellLine: name, dateStarted: new Date().toISOString().split('T')[0], status: 'Activo' };
        updateState({ cultures: [newC, ...cultures] });
        setActiveCultureId(newC.id);
      }
    });
  };
  const toggleCultureStatus = (id) => {
    updateState({ cultures: cultures.map(c => c.id === id ? { ...c, status: c.status === 'Activo' ? 'Archivado' : 'Activo' } : c) });
  };
  const removeCulture = (id) => {
    if (confirm('Â¿Eliminar cultivo y toda su cronologÃ­a? Esta acciÃ³n es irreversible.')) {
      updateState({ cultures: cultures.filter(c => c.id !== id), cultureLogs: logs.filter(l => l.cultureId !== id) });
      if (activeCultureId === id) setActiveCultureId(null);
    }
  };
  const convertToSubject = (culture) => {
    const newSubject = {
      id: uuidv4(),
      name: `${culture.cellLine} (Derivado)`,
      group: 'Cultivo Celular',
      measurements: {},
      images: []
    };
    updateState({ subjects: [...(state.subjects || []), newSubject] });
    alert(`La muestra "${newSubject.name}" ha sido creada exitosamente en la secciÃ³n "Sujetos".`);
  };

  // == LÃ³gica de Timeline (Logs) ==
  const addLogToActive = () => {
    if (!activeCultureId) return alert('Selecciona o crea un cultivo activo.');
    const newLog = {
      id: uuidv4(), cultureId: activeCultureId, date: new Date().toISOString().split('T')[0],
      passage: 1, action: 'ObservaciÃ³n', protocolUsed: '', confluence: 50, observations: '', checkedMaterials: [], images: []
    };
    updateState({ cultureLogs: [newLog, ...logs] });
  };
  const updateLog = (id, field, value) => {
    updateState({ cultureLogs: logs.map(l => l.id === id ? { ...l, [field]: value } : l) });
  };
  const toggleLogMaterial = (logId, materialId) => {
    setState({
      ...state, cultureLogs: logs.map(l => {
        if (l.id === logId) {
          const checked = l.checkedMaterials || [];
          return { ...l, checkedMaterials: checked.includes(materialId) ? checked.filter(m => m !== materialId) : [...checked, materialId] };
        }
        return l;
      })
    });
  };
  const handleActionChange = (logId, value) => {
    if (value === 'ADD_NEW') {
      askUser('Nueva acciÃ³n para el menÃº desplegable:', '', (newAct) => {
        if (newAct) {
          if (!actionsList.includes(newAct)) updateState({ cultureActions: [...actionsList, newAct] });
          updateLog(logId, 'action', newAct);
        }
      });
    } else {
      updateLog(logId, 'action', value);
    }
  };
  const removeLog = (id) => {
    if (confirm('Â¿Eliminar este evento de la lÃ­nea de tiempo?')) updateState({ cultureLogs: logs.filter(l => l.id !== id) });
  };
  const handleImageUpload = async (e, logId) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    
    try {
      const compressedImages = await Promise.all(
        files.map(file => compressImage(file, 1024, 0.75))
      );
      
      setState(prevState => ({
        ...prevState, 
        cultureLogs: prevState.cultureLogs.map(l => 
          l.id === logId ? { ...l, images: [...l.images, ...compressedImages] } : l
        )
      }));
    } catch (err) {
      console.error("Error comprimiendo imagen:", err);
      alert("OcurriÃ³ un error al intentar optimizar la foto. Revisa que sea el formato correcto.");
    }
    
    e.target.value = '';
  };
  const removeImage = (logId, imgIndex) => {
    updateState({ cultureLogs: logs.map(l => {
      if (l.id === logId) {
        const newImgs = [...l.images]; newImgs.splice(imgIndex, 1);
        return { ...l, images: newImgs };
      }
      return l;
    })});
  };

  const activeLogs = logs.filter(l => l.cultureId === activeCultureId).sort((a,b) => new Date(b.date) - new Date(a.date));

  return (
    <div className="culture-container">
      {/* Header General */}
      <div className="culture-header glass-panel">
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px'}}>
          <div>
            <h2 style={{color: 'var(--text-primary)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px'}}>
              <Microscope size={24} color="var(--success)"/> BitÃ¡cora de Cultivos
            </h2>
            <p className="no-print" style={{color: 'var(--text-secondary)', fontSize: '0.9rem'}}>Registro de pasajes, confluencia y stock celular.</p>
          </div>
          <div className="no-print" style={{display: 'flex', gap: '8px'}}>
            <button className="btn" onClick={() => setPrintMode('single')} title="Exportar Cultivo Actual a PDF">Exportar PDF</button>
            <button className="btn" onClick={() => setPrintMode('all')} title="Exportar Todos los Cultivos a PDF">PDF Completo</button>
          </div>
        </div>
      </div>

      {/* Vista Dividida: Maestro (Cultivos) - Detalle (Timeline) */}
      <div className={`culture-split-view ${printMode ? 'print-mode' : ''}`}>
        {/* Columna Izquierda: Cultivos */}
        <div className="culture-sidebar glass-panel no-print">
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px'}}>
            <h4 style={{display:'flex', alignItems:'center', gap:'6px'}}><Box size={16}/> Cultivos Activos</h4>
            <button className="btn-icon" onClick={addCulture} title="Nuevo Proyecto/Cultivo" style={{background: 'var(--success)', color: 'white', borderRadius: '4px'}}><Plus size={16}/></button>
          </div>
          
          <div className="culture-list">
            {cultures.map(c => (
              <div 
                key={c.id} 
                className={`culture-list-item ${activeCultureId === c.id ? 'active' : ''} ${c.status === 'Archivado' ? 'archived' : ''}`}
                onClick={() => setActiveCultureId(c.id)}
              >
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: '6px'}}>
                  <span className="culture-list-name" onDoubleClick={() => askUser("Renombrar cultivo:", c.cellLine, (nn) => { if(nn) setState({...state, cultures: cultures.map(cc=>cc.id===c.id?{...cc, cellLine:nn}:cc)}) })}>{c.cellLine}</span>
                  <span className={`culture-status-badge ${c.status.toLowerCase()}`}>{c.status}</span>
                </div>
                <div style={{fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px'}}>Inicio: {c.dateStarted}</div>
              </div>
            ))}
            {cultures.length === 0 && <div className="empty-mini">No hay cultivos. AÃ±ade uno con el botÃ³n +.</div>}
          </div>
        </div>

        {/* Columna Derecha: Timeline del Cultivo Seleccionado */}
        <div className="culture-timeline-view">
          {(printMode === 'all' ? cultures : cultures.filter(c => c.id === activeCultureId)).map(activeCulture => {
            const currentActiveLogs = logs.filter(l => l.cultureId === activeCulture.id).sort((a,b) => new Date(b.date) - new Date(a.date));
            return (
            <div key={activeCulture.id} className="culture-print-section">
              <div className="timeline-header">
                <div>
                  <h3>LÃ­nea de Tiempo: <span style={{color:'var(--accent)'}}>{activeCulture.cellLine}</span></h3>
                  <div className="no-print" style={{display:'flex', gap:'12px', marginTop:'8px', fontSize: '0.85rem'}}>
                    <button className="btn-text" onClick={() => toggleCultureStatus(activeCulture.id)}>
                      {activeCulture.status === 'Activo' ? <><Archive size={14}/> Archivar Cultivo</> : <><Clock size={14}/> Reactivar</>}
                    </button>
                    <button className="btn-text" style={{color: 'var(--accent)'}} onClick={() => convertToSubject(activeCulture)}>
                      <ExternalLink size={14}/> Exportar Muestra
                    </button>
                    <button className="btn-text" style={{color: 'var(--danger)'}} onClick={() => removeCulture(activeCulture.id)}>
                      <Trash2 size={14}/> Eliminar Todo
                    </button>
                  </div>
                </div>
                <button className="btn btn-primary no-print" onClick={addLogToActive} style={{background: 'var(--success)', border: 'none', color: '#fff'}}>
                  <Plus size={16} /> AÃ±adir Evento
                </button>
              </div>

              <div className="timeline-vertical">
                {currentActiveLogs.length > 0 ? currentActiveLogs.map((log) => (
                  <div key={log.id} className="timeline-item">
                    <div className="timeline-dot"></div>
                    <div className={`timeline-content culture-log-card print-card ${printMode && log.images?.length > 0 ? 'has-images' : ''}`}>
                      {printMode ? (
                        <div style={{ display: 'flex', width: '100%', alignItems: 'center' }}>
                          <div className="print-compact-info" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px', padding: '12px', borderRight: log.images.length > 0 ? '1px solid #ccc' : 'none' }}>
                            <div style={{ fontWeight: 600, fontSize: '0.95rem', borderBottom: '1px solid #ccc', paddingBottom: '4px', marginBottom: '4px' }}>
                              ðŸ—“ï¸ {log.date} &nbsp;|&nbsp; Pasaje {log.passage} &nbsp;|&nbsp; AcciÃ³n: {log.action}
                            </div>
                            <div style={{ fontSize: '0.85rem' }}>
                              <strong>Confluencia:</strong> {log.confluence}% 
                              {log.protocolUsed && protocols.find(p=>p.id===log.protocolUsed) && <span> &nbsp;|&nbsp; <strong>Protocolo:</strong> {protocols.find(p=>p.id===log.protocolUsed)?.name}</span>}
                            </div>
                            {log.observations && (
                              <div style={{ fontSize: '0.85rem', marginTop: '4px', whiteSpace: 'pre-wrap' }}>
                                <strong>Obs:</strong> {log.observations}
                              </div>
                            )}
                          </div>
                          {log.images.length > 0 && (
                            <div style={{ padding: '8px', display: 'flex', gap: '4px', flexWrap: 'wrap', maxWidth: '300px' }}>
                              {log.images.map((imgSrc, i) => (
                                <img key={i} src={imgSrc} alt="Microscopio" style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #ccc' }} />
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <>
                          <div className="culture-log-info">
                            <div className="log-field-group">
                              <label>Fecha</label>
                              <input type="date" className="input-field" value={log.date} onChange={e => updateLog(log.id, 'date', e.target.value)} />
                            </div>
                            <div className="log-field-group">
                              <label>Pasaje NÂ°</label>
                              <input type="number" className="input-field" value={log.passage} onChange={e => updateLog(log.id, 'passage', e.target.value)} />
                            </div>
                            <div className="log-field-group">
                              <label>AcciÃ³n</label>
                              <select className="input-field" value={log.action} onChange={e => handleActionChange(log.id, e.target.value)}>
                                {actionsList.map(a => <option key={a} value={a}>{a}</option>)}
                                <option value="ADD_NEW" style={{color: 'var(--success)'}}>âž• AÃ±adir nueva acciÃ³n...</option>
                              </select>
                            </div>
                            <div className="log-field-group">
                              <label>Protocolo Usado</label>
                              <select className="input-field" value={log.protocolUsed} onChange={e => updateLog(log.id, 'protocolUsed', e.target.value)}>
                                <option value="">Ninguno / Manual</option>
                                {protocols.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                              </select>
                            </div>

                            {/* Checklist y DescripciÃ³n EspecÃ­ficas del Protocolo si estÃ¡ seleccionado */}
                            {log.protocolUsed && protocols.find(p => p.id === log.protocolUsed) && (
                              <div style={{gridColumn: '1 / -1', background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.2)', padding: '16px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '12px'}}>
                                {protocols.find(p => p.id === log.protocolUsed).description && (
                                  <div className="log-field-group">
                                    <label style={{color: 'var(--accent)'}}>Pasos del Protocolo</label>
                                    <div 
                                      className="protocol-rich-text"
                                      style={{fontSize: '0.85rem', color: 'var(--text-primary)', background: 'rgba(0,0,0,0.2)', padding:'12px', borderRadius: '4px', overflowX: 'auto'}}
                                      dangerouslySetInnerHTML={{__html: protocols.find(p => p.id === log.protocolUsed).description}}
                                    />
                                  </div>
                                )}

                                {protocols.find(p => p.id === log.protocolUsed).materialsIds?.length > 0 && (
                                  <div className="log-field-group">
                                    <label style={{color: 'var(--accent)'}}>Checklist de Materiales</label>
                                    <div style={{display: 'flex', flexDirection: 'column', gap: '6px', background: 'rgba(0,0,0,0.2)', padding:'8px', borderRadius: '4px'}}>
                                      {protocols.find(p => p.id === log.protocolUsed).materialsIds.map(mid => {
                                        const itemInfo = inventory.find(inv => inv.id === mid) || { name: 'Item Eliminado' };
                                        const isChecked = (log.checkedMaterials || []).includes(mid);
                                        return (
                                          <label key={mid} style={{display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', textDecoration: isChecked ? 'line-through' : 'none', opacity: isChecked ? 0.6 : 1}}>
                                            <input type="checkbox" checked={isChecked} onChange={() => toggleLogMaterial(log.id, mid)} />
                                            {itemInfo.name}
                                          </label>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                            <div className="log-field-group" style={{gridColumn: '1 / -1', marginTop: '8px'}}>
                              <label>Confluencia Estimada ({log.confluence}%)</label>
                              <input type="range" min="0" max="100" step="5" className="culture-range-input" value={log.confluence} onChange={e => updateLog(log.id, 'confluence', e.target.value)} />
                            </div>

                            <div className="log-field-group" style={{gridColumn: '1 / -1'}}>
                              <label>Observaciones (Resultados)</label>
                              <textarea className="input-field" style={{minHeight: '60px', resize: 'vertical'}} value={log.observations} onChange={e => updateLog(log.id, 'observations', e.target.value)} placeholder="Resultados o eventualidades..." />
                            </div>
                          </div>

                          <div className="culture-log-sidebar">
                            <div className="culture-log-images-header">
                              <span style={{fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)'}}>MicroscopÃ­a</span>
                              <label className="btn-icon" style={{cursor: 'pointer'}} title="AÃ±adir fotos">
                                <Plus size={16} />
                                <input type="file" multiple accept="image/*" onChange={(e) => handleImageUpload(e, log.id)} style={{display: 'none'}} />
                              </label>
                            </div>
                            <div className="culture-log-gallery">
                              {log.images.map((imgSrc, i) => (
                                <div key={i} className="culture-gallery-item">
                                  <img src={imgSrc} alt="Microscopio" />
                                  <button className="culture-img-remove" onClick={() => removeImage(log.id, i)}><X size={12} /></button>
                                </div>
                              ))}
                              {log.images.length === 0 && <div className="culture-empty-img"><ImageIcon size={20} style={{opacity: 0.3}} /></div>}
                            </div>
                            <button className="btn btn-danger" style={{width: '100%', marginTop: 'auto', justifyContent: 'center'}} onClick={() => removeLog(log.id)}>
                              <Trash2 size={14} /> Descartar
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )) : (
                  <div className="timeline-empty no-print">
                    <Clock size={40} style={{opacity: 0.2, marginBottom: '16px'}} />
                    <p>No hay eventos registrados para este cultivo.</p>
                    <span>Crea uno con el botÃ³n "AÃ±adir Evento".</span>
                  </div>
                )}
              </div>
            </div>
            );
          })}

          {!activeCultureId && printMode !== 'all' && (
            <div className="empty-state no-print" style={{flex: 1, padding: '40px', textAlign: 'center'}}>
              <Microscope size={64} style={{color: 'var(--text-secondary)', opacity: 0.2, marginBottom: '24px'}} />
              <h3>Selecciona o Crea un Cultivo</h3>
              <p>Escoge un proyecto en el menÃº lateral para ver su lÃ­nea de tiempo cronolÃ³gica.</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal Custom de Prompt para Electron */}
      {customPrompt && (
        <div className="modal-overlay" onClick={() => setCustomPrompt(null)}>
          <div className="glass-panel" style={{padding: '20px', minWidth: '350px'}} onClick={e => e.stopPropagation()}>
            <h4 style={{marginBottom: '12px'}}>{customPrompt.message}</h4>
            <input 
              autoFocus
              className="input-field" 
              defaultValue={customPrompt.defaultValue}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  customPrompt.onConfirm(e.target.value);
                  setCustomPrompt(null);
                } else if (e.key === 'Escape') {
                  setCustomPrompt(null);
                }
              }}
              style={{marginBottom: '16px'}}
            />
            <div style={{display: 'flex', gap: '8px', justifyContent: 'flex-end'}}>
              <button className="btn" onClick={() => setCustomPrompt(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={(e) => {
                 const val = e.currentTarget.parentElement.previousElementSibling.value;
                 customPrompt.onConfirm(val);
                 setCustomPrompt(null);
              }}>Aceptar</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
