import React, { useState, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Download, Plus, Trash2, ClipboardPaste, FileText, CheckCircle, Calculator, FlaskConical } from 'lucide-react';
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

function computeAverage(vals) {
  const valid = vals.map(v => parseFloat(v)).filter(v => !isNaN(v));
  if (valid.length === 0) return null;
  const sum = valid.reduce((acc, curr) => acc + curr, 0);
  return sum / valid.length;
}

export default function Spectrophotometry({ state, updateState, user, userRole }) {
  const [activeTab, setActiveTab] = useState('calibration'); // 'calibration' | 'samples'

  // Protocol Master Selection
  const [activeProtocolId, setActiveProtocolId] = useState('');
  
  // Cloud lists
  const protocols = state?.spectroTemplates || [];
  const calibrations = state?.spectroCalibrations || [];

  const activeProtocol = useMemo(() => protocols.find(p => p.id === activeProtocolId), [protocols, activeProtocolId]);
  
  // Data States
  const [numReplicates, setNumReplicates] = useState(1);
  const [standards, setStandards] = useState([{ id: uuidv4(), concentration: '', values: ['', '', ''] }]);
  const [samples, setSamples] = useState([{ id: uuidv4(), name: 'Muestra 1', value: '', dilution: '', time: '' }]);
  
  // Settings & Muestras
  const [globalDilution, setGlobalDilution] = useState(1);
  const [globalTime, setGlobalTime] = useState(1);
  
  const [factorSource, setFactorSource] = useState('curve'); // 'curve' | 'manual'
  const [manualFactorInput, setManualFactorInput] = useState('');
  
  const [activeCalibrationId, setActiveCalibrationId] = useState('');
  const activeCalibration = useMemo(() => calibrations.find(c => c.id === activeCalibrationId), [calibrations, activeCalibrationId]);

  // Handle Protocol Change
  const handleProtocolChange = (e) => {
    const pid = e.target.value;
    setActiveProtocolId(pid);
    setActiveCalibrationId('');
    
    if (!pid) {
      setStandards([{ id: uuidv4(), concentration: '', values: ['', '', ''] }]);
      return;
    }
    const proto = protocols.find(p => p.id === pid);
    if (proto) {
      setStandards(proto.concentrations.map(c => ({ id: uuidv4(), concentration: c, values: ['', '', ''] })));
    }
  };

  // Derived Standards
  const standardsWithAverage = useMemo(() => {
    return standards.map(s => {
      const activeValues = s.values.slice(0, numReplicates);
      return { ...s, activeValues, average: computeAverage(activeValues) };
    });
  }, [standards, numReplicates]);

  const cleanStandardsAverages = useMemo(() => {
    return standardsWithAverage
      .map(s => ({ x: parseFloat(s.concentration), y: s.average }))
      .filter(s => !isNaN(s.x) && s.y !== null);
  }, [standardsWithAverage]);

  // Math Computing
  const computedCurveParams = useMemo(() => {
    if (activeCalibration) return activeCalibration.curveParams;
    return linearRegression(cleanStandardsAverages);
  }, [cleanStandardsAverages, activeCalibration]);

  // The true global factor for samples: Average of individual replicates' factors
  const computedCurveFactor = useMemo(() => {
    if (activeCalibration) return activeCalibration.factor;
    
    const factors = [];
    for (let r = 0; r < numReplicates; r++) {
      const repPts = standards
        .map(s => ({ x: parseFloat(s.concentration), y: parseFloat(s.values[r]) }))
        .filter(p => !isNaN(p.x) && !isNaN(p.y));
      if (repPts.length > 0) {
        factors.push(calculateFactor(repPts));
      }
    }
    
    if (factors.length === 0) return 0;
    const sum = factors.reduce((a, b) => a + b, 0);
    return sum / factors.length;
  }, [standards, numReplicates, activeCalibration]);

  // Final Factor to use for Samples
  const finalFactor = useMemo(() => {
    if (factorSource === 'manual') {
      const val = parseFloat(manualFactorInput);
      return isNaN(val) ? 0 : val;
    }
    return computedCurveFactor;
  }, [factorSource, manualFactorInput, computedCurveFactor]);

  // Process Samples
  const processedSamples = useMemo(() => {
    return processSpectroSamples(samples, finalFactor, globalDilution, globalTime);
  }, [samples, finalFactor, globalDilution, globalTime]);

  const chartData = useMemo(() => {
    const pts = activeCalibration ? activeCalibration.standards : cleanStandardsAverages;
    if (!pts || pts.length === 0) return [];
    
    let data = pts.map(s => ({
      concentration: s.x,
      absorbance: s.y,
      isStandard: true
    }));

    if (computedCurveParams && computedCurveParams.m !== 0) {
      const minX = 0;
      const maxX = Math.max(...pts.map(s => s.x)) * 1.1 || 100;
      data.push({ concentration: minX, trendAbs: computedCurveParams.m * minX + computedCurveParams.b });
      data.push({ concentration: maxX, trendAbs: computedCurveParams.m * maxX + computedCurveParams.b });
    }

    data.sort((a, b) => a.concentration - b.concentration);
    return data;
  }, [cleanStandardsAverages, computedCurveParams, activeCalibration]);

  // Export
  const handleExport = () => {
    const exportStandards = activeCalibration ? activeCalibration.standards : standardsWithAverage;
    const blob = generateSpectroXLSX(
      processedSamples, 
      exportStandards, 
      activeCalibration ? activeCalibration.numReplicates : numReplicates,
      computedCurveParams, 
      finalFactor, 
      globalDilution, 
      globalTime
    );
    downloadFile(blob, 'Resultados_Espectrofotometria.xlsx');
  };

  // Clipboard
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

      if (activeProtocol) {
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

  // Protocol & Calibration Cloud actions
  const handleSaveProtocol = () => {
    if (userRole !== 'admin') return alert('Solo administradores pueden crear protocolos.');
    if (!cleanStandardsAverages.length) return alert('No hay concentraciones para guardar.');
    const name = prompt('Nombre del nuevo protocolo (Ej: Proteínas Lowry):');
    if (!name) return;
    const newProtocol = {
      id: uuidv4(),
      name,
      concentrations: cleanStandardsAverages.map(s => s.x)
    };
    updateState({ spectroTemplates: [...protocols, newProtocol] });
    setActiveProtocolId(newProtocol.id);
  };
  
  const handleDeleteProtocol = () => {
    if (userRole !== 'admin') return;
    if(confirm('¿Eliminar este protocolo para todo el laboratorio?')) {
      updateState({ spectroTemplates: protocols.filter(t => t.id !== activeProtocolId) });
      setActiveProtocolId('');
    }
  };

  const handleSaveCalibration = () => {
    if (!activeProtocolId) return alert('Debes seleccionar un Protocolo Activo antes de guardar una curva.');
    if (cleanStandardsAverages.length === 0) return alert('No hay datos para guardar.');
    
    const newCal = {
      id: uuidv4(),
      protocolId: activeProtocolId,
      name: `Calibración - ${new Date().toLocaleDateString()}`,
      authorName: user?.displayName || user?.email || 'Desconocido',
      authorUid: user?.uid,
      date: new Date().toISOString(),
      factor: computedCurveFactor,
      curveParams: computedCurveParams,
      numReplicates,
      standards: standardsWithAverage // Exportable format
    };
    updateState({ spectroCalibrations: [...calibrations, newCal] });
    alert('Curva guardada y compartida en este protocolo.');
  };

  const filteredCalibrations = calibrations.filter(c => c.protocolId === activeProtocolId);

  return (
    <div className="spectro-container">
      <div className="spectro-header">
        <h2>🔬 Espectrofotometría Multiparamétrica</h2>
        <p>Selecciona un protocolo oficial del laboratorio para estandarizar tus curvas o cargar las de tus colegas.</p>
      </div>
      
      {/* PROTOCOL BAR */}
      <div className="protocol-bar">
        <div className="protocol-selector-group">
          <FileText size={20} style={{color: '#6366f1'}}/>
          <select className="protocol-select" value={activeProtocolId} onChange={handleProtocolChange}>
            <option value="">-- Modo Libre (Sin Protocolo) --</option>
            {protocols.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        
        {userRole === 'admin' && (
          <div className="admin-actions">
            <button className="btn btn-outline" onClick={handleSaveProtocol} disabled={!!activeCalibration}>Guardar como Protocolo</button>
            {activeProtocolId && <button className="btn btn-danger" onClick={handleDeleteProtocol}>Borrar Protocolo</button>}
          </div>
        )}
      </div>

      {activeProtocolId && (
        <div className="calibrations-bar">
          <div className="cloud-title">Curvas Guardadas (Protocolo: {activeProtocol?.name})</div>
          <div className="calibrations-controls">
            <select value={activeCalibrationId} onChange={e => setActiveCalibrationId(e.target.value)}>
              <option value="">Crear Nueva Curva (Libre)</option>
              {filteredCalibrations.map(c => (
                <option key={c.id} value={c.id}>{c.authorName} - {new Date(c.date).toLocaleDateString()}</option>
              ))}
            </select>
            {!activeCalibrationId && (
              <button className="btn btn-primary" onClick={handleSaveCalibration}>Compartir mi Curva Actual</button>
            )}
            {activeCalibrationId && (
              <button className="btn btn-danger" onClick={() => {
                updateState({ spectroCalibrations: calibrations.filter(c => c.id !== activeCalibrationId) });
                setActiveCalibrationId('');
              }}>Borrar Curva</button>
            )}
          </div>
        </div>
      )}
      
      {!activeProtocolId && (
        <div className="locked-alert" style={{borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)'}}>
          <strong>Modo Libre Activo</strong>: Estás trabajando sin protocolo. No podrás guardar tu curva en la nube hasta que selecciones o crees un protocolo oficial.
        </div>
      )}

      {activeCalibration && (
        <div className="locked-alert">
          <strong>🔒 Modo Lectura</strong>: Curva de <strong>{activeCalibration.authorName}</strong> cargada. Sus factores están bloqueados para garantizar reproducibilidad.
        </div>
      )}

      {/* TABS */}
      <div className="spectro-tabs">
        <button className={`spectro-tab-btn ${activeTab === 'calibration' ? 'active' : ''}`} onClick={() => setActiveTab('calibration')}>
          <FlaskConical size={18}/> 1. Calibración (Curva Estándar)
        </button>
        <button className={`spectro-tab-btn ${activeTab === 'samples' ? 'active' : ''}`} onClick={() => setActiveTab('samples')}>
          <Calculator size={18}/> 2. Análisis de Muestras
        </button>
      </div>

      {activeTab === 'calibration' && (
        <div className="spectro-grid">
          {/* Left Column: Calibration Table */}
          <div className="spectro-left">
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
              </div>
            </div>

            {!activeCalibration && (
              <div className="spectro-card" style={{overflowX: 'auto'}}>
                <div className="card-header-flex">
                  <h3>🧪 Puntos de Calibración {activeProtocol && `🔒`}</h3>
                  <button className="btn btn-small" onClick={handlePasteStandards}><ClipboardPaste size={14}/> Pegar de Excel</button>
                </div>
                
                <table className="spectro-table">
                  <thead>
                    <tr>
                      <th>[ ] {activeProtocol && '🔒'}</th>
                      <th>Abs 1</th>
                      {numReplicates >= 2 && <th>Abs 2</th>}
                      {numReplicates >= 3 && <th>Abs 3</th>}
                      {numReplicates > 1 && <th style={{color:'#8b5cf6'}}>Promedio</th>}
                      {!activeProtocol && <th width="30"></th>}
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
                          }} placeholder="[ ]" disabled={!!activeProtocol} style={{width:'70px'}} />
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
                        {!activeProtocol && (
                          <td>
                            <button className="btn-icon" onClick={() => setStandards(standards.filter(st => st.id !== s.id))}><Trash2 size={16}/></button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!activeProtocol && (
                  <button className="btn btn-outline" style={{marginTop:'10px', width:'100%'}} onClick={() => setStandards([...standards, { id: uuidv4(), concentration: '', values: ['', '', ''] }])}>
                    <Plus size={16}/> Agregar Fila
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Right Column: Visualization & Results */}
          <div className="spectro-right">
            <div className="spectro-card sticky-card">
              <h3>📊 Resultados Matemáticos</h3>
              
              <div className="dual-math-stats">
                <div className="math-box">
                  <div className="math-box-title">Regresión Lineal</div>
                  {computedCurveParams ? (
                    <>
                      <div className="stat-text">y = {computedCurveParams.m.toFixed(4)}x + {computedCurveParams.b.toFixed(4)}</div>
                      <div className="stat-text">R² = {computedCurveParams.r2.toFixed(4)}</div>
                    </>
                  ) : <div className="stat-text text-muted">-</div>}
                </div>

                <div className="math-box math-box-active">
                  <div className="math-box-title">
                    Factor Promedio
                    <CheckCircle size={14} color="#10b981"/>
                  </div>
                  {computedCurveFactor ? (
                    <div className="stat-text">Factor = {computedCurveFactor.toFixed(4)}</div>
                  ) : <div className="stat-text text-muted">-</div>}
                </div>
              </div>

              <div className="chart-container">
                <ResponsiveContainer width="100%" height={220}>
                  <ComposedChart data={chartData} margin={{ top: 10, right: 20, bottom: 0, left: -20 }}>
                    <CartesianGrid stroke="#f5f5f5" strokeDasharray="3 3" />
                    <XAxis dataKey="concentration" type="number" />
                    <YAxis yAxisId="left" type="number" />
                    <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                    <Line yAxisId="left" type="monotone" dataKey="trendAbs" stroke="#3b82f6" strokeWidth={2} dot={false} activeDot={false} />
                    <Scatter yAxisId="left" name="Estándar" dataKey="absorbance" fill="#8b5cf6" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'samples' && (
        <div className="spectro-grid">
          {/* Left Column: Samples Config & Table */}
          <div className="spectro-left">
            <div className="spectro-card">
              <h3>⚙️ Configuración de Muestras</h3>
              <div className="settings-row" style={{marginBottom: '16px'}}>
                <div className="field">
                  <label>Origen del Factor Matemático</label>
                  <select value={factorSource} onChange={e => setFactorSource(e.target.value)}>
                    <option value="curve">Factor Promedio de la Curva ({computedCurveFactor.toFixed(4)})</option>
                    <option value="manual">Ingresar Factor Manual</option>
                  </select>
                </div>
                {factorSource === 'manual' && (
                  <div className="field" style={{width:'150px'}}>
                    <label>Factor Manual</label>
                    <input type="number" step="any" value={manualFactorInput} onChange={e => setManualFactorInput(e.target.value)} placeholder="Ej: 45.20" />
                  </div>
                )}
              </div>
              <div className="settings-row">
                <div className="field" style={{width:'100px'}}>
                  <label>Dil. Global</label>
                  <input type="number" step="any" value={globalDilution} onChange={e => setGlobalDilution(e.target.value)} />
                </div>
                <div className="field" style={{width:'100px'}}>
                  <label>T (min)</label>
                  <input type="number" step="any" value={globalTime} onChange={e => setGlobalTime(e.target.value)} />
                </div>
              </div>
            </div>

            <div className="spectro-card" style={{overflowX: 'auto'}}>
              <div className="card-header-flex" style={{marginBottom: '8px'}}>
                <h3>🧬 Muestras</h3>
                <button className="btn btn-small" onClick={handlePasteSamples}><ClipboardPaste size={14}/> Pegar de Excel</button>
              </div>
              
              <div className="sample-math-toggle" style={{justifyContent: 'center', backgroundColor: 'rgba(16, 185, 129, 0.1)', borderColor: '#10b981', color: '#047857'}}>
                <strong>Factor Activo: {finalFactor ? finalFactor.toFixed(5) : '0.00000'}</strong>
              </div>

              <table className="spectro-table samples-table" style={{marginTop:'16px'}}>
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

          {/* Right Column: Samples Results & Export */}
          <div className="spectro-right">
            <div className="spectro-card sticky-card">
              <h3>📝 Resultados de Muestras</h3>
              
              <div className="results-preview">
                <div className="results-table-container" style={{maxHeight: '400px'}}>
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
                          <td title={s.name}>{s.name.substring(0, 10) || '—'}</td>
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
                <Download size={18}/> Exportar Reporte GLP Completo
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
