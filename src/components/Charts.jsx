import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ErrorBar, Legend, Cell, ComposedChart, LineChart, Line } from 'recharts';
import { Plus, X, BarChart3, Download } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import './Charts.css';

const COLORS = ['#6b7280','#3b82f6','#8b5cf6','#ec4899','#f59e0b','#f97316','#ef4444','#10b981','#06b6d4','#84cc16'];

const DEFAULT_GROUPS = [
  { id: uuidv4(), name: 'Control', color: COLORS[0] },
  { id: uuidv4(), name: 'H₂O₂ 50µM', color: COLORS[1] },
  { id: uuidv4(), name: 'H₂O₂ 150µM', color: COLORS[2] },
  { id: uuidv4(), name: 'H₂O₂ 300µM', color: COLORS[3] },
];

function quantile(arr, q) {
  const sorted = [...arr].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  } else {
    return sorted[base];
  }
}

function calcStats(values) {
  const nums = values.filter(v => v !== '' && !isNaN(parseFloat(v))).map(Number);
  if (nums.length === 0) return { mean: 0, sd: 0, n: 0, box: [0,0,0,0,0] };
  const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
  const sd = nums.length > 1
    ? Math.sqrt(nums.map(v => (v - mean) ** 2).reduce((a, b) => a + b, 0) / (nums.length - 1))
    : 0;

  let box = [nums[0], nums[0], nums[0], nums[0], nums[0]];
  if (nums.length > 0) {
    const min = Math.min(...nums);
    const max = Math.max(...nums);
    const q1 = quantile(nums, 0.25);
    const median = quantile(nums, 0.5);
    const q3 = quantile(nums, 0.75);
    box = [min, q1, median, q3, max];
  }

  return { mean, sd, n: nums.length, box };
}

const BoxPlotShape = (props) => {
  const { x, y, width, height, payload, fill } = props;
  const fullBox = payload.fullBox;
  if (!fullBox || fullBox.length !== 5) return null;
  const [min, q1, med, q3, max] = fullBox;
  
  const scaleY = (val) => {
    if (max === min) return y;
    return y + height - ((val - min) / (max - min)) * height;
  };
  
  const yQ1 = scaleY(q1);
  const yMed = scaleY(med);
  const yQ3 = scaleY(q3);
  const yMin = scaleY(min);
  const yMax = scaleY(max);
  
  const cx = x + width / 2;
  const whiskerWidth = width * 0.5;

  return (
    <g>
      <line x1={cx} y1={yMax} x2={cx} y2={yQ3} stroke="#e6edf3" strokeWidth={2} />
      <line x1={cx} y1={yMin} x2={cx} y2={yQ1} stroke="#e6edf3" strokeWidth={2} />
      <line x1={cx - whiskerWidth/2} y1={yMax} x2={cx + whiskerWidth/2} y2={yMax} stroke="#e6edf3" strokeWidth={2} />
      <line x1={cx - whiskerWidth/2} y1={yMin} x2={cx + whiskerWidth/2} y2={yMin} stroke="#e6edf3" strokeWidth={2} />
      <rect x={x} y={yQ3} width={width} height={Math.abs(yQ1 - yQ3)} fill={fill} stroke="#e6edf3" strokeWidth={1} rx={2} />
      <line x1={x} y1={yMed} x2={x + width} y2={yMed} stroke="#161b22" strokeWidth={2} />
    </g>
  );
};

