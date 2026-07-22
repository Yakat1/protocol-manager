import React, { useState, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Download, Plus, Trash2, ClipboardPaste, Calculator, TrendingUp } from 'lucide-react';
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

export default function Spectrophotometry() {
  const [standards, setStandards] = useState([{ id: uuidv4(), concentration: '', value: '' }]);
  const [samples, setSamples] = useState([{ id: uuidv4(), name: 'Muestra 1', value: '', dilution: '', time: '' }]);
  const [method, setMethod] = useState('linear');
  const [globalDilution, setGlobalDilution] = useState(1);
  const [globalTime, setGlobalTime] = useState(1);
  const [manualFactor, setManualFactor] = useState('');

  // Clean standards for math
  const cleanStandards = standards
    .map(s => ({ x: parseFloat(s.concentration), y: parseFloat(s.value) }))
    .filter(s => !isNaN(s.x) && !isNaN(s.y));

  // Compute curve params
  const curveParams = useMemo(() => {
    if (method === 'linear') return linearRegression(cleanStandards);
    return null;
  }, [cleanStandards, method]);

  const factor = useMemo(() => {
    if (method === 'factor') {
      if (manualFactor && parseFloat(manualFactor) > 0) return parseFloat(manualFactor);
      return calculateFactor(cleanStandards);
    }
    return null;
  }, [cleanStandards, method, manualFactor]);

  // Process samples
  const processedSamples = useMemo(() => {
    return processSpectroSamples(samples, method, curveParams, factor, globalDilution, globalTime);
  }, [samples, method, curveParams, factor, globalDilution, globalTime]);

  // Chart data
  const chartData = useMemo(() => {
    if (cleanStandards.length === 0) return [];
    
    // For standard points
    let data = cleanStandards.map(s => ({
      concentration: s.x,
      absorbance: s.y,
      isStandard: true
    }));

    // Generate trendline points
    if (method === 'linear' && curveParams) {
      const minX = 0;
      const maxX = Math.max(...cleanStandards.map(s => s.x)) * 1.1 || 100;
      data.push({ concentration: minX, trendAbs: curveParams.m * minX + curveParams.b });
      data.push({ concentration: maxX, trendAbs: curveParams.m * maxX + curveParams.b });
    } else if (method === 'factor' && factor) {
      const maxX = Math.max(...cleanStandards.map(s => s.x)) * 1.1 || 100;
      data.push({ concentration: 0, trendAbs: 0 });
      data.push({ concentration: maxX, trendAbs: maxX / factor });
    }

    data.sort((a, b) => a.concentration - b.concentration);
    return data;
  }, [cleanStandards, method, curveParams, factor]);

  const handleExport = () => {
    const blob = generateSpectroXLSX(processedSamples, standards, method, curveParams, factor, globalDilution, globalTime);
    downloadFile(blob, 'Resultados_Espectrofotometria.xlsx');
  };

  const handlePasteStandards = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const rows = text.trim().split('\n').map(r => r.split('\t'));
      const newStds = rows.map(r => ({
        id: uuidv4(),
        concentration: r[0] ? r[0].replace(',','.') : '',
        value: r[1] ? r[1].replace(',','.') : ''
      }));
      setStandards(newStds);
    } catch(e) {
      alert("Error al pegar. Asegúrate de tener dos columnas (Concentración y Absorbancia) separadas por tabulador copiadas desde Excel.");
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
      alert("Error al pegar. Asegúrate de tener dos columnas (Nombre y Absorbancia) separadas por tabulador copiadas desde Excel.");
    }
  };

  return (
    <div className="spectro-container">
      <div className="spectro-header">
        <h2>🔬 Análisis Espectrofotométrico</h2>
        <p>Ingresa tus datos de calibración y muestras para calcular la concentración y actividad interpolada.</p>
      </div>

      <div className="spectro-grid">
        
        {/* Left Column: Data Input */}
        <div className="spectro-left">
          
          {/* Settings Card */}
          <div className="spectro-card">
            <h3>⚙️ Configuración del Ensayo</h3>
            <div className="settings-row">
              <div className="field">
                <label>Método de Cálculo</label>
                <select value={method} onChange={e => setMethod(e.target.value)}>
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
            {method === 'factor' && (
              <div className="field" style={{marginTop:'12px'}}>
                <label>Factor Manual (opcional, ignora curva)</label>
                <input type="number" step="any" placeholder="Ej. 1.45" value={manualFactor} onChange={e => setManualFactor(e.target.value)} />
              </div>
            )}
          </div>

          {/* Standards Card */}
          <div className="spectro-card">
            <div className="card-header-flex">
              <h3>🧪 Curva Estándar</h3>
              <button className="btn btn-small" onClick={handlePasteStandards}><ClipboardPaste size={14}/> Pegar de Excel</button>
            </div>
            
            <table className="spectro-table">
              <thead>
                <tr>
                  <th>Concentración (μM)</th>
                  <th>Absorbancia</th>
                  <th width="40"></th>
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
                      }} placeholder="Ej. 15" />
                    </td>
                    <td>
                      <input type="number" step="any" value={s.value} onChange={e => {
                        const newS = [...standards];
                        newS[i].value = e.target.value;
                        setStandards(newS);
                      }} placeholder="Ej. 0.25" />
                    </td>
                    <td>
                      <button className="btn-icon" onClick={() => setStandards(standards.filter(st => st.id !== s.id))}><Trash2 size={16}/></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button className="btn btn-outline" style={{marginTop:'10px', width:'100%'}} onClick={() => setStandards([...standards, { id: uuidv4(), concentration: '', value: '' }])}>
              <Plus size={16}/> Agregar Fila
            </button>
          </div>

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
                  <th>Dil. (Opcional)</th>
                  <th>Tiempo (Opcional)</th>
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
                  <XAxis dataKey="concentration" type="number" name="Concentración" unit="μM" />
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
              {method === 'linear' && curveParams ? (
                <>
                  <div className="stat-badge">R²: {curveParams.r2.toFixed(4)}</div>
                  <div className="stat-badge">y = {curveParams.m.toFixed(4)}x + {curveParams.b.toFixed(4)}</div>
                </>
              ) : method === 'factor' && factor ? (
                <div className="stat-badge">Factor: {factor.toFixed(4)}</div>
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
                      <th>[ ] (μM)</th>
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
