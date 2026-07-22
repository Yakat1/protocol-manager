import React, { useState, useMemo } from 'react';
import { Download, AlertTriangle } from 'lucide-react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line, ComposedChart } from 'recharts';
import { ASSAY_KITS, runGenericAnalysis, generateAnalysisXLSX } from './AssayAnalysisEngine';
import { v4 as uuidv4 } from 'uuid';
import { WELL_TYPES, ROWS, COLS, wellKey } from './PlateMapperHelpers';
import './AutoAnalysis.css';

export default function AutoAnalysis({ wells, groups, setWells, setGroups, setActiveGroupId }) {
  const [selectedKitId, setSelectedKitId] = useState('');
  const [method, setMethod] = useState('linear');
  const [standardGroupId, setStandardGroupId] = useState('');
  const [kitInputs, setKitInputs] = useState({});

  const kit = useMemo(() => ASSAY_KITS.find(k => k.id === selectedKitId), [selectedKitId]);
  
  // Run live analysis based on current inputs
  const analysisData = useMemo(() => {
    if (!selectedKitId) return null;
    return runGenericAnalysis(selectedKitId, wells, groups, standardGroupId, method, kitInputs);
  }, [selectedKitId, wells, groups, standardGroupId, method, kitInputs]);

  const handleAutoConfigureStandard = () => {
    const setup = kit?.standardCurveSetup;
    if (!setup) return;

    let newWells = { ...wells };
    let newGroups = [...groups];

    // Standard group
    let stdGroup = newGroups.find(g => g.wellType === 'standard');
    if (!stdGroup) {
      stdGroup = { id: uuidv4(), name: 'Estandar', color: WELL_TYPES.standard.color, wellType: 'standard' };
      newGroups = [...newGroups, stdGroup];
    }
    
    if (setup.standards?.length) {
      setup.standards.forEach(({ conc, unit, wells: stdWells }) => {
        stdWells.forEach((wk, i) => {
          newWells[wk] = { ...newWells[wk], groupId: stdGroup.id, concentration: conc, concUnit: unit, replicateNum: i + 1 };
        });
      });
      setActiveGroupId(stdGroup.id);
    }
    
    // Blank group
    if (setup.blankWells?.length) {
      let blkGroup = newGroups.find(g => g.wellType === 'blank');
      if (!blkGroup) {
        blkGroup = { id: uuidv4(), name: 'Blanco (A)', color: WELL_TYPES.blank.color, wellType: 'blank' };
        newGroups = [...newGroups, blkGroup];
      }
      setup.blankWells.forEach((wk, i) => {
        newWells[wk] = { ...newWells[wk], groupId: blkGroup.id, concentration: 0, concUnit: 'uM', replicateNum: i + 1 };
      });
    }

    setStandardGroupId(stdGroup.id);
    setGroups(newGroups);
    setWells(newWells);
  };

  const downloadReport = () => {
    if (!analysisData || !kit) return;
    try {
      const blob = generateAnalysisXLSX(
        kit.name, 
        analysisData.results, 
        groups, 
        method, 
        analysisData.curveParams, 
        analysisData.factor, 
        kitInputs,
        standardGroupId
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Reporte_${kit.id}_${new Date().getTime()}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(`Error al generar reporte: ${e.message}`);
    }
  };

  // Generate chart data for Recharts
  const chartData = useMemo(() => {
    if (!analysisData || analysisData.pts.length === 0) return [];
    
    // Original points
    const points = analysisData.pts.map(p => ({ x: p.x, y: p.y }));
    
    // Add trendline points
    if (method === 'linear' && analysisData.curveParams) {
      const { m, b } = analysisData.curveParams;
      const minX = Math.min(...points.map(p => p.x));
      const maxX = Math.max(...points.map(p => p.x));
      
      points.push({ x: minX, trend: (m * minX) + b });
      points.push({ x: maxX, trend: (m * maxX) + b });
    } else if (method === 'factor' && analysisData.factor) {
      const f = analysisData.factor; // conc = abs * factor => abs = conc / factor
      const maxX = Math.max(...points.map(p => p.x), 10);
      points.push({ x: 0, trend: 0 });
      points.push({ x: maxX, trend: maxX / f });
    }

    // Sort by x
    return points.sort((a, b) => a.x - b.x);
  }, [analysisData, method]);

  // Generate preview rows
  const previewRows = useMemo(() => {
    if (!analysisData) return [];
    const rows = [];
    ROWS.forEach(r => {
      COLS.forEach(c => {
        const k = wellKey(r, c);
        const w = analysisData.results[k];
        if (w && w.groupId && typeof w.value === 'number') {
          const g = groups.find(gr => gr.id === w.groupId);
          if (g && (g.wellType === 'unknown' || g.wellType === 'positive' || g.wellType === 'negative')) {
             rows.push({
               well: k,
               groupName: g.name,
               abs: w.value,
               conc: w.calculated_concentration,
               activity: w.final_activity
             });
          }
        }
      });
    });
    return rows;
  }, [analysisData, groups]);

  if (!groups || groups.length === 0) return null;

  return (
    <div className="auto-analysis-container no-print">
      <h4 className="aa-title">{'🔬'} Análisis Automático (Espectrofotometría)</h4>
      
      <div className="aa-section">
        <label>Seleccionar Kit o Método:</label>
        <select 
          className="input-field" 
          value={selectedKitId} 
          onChange={e => {
            setSelectedKitId(e.target.value);
            setKitInputs({});
            const selKit = ASSAY_KITS.find(k => k.id === e.target.value);
            if (selKit) setMethod(selKit.defaultMethod || 'linear');
          }}
        >
          <option value="">-- Sin Módulo de Análisis --</option>
          {ASSAY_KITS.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
        </select>
      </div>

      {selectedKitId && kit && (
        <div className="aa-content">
          <div className="aa-steps-grid">
            
            {/* Paso 1: Configurar Curva */}
            <div className="aa-card">
              <div className="aa-card-title">{'📐'} 1. Configurar Curva</div>
              
              <div className="aa-field">
                <label>Grupo de Calibración:</label>
                <select 
                  className="input-field"
                  value={standardGroupId}
                  onChange={e => setStandardGroupId(e.target.value)}
                >
                  <option value="">-- Selecciona el Grupo Estándar --</option>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>

              <div className="aa-field">
                <label>Método Matemático:</label>
                <div style={{display:'flex', gap:'10px', fontSize:'0.8rem', marginTop:'4px'}}>
                  <label style={{display:'flex', alignItems:'center', gap:'4px', cursor:'pointer', margin:0}}>
                    <input type="radio" name="method" checked={method==='linear'} onChange={()=>setMethod('linear')} /> 
                    Regresión Lineal
                  </label>
                  <label style={{display:'flex', alignItems:'center', gap:'4px', cursor:'pointer', margin:0}}>
                    <input type="radio" name="method" checked={method==='factor'} onChange={()=>setMethod('factor')} /> 
                    Factor (Lowry)
                  </label>
                </div>
              </div>

              {kit.standardCurveSetup && (
                <div style={{marginTop:'12px'}}>
                  <div style={{fontSize:'0.75rem', color:'var(--text-secondary)', marginBottom:'8px'}}>
                    Este kit tiene concentraciones y posiciones predefinidas. Puedes asignarlas a la placa automáticamente:
                  </div>
                  <button className="btn btn-secondary" style={{width:'100%', fontSize:'0.75rem'}} onClick={handleAutoConfigureStandard}>
                    {'⚗️'} Configurar Posiciones Automáticas
                  </button>
                </div>
              )}
            </div>

            {/* Paso 2: Vista Previa Curva */}
            <div className="aa-card aa-chart-card">
              <div className="aa-card-title">{'📈'} 2. Vista Previa Curva</div>
              {chartData.length > 0 ? (
                <>
                  <div style={{ width: '100%', height: 160 }}>
                    <ResponsiveContainer>
                      <ComposedChart data={chartData} margin={{top: 5, right: 10, left: -20, bottom: 0}}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)"/>
                        <XAxis dataKey="x" type="number" domain={['dataMin', 'dataMax']} tick={{fontSize:10}} />
                        <YAxis tick={{fontSize:10}} />
                        <Tooltip contentStyle={{fontSize:'0.75rem', background:'var(--surface-color)', border:'1px solid var(--border-color)', color:'var(--text-primary)'}}/>
                        <Scatter name="Estándares" dataKey="y" fill="#8b5cf6" />
                        <Line type="linear" dataKey="trend" stroke="#10b981" strokeWidth={2} dot={false} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="aa-chart-stats">
                    {method === 'linear' && analysisData?.curveParams && (
                      <>
                        <span><strong>Ec:</strong> y = {analysisData.curveParams.m.toFixed(4)}x {analysisData.curveParams.b >= 0 ? '+' : '-'} {Math.abs(analysisData.curveParams.b).toFixed(4)}</span>
                        <span><strong>R²:</strong> {analysisData.curveParams.r2.toFixed(4)}</span>
                      </>
                    )}
                    {method === 'factor' && analysisData?.factor && (
                      <span><strong>Factor Calculado:</strong> {analysisData.factor.toFixed(4)}</span>
                    )}
                  </div>
                </>
              ) : (
                <div className="aa-empty-state">
                  <AlertTriangle size={18} />
                  Faltan lecturas (Abs) o concentraciones (μM) en el grupo seleccionado.
                </div>
              )}
            </div>
            
            {/* Paso 3: Inputs y Resultados */}
            <div className="aa-card aa-results-card">
              <div className="aa-card-title">{'📋'} 3. Resultados y Exportación</div>
              
              <div className="aa-inputs-row">
                {kit.requiredInputs.map(inp => (
                  <div className="aa-field" key={inp.id} style={{flex:1}}>
                    <label>{inp.label}</label>
                    <input 
                      type={inp.type} 
                      className="input-field" 
                      value={kitInputs[inp.id] ?? inp.default}
                      onChange={e => setKitInputs({...kitInputs, [inp.id]: e.target.value})}
                    />
                  </div>
                ))}
                {method === 'factor' && (
                  <div className="aa-field" style={{flex:1}}>
                    <label>Factor Manual</label>
                    <input 
                      type="number" 
                      className="input-field" 
                      placeholder="Ej. 142.5"
                      value={kitInputs.manual_factor || ''}
                      onChange={e => setKitInputs({...kitInputs, manual_factor: e.target.value})}
                    />
                  </div>
                )}
              </div>

              {previewRows.length > 0 ? (
                <div className="aa-table-container">
                  <table className="aa-table">
                    <thead>
                      <tr>
                        <th>Muestra</th>
                        <th>Abs</th>
                        <th>Conc.</th>
                        <th>Final</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.slice(0,4).map(r => (
                        <tr key={r.well}>
                          <td>{r.groupName} ({r.well})</td>
                          <td>{r.abs?.toFixed(3)}</td>
                          <td>{r.conc?.toFixed(2)}</td>
                          <td>{r.activity?.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {previewRows.length > 4 && <div className="aa-table-more">+ {previewRows.length - 4} más...</div>}
                </div>
              ) : (
                <div className="aa-empty-state" style={{marginTop:'10px'}}>
                  No hay muestras con lectura de absorbancia.
                </div>
              )}

              <button className="btn btn-primary" style={{width:'100%', marginTop:'10px'}} onClick={downloadReport} disabled={!analysisData}>
                <Download size={16} /> Exportar Reporte a Excel
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