export default function Charts({ subjects, variables, cultures: culturesProp, cultureLogs: cultureLogsProp }) {
  const [groups, setGroups] = useState(DEFAULT_GROUPS);
  const [values, setValues] = useState({}); // { groupId: ['val1','val2',...] }
  const [chartTitle, setChartTitle] = useState('Viabilidad Celular (% vs Control)');
  const [yLabel, setYLabel] = useState('% Viabilidad');
  const [chartType, setChartType] = useState('bar'); // 'bar' | 'box'
  const [activeView, setActiveView] = useState('analysis'); // 'analysis' | 'growth'
  const [selectedCultures, setSelectedCultures] = useState([]);

  const cultures = culturesProp || [];
  const cultureLogs = cultureLogsProp || [];

  const addGroup = () => {
    const idx = groups.length % COLORS.length;
    setGroups([...groups, { id: uuidv4(), name: `Grupo ${groups.length + 1}`, color: COLORS[idx] }]);
  };

  const removeGroup = (id) => {
    setGroups(groups.filter(g => g.id !== id));
    const next = { ...values };
    delete next[id];
    setValues(next);
  };

  const renameGroup = (id, name) => {
    setGroups(groups.map(g => g.id === id ? { ...g, name } : g));
  };

  const updateValue = (groupId, index, val) => {
    const arr = [...(values[groupId] || ['', '', ''])];
    arr[index] = val;
    setValues({ ...values, [groupId]: arr });
  };

  const addReplicate = (groupId) => {
    const arr = [...(values[groupId] || ['', '', ''])];
    arr.push('');
    setValues({ ...values, [groupId]: arr });
  };

  const importFromSubjects = (varId, varName, unit) => {
    if (!subjects) return;
    
    // Agrupar sujetos por "Grupo Experimental"
    const groupsMap = {}; 
    subjects.forEach(sub => {
      const gName = sub.group || 'Sin Grupo';
      const val = sub.measurements?.[varId];
      if (val !== undefined && val !== '') {
        if (!groupsMap[gName]) groupsMap[gName] = [];
        groupsMap[gName].push(val);
      }
    });

    const newGroups = [];
    const newValues = {};
    let colorIdx = 0;

    for (const [gName, vals] of Object.entries(groupsMap)) {
      const gId = uuidv4();
      newGroups.push({ id: gId, name: gName, color: COLORS[colorIdx % COLORS.length] });
      newValues[gId] = vals;
      colorIdx++;
    }

    if (newGroups.length > 0) {
      setGroups(newGroups);
      setValues(newValues);
      setChartTitle(`Análisis de ${varName}`);
      setYLabel(unit || '');
    } else {
      alert(`No hay datos numéricos ingresados para "${varName}" en tus sujetos.`);
    }
  };

  const chartData = groups.map(g => {
    const stats = calcStats(values[g.id] || []);
    return { 
      name: g.name, 
      mean: parseFloat(stats.mean.toFixed(3)), 
      sd: parseFloat(stats.sd.toFixed(3)), 
      n: stats.n, 
      color: g.color,
      boxData: [stats.box[0], stats.box[4]], // range [min, max]
      fullBox: stats.box // [min, q1, med, q3, max]
    };
  }).filter(d => d.n > 0);

  // ── Growth Curve Logic ───────────────────────────────────────────────────────
  const toggleCultureSelection = (id) => {
    setSelectedCultures(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
  };

  const growthData = (() => {
    if (selectedCultures.length === 0) return [];
    const allDates = new Set();
    const byDate = {};
    selectedCultures.forEach(cId => {
      const logs = cultureLogs.filter(l => l.cultureId === cId).sort((a,b) => new Date(a.date) - new Date(b.date));
      logs.forEach(l => {
        allDates.add(l.date);
        if (!byDate[l.date]) byDate[l.date] = {};
        byDate[l.date][cId] = parseInt(l.confluence) || 0;
      });
    });
    return [...allDates].sort().map(date => ({ date, ...byDate[date] }));
  })();

  const exportGrowthCSV = () => {
    if (growthData.length === 0) return alert('No hay datos para exportar.');
    const cultureNames = selectedCultures.map(id => {
      const c = cultures.find(cc => cc.id === id);
      return c ? c.cellLine : id;
    });
    let csv = 'Fecha,' + cultureNames.join(',') + '\n';
    growthData.forEach(row => {
      csv += row.date + ',' + selectedCultures.map(id => row[id] ?? '').join(',') + '\n';
    });
    const blob = new Blob([csv], {type: 'text/csv'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'curvas_crecimiento.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="charts-container">
      {/* Tab Toggle */}
      <div style={{display: 'flex', gap: '8px', marginBottom: '16px'}}>
        <button className={`btn ${activeView === 'analysis' ? 'btn-primary' : ''}`} onClick={() => setActiveView('analysis')} style={{flex: 1, justifyContent: 'center'}}>
          📊 Análisis de Datos
        </button>
        <button className={`btn ${activeView === 'growth' ? 'btn-primary' : ''}`} onClick={() => setActiveView('growth')} style={{flex: 1, justifyContent: 'center'}}>
          🦠 Curvas de Crecimiento
        </button>
      </div>

      {activeView === 'analysis' ? (
        <>
      {/* Config */}
      <div className="chart-config" style={{alignItems: 'flex-end', gap: '16px'}}>
        <div className="input-group" style={{marginBottom: 0, flex: '1 1 150px'}}>
          <label className="input-label">Título de la Gráfica</label>
          <input className="input-field" value={chartTitle} onChange={e => setChartTitle(e.target.value)} />
        </div>
        <div className="input-group" style={{marginBottom: 0, flex: '0 1 120px'}}>
          <label className="input-label">Eje Y</label>
          <input className="input-field" value={yLabel} onChange={e => setYLabel(e.target.value)} />
        </div>
        <div className="input-group" style={{marginBottom: 0, flex: '0 1 120px'}}>
          <label className="input-label">Tipo</label>
          <select className="input-field" value={chartType} onChange={e => setChartType(e.target.value)} style={{cursor: 'pointer'}}>
            <option value="bar">Barras</option>
            <option value="box">BoxPlot</option>
          </select>
        </div>
        
        {variables && variables.filter(v => v.type === 'number').length > 0 && (
          <div className="input-group" style={{marginBottom: 0, flex: '1 1 200px'}}>
            <label className="input-label" style={{color: 'var(--accent)'}}>⚡ Auto-Importar de Sujetos</label>
            <select 
              className="input-field" 
              onChange={e => {
                const vId = e.target.value;
                if (!vId) return;
                const vDef = variables.find(v => v.id === vId);
                if (vDef) importFromSubjects(vDef.id, vDef.name, vDef.unit);
                e.target.value = '';
              }}
              defaultValue=""
              style={{cursor: 'pointer'}}
            >
              <option value="" disabled>🟢 Selecciona Variable a Graficar...</option>
              {variables.filter(v => v.type === 'number').map(v => (
                <option key={v.id} value={v.id}>{v.name} {v.unit ? `(${v.unit})` : ''}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Data Entry */}
      <div className="data-entry-section">
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px'}}>
          <h4 className="section-title" style={{margin: 0}}>Datos por Grupo (Réplicas)</h4>
          <button className="btn" onClick={addGroup}><Plus size={14}/> Grupo</button>
        </div>
        <div className="data-entry-grid">
          {groups.map(g => {
            const reps = values[g.id] || ['', '', ''];
            return (
              <div key={g.id} className="group-data-card">
                <h5>
                  <div style={{width: 10, height: 10, borderRadius: '50%', background: g.color, flexShrink: 0}}></div>
                  <input className="group-name-input" style={{width: '100%'}} value={g.name} onChange={e => renameGroup(g.id, e.target.value)} />
                  <button className="btn-icon" style={{padding: '2px'}} onClick={() => removeGroup(g.id)}><X size={12}/></button>
                </h5>
                {reps.map((v, i) => (
                  <input
                    key={i}
                    className="input-field"
                    style={{width: '100%', marginBottom: '4px', padding: '6px 8px', fontSize: '0.8rem'}}
                    type="number"
                    placeholder={`n${i + 1}`}
                    value={v}
                    onChange={e => updateValue(g.id, i, e.target.value)}
                  />
                ))}
                <button className="btn" style={{width: '100%', justifyContent: 'center', fontSize: '0.7rem', padding: '4px'}} onClick={() => addReplicate(g.id)}>
                  <Plus size={12}/> Réplica
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Chart */}
      {chartData.length > 0 ? (
        <div className="glass-panel chart-wrapper">
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px'}}>
            <h4>{chartTitle}</h4>
          </div>
          <ResponsiveContainer width="100%" height={400}>
            {chartType === 'bar' ? (
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="name" tick={{ fill: 'var(--text-primary)', fontSize: 13, fontWeight: 500 }} axisLine={{ stroke: 'rgba(255,255,255,0.2)' }} />
                <YAxis label={{ value: yLabel, angle: -90, position: 'insideLeft', fill: 'var(--text-primary)', fontSize: 13, fontWeight: 500 }} tick={{ fill: 'var(--text-primary)', fontSize: 13 }} axisLine={{ stroke: 'rgba(255,255,255,0.2)' }} />
                <Tooltip cursor={{fill: 'rgba(255,255,255,0.05)'}} contentStyle={{ background: '#161b22', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} itemStyle={{ color: '#e6edf3' }} labelStyle={{ color: '#e6edf3', fontWeight: 'bold', marginBottom: '4px' }} formatter={(value, name, props) => { const item = props.payload; return [`${value.toFixed(3)} ± ${item.sd.toFixed(3)} (n=${item.n})`, yLabel]; }} />
                <Bar dataKey="mean" radius={[4, 4, 0, 0]}>
                  <ErrorBar dataKey="sd" width={10} strokeWidth={2} stroke="#e6edf3" />
                  {chartData.map((entry, i) => (<Cell key={`cell-${i}`} fill={entry.color} />))}
                </Bar>
              </BarChart>
            ) : (
              <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="name" tick={{ fill: 'var(--text-primary)', fontSize: 13, fontWeight: 500 }} axisLine={{ stroke: 'rgba(255,255,255,0.2)' }} />
                <YAxis label={{ value: yLabel, angle: -90, position: 'insideLeft', fill: 'var(--text-primary)', fontSize: 13, fontWeight: 500 }} tick={{ fill: 'var(--text-primary)', fontSize: 13 }} axisLine={{ stroke: 'rgba(255,255,255,0.2)' }} />
                <Tooltip cursor={{fill: 'rgba(255,255,255,0.05)'}} contentStyle={{ background: '#161b22', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} itemStyle={{ color: '#e6edf3' }} labelStyle={{ color: '#e6edf3', fontWeight: 'bold', marginBottom: '4px' }} formatter={(value, name, props) => { const box = props.payload.fullBox; return [`Min: ${box[0].toFixed(2)}, Q1: ${box[1].toFixed(2)}, Med: ${box[2].toFixed(2)}, Q3: ${box[3].toFixed(2)}, Max: ${box[4].toFixed(2)} (n=${props.payload.n})`, yLabel]; }} />
                <Bar dataKey="boxData" shape={<BoxPlotShape />}>
                  {chartData.map((entry, i) => (<Cell key={`cell-${i}`} fill={entry.color} />))}
                </Bar>
              </ComposedChart>
            )}
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="glass-panel chart-empty">
          <BarChart3 size={48} style={{opacity: 0.3}} />
          <p>Ingresa valores numéricos en los grupos de arriba para generar la gráfica de barras con Media ± DE.</p>
        </div>
      )}
        </>
      ) : (
        /* ────────── GROWTH CURVES VIEW ────────── */
        <>
          <div className="glass-panel" style={{padding: '16px', marginBottom: '16px'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px'}}>
              <h4 style={{margin: 0}}>🦠 Selecciona Cultivos a Comparar</h4>
              {growthData.length > 0 && (
                <button className="btn" style={{fontSize: '0.8rem'}} onClick={exportGrowthCSV}>
                  <Download size={14} style={{marginRight: '4px'}}/> CSV
                </button>
              )}
            </div>
            {cultures.length === 0 ? (
              <p style={{color: 'var(--text-secondary)', textAlign: 'center', padding: '20px'}}>No hay cultivos registrados. Ve a la Bitácora de Cultivos para crear uno.</p>
            ) : (
              <div style={{display: 'flex', flexWrap: 'wrap', gap: '8px'}}>
                {cultures.map((c, idx) => {
                  const isSelected = selectedCultures.includes(c.id);
                  const color = COLORS[idx % COLORS.length];
                  return (
                    <button
                      key={c.id}
                      className="btn"
                      style={{
                        fontSize: '0.8rem', padding: '6px 12px',
                        background: isSelected ? color : 'transparent',
                        border: `2px solid ${color}`,
                        color: isSelected ? '#fff' : color,
                        fontWeight: isSelected ? 'bold' : 'normal'
                      }}
                      onClick={() => toggleCultureSelection(c.id)}
                    >
                      {c.cellLine}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {growthData.length > 0 ? (
            <div className="glass-panel chart-wrapper">
              <h4 style={{marginBottom: '16px'}}>Confluencia vs Tiempo</h4>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={growthData} margin={{ top: 10, right: 30, left: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                  <XAxis dataKey="date" tick={{ fill: 'var(--text-primary)', fontSize: 11 }} axisLine={{ stroke: 'rgba(255,255,255,0.2)' }} />
                  <YAxis domain={[0, 100]} label={{ value: '% Confluencia', angle: -90, position: 'insideLeft', fill: 'var(--text-primary)', fontSize: 13 }} tick={{ fill: 'var(--text-primary)', fontSize: 12 }} axisLine={{ stroke: 'rgba(255,255,255,0.2)' }} />
                  <Tooltip contentStyle={{ background: '#161b22', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} itemStyle={{ color: '#e6edf3' }} labelStyle={{ color: '#e6edf3', fontWeight: 'bold' }} />
                  <Legend />
                  {selectedCultures.map((cId, idx) => {
                    const culture = cultures.find(c => c.id === cId);
                    return (
                      <Line
                        key={cId}
                        type="monotone"
                        dataKey={cId}
                        name={culture ? culture.cellLine : cId}
                        stroke={COLORS[idx % COLORS.length]}
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        activeDot={{ r: 6 }}
                        connectNulls
                      />
                    );
                  })}
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            selectedCultures.length > 0 && (
              <div className="glass-panel chart-empty">
                <BarChart3 size={48} style={{opacity: 0.3}} />
                <p>Los cultivos seleccionados no tienen datos de confluencia registrados aún.</p>
              </div>
            )
          )}
        </>
      )}
    </div>
  );
}
