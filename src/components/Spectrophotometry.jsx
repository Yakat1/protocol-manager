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

export default function Spectrophotometry({ state, updateState, user, userRole }) {
  const [standards, setStandards] = useState([{ id: uuidv4(), concentration: '', value: '' }]);
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

  // If a calibration is loaded, everything is locked to that calibration's math.
  const activeCalibration = useMemo(() => calibrations.find(c => c.id === activeCalibrationId), [calibrations, activeCalibrationId]);
  const activeTemplate = useMemo(() => templates.find(t => t.id === activeTemplateId), [templates, activeTemplateId]);

  // Clean standards for math (only used if NO calibration is loaded)
  const cleanStandards = standards
    .map(s => ({ x: parseFloat(s.concentration), y: parseFloat(s.value) }))
    .filter(s => !isNaN(s.x) && !isNaN(s.y));

  // Compute curve params
  const computedCurveParams = useMemo(() => {
    if (activeCalibration) return activeCalibration.curveParams;
    if (method === 'linear') return linearRegression(cleanStandards);
    return null;
  }, [cleanStandards, method, activeCalibration]);

  const computedFactor = useMemo(() => {
    if (activeCalibration) return activeCalibration.factor;
    if (method === 'factor') {
      if (manualFactor && parseFloat(manualFactor) > 0) return parseFloat(manualFactor);
      return calculateFactor(cleanStandards);
    }
    return null;
  }, [cleanStandards, method, manualFactor, activeCalibration]);

  // Active Method
  const activeMethod = activeCalibration ? activeCalibration.method : method;

  // Process samples
  const processedSamples = useMemo(() => {
    return processSpectroSamples(samples, activeMethod, computedCurveParams, computedFactor, globalDilution, globalTime);
  }, [samples, activeMethod, computedCurveParams, computedFactor, globalDilution, globalTime]);

  // Chart data
  const chartData = useMemo(() => {
    // If a calibration is loaded, show its standard points instead.
    const pts = activeCalibration ? activeCalibration.standards : cleanStandards;
    if (!pts || pts.length === 0) return [];
    
    let data = pts.map(s => ({
      concentration: s.x,
      absorbance: s.y,
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
    const exportStandards = activeCalibration ? activeCalibration.standards : standards;
    const blob = generateSpectroXLSX(processedSamples, exportStandards, activeMethod, computedCurveParams, computedFactor, globalDilution, globalTime);
    downloadFile(blob, 'Resultados_Espectrofotometria.xlsx');
  };

  const handlePasteStandards = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const rows = text.trim().split('\n').map(r => r.split('\t'));
      
      // If template is active, map onto existing standards
      if (activeTemplate) {
        const newStds = [...standards];
        rows.forEach((r, i) => {
          if (newStds[i]) {
            newStds[i].value = r[1] ? r[1].replace(',','.') : (r[0] ? r[0].replace(',','.') : '');
          }
        });
        setStandards(newStds);
      } else {
        const newStds = rows.map(r => ({
          id: uuidv4(),
          concentration: r[0] ? r[0].replace(',','.') : '',
          value: r[1] ? r[1].replace(',','.') : ''
        }));
        setStandards(newStds);
      }
    } catch(e) {
      alert("Error al pegar.");
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
      setStandards([{ id: uuidv4(), concentration: '', value: '' }]);
      return;
    }
    const tmpl = templates.find(t => t.id === tid);
    if (tmpl) {
      setMethod(tmpl.method);
      setStandards(tmpl.concentrations.map(c => ({ id: uuidv4(), concentration: c, value: '' })));
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
        <p>Procesa absorbancias usando curvas estándar o factores matemáticos compartidos por el laboratorio.</p>
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
          <strong>🔒 Modo Lectura (Curva Cargada)</strong>: Estás utilizando la calibración de <strong>{activeCalibration.authorName}</strong>. 
          El factor matemático está bloqueado para asegurar reproducibilidad. Para crear una nueva curva, vuelve a "Mi Propia Curva".
        </div>
      )}

      <div className="spectro-grid">
        
        {/* Left Column: Data Input */}
        <div className="spectro-left">
          
          {/* Settings Card */}
          <div className="spectro-card">
            <h3>⚙️ Configuración del Ensayo</h3>
            <div className="settings-row">
              <div className="field">
                <label>Método de Cálculo</label>
                <select value={activeMethod} onChange={e => setMethod(e.target.value)} disabled={!!activeCalibration || !!activeTemplate}>
                  <option value="linear">Regresión Lineal (y = mx + b)</option>
                  <option value="factor">Factor de Corrección (ΣConc / ΣAbs)</option>
                </select>
              </div>
              <div className="field">
                <label>Dilución Global</label>
                <input type="number" step="any" value={globalDilution} onChange={e => setGlobalDilution(e.target.value)} />
              </div>
              <div className="field">
                <label>Tiempo Global (min)</label>
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
            <div className="spectro-card">
              <div className="card-header-flex">
                <h3>🧪 Curva Estándar {activeTemplate && `(${activeTemplate.name})`}</h3>
                <button className="btn btn-small" onClick={handlePasteStandards}><ClipboardPaste size={14}/> Pegar de Excel</button>
              </div>
              
              <table className="spectro-table">
                <thead>
                  <tr>
                    <th>Concentración {activeTemplate && '🔒'}</th>
                    <th>Absorbancia</th>
                    {!activeTemplate && <th width="40"></th>}
                  </tr>
                </thead>
                <tbody>
                  {standards.map((s, i) => (
                    <tr key={s.id}>
                      <td>
                        <input type="number" step="any" value={s.concentration} onChange={e => {
                          const newS = [...standards];
                          newS[i].concentration = e.target.value;
                          setStandards(newS);
                        }} placeholder="Ej. 15" disabled={!!activeTemplate} />
                      </td>
                      <td>
                        <input type="number" step="any" value={s.value} onChange={e => {
                          const newS = [...standards];
                          newS[i].value = e.target.value;
                          setStandards(newS);
                        }} placeholder="Ej. 0.25" />
                      </td>
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
                <button className="btn btn-outline" style={{marginTop:'10px', width:'100%'}} onClick={() => setStandards([...standards, { id: uuidv4(), concentration: '', value: '' }])}>
                  <Plus size={16}/> Agregar Fila
                </button>
              )}
            </div>
          )}

          {/* Samples Card */}
          <div className="spectro-card">
            <div className="card-header-flex">
              <h3>🧬 Muestras</h3>
              <button className="btn btn-small" onClick={handlePasteSamples}><ClipboardPaste size={14}/> Pegar de Excel</button>
            </div>

            <table className="spectro-table samples-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Absorbancia</th>
                  <th>Dil. (Opc.)</th>
                  <th>T (Opc.)</th>
                  <th width="40"></th>
                </tr>
              </thead>
              <tbody>
                {samples.map((s, i) => (
                  <tr key={s.id}>
                    <td>
                      <input type="text" value={s.name} onChange={e => {
                        const newS = [...samples]; newS[i].name = e.target.value; setSamples(newS);
                      }} placeholder="Muestra" />
                    </td>
                    <td>
                      <input type="number" step="any" value={s.value} onChange={e => {
                        const newS = [...samples]; newS[i].value = e.target.value; setSamples(newS);
                      }} placeholder="Abs" />
                    </td>
                    <td>
                      <input type="number" step="any" value={s.dilution} onChange={e => {
                        const newS = [...samples]; newS[i].dilution = e.target.value; setSamples(newS);
                      }} placeholder={`(${globalDilution})`} />
                    </td>
                    <td>
                      <input type="number" step="any" value={s.time} onChange={e => {
                        const newS = [...samples]; newS[i].time = e.target.value; setSamples(newS);
                      }} placeholder={`(${globalTime})`} />
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
            <h3>📊 Visualización y Resultados</h3>
            
            <div className="chart-container">
              <ResponsiveContainer width="100%" height={250}>
                <ComposedChart data={chartData} margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
                  <CartesianGrid stroke="#f5f5f5" strokeDasharray="3 3" />
                  <XAxis dataKey="concentration" type="number" name="Concentración" />
                  <YAxis yAxisId="left" type="number" name="Absorbancia" />
                  <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                  {/* Trend line */}
                  <Line yAxisId="left" type="monotone" dataKey="trendAbs" stroke="#3b82f6" strokeWidth={2} dot={false} activeDot={false} />
                  {/* Scatter points */}
                  <Scatter yAxisId="left" name="Estándar" dataKey="absorbance" fill="#8b5cf6" />
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
                <div className="stat-badge" style={{color:'#6b7280', background:'#f3f4f6'}}>Esperando datos de calibración...</div>
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
                        <td title={s.name}>{s.name.substring(0, 15) || '—'}</td>
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
