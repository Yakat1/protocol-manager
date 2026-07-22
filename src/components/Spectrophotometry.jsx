import React, { useState, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Download, Plus, Trash2, ClipboardPaste, Calculator, TrendingUp, Save, Users, FileText } from 'lucide-react';
import {
  ComposedChart, Line, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { linearRegression, calculateFactor, processSpectroSamples, generateSpectroXLSX } from './AssayAnalysisEngine';
import './Spectrophotometry.css';

function downloadFile(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// Compute the average of valid values in an array of strings/numbers
function computeAverage(vals) {
  const valid = vals.map(v => parseFloat(v)).filter(v => !isNaN(v));
  if (valid.length === 0) return null;
  const sum = valid.reduce((acc, curr) => acc + curr, 0);
  return sum / valid.length;
}

export default function Spectrophotometry({ state, updateState, user, userRole }) {
  const [numReplicates, setNumReplicates] = useState(1);
  const [standards, setStandards] = useState([{ id: uuidv4(), concentration: '', values: ['', '', ''] }]);
  const [samples, setSamples] = useState([{ id: uuidv4(), name: 'Muestra 1', value: '', dilution: '', time: '' }]);
  const [method, setMethod] = useState('linear');
  const [globalDilution, setGlobalDilution] = useState(1);
  const [globalTime, setGlobalTime] = useState(1);
  const [manualFactor, setManualFactor] = useState('');
  
  const [activeTemplateId, setActiveTemplateId] = useState('');
  const [activeCalibrationId, setActiveCalibrationId] = useState('');
  
  // Nube states
  const templates = state?.spectroTemplates || [];
  const calibrations = state?.spectroCalibrations || [];

  const activeCalibration = useMemo(() => calibrations.find(c => c.id === activeCalibrationId), [calibrations, activeCalibrationId]);
  const activeTemplate = useMemo(() => templates.find(t => t.id === activeTemplateId), [templates, activeTemplateId]);

  // Append average to each standard row
  const standardsWithAverage = useMemo(() => {
    return standards.map(s => {
      const activeValues = s.values.slice(0, numReplicates);
      return { ...s, activeValues, average: computeAverage(activeValues) };
    });
  }, [standards, numReplicates]);

  // Clean standards (average) for math
  const cleanStandards = useMemo(() => {
    return standardsWithAverage
      .map(s => ({ x: parseFloat(s.concentration), y: s.average, values: s.activeValues }))
      .filter(s => !isNaN(s.x) && s.y !== null);
  }, [standardsWithAverage]);

  // Compute final curve params from averages
  const computedCurveParams = useMemo(() => {
    if (activeCalibration) return activeCalibration.curveParams;
    if (method === 'linear') return linearRegression(cleanStandards);
    return null;
  }, [cleanStandards, method, activeCalibration]);

  // Compute final factor from averages
  const computedFactor = useMemo(() => {
    if (activeCalibration) return activeCalibration.factor;
    if (method === 'factor') {
      if (manualFactor && parseFloat(manualFactor) > 0) return parseFloat(manualFactor);
      return calculateFactor(cleanStandards);
    }
    return null;
  }, [cleanStandards, method, manualFactor, activeCalibration]);

  const activeMethod = activeCalibration ? activeCalibration.method : method;

  const processedSamples = useMemo(() => {
    return processSpectroSamples(samples, activeMethod, computedCurveParams, computedFactor, globalDilution, globalTime);
  }, [samples, activeMethod, computedCurveParams, computedFactor, globalDilution, globalTime]);

  const chartData = useMemo(() => {
    const pts = activeCalibration ? activeCalibration.standards : cleanStandards;
    if (!pts || pts.length === 0) return [];
    
    let data = pts.map(s => ({
      concentration: s.x,
      absorbance: s.y, // This is the average
      isStandard: true
    }));

    if (activeMethod === 'linear' && computedCurveParams) {
      const minX = 0;
      const maxX = Math.max(...pts.map(s => s.x)) * 1.1 || 100;
      data.push({ concentration: minX, trendAbs: computedCurveParams.m * minX + computedCurveParams.b });
      data.push({ concentration: maxX, trendAbs: computedCurveParams.m * maxX + computedCurveParams.b });
    } else if (activeMethod === 'factor' && computedFactor) {
      const maxX = Math.max(...pts.map(s => s.x)) * 1.1 || 100;
      data.push({ concentration: 0, trendAbs: 0 });
      data.push({ concentration: maxX, trendAbs: maxX / computedFactor });
    }

    data.sort((a, b) => a.concentration - b.concentration);
    return data;
  }, [cleanStandards, activeMethod, computedCurveParams, computedFactor, activeCalibration]);

  const handleExport = () => {
    const exportStandards = activeCalibration ? activeCalibration.standards : standardsWithAverage;
    const blob = generateSpectroXLSX(
      processedSamples, 
      exportStandards, 
      activeCalibration ? activeCalibration.numReplicates : numReplicates,
      activeMethod, 
      computedCurveParams, 
      computedFactor, 
      globalDilution, 
      globalTime
    );
    downloadFile(blob, 'Resultados_Espectrofotometria.xlsx');
  };

  const handlePasteStandards = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const rows = text.trim().split('\n').map(r => r.split('\t'));
      
      const cols = rows[0].length;
      let newReps = numReplicates;
      if (cols >= 4) newReps = 3;
      else if (cols === 3) newReps = 2;
      else if (cols === 2) newReps = 1;
      
      setNumReplicates(newReps);

      if (activeTemplate) {
        const newStds = [...standards];
        rows.forEach((r, i) => {
          if (newStds[i]) {
            newStds[i].values[0] = r[1] ? r[1].replace(',','.') : '';
            if (newReps >= 2) newStds[i].values[1] = r[2] ? r[2].replace(',','.') : '';
            if (newReps >= 3) newStds[i].values[2] = r[3] ? r[3].replace(',','.') : '';
          }
        });
        setStandards(newStds);
      } else {
        const newStds = rows.map(r => {
          const vals = ['', '', ''];
          if (cols >= 2) vals[0] = r[1] ? r[1].replace(',','.') : '';
          if (cols >= 3) vals[1] = r[2] ? r[2].replace(',','.') : '';
          if (cols >= 4) vals[2] = r[3] ? r[3].replace(',','.') : '';
          return {
            id: uuidv4(),
            concentration: r[0] ? r[0].replace(',','.') : '',
            values: vals
          };
        });
        setStandards(newStds);
      }
    } catch(e) {
      alert("Error al pegar. Verifica que los datos vengan desde Excel.");
    }
  };

  const handlePasteSamples = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const rows = text.trim().split('\n').map(r => r.split('\t'));
      const newSamps = rows.map(r => ({
        id: uuidv4(),
        name: r[0] || '',
        value: r[1] ? r[1].replace(',','.') : '',
        dilution: '',
        time: ''
      }));
      setSamples(newSamps);
    } catch(e) {
      alert("Error al pegar.");
    }
  };

  const handleLoadTemplate = (e) => {
    const tid = e.target.value;
    setActiveTemplateId(tid);
    if (!tid) {
      setStandards([{ id: uuidv4(), concentration: '', values: ['', '', ''] }]);
      return;
    }
    const tmpl = templates.find(t => t.id === tid);
    if (tmpl) {
      setMethod(tmpl.method);
      setStandards(tmpl.concentrations.map(c => ({ id: uuidv4(), concentration: c, values: ['', '', ''] })));
    }
  };

  const handleSaveTemplate = () => {
    if (!cleanStandards.length) return alert('No hay concentraciones para guardar.');
    const name = prompt('Nombre de la nueva plantilla de ensayo:');
    if (!name) return;
    const newTemplate = {
      id: uuidv4(),
      name,
      method,
      concentrations: cleanStandards.map(s => s.x)
    };
    updateState({ spectroTemplates: [...templates, newTemplate] });
  };
  
  const handleDeleteTemplate = (id) => {
    if(confirm('¿Eliminar esta plantilla para todo el laboratorio?')) {
      updateState({ spectroTemplates: templates.filter(t => t.id !== id) });
      if (activeTemplateId === id) setActiveTemplateId('');
    }
  };

  const handleSaveCalibration = () => {
    if (cleanStandards.length === 0 && !manualFactor) return alert('No hay datos para guardar.');
    const name = prompt('Nombre de esta curva/factor para compartir:');
    if (!name) return;
    const newCal = {
      id: uuidv4(),
      name,
      authorName: user?.displayName || user?.email || 'Desconocido',
      authorUid: user?.uid,
      date: new Date().toISOString(),
      method,
      factor: computedFactor,
      curveParams: computedCurveParams,
      numReplicates,
      standards: cleanStandards
    };
    updateState({ spectroCalibrations: [...calibrations, newCal] });
  };
  
  const handleDeleteCalibration = (id) => {
    if(confirm('¿Eliminar esta curva guardada?')) {
      updateState({ spectroCalibrations: calibrations.filter(c => c.id !== id) });
      if (activeCalibrationId === id) setActiveCalibrationId('');
    }
  };

  return (
    <div className="spectro-container">
      <div className="spectro-header">
        <h2>🔬 Análisis Espectrofotométrico</h2>
        <p>Procesa absorbancias usando curvas estándar (soporta réplicas) o factores compartidos.</p>
      </div>
      
      {/* NUBE CLOUD BAR */}
      <div className="spectro-cloud-bar">
        <div className="cloud-section">
          <div className="cloud-title"><FileText size={16}/> Plantillas de Ensayo</div>
          <select value={activeTemplateId} onChange={handleLoadTemplate} disabled={!!activeCalibration}>
            <option value="">Libre (Sin Plantilla)</option>
            {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          {userRole === 'admin' && (
            <div className="admin-actions">
              <button className="btn btn-small btn-outline" onClick={handleSaveTemplate} disabled={!!activeCalibration}>Guardar Plantilla</button>
              {activeTemplateId && <button className="btn btn-small btn-danger" onClick={() => handleDeleteTemplate(activeTemplateId)}>Borrar</button>}
            </div>
          )}
        </div>
        <div className="cloud-section">
          <div className="cloud-title"><Users size={16}/> Compartir Factores & Curvas</div>
          <select value={activeCalibrationId} onChange={e => setActiveCalibrationId(e.target.value)}>
            <option value="">Mi Propia Curva (Libre)</option>
            {calibrations.map(c => (
              <option key={c.id} value={c.id}>{c.authorName} - {c.name} ({new Date(c.date).toLocaleDateString()})</option>
            ))}
          </select>
          {!activeCalibrationId && (
            <button className="btn btn-small btn-primary" onClick={handleSaveCalibration}>
              <Save size={14}/> Compartir
            </button>
          )}
          {activeCalibrationId && (
            <button className="btn btn-small btn-danger" onClick={() => handleDeleteCalibration(activeCalibrationId)}>Borrar</button>
          )}
        </div>
      </div>

      {activeCalibration && (
        <div className="locked-alert">
          <strong>🔒 Modo Lectura (Curva Cargada)</strong>: Estás utilizando el factor consolidado de <strong>{activeCalibration.authorName}</strong>. 
          Para estandarizar una nueva curva o ingresar réplicas, vuelve a "Mi Propia Curva".
        </div>
      )}

      <div className="spectro-grid">
        
        {/* Left Column: Data Input */}
        <div className="spectro-left">
          
          {/* Settings Card */}
          <div className="spectro-card">
            <h3>⚙️ Configuración del Ensayo</h3>
            <div className="settings-row">
              {!activeCalibration && (
                <div className="field">
                  <label>Réplicas de Curva</label>
                  <select value={numReplicates} onChange={e => setNumReplicates(Number(e.target.value))}>
                    <option value={1}>1 (Simple)</option>
                    <option value={2}>2 (Duplicado)</option>
                    <option value={3}>3 (Triplicado)</option>
                  </select>
                </div>
              )}
              <div className="field">
                <label>Método de Cálculo</label>
                <select value={activeMethod} onChange={e => setMethod(e.target.value)} disabled={!!activeCalibration || !!activeTemplate}>
                  <option value="linear">Regresión Lineal (y = mx + b)</option>
                  <option value="factor">Factor de Corrección (ΣConc / ΣAbs)</option>
                </select>
              </div>
              <div className="field" style={{width:'80px'}}>
                <label>Dil. Global</label>
                <input type="number" step="any" value={globalDilution} onChange={e => setGlobalDilution(e.target.value)} />
              </div>
              <div className="field" style={{width:'80px'}}>
                <label>T (min)</label>
                <input type="number" step="any" value={globalTime} onChange={e => setGlobalTime(e.target.value)} />
              </div>
            </div>
            {activeMethod === 'factor' && !activeCalibration && (
              <div className="field" style={{marginTop:'12px'}}>
                <label>Factor Manual (opcional, ignora curva)</label>
                <input type="number" step="any" placeholder="Ej. 1.45" value={manualFactor} onChange={e => setManualFactor(e.target.value)} />
              </div>
            )}
            {activeCalibration && activeMethod === 'factor' && (
              <div className="field" style={{marginTop:'12px'}}>
                <label>Factor Bloqueado ({activeCalibration.authorName})</label>
                <input type="text" value={activeCalibration.factor.toFixed(4)} disabled />
              </div>
            )}
          </div>

          {/* Standards Card */}
          {!activeCalibration && (
            <div className="spectro-card" style={{overflowX: 'auto'}}>
              <div className="card-header-flex">
                <h3>🧪 Curva Estándar {activeTemplate && `(${activeTemplate.name})`}</h3>
                <button className="btn btn-small" onClick={handlePasteStandards}><ClipboardPaste size={14}/> Pegar de Excel</button>
              </div>
              
              <table className="spectro-table">
                <thead>
                  <tr>
                    <th>[ ] {activeTemplate && '🔒'}</th>
                    <th>Abs 1</th>
                    {numReplicates >= 2 && <th>Abs 2</th>}
                    {numReplicates >= 3 && <th>Abs 3</th>}
                    {numReplicates > 1 && <th style={{color:'#8b5cf6'}}>Promedio</th>}
                    {!activeTemplate && <th width="30"></th>}
                  </tr>
                </thead>
                <tbody>
                  {standardsWithAverage.map((s, i) => (
                    <tr key={s.id}>
                      <td>
                        <input type="number" step="any" value={s.concentration} onChange={e => {
                          const newS = [...standards];
                          newS[i].concentration = e.target.value;
                          setStandards(newS);
                        }} placeholder="[ ]" disabled={!!activeTemplate} style={{width:'70px'}} />
                      </td>
                      <td>
                        <input type="number" step="any" value={s.values[0]} onChange={e => {
                          const newS = [...standards];
                          newS[i].values[0] = e.target.value;
                          setStandards(newS);
                        }} placeholder="Abs" />
                      </td>
                      {numReplicates >= 2 && (
                        <td>
                          <input type="number" step="any" value={s.values[1]} onChange={e => {
                            const newS = [...standards];
                            newS[i].values[1] = e.target.value;
                            setStandards(newS);
                          }} placeholder="Abs" />
                        </td>
                      )}
                      {numReplicates >= 3 && (
                        <td>
                          <input type="number" step="any" value={s.values[2]} onChange={e => {
                            const newS = [...standards];
                            newS[i].values[2] = e.target.value;
                            setStandards(newS);
                          }} placeholder="Abs" />
                        </td>
                      )}
                      {numReplicates > 1 && (
                        <td>
                          <strong style={{fontSize:'0.9rem', color:'#8b5cf6'}}>{s.average !== null ? s.average.toFixed(4) : '-'}</strong>
                        </td>
                      )}
                      {!activeTemplate && (
                        <td>
                          <button className="btn-icon" onClick={() => setStandards(standards.filter(st => st.id !== s.id))}><Trash2 size={16}/></button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              {!activeTemplate && (
                <button className="btn btn-outline" style={{marginTop:'10px', width:'100%'}} onClick={() => setStandards([...standards, { id: uuidv4(), concentration: '', values: ['', '', ''] }])}>
                  <Plus size={16}/> Agregar Fila
                </button>
              )}
            </div>
          )}

          {/* Samples Card */}
          <div className="spectro-card" style={{overflowX: 'auto'}}>
            <div className="card-header-flex">
              <h3>🧬 Muestras</h3>
              <button className="btn btn-small" onClick={handlePasteSamples}><ClipboardPaste size={14}/> Pegar de Excel</button>
            </div>

            <table className="spectro-table samples-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Absorbancia</th>
                  <th>Dil. (Opc)</th>
                  <th>T (Opc)</th>
                  <th width="30"></th>
                </tr>
              </thead>
              <tbody>
                {samples.map((s, i) => (
                  <tr key={s.id}>
                    <td>
                      <input type="text" value={s.name} onChange={e => {
                        const newS = [...samples]; newS[i].name = e.target.value; setSamples(newS);
                      }} placeholder="Muestra" style={{width:'100px'}} />
                    </td>
                    <td>
                      <input type="number" step="any" value={s.value} onChange={e => {
                        const newS = [...samples]; newS[i].value = e.target.value; setSamples(newS);
                      }} placeholder="Abs" />
                    </td>
                    <td>
                      <input type="number" step="any" value={s.dilution} onChange={e => {
                        const newS = [...samples]; newS[i].dilution = e.target.value; setSamples(newS);
                      }} placeholder={`(${globalDilution})`} style={{width:'60px'}} />
                    </td>
                    <td>
                      <input type="number" step="any" value={s.time} onChange={e => {
                        const newS = [...samples]; newS[i].time = e.target.value; setSamples(newS);
                      }} placeholder={`(${globalTime})`} style={{width:'60px'}} />
                    </td>
                    <td>
                      <button className="btn-icon" onClick={() => setSamples(samples.filter(st => st.id !== s.id))}><Trash2 size={16}/></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button className="btn btn-outline" style={{marginTop:'10px', width:'100%'}} onClick={() => setSamples([...samples, { id: uuidv4(), name: `Muestra ${samples.length+1}`, value: '', dilution: '', time: '' }])}>
              <Plus size={16}/> Agregar Fila
            </button>
          </div>

        </div>

        {/* Right Column: Visualization & Results */}
        <div className="spectro-right">
          
          <div className="spectro-card sticky-card">
            <h3>📊 Visualización (Promedio)</h3>
            
            <div className="chart-container">
              <ResponsiveContainer width="100%" height={250}>
                <ComposedChart data={chartData} margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
                  <CartesianGrid stroke="#f5f5f5" strokeDasharray="3 3" />
                  <XAxis dataKey="concentration" type="number" name="Concentración" />
                  <YAxis yAxisId="left" type="number" name="Abs Promedio" />
                  <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                  {/* Trend line */}
                  <Line yAxisId="left" type="monotone" dataKey="trendAbs" stroke="#3b82f6" strokeWidth={2} dot={false} activeDot={false} />
                  {/* Scatter points */}
                  <Scatter yAxisId="left" name="Promedio" dataKey="absorbance" fill="#8b5cf6" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            <div className="chart-stats">
              {activeMethod === 'linear' && computedCurveParams ? (
                <>
                  <div className="stat-badge">R²: {computedCurveParams.r2.toFixed(4)}</div>
                  <div className="stat-badge">y = {computedCurveParams.m.toFixed(4)}x + {computedCurveParams.b.toFixed(4)}</div>
                </>
              ) : activeMethod === 'factor' && computedFactor ? (
                <div className="stat-badge">Factor: {computedFactor.toFixed(4)}</div>
              ) : (
                <div className="stat-badge" style={{color:'#6b7280', background:'#f3f4f6'}}>Esperando datos...</div>
              )}
            </div>

            <div className="results-preview">
              <h4>Previsualización de Resultados</h4>
              <div className="results-table-container">
                <table className="spectro-results-table">
                  <thead>
                    <tr>
                      <th>Muestra</th>
                      <th>Abs</th>
                      <th>[ ]</th>
                      <th>Actividad</th>
                    </tr>
                  </thead>
                  <tbody>
                    {processedSamples.map(s => (
                      <tr key={s.id}>
                        <td title={s.name}>{s.name.substring(0, 12) || '—'}</td>
                        <td>{s.value || '—'}</td>
                        <td>{s.calculated_concentration !== null ? s.calculated_concentration.toFixed(3) : '—'}</td>
                        <td><strong>{s.final_activity !== null ? s.final_activity.toFixed(3) : '—'}</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <button className="btn btn-primary btn-large" style={{width:'100%', marginTop:'16px'}} onClick={handleExport}>
              <Download size={18}/> Exportar Reporte a Excel
            </button>

          </div>

        </div>

      </div>
    </div>
  );
}
