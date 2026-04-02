import React, { useState } from 'react';
import { Plus, X, Download, ClipboardPaste } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import './PlateMapper.css';

const ROWS = ['A','B','C','D','E','F','G','H'];
const COLS = Array.from({length: 12}, (_, i) => i + 1);

const DEFAULT_GROUPS = [
  { id: 'g1', name: 'Control Negativo', color: '#6b7280' },
  { id: 'g2', name: 'H₂O₂ 50µM', color: '#3b82f6' },
  { id: 'g3', name: 'H₂O₂ 150µM', color: '#8b5cf6' },
  { id: 'g4', name: 'H₂O₂ 300µM', color: '#ec4899' },
  { id: 'g5', name: 'Fenton Baja', color: '#f59e0b' },
  { id: 'g6', name: 'Fenton Media', color: '#f97316' },
  { id: 'g7', name: 'Fenton Alta', color: '#ef4444' },
  { id: 'g8', name: 'NAC + H₂O₂', color: '#10b981' },
];

export default function PlateMapper({ state, setState }) {
  const [groups, setGroups] = useState(DEFAULT_GROUPS);
  const [activeGroupId, setActiveGroupId] = useState(groups[0].id);
  const [wells, setWells] = useState({}); // { "A1": { groupId, value } }
  const [pasteData, setPasteData] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [selectedExports, setSelectedExports] = useState({});

  const handleExportGroup = (statItem) => {
    if (!state || !setState) return alert("Editor inactivo. Guarda el protocolo primero.");
    const targetSubjId = selectedExports[statItem.group.id] || 'NEW';

    const hasAbs = state.variables.find(v => v.id === 'var_plate_signal');
    let finalVars = state.variables;
    if (!hasAbs) {
        finalVars = [...state.variables, { id: 'var_plate_signal', name: 'Señal Microplaca', unit: 'OD/RFU', type: 'number' }];
    }

    if (targetSubjId === 'NEW') {
        const newSubj = {
          id: uuidv4(),
          name: `${statItem.group.name} (Media Placa)`,
          group: 'Microplaca',
          measurements: { var_plate_signal: statItem.mean.toFixed(4) },
          images: []
        };
        setState({...state, variables: finalVars, subjects: [...state.subjects, newSubj]});
        alert(`Muestra genérica "${newSubj.name}" creada exitosamente.`);
    } else {
        const tgt = state.subjects.find(s => s.id === targetSubjId);
        setState({
          ...state, 
          variables: finalVars, 
          subjects: state.subjects.map(s => s.id === targetSubjId ? { ...s, measurements: { ...s.measurements, var_plate_signal: statItem.mean.toFixed(4) } } : s)
        });
        alert(`Señal estadística asignada exitosamente a la muestra: ${tgt?.name}`);
    }
  };

  const wellKey = (row, col) => `${row}${col}`;

  const handleWellClick = (row, col) => {
    const key = wellKey(row, col);
    const current = wells[key];
    if (current && current.groupId === activeGroupId) {
      const next = { ...wells };
      delete next[key];
      setWells(next);
    } else {
      setWells({ ...wells, [key]: { groupId: activeGroupId, value: current?.value ?? null } });
    }
  };

  const getGroupForWell = (row, col) => {
    const w = wells[wellKey(row, col)];
    if (!w) return null;
    return groups.find(g => g.id === w.groupId);
  };

  const addGroup = () => {
    const num = groups.length + 1;
    const hue = (num * 47) % 360;
    setGroups([...groups, { id: uuidv4(), name: `Grupo ${num}`, color: `hsl(${hue}, 70%, 55%)` }]);
  };

  const removeGroup = (id) => {
    setGroups(groups.filter(g => g.id !== id));
    const next = { ...wells };
    Object.keys(next).forEach(k => { if (next[k].groupId === id) delete next[k]; });
    setWells(next);
    if (activeGroupId === id && groups.length > 1) setActiveGroupId(groups[0].id);
  };

  const renameGroup = (id, newName) => {
    setGroups(groups.map(g => g.id === id ? { ...g, name: newName } : g));
  };

  const handleImportPaste = () => {
    if (!pasteData.trim()) return;
    const rows_data = pasteData.trim().split('\n');
    const newWells = { ...wells };
    rows_data.forEach((line, ri) => {
      if (ri >= ROWS.length) return;
      const vals = line.split(/[\t,;]+/);
      vals.forEach((val, ci) => {
        if (ci >= COLS.length) return;
        const key = wellKey(ROWS[ri], COLS[ci]);
        if (newWells[key]) {
          newWells[key] = { ...newWells[key], value: parseFloat(val) || val.trim() };
        } else {
          newWells[key] = { groupId: null, value: parseFloat(val) || val.trim() };
        }
      });
    });
    setWells(newWells);
    setShowImport(false);
    setPasteData('');
  };

  const getGroupStats = () => {
    const stats = {};
    groups.forEach(g => { stats[g.id] = { group: g, values: [] }; });
    Object.entries(wells).forEach(([, w]) => {
      if (w.groupId && w.value !== null && w.value !== undefined && stats[w.groupId]) {
        stats[w.groupId].values.push(typeof w.value === 'number' ? w.value : parseFloat(w.value));
      }
    });
    return Object.values(stats).filter(s => s.values.length > 0).map(s => {
      const nums = s.values.filter(v => !isNaN(v));
      const mean = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : NaN;
      const sd = nums.length > 1 ? Math.sqrt(nums.map(v => (v - mean) ** 2).reduce((a, b) => a + b, 0) / (nums.length - 1)) : 0;
      return { ...s, mean, sd, n: nums.length };
    });
  };

  const exportPlateCSV = () => {
    const lines = ['Pocillo,Grupo,Valor'];
    ROWS.forEach(r => {
      COLS.forEach(c => {
        const key = wellKey(r, c);
        const w = wells[key];
        if (w) {
          const gName = groups.find(g => g.id === w.groupId)?.name || 'Sin Grupo';
          lines.push(`${key},"${gName}",${w.value ?? ''}`);
        }
      });
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'plate_results.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const stats = getGroupStats();

  return (
    <div className="plate-mapper-container">
      {/* Group Chips */}
      <div className="plate-mapper-toolbar">
        <span style={{fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600}}>Grupo Activo:</span>
        <div className="group-selector">
          {groups.map(g => (
            <div key={g.id} style={{display: 'flex', alignItems: 'center', gap: '2px'}}>
              <div 
                className={`group-chip ${activeGroupId === g.id ? 'active' : ''}`}
                style={{ background: g.color }}
                onClick={() => setActiveGroupId(g.id)}
              >
                {g.name}
              </div>
              <button className="btn-icon" style={{padding: '2px'}} onClick={() => removeGroup(g.id)} title="Eliminar grupo">
                <X size={12}/>
              </button>
            </div>
          ))}
          <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
            <button className="btn-icon" onClick={addGroup} title="Añadir grupo libre"><Plus size={16}/></button>
            {state?.subjects && (
              <select 
                className="input-field" 
                style={{padding: '2px', fontSize: '0.8rem', width: 'auto'}}
                onChange={(e) => {
                  if(e.target.value) {
                    const s = state.subjects.find(subj => subj.id === e.target.value);
                    if (s) {
                      const num = groups.length + 1;
                      const hue = (num * 47) % 360;
                      const newId = uuidv4();
                      setGroups([...groups, { id: newId, name: s.name, color: `hsl(${hue}, 70%, 55%)` }]);
                      setSelectedExports({...selectedExports, [newId]: s.id});
                    }
                    e.target.value = "";
                  }
                }}
              >
                <option value="">+ Desde Sujeto LIMS</option>
                {state.subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            )}
          </div>
        </div>
      </div>

      {/* Legend with editable names */}
      <div className="plate-legend">
        {groups.map(g => (
          <div key={g.id} className="legend-item">
            <div className="legend-swatch" style={{background: g.color}}></div>
            <input 
              className="group-name-input"
              value={g.name}
              onChange={(e) => renameGroup(g.id, e.target.value)}
            />
          </div>
        ))}
      </div>

      {/* 96-well Grid */}
      <div className="plate-grid-wrapper">
        <div className="plate-grid">
          <div></div>
          {COLS.map(c => <div key={c} className="plate-col-header">{c}</div>)}

          {ROWS.map(r => (
            <React.Fragment key={r}>
              <div className="plate-row-header">{r}</div>
              {COLS.map(c => {
                const group = getGroupForWell(r, c);
                const w = wells[wellKey(r, c)];
                return (
                  <div 
                    key={c}
                    className={`plate-well ${w?.value != null ? 'has-value' : ''}`}
                    style={group ? { background: group.color, borderColor: group.color } : {}}
                    onClick={() => handleWellClick(r, c)}
                    title={`${r}${c}${group ? ` — ${group.name}` : ''}${w?.value != null ? ` = ${w.value}` : ''}`}
                  >
                    {w?.value != null ? (typeof w.value === 'number' ? w.value.toFixed(1) : '') : ''}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Toolbar */}
      <div style={{display: 'flex', gap: '8px', marginBottom: '20px'}}>
        <button className="btn" onClick={() => setShowImport(!showImport)}>
          <ClipboardPaste size={16}/> Importar Lecturas
        </button>
        <button className="btn" onClick={exportPlateCSV}>
          <Download size={16}/> Exportar Placa CSV
        </button>
        <button className="btn btn-danger" onClick={() => setWells({})}>
          <X size={16}/> Limpiar Placa
        </button>
      </div>

      {/* Paste Import */}
      {showImport && (
        <div className="glass-panel plate-data-import" style={{padding: '16px', marginBottom: '20px'}}>
          <h4 style={{marginBottom: '8px'}}>Pegar Matriz de Resultados</h4>
          <p style={{fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '12px'}}>
            Copia las lecturas del lector de microplaca (8 filas × 12 columnas, separadas por tabulador o coma) y pégalas aquí. Se asignarán a las posiciones A1→H12.
          </p>
          <textarea 
            className="input-field"
            value={pasteData}
            onChange={e => setPasteData(e.target.value)}
            placeholder={"0.45\t0.52\t0.48\t...\n0.31\t0.29\t0.33\t..."}
          />
          <button className="btn btn-primary" style={{marginTop: '8px'}} onClick={handleImportPaste}>
            Aplicar Lecturas
          </button>
        </div>
      )}

      {/* Summary Statistics */}
      {stats.length > 0 && (
        <div className="glass-panel" style={{padding: '16px'}}>
          <h4 style={{marginBottom: '12px'}}>Resumen Estadístico por Grupo</h4>
          <table className="plate-results-table">
            <thead>
              <tr>
                <th></th>
                <th>Grupo</th>
                <th>n</th>
                <th>Media</th>
                <th>DE</th>
              </tr>
            </thead>
            <tbody>
              {stats.map(s => (
                <tr key={s.group.id}>
                  <td><div className="legend-swatch" style={{background: s.group.color}}></div></td>
                  <td>{s.group.name}</td>
                  <td>{s.n}</td>
                  <td>{isNaN(s.mean) ? '—' : s.mean.toFixed(4)}</td>
                  <td>{s.sd.toFixed(4)}</td>
                  {state && (
                    <td style={{display: 'flex', gap: '8px'}}>
                      <select 
                        className="input-field" 
                        style={{padding: '2px', fontSize: '0.8rem', width: '150px'}}
                        value={selectedExports[s.group.id] || 'NEW'}
                        onChange={(e) => setSelectedExports({...selectedExports, [s.group.id]: e.target.value})}
                      >
                        <option value="NEW">Crear Nueva Muestra (Media)</option>
                        {state.subjects.map(subj => <option key={subj.id} value={subj.id}>Vincular: {subj.name}</option>)}
                      </select>
                      <button className="btn" style={{padding: '2px 8px', fontSize: '0.8rem'}} onClick={() => handleExportGroup(s)} disabled={isNaN(s.mean)}>Exportar</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
