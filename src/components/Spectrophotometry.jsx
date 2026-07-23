import React, { useState, useMemo, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Download, Plus, Trash2, ClipboardPaste, Save, FileText, CheckCircle, Calculator, FlaskConical, Beaker, Calendar, BookOpen } from 'lucide-react';
import {
  ComposedChart, Line, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { linearRegression, calculateFactor, computeAverageAbs, processSpectroSamples, generateSpectroXLSX } from './AssayAnalysisEngine';
import './Spectrophotometry.css';

function downloadFile(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

const DEFAULT_CURVES = () => [
  { id: 'c1', name: 'Curva 1', points: [{ id: uuidv4(), concentration: '', abs1: '', abs2: '', abs3: '' }] },
  { id: 'c2', name: 'Curva 2', points: [{ id: uuidv4(), concentration: '', abs1: '', abs2: '', abs3: '' }] },
  { id: 'c3', name: 'Curva 3', points: [{ id: uuidv4(), concentration: '', abs1: '', abs2: '', abs3: '' }] }
];

export default function Spectrophotometry({ state, updateState, user }) {
  const [activeTab, setActiveTab] = useState('calibration'); // 'calibration' | 'samples'
  
  // Cloud data: Protocols are now "Working Sessions" containing the 3 curves and samples.
  const savedProtocols = state?.spectroProtocols || [];
  
  const [activeProtocolId, setActiveProtocolId] = useState('');
  
  // Current Working Session State
  const [protocolName, setProtocolName] = useState('Nuevo Protocolo');
  const [protocolNotes, setProtocolNotes] = useState('');
  
  const [curves, setCurves] = useState(DEFAULT_CURVES());
  const [activeCurveIdx, setActiveCurveIdx] = useState(0);

  const [samples, setSamples] = useState([{ id: uuidv4(), name: 'Muestra 1', value: '', dilution: '', time: '' }]);
  const [globalDilution, setGlobalDilution] = useState(1);
  const [globalTime, setGlobalTime] = useState(1);
  
  const [factorSource, setFactorSource] = useState('protocol'); // 'protocol' | 'manual'
  const [manualFactorInput, setManualFactorInput] = useState('');

  // Handle Loading a Protocol
  const handleLoadProtocol = (e) => {
    const pid = e.target.value;
    setActiveProtocolId(pid);
    
    if (!pid) {
      setProtocolName('Nuevo Protocolo');
      setProtocolNotes('');
      setCurves(DEFAULT_CURVES());
      setSamples([{ id: uuidv4(), name: 'Muestra 1', value: '', dilution: '', time: '' }]);
      return;
    }
    
    const proto = savedProtocols.find(p => p.id === pid);
    if (proto) {
      setProtocolName(proto.nombre || 'Protocolo Cargado');
      setProtocolNotes(proto.notas || '');
      setCurves(proto.curvas || DEFAULT_CURVES());
      setSamples(proto.muestras && proto.muestras.length > 0 ? proto.muestras : [{ id: uuidv4(), name: 'Muestra 1', value: '', dilution: '', time: '' }]);
      setGlobalDilution(proto.globalDilution || 1);
      setGlobalTime(proto.globalTime || 1);
    }
  };

  // Live Math Calculations
  const processedCurves = useMemo(() => {
    return curves.map(curve => {
      // 1. Calculate Average Absorbance per point
      const pointsWithAvg = curve.points.map(p => {
        const absPromedio = computeAverageAbs(p.abs1, p.abs2, p.abs3);
        return { ...p, absPromedio };
      });
      
      // 2. Extract valid points for regression and factor
      const validMathPts = pointsWithAvg
        .map(p => ({ x: parseFloat(p.concentration), y: p.absPromedio }))
        .filter(p => !isNaN(p.x) && p.y !== null);

      // 3. Calculate Results
      let results = { m: null, b: null, r2: null, factor: null };
      if (validMathPts.length > 0) {
        const lr = linearRegression(validMathPts);
        results = {
          m: lr.m,
          b: lr.b,
          r2: lr.r2,
          factor: calculateFactor(validMathPts)
        };
      }
      
      return { ...curve, points: pointsWithAvg, validMathPts, results };
    });
  }, [curves]);

  const activeCurve = processedCurves[activeCurveIdx];

  const protocolFactor = useMemo(() => {
    const validFactors = processedCurves.map(c => c.results.factor).filter(f => f !== null && f !== 0);
    if (validFactors.length === 0) return 0;
    const sum = validFactors.reduce((a, b) => a + b, 0);
    return sum / validFactors.length;
  }, [processedCurves]);

  const finalFactor = useMemo(() => {
    if (factorSource === 'manual') {
      const val = parseFloat(manualFactorInput);
      return isNaN(val) ? 0 : val;
    }
    return protocolFactor;
  }, [factorSource, manualFactorInput, protocolFactor]);

  const processedSamples = useMemo(() => {
    return processSpectroSamples(samples, finalFactor, globalDilution, globalTime);
  }, [samples, finalFactor, globalDilution, globalTime]);

  // Chart Data for Active Curve
  const chartData = useMemo(() => {
    const pts = activeCurve.validMathPts;
    if (!pts || pts.length === 0) return [];
    
    let data = pts.map(s => ({
      concentration: s.x,
      absorbance: s.y,
      isStandard: true
    }));

    if (activeCurve.results && activeCurve.results.m !== null && activeCurve.results.m !== 0) {
      const minX = 0;
      const maxX = Math.max(...pts.map(s => s.x)) * 1.1 || 100;
      data.push({ concentration: minX, trendAbs: activeCurve.results.m * minX + activeCurve.results.b });
      data.push({ concentration: maxX, trendAbs: activeCurve.results.m * maxX + activeCurve.results.b });
    }

    data.sort((a, b) => a.concentration - b.concentration);
    return data;
  }, [activeCurve]);

  // Operations
  const handleSaveToCloud = () => {
    if (!protocolName.trim()) return alert("Debes ingresar un nombre para el protocolo.");
    
    const newProtocol = {
      id: activeProtocolId || uuidv4(),
      nombre: protocolName,
      fecha: new Date().toISOString(),
      autor: user?.displayName || user?.email || 'Usuario',
      autorUid: user?.uid,
      notas: protocolNotes,
      curvas: curves,
      muestras: samples,
      factorCorreccionPromedio: protocolFactor,
      globalDilution,
      globalTime
    };

    let updatedProtocols = [...savedProtocols];
    if (activeProtocolId) {
      updatedProtocols = updatedProtocols.map(p => p.id === activeProtocolId ? newProtocol : p);
    } else {
      updatedProtocols.push(newProtocol);
      setActiveProtocolId(newProtocol.id);
    }
    
    updateState({ spectroProtocols: updatedProtocols });
    alert("Protocolo guardado exitosamente.");
  };

  const handleExport = () => {
    const blob = generateSpectroXLSX(
      protocolName,
      processedCurves,
      processedSamples,
      finalFactor,
      globalDilution,
      globalTime
    );
    downloadFile(blob, `Reporte_${protocolName.replace(/\s+/g, '_')}.xlsx`);
  };

  const handlePasteCurve = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const rows = text.trim().split('\n').map(r => r.split('\t'));
      
      const newPoints = rows.map(r => {
        return {
          id: uuidv4(),
          concentration: r[0] ? r[0].replace(',','.') : '',
          abs1: r[1] ? r[1].replace(',','.') : '',
          abs2: r[2] ? r[2].replace(',','.') : '',
          abs3: r[3] ? r[3].replace(',','.') : ''
        };
      });

      const newCurves = [...curves];
      newCurves[activeCurveIdx] = { ...newCurves[activeCurveIdx], points: newPoints };
      setCurves(newCurves);
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

  const isReadOnly = activeProtocolId && savedProtocols.find(p => p.id === activeProtocolId)?.autorUid !== user?.uid;

  return (
    <div className="spectro-container">
      <div className="spectro-header">
        <h2>🔬 Espectrofotometría Multiparamétrica</h2>
        <p>Modelo Oficial: Crea protocolos con 3 curvas por triplicado para estandarizar tus factores de cálculo.</p>
      </div>

      {/* PROTOCOL BAR (Session Management) */}
      <div className="protocol-bar" style={{ flexWrap: 'wrap', gap: '16px' }}>
        <div className="protocol-selector-group" style={{ flex: '1', minWidth: '300px' }}>
          <BookOpen size={20} style={{color: '#6366f1'}}/>
          <select className="protocol-select" value={activeProtocolId} onChange={handleLoadProtocol}>
            <option value="">-- Iniciar Nuevo Protocolo --</option>
            {savedProtocols.map(p => (
              <option key={p.id} value={p.id}>{p.nombre} ({new Date(p.fecha).toLocaleDateString()}) - {p.autor}</option>
            ))}
          </select>
        </div>
        
        <div className="protocol-meta" style={{ display: 'flex', gap: '16px', flex: '2', minWidth: '400px' }}>
          <input 
            type="text" 
            placeholder="Nombre del Protocolo (Ej: Lowry Lote 4)" 
            value={protocolName} 
            onChange={e => setProtocolName(e.target.value)} 
            className="input-field"
            style={{ flex: '1' }}
            disabled={isReadOnly}
          />
          <input 
            type="text" 
            placeholder="Notas u Observaciones..." 
            value={protocolNotes} 
            onChange={e => setProtocolNotes(e.target.value)} 
            className="input-field"
            style={{ flex: '1' }}
            disabled={isReadOnly}
          />
        </div>

        <div className="admin-actions">
          {!isReadOnly && (
            <button className="btn btn-primary" onClick={handleSaveToCloud}>
              <Save size={16}/> Guardar Protocolo
            </button>
          )}
        </div>
      </div>

      {isReadOnly && (
        <div className="locked-alert">
          <strong>🔒 Modo Lectura</strong>: Este protocolo fue creado por otro usuario. No puedes sobreescribirlo, pero puedes usar su factor para calcular tus muestras.
        </div>
      )}

      {/* TABS */}
      <div className="spectro-tabs">
        <button className={`spectro-tab-btn ${activeTab === 'calibration' ? 'active' : ''}`} onClick={() => setActiveTab('calibration')}>
          <FlaskConical size={18}/> 1. Calibración (3 Curvas)
        </button>
        <button className={`spectro-tab-btn ${activeTab === 'samples' ? 'active' : ''}`} onClick={() => setActiveTab('samples')}>
          <Calculator size={18}/> 2. Análisis de Muestras
        </button>
      </div>

      {activeTab === 'calibration' && (
        <>
          <div className="curves-tabs" style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            {processedCurves.map((curve, idx) => (
              <button 
                key={curve.id} 
                className={`btn ${activeCurveIdx === idx ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setActiveCurveIdx(idx)}
              >
                {curve.name} {curve.results.factor ? '✅' : ''}
              </button>
            ))}
          </div>

          <div className="spectro-grid">
            {/* Left Column: Calibration Table for Active Curve */}
            <div className="spectro-left">
              <div className="spectro-card" style={{overflowX: 'auto'}}>
                <div className="card-header-flex">
                  <h3>🧪 Puntos de {activeCurve.name}</h3>
                  {!isReadOnly && (
                    <button className="btn btn-small" onClick={handlePasteCurve}><ClipboardPaste size={14}/> Pegar de Excel</button>
                  )}
                </div>
                
                <table className="spectro-table">
                  <thead>
                    <tr>
                      <th>Concentración</th>
                      <th>Abs 1</th>
                      <th>Abs 2</th>
                      <th>Abs 3</th>
                      <th style={{color:'#8b5cf6'}}>Promedio</th>
                      {!isReadOnly && <th width="30"></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {activeCurve.points.map((p, i) => (
                      <tr key={p.id}>
                        <td>
                          <input type="number" step="any" value={p.concentration} onChange={e => {
                            const newCurves = [...curves];
                            newCurves[activeCurveIdx].points[i].concentration = e.target.value;
                            setCurves(newCurves);
                          }} placeholder="[ ]" disabled={isReadOnly} />
                        </td>
                        <td>
                          <input type="number" step="any" value={p.abs1} onChange={e => {
                            const newCurves = [...curves];
                            newCurves[activeCurveIdx].points[i].abs1 = e.target.value;
                            setCurves(newCurves);
                          }} placeholder="Abs 1" disabled={isReadOnly} />
                        </td>
                        <td>
                          <input type="number" step="any" value={p.abs2} onChange={e => {
                            const newCurves = [...curves];
                            newCurves[activeCurveIdx].points[i].abs2 = e.target.value;
                            setCurves(newCurves);
                          }} placeholder="Abs 2" disabled={isReadOnly} />
                        </td>
                        <td>
                          <input type="number" step="any" value={p.abs3} onChange={e => {
                            const newCurves = [...curves];
                            newCurves[activeCurveIdx].points[i].abs3 = e.target.value;
                            setCurves(newCurves);
                          }} placeholder="Abs 3" disabled={isReadOnly} />
                        </td>
                        <td>
                          <strong style={{fontSize:'0.9rem', color:'#8b5cf6'}}>{p.absPromedio !== null ? p.absPromedio.toFixed(4) : '-'}</strong>
                        </td>
                        {!isReadOnly && (
                          <td>
                            <button className="btn-icon" onClick={() => {
                              const newCurves = [...curves];
                              newCurves[activeCurveIdx].points = newCurves[activeCurveIdx].points.filter(pt => pt.id !== p.id);
                              setCurves(newCurves);
                            }}><Trash2 size={16}/></button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!isReadOnly && (
                  <button className="btn btn-outline" style={{marginTop:'10px', width:'100%'}} onClick={() => {
                    const newCurves = [...curves];
                    newCurves[activeCurveIdx].points.push({ id: uuidv4(), concentration: '', abs1: '', abs2: '', abs3: '' });
                    setCurves(newCurves);
                  }}>
                    <Plus size={16}/> Agregar Fila
                  </button>
                )}
              </div>
            </div>

            {/* Right Column: Visualization & Results for Active Curve */}
            <div className="spectro-right">
              <div className="spectro-card sticky-card">
                <h3>📊 Resultados de {activeCurve.name}</h3>
                
                <div className="dual-math-stats" style={{ gridTemplateColumns: '1fr 1fr' }}>
                  <div className="math-box">
                    <div className="math-box-title">Regresión Lineal</div>
                    {activeCurve.results.m !== null ? (
                      <>
                        <div className="stat-text">y = {activeCurve.results.m.toFixed(4)}x + {activeCurve.results.b.toFixed(4)}</div>
                        <div className="stat-text">R² = {activeCurve.results.r2.toFixed(4)}</div>
                      </>
                    ) : <div className="stat-text text-muted">-</div>}
                  </div>

                  <div className="math-box math-box-active">
                    <div className="math-box-title">Factor de Curva</div>
                    {activeCurve.results.factor ? (
                      <div className="stat-text">Factor = {activeCurve.results.factor.toFixed(4)}</div>
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
                
                <div style={{ marginTop: '16px', padding: '16px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid #10b981', borderRadius: '8px', textAlign: 'center' }}>
                  <h4 style={{ margin: '0 0 8px 0', color: '#047857' }}>FACTOR FINAL (PROMEDIO DEL PROTOCOLO)</h4>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#10b981' }}>
                    {protocolFactor ? protocolFactor.toFixed(5) : '0.00000'}
                  </div>
                  <small style={{ color: '#065f46' }}>Promedio de las {processedCurves.filter(c => c.results.factor).length} curvas válidas.</small>
                </div>

              </div>
            </div>
          </div>
        </>
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
                    <option value="protocol">Factor Promedio del Protocolo ({protocolFactor.toFixed(4)})</option>
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
                  <input type="number" step="any" value={globalDilution} onChange={e => setGlobalDilution(e.target.value)} disabled={isReadOnly} />
                </div>
                <div className="field" style={{width:'100px'}}>
                  <label>T (min)</label>
                  <input type="number" step="any" value={globalTime} onChange={e => setGlobalTime(e.target.value)} disabled={isReadOnly} />
                </div>
              </div>
            </div>

            <div className="spectro-card" style={{overflowX: 'auto'}}>
              <div className="card-header-flex" style={{marginBottom: '8px'}}>
                <h3>🧬 Muestras</h3>
                {!isReadOnly && <button className="btn btn-small" onClick={handlePasteSamples}><ClipboardPaste size={14}/> Pegar de Excel</button>}
              </div>
              
              <div className="sample-math-toggle" style={{justifyContent: 'center', backgroundColor: 'rgba(16, 185, 129, 0.1)', borderColor: '#10b981', color: '#047857'}}>
                <strong>Factor Aplicado: {finalFactor ? finalFactor.toFixed(5) : '0.00000'}</strong>
              </div>

              <table className="spectro-table samples-table" style={{marginTop:'16px'}}>
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Absorbancia</th>
                    <th>Dil. (Opc)</th>
                    <th>T (Opc)</th>
                    {!isReadOnly && <th width="30"></th>}
                  </tr>
                </thead>
                <tbody>
                  {samples.map((s, i) => (
                    <tr key={s.id}>
                      <td>
                        <input type="text" value={s.name} onChange={e => {
                          const newS = [...samples]; newS[i].name = e.target.value; setSamples(newS);
                        }} placeholder="Muestra" style={{width:'100px'}} disabled={isReadOnly} />
                      </td>
                      <td>
                        <input type="number" step="any" value={s.value} onChange={e => {
                          const newS = [...samples]; newS[i].value = e.target.value; setSamples(newS);
                        }} placeholder="Abs" disabled={isReadOnly} />
                      </td>
                      <td>
                        <input type="number" step="any" value={s.dilution} onChange={e => {
                          const newS = [...samples]; newS[i].dilution = e.target.value; setSamples(newS);
                        }} placeholder={`(${globalDilution})`} style={{width:'60px'}} disabled={isReadOnly} />
                      </td>
                      <td>
                        <input type="number" step="any" value={s.time} onChange={e => {
                          const newS = [...samples]; newS[i].time = e.target.value; setSamples(newS);
                        }} placeholder={`(${globalTime})`} style={{width:'60px'}} disabled={isReadOnly} />
                      </td>
                      {!isReadOnly && (
                        <td>
                          <button className="btn-icon" onClick={() => setSamples(samples.filter(st => st.id !== s.id))}><Trash2 size={16}/></button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              {!isReadOnly && (
                <button className="btn btn-outline" style={{marginTop:'10px', width:'100%'}} onClick={() => setSamples([...samples, { id: uuidv4(), name: `Muestra ${samples.length+1}`, value: '', dilution: '', time: '' }])}>
                  <Plus size={16}/> Agregar Fila
                </button>
              )}
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
