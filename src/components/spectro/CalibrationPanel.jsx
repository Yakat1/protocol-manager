import { v4 as uuidv4 } from 'uuid';
import { ClipboardPaste, Plus, Trash2 } from 'lucide-react';
import {
  ComposedChart, Line, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

export default function CalibrationPanel({
  processedCurves,
  activeCurveIdx,
  onCurveSelect,
  curves,
  onCurvesChange,
  isConcentrationLocked,
  isReadOnly,
  isFromTemplate,
  onPasteCurve,
  chartData,
  protocolFactor,
}) {
  const activeCurve = processedCurves[activeCurveIdx];

  return (
    <>
      <div className="curves-tabs">
        {processedCurves.map((curve, idx) => (
          <button
            key={curve.id}
            className={`btn ${activeCurveIdx === idx ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => onCurveSelect(idx)}
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
              <h3>🧪 Puntos de {activeCurve.name} {isConcentrationLocked && '🔒'}</h3>
              {!isReadOnly && !isFromTemplate && (
                <button className="btn btn-small" onClick={onPasteCurve}><ClipboardPaste size={14}/> Pegar de Excel</button>
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
                  {!isConcentrationLocked && <th width="30"></th>}
                </tr>
              </thead>
              <tbody>
                {activeCurve.points.map((p, i) => (
                  <tr key={p.id}>
                    <td>
                      <input type="number" step="any" value={p.concentration} onChange={e => {
                        const newCurves = [...curves];
                        newCurves[activeCurveIdx].points[i].concentration = e.target.value;
                        onCurvesChange(newCurves);
                      }} placeholder="[ ]" disabled={isConcentrationLocked} style={isConcentrationLocked ? {backgroundColor: 'var(--bg-primary)'} : {}} />
                    </td>
                    <td>
                      <input type="number" step="any" value={p.abs1} onChange={e => {
                        const newCurves = [...curves];
                        newCurves[activeCurveIdx].points[i].abs1 = e.target.value;
                        onCurvesChange(newCurves);
                      }} placeholder="Abs 1" disabled={isReadOnly} />
                    </td>
                    <td>
                      <input type="number" step="any" value={p.abs2} onChange={e => {
                        const newCurves = [...curves];
                        newCurves[activeCurveIdx].points[i].abs2 = e.target.value;
                        onCurvesChange(newCurves);
                      }} placeholder="Abs 2" disabled={isReadOnly} />
                    </td>
                    <td>
                      <input type="number" step="any" value={p.abs3} onChange={e => {
                        const newCurves = [...curves];
                        newCurves[activeCurveIdx].points[i].abs3 = e.target.value;
                        onCurvesChange(newCurves);
                      }} placeholder="Abs 3" disabled={isReadOnly} />
                    </td>
                    <td>
                      <strong style={{fontSize:'0.9rem', color:'#8b5cf6'}}>{p.absPromedio !== null ? p.absPromedio.toFixed(4) : '-'}</strong>
                    </td>
                    {!isConcentrationLocked && (
                      <td>
                        <button className="btn-icon" onClick={() => {
                          const newCurves = [...curves];
                          newCurves[activeCurveIdx].points = newCurves[activeCurveIdx].points.filter(pt => pt.id !== p.id);
                          onCurvesChange(newCurves);
                        }}><Trash2 size={16}/></button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {!isConcentrationLocked && (
              <button className="btn btn-outline" style={{marginTop:'10px', width:'100%'}} onClick={() => {
                const newCurves = [...curves];
                newCurves[activeCurveIdx].points.push({ id: uuidv4(), concentration: '', abs1: '', abs2: '', abs3: '' });
                onCurvesChange(newCurves);
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

            <div className="dual-math-stats">
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
  );
}