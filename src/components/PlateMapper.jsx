import React, { useState, useRef } from 'react';
import { Plus, X, Download, ClipboardPaste, Printer, Save, Upload, Shuffle, AlertTriangle, Copy, Lock, Unlock } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { ROWS, COLS, WELL_TYPES, wellKey, parseWellId, getGroupStats, validateLayout, applySerialDilution, applyReplicates, randomizeInner, exportBioTekCSV, exportSoftMaxPro, exportPlateCSV, importSampleList } from './PlateMapperHelpers';
import { ASSAY_KITS, runAssayAnalysis, generateAnalysisCSV, applyCustomConcentrations } from './AssayAnalysisEngine';
import './PlateMapper.css';

function downloadFile(content, filename, type='text/csv') {
  const blob = new Blob([content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export default function PlateMapper({ state, updateState }) {
  const [groups, setGroups] = useState([]);
  const [activeGroupId, setActiveGroupId] = useState(null);
  const [wells, setWells] = useState({});
  const [pasteData, setPasteData] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [selectedExports, setSelectedExports] = useState({});
  const [isBWPrint, setIsBWPrint] = useState(false);
  const [tooltip, setTooltip] = useState(null);
  const [lastClicked, setLastClicked] = useState(null);
  const [showDilution, setShowDilution] = useState(false);
  const [dilution, setDilution] = useState({ startWell:'A1', startConc:100, unit:'µM', factor:2, steps:8, direction:'horizontal' });
  const [showRep, setShowRep] = useState(false);
  const [repCount, setRepCount] = useState(3);
  const [repDir, setRepDir] = useState('vertical');
  const [showSampleImport, setShowSampleImport] = useState(false);
  const [sampleText, setSampleText] = useState('');
  const [sampleRepCount, setSampleRepCount] = useState(2);
  const [sampleDir, setSampleDir] = useState('horizontal');
  const [warnings, setWarnings] = useState([]);
  const [selectedKitId, setSelectedKitId] = useState('');
  const [kitInputs, setKitInputs] = useState({});

  const plateLayouts = state?.plateLayouts || [];

  const addGroupByType = (type) => {
    const t = WELL_TYPES[type];
    const n = groups.filter(g => g.wellType === type).length + 1;
    const ng = { id: uuidv4(), name: `${t.label} ${n}`, color: t.color, wellType: type };
    setGroups(prev => [...prev, ng]);
    setActiveGroupId(ng.id);
  };

  const addFreeGroup = () => {
    const n = groups.length + 1;
    const hue = (n * 47) % 360;
    const ng = { id: uuidv4(), name: `Grupo ${n}`, color: `hsl(${hue},70%,55%)`, wellType: 'unknown' };
    setGroups(prev => [...prev, ng]);
    setActiveGroupId(ng.id);
  };

  const removeGroup = (id) => {
    setGroups(prev => prev.filter(g => g.id !== id));
    setWells(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(k => { if (next[k].groupId === id) delete next[k]; });
      return next;
    });
    if (activeGroupId === id) setActiveGroupId(groups.length > 1 ? groups.find(g => g.id !== id)?.id : null);
  };

  const renameGroup = (id, name) => setGroups(prev => prev.map(g => g.id === id ? { ...g, name } : g));

  const toggleGroupLock = (id) => {
    setGroups(prev => prev.map(g => g.id === id ? { ...g, locked: !g.locked } : g));
  };

  const handleWellClick = (e, row, col) => {
    const activeGroup = groups.find(g => g.id === activeGroupId);
    if (activeGroup?.locked) return; // Cannot modify locked groups

    const ri = ROWS.indexOf(row), ci = COLS.indexOf(col);
    if (e.shiftKey && lastClicked && activeGroupId) {
      const r1 = Math.min(lastClicked.ri, ri), r2 = Math.max(lastClicked.ri, ri);
      const c1 = Math.min(lastClicked.ci, ci), c2 = Math.max(lastClicked.ci, ci);
      setWells(prev => {
        const nw = { ...prev };
        for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) {
          const k = wellKey(ROWS[r], COLS[c]);
          const existingGroup = prev[k]?.groupId ? groups.find(g => g.id === prev[k].groupId) : null;
          if (existingGroup?.locked) continue; // Skip locked wells
          nw[k] = { ...nw[k], groupId: activeGroupId };
        }
        return nw;
      });
    } else {
      const key = wellKey(row, col);
      setWells(prev => {
        const existingGroup = prev[key]?.groupId ? groups.find(g => g.id === prev[key].groupId) : null;
        if (existingGroup?.locked) return prev; // Cannot override locked well

        if (prev[key]?.groupId === activeGroupId) {
          const nw = { ...prev }; delete nw[key]; return nw;
        }
        return { ...prev, [key]: { ...prev[key], groupId: activeGroupId, value: prev[key]?.value ?? null } };
      });
    }
    setLastClicked({ ri, ci });
  };

  const handleImportPaste = () => {
    if (!pasteData.trim()) return;
    const rows_data = pasteData.trim().split('\n');
    const nw = { ...wells };
    rows_data.forEach((line, ri) => {
      if (ri >= ROWS.length) return;
      line.split(/[\t,;]+/).forEach((val, ci) => {
        if (ci >= COLS.length) return;
        const key = wellKey(ROWS[ri], COLS[ci]);
        nw[key] = { ...nw[key], groupId: nw[key]?.groupId || null, value: parseFloat(val) || val.trim() };
      });
    });
    setWells(nw); setShowImport(false); setPasteData('');
  };

  const handleDilution = () => {
    if (!activeGroupId) return alert('Selecciona un grupo primero.');
    const result = applySerialDilution(wells, activeGroupId, dilution);
    if (!result) return alert('Pocillo de inicio inválido (ej. A1).');
    setWells(result); setShowDilution(false);
  };

  const handleReplicates = () => {
    const result = applyReplicates(wells, groups, repCount, repDir);
    if (!result) return alert('No hay pocillos asignados.');
    setWells(result); setShowRep(false);
  };

  const handleRandomize = () => {
    if (!confirm('¿Redistribuir aleatoriamente todas las muestras en los 60 pocillos internos (B2-G11)?')) return;
    const result = randomizeInner(wells, groups);
    if (!result) return alert('No hay muestras asignadas.');
    setWells(result);
  };

  const handleSampleImport = (populatePlate = true) => {
    const result = importSampleList(sampleText, groups, wells, sampleRepCount, sampleDir, populatePlate);
    if (!result) return alert('Lista vacía.');
    setGroups(result.groups); 
    if (populatePlate) setWells(result.wells);
    setShowSampleImport(false); setSampleText('');
  };

  const handleRunAnalysis = () => {
    try {
      const { results, curveParams } = runAssayAnalysis(selectedKitId, wells, groups, kitInputs);
      const csv = generateAnalysisCSV(selectedKitId, results, groups, curveParams);
      downloadFile(csv, `analisis_${selectedKitId}.csv`);
      alert('Analisis exitoso. El archivo ha sido descargado.');
    } catch (e) {
      alert(`Error en el analisis: ${e.message}`);
    }
  };

  const handleAutoConfigureStandard = () => {
    const kit = ASSAY_KITS.find(k => k.id === selectedKitId);
    const setup = kit?.standardCurveSetup;
    if (!setup) return;

    let newWells = { ...wells };
    let newGroups = [...groups];

    // Create or reuse Blank group and assign blankWells (A1, A2)
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

    // Create or reuse Standard group and assign each standard pair
    if (setup.standards?.length) {
      let stdGroup = newGroups.find(g => g.wellType === 'standard');
      if (!stdGroup) {
        stdGroup = { id: uuidv4(), name: 'Estandar', color: WELL_TYPES.standard.color, wellType: 'standard' };
        newGroups = [...newGroups, stdGroup];
      }
      setup.standards.forEach(({ conc, unit, wells: stdWells }) => {
        stdWells.forEach((wk, i) => {
          newWells[wk] = { ...newWells[wk], groupId: stdGroup.id, concentration: conc, concUnit: unit, replicateNum: i + 1 };
        });
      });
      setActiveGroupId(stdGroup.id);
    }

    setGroups(newGroups);
    setWells(newWells);

    const stdSummary = setup.standards?.map(s => `${s.wells.join('/')} = ${s.conc} ${s.unit}`).join(', ');
    alert(`Curva estandar configurada:\n- Blanco: ${setup.blankWells?.join(', ')} (0 uM)\n- Estandares: ${stdSummary}`);
  };


  const saveLayout = () => {
    if (!updateState) return alert('Editor inactivo.');
    const name = prompt('Nombre para este Layout:');
    if (!name) return;
    const w = validateLayout(groups, wells);
    if (w.length > 0 && !confirm(`Advertencias:\n• ${w.join('\n• ')}\n\n¿Guardar de todas formas?`)) return;
    const cleanWells = {};
    Object.keys(wells).forEach(k => { cleanWells[k] = { ...wells[k], value: null }; });
    updateState({ plateLayouts: [...plateLayouts, { id: uuidv4(), name, groups, wells: cleanWells }] });
    alert('Plantilla guardada.');
  };

  const loadLayout = (e) => {
    const id = e.target.value; if (!id) return;
    const layout = plateLayouts.find(l => l.id === id);
    if (layout && confirm(`¿Cargar "${layout.name}"?`)) {
      setGroups(layout.groups); setWells(layout.wells);
      if (layout.groups.length) setActiveGroupId(layout.groups[0].id);
    }
    e.target.value = '';
  };

  const handleExportGroup = (statItem) => {
    if (!state || !updateState) return alert('Editor inactivo.');
    const targetSubjId = selectedExports[statItem.group.id] || 'NEW';
    const hasAbs = state.variables.find(v => v.id === 'var_plate_signal');
    let finalVars = state.variables;
    if (!hasAbs) finalVars = [...state.variables, { id: 'var_plate_signal', name: 'Señal Microplaca', unit: 'OD/RFU', type: 'number' }];
    if (targetSubjId === 'NEW') {
      const newSubj = { id: uuidv4(), name: `${statItem.group.name} (Media Placa)`, group: 'Microplaca', measurements: { var_plate_signal: statItem.mean.toFixed(4) }, images: [] };
      updateState({ variables: finalVars, subjects: [...state.subjects, newSubj] });
      alert(`Muestra "${newSubj.name}" creada.`);
    } else {
      updateState({ variables: finalVars, subjects: state.subjects.map(s => s.id === targetSubjId ? { ...s, measurements: { ...s.measurements, var_plate_signal: statItem.mean.toFixed(4) } } : s) });
      alert('Señal asignada.');
    }
  };

  const getGroupForWell = (r, c) => { const w = wells[wellKey(r, c)]; return w ? groups.find(g => g.id === w.groupId) : null; };
  const stats = getGroupStats(groups, wells);

  return (
    <div className={`plate-mapper-container ${isBWPrint ? 'print-bw' : ''}`}>
      {/* Well Type Buttons */}
      <div className="well-type-buttons no-print">
        {Object.entries(WELL_TYPES).map(([key, t]) => (
          <button key={key} className="well-type-btn" onClick={() => addGroupByType(key)}>
            <span className="wt-dot" style={{background: t.color}}></span>
            + {t.label}
          </button>
        ))}
        <button className="well-type-btn" onClick={addFreeGroup}><Plus size={14}/> Grupo Libre</button>
        {state?.subjects && (
          <select className="input-field" style={{padding:'4px',fontSize:'0.8rem',width:'auto'}}
            onChange={(e) => {
              if (!e.target.value) return;
              const s = state.subjects.find(subj => subj.id === e.target.value);
              if (s) { const nId = uuidv4(); const n = groups.length+1; setGroups(prev => [...prev, {id:nId,name:s.name,color:`hsl(${(n*47)%360},70%,55%)`,wellType:'unknown'}]); setSelectedExports(prev => ({...prev,[nId]:s.id})); setActiveGroupId(nId); }
              e.target.value = '';
            }}>
            <option value="">+ Desde Sujeto LIMS</option>
            {state.subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
      </div>

      {/* Active Group Toolbar */}
      <div className="plate-mapper-toolbar">
        <span style={{fontSize:'0.85rem',color:'var(--text-secondary)',fontWeight:600}}>Grupo Activo:</span>
        <div className="group-selector">
          {groups.map(g => (
            <div key={g.id} style={{display:'flex',alignItems:'center',gap:'2px'}}>
              <div className={`group-chip ${activeGroupId===g.id?'active':''}`} style={{background:g.color}} onClick={() => setActiveGroupId(g.id)}>
                {g.name}
              </div>
              <button className="btn-icon" style={{padding:'2px'}} onClick={() => removeGroup(g.id)}><X size={12}/></button>
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="plate-legend">
        {groups.map(g => (
          <div key={g.id} className="legend-item">
            <div className="legend-swatch" style={{background:g.color}}></div>
            <input className="group-name-input" value={g.name} onChange={(e) => renameGroup(g.id,e.target.value)}/>
            <button className="btn-icon" onClick={() => toggleGroupLock(g.id)} title={g.locked ? "Desbloquear pocillos" : "Bloquear pocillos"}>
              {g.locked ? <Lock size={14} color="#f87171"/> : <Unlock size={14} color="var(--text-secondary)"/>}
            </button>
            <span className="well-type-badge" style={{color:WELL_TYPES[g.wellType]?.color}}>{WELL_TYPES[g.wellType]?.abbr}</span>
          </div>
        ))}
        {!groups.length && <span style={{color:'var(--text-secondary)',fontSize:'0.8rem'}}>Usa los botones de arriba para crear grupos</span>}
      </div>

      {/* Shift+Click hint */}
      {activeGroupId && <p className="no-print" style={{fontSize:'0.75rem',color:'var(--text-secondary)',margin:'0 0 8px'}}>💡 Shift+Click para seleccionar un rango rectangular de pocillos</p>}

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
                  <div key={c}
                    className={`plate-well ${w?.value != null ? 'has-value' : ''} ${group?.locked ? 'locked' : ''}`}
                    style={group ? {background:group.color, borderColor:group.color} : {}}
                    onClick={(e) => handleWellClick(e, r, c)}
                    onMouseEnter={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setTooltip({key:wellKey(r,c), x:rect.left+rect.width/2, y:rect.top-8, r, c});
                    }}
                    onMouseLeave={() => setTooltip(null)}
                  >
                    <span className="print-only-text">{group ? group.name.substring(0,4).toUpperCase() : ''}</span>
                    <span className="well-value">{w?.value != null ? (typeof w.value === 'number' ? w.value.toFixed(1) : '') : ''}</span>
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Tooltip */}
      {tooltip && (() => {
        const w = wells[tooltip.key]; const g = w ? groups.find(gr => gr.id === w.groupId) : null;
        const ti = g ? WELL_TYPES[g.wellType] : null;
        return (
          <div className="well-tooltip" style={{left:tooltip.x, top:tooltip.y}}>
            <div className="tt-header">{g && <span className="tt-swatch" style={{background:g.color}}></span>}{tooltip.key}</div>
            {g && <div className="tt-row"><span>Grupo</span><span>{g.name}</span></div>}
            {ti && <div className="tt-row"><span>Tipo</span><span>{ti.label}</span></div>}
            {w?.concentration != null && <div className="tt-row"><span>Conc.</span><span>{w.concentration} {w.concUnit||''}</span></div>}
            {w?.replicateNum && <div className="tt-row"><span>Réplica</span><span>#{w.replicateNum}</span></div>}
            {w?.value != null && <div className="tt-row"><span>Valor</span><span>{w.value}</span></div>}
            {!g && <div className="tt-row"><span style={{color:'var(--text-secondary)'}}>Vacío</span><span></span></div>}
          </div>
        );
      })()}

      {/* Action Toolbar */}
      <div className="no-print" style={{display:'flex',gap:'8px',marginBottom:'16px',flexWrap:'wrap'}}>
        <button className="btn" onClick={() => setShowDilution(!showDilution)}>🧪 Dilución Seriada</button>
        <button className="btn" onClick={() => setShowRep(!showRep)}><Copy size={16}/> Replicados</button>
        <button className="btn" onClick={handleRandomize}><Shuffle size={16}/> Aleatorizar (Inner 60)</button>
        <button className="btn" onClick={() => setShowImport(!showImport)}><ClipboardPaste size={16}/> Importar Lecturas</button>
        <button className="btn" onClick={() => setShowSampleImport(!showSampleImport)}><Upload size={16}/> Importar Lista Muestras</button>
        <button className="btn" onClick={() => window.print()}><Printer size={16}/> Imprimir</button>
        <label className="btn" style={{display:'flex',alignItems:'center',gap:'8px',cursor:'pointer',background:'transparent',border:'1px solid var(--panel-border)'}}>
          <input type="checkbox" checked={isBWPrint} onChange={e => setIsBWPrint(e.target.checked)} style={{cursor:'pointer'}}/>B/N
        </label>
        <button className="btn btn-danger" onClick={() => {
          setWells(prev => {
            const nw = {};
            Object.keys(prev).forEach(k => {
              const g = groups.find(gr => gr.id === prev[k].groupId);
              if (g?.locked) nw[k] = prev[k];
            });
            return nw;
          });
          setWarnings([]);
        }}><X size={16}/> Limpiar Placa</button>
      </div>

      {/* Assay Analysis Engine Panel */}
      <div className="glass-panel no-print" style={{padding:'16px', marginBottom:'16px', borderLeft:'4px solid #8b5cf6'}}>
        <h4 style={{marginBottom:'12px', display:'flex', alignItems:'center', gap:'8px'}}>
          {'🔬'} Análisis Automático (Kits LIMS)
        </h4>

        <div className="field" style={{marginBottom:'14px'}}>
          <label>Seleccionar Kit</label>
          <select className="input-field" value={selectedKitId} style={{maxWidth:'380px'}} onChange={e => {
            setSelectedKitId(e.target.value);
            setKitInputs({});
          }}>
            <option value="">-- Sin Módulo de Análisis --</option>
            {ASSAY_KITS.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
          </select>
        </div>

        {selectedKitId && (() => {
          const kit = ASSAY_KITS.find(k => k.id === selectedKitId);
          const setup = kit?.standardCurveSetup;
          const dp = setup?.dilutionParams;
          return (
            <div style={{display:'flex', flexDirection:'column', gap:'12px'}}>

              {/* Step cards */}
              {setup && (
                <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(210px, 1fr))', gap:'10px'}}>

                  {/* STEP 1 – Blank */}
                  <div style={{background:'rgba(107,114,128,0.12)', borderRadius:'8px', padding:'10px', borderLeft:'3px solid #6b7280'}}>
                    <div style={{fontWeight:700, fontSize:'0.8rem', marginBottom:'4px', color:'var(--text-primary)'}}>
                      {'🥛'} Paso 1 — Blanco
                    </div>
                    <div style={{fontSize:'0.78rem', color:'var(--text-secondary)'}}>
                      El sistema asignará el blanco en los pocillos <strong>{setup.blankWells?.join(' y ')}</strong> (0 μM, duplicado).
                      Estos quedarán marcados automáticamente al hacer clic en el botón del Paso 2.
                    </div>
                  </div>

                  {/* STEP 2 – Standard curve */}
                  <div style={{background:'rgba(59,130,246,0.1)', borderRadius:'8px', padding:'10px', borderLeft:'3px solid #3b82f6'}}>
                    <div style={{fontWeight:700, fontSize:'0.8rem', marginBottom:'6px', color:'var(--text-primary)'}}>
                      {'🧪'} Paso 2 — Curva Estándar Automática
                    </div>
                    <div style={{fontSize:'0.78rem', color:'var(--text-secondary)', marginBottom:'8px'}}>
                      El botón asignará automáticamente <strong>Blanco</strong> en {setup.blankWells?.join(', ')} (0 μM)
                      y los siguientes <strong>{setup.standards?.length} estándares</strong> en duplicado:
                      <ul style={{margin:'4px 0 0 14px', padding:0}}>
                        {setup.standards?.map(s => (
                          <li key={s.conc}>{s.wells.join(' y ')} → <strong>{s.conc} {s.unit}</strong></li>
                        ))}
                      </ul>
                    </div>
                    <button className="btn btn-primary" style={{fontSize:'0.8rem', padding:'4px 10px'}} onClick={handleAutoConfigureStandard}>
                      {'⚗️'} Configurar Curva Estándar
                    </button>
                  </div>

                  {/* STEP 3 – Samples */}
                  <div style={{background:'rgba(245,158,11,0.1)', borderRadius:'8px', padding:'10px', borderLeft:'3px solid #f59e0b'}}>
                    <div style={{fontWeight:700, fontSize:'0.8rem', marginBottom:'4px', color:'var(--text-primary)'}}>
                      {'🔬'} Paso 3 — Muestras y Cálculo
                    </div>
                    <div style={{fontSize:'0.78rem', color:'var(--text-secondary)'}}>
                      Crea grupos <strong>Desconocido</strong> y/o <strong>Ctrl (+)</strong> para tus muestras.
                      Importa las lecturas de absorbancia con <em>"Importar Lecturas"</em>.
                      Luego ingresa el factor de dilución de tu muestra y haz clic en <strong>Calcular y Exportar</strong>.
                    </div>
                  </div>

                </div>
              )}

              {/* Inputs + export */}
              <div style={{display:'flex', gap:'12px', flexWrap:'wrap', alignItems:'flex-end'}}>
                {kit?.requiredInputs?.map(inp => (
                  <div className="field" key={inp.id}>
                    <label>{inp.label}</label>
                    <input
                      type={inp.type}
                      className="input-field"
                      style={{width:'150px'}}
                      value={kitInputs[inp.id] ?? inp.default}
                      onChange={e => setKitInputs({...kitInputs, [inp.id]: e.target.value})}
                    />
                  </div>
                ))}
                <button className="btn btn-primary" onClick={handleRunAnalysis}>
                  <Download size={16}/> Calcular y Exportar
                </button>
              </div>

            </div>
          );
        })()}
      </div>


      {/* Export Toolbar */}
      <div className="no-print" style={{display:'flex',gap:'8px',marginBottom:'16px',flexWrap:'wrap'}}>
        <button className="btn" onClick={() => downloadFile(exportPlateCSV(wells,groups),'plate_results.csv')}><Download size={16}/> CSV Genérico</button>
        <button className="btn" onClick={() => downloadFile(exportBioTekCSV(wells,groups),'plate_biotek.csv')}><Download size={16}/> BioTek Gen5</button>
        <button className="btn" onClick={() => downloadFile(exportSoftMaxPro(wells,groups),'plate_softmax.txt','text/plain')}><Download size={16}/> SoftMax Pro</button>
      </div>

      {/* Templates */}
      <div className="no-print" style={{display:'flex',gap:'8px',marginBottom:'16px',alignItems:'center',background:'rgba(59,130,246,0.1)',padding:'12px',borderRadius:'8px',border:'1px solid rgba(59,130,246,0.3)'}}>
        <strong style={{color:'var(--text-primary)',fontSize:'0.85rem'}}>Plantillas:</strong>
        <button className="btn" onClick={saveLayout}><Save size={16}/> Guardar</button>
        {plateLayouts.length > 0 && (
          <select className="input-field" onChange={loadLayout} style={{padding:'6px',fontSize:'0.85rem',maxWidth:'250px'}}>
            <option value="">Cargar plantilla...</option>
            {plateLayouts.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        )}
      </div>

      {/* Dilution Builder */}
      {showDilution && (
        <div className="plate-tools-panel no-print">
          <h4>🧪 Constructor de Dilución Seriada</h4>
          <div style={{fontSize:'0.8rem',color:'var(--text-secondary)',marginBottom:'12px',background:'rgba(0,0,0,0.03)',padding:'8px',borderRadius:'4px'}}>
            <strong>Instrucciones:</strong>
            <ol style={{margin:'4px 0 0 16px',padding:0}}>
              <li>Selecciona arriba el grupo que deseas diluir (ej. <em>Estándar</em>).</li>
              <li>Ingresa el <strong>Pocillo Inicio</strong> y la <strong>Concentración</strong> inicial (la más alta).</li>
              <li>Elige el <strong>Factor</strong> (Ej. 1:2 significa que cada paso tendrá la mitad de concentración).</li>
              <li>Indica los <strong>Pasos</strong> (número de pocillos totales a llenar) y la <strong>Dirección</strong>.</li>
            </ol>
          </div>
          <div className="plate-tools-row">
            <div className="field"><label>Pocillo Inicio</label><input value={dilution.startWell} onChange={e => setDilution({...dilution,startWell:e.target.value})} placeholder="A1"/></div>
            <div className="field"><label>Concentración</label><input type="number" value={dilution.startConc} onChange={e => setDilution({...dilution,startConc:parseFloat(e.target.value)||0})}/></div>
            <div className="field"><label>Unidad</label><input value={dilution.unit} onChange={e => setDilution({...dilution,unit:e.target.value})} style={{width:'60px'}}/></div>
            <div className="field"><label>Factor (1:N)</label>
              <select value={dilution.factor} onChange={e => setDilution({...dilution,factor:parseFloat(e.target.value)})}>
                <option value={2}>1:2</option><option value={3}>1:3</option><option value={5}>1:5</option><option value={10}>1:10</option>
              </select>
            </div>
            <div className="field"><label>Pasos</label><input type="number" min={2} max={12} value={dilution.steps} onChange={e => setDilution({...dilution,steps:parseInt(e.target.value)||2})}/></div>
            <div className="field"><label>Dirección</label>
              <select value={dilution.direction} onChange={e => setDilution({...dilution,direction:e.target.value})}>
                <option value="horizontal">→ Horizontal</option><option value="vertical">↓ Vertical</option>
              </select>
            </div>
            <button className="btn btn-primary" onClick={handleDilution}>Aplicar</button>
          </div>
        </div>
      )}

      {/* Replicate Tool */}
      {showRep && (
        <div className="plate-tools-panel no-print">
          <h4><Copy size={16}/> Herramienta de Replicados</h4>
          <div style={{fontSize:'0.78rem',color:'var(--text-secondary)',marginBottom:'10px',background:'rgba(0,0,0,0.03)',padding:'8px',borderRadius:'4px'}}>
            <strong>Reorganiza automáticamente</strong> todas las muestras ya asignadas en la placa con la convención clásica de laboratorio:
            <ul style={{margin:'4px 0 0 14px',padding:0}}>
              <li><strong>↓ Vertical:</strong> Cada muestra en su propia fila, réplicas lado a lado → M1: A1,A2 | M2: B1,B2</li>
              <li><strong>→ Horizontal:</strong> Todas las muestras en la misma fila, réplicas en filas debajo → Fila A: M1,M2,M3 | Fila B: M1,M2,M3</li>
            </ul>
          </div>
          <div className="plate-tools-row">
            <div className="field"><label>Réplicas</label>
              <select value={repCount} onChange={e => setRepCount(parseInt(e.target.value))}>
                <option value={2}>Duplicado</option><option value={3}>Triplicado</option>
              </select>
            </div>
            <div className="field"><label>Dirección</label>
              <select value={repDir} onChange={e => setRepDir(e.target.value)}>
                <option value="vertical">↓ Vertical (una muestra por fila)</option>
                <option value="horizontal">→ Horizontal (muestras en fila, réplicas abajo)</option>
              </select>
            </div>
            <button className="btn btn-primary" onClick={handleReplicates}>Aplicar</button>
          </div>
        </div>
      )}

      {/* Paste Import */}
      {showImport && (
        <div className="glass-panel plate-data-import" style={{padding:'16px',marginBottom:'16px'}}>
          <h4>Pegar Matriz de Resultados</h4>
          <p style={{fontSize:'0.8rem',color:'var(--text-secondary)',marginBottom:'12px'}}>8 filas × 12 columnas separadas por tabulador o coma.</p>
          <textarea className="input-field" value={pasteData} onChange={e => setPasteData(e.target.value)} placeholder={"0.45\t0.52\t0.48\t...\n0.31\t0.29\t0.33\t..."}/>
          <button className="btn btn-primary" style={{marginTop:'8px'}} onClick={handleImportPaste}>Aplicar Lecturas</button>
        </div>
      )}

      {/* Sample List Import */}
      {showSampleImport && (
        <div className="plate-tools-panel no-print">
          <h4><Upload size={16}/> Importar Lista de Muestras</h4>
          <p style={{fontSize:'0.78rem',color:'var(--text-secondary)',marginBottom:'8px'}}>Pega una lista de nombres (uno por línea) o carga un CSV de una columna.</p>
          <div style={{fontSize:'0.78rem',color:'var(--text-secondary)',marginBottom:'10px',background:'rgba(0,0,0,0.03)',padding:'8px',borderRadius:'4px'}}>
            <strong>Convención de llenado:</strong>
            <ul style={{margin:'4px 0 0 14px',padding:0}}>
              <li><strong>↓ Vertical:</strong> Una muestra por fila, réplicas lado a lado → M1: A1,A2 | M2: B1,B2</li>
              <li><strong>→ Horizontal:</strong> Muestras en la misma fila, réplicas en filas debajo → Fila A: M1,M2,M3 | Fila B: M1,M2,M3</li>
            </ul>
          </div>
          <div className="plate-tools-row" style={{marginBottom:'8px'}}>
            <div className="field"><label>Réplicas</label>
              <select value={sampleRepCount} onChange={e => setSampleRepCount(parseInt(e.target.value))}>
                <option value={1}>Singlete</option><option value={2}>Duplicado</option><option value={3}>Triplicado</option>
              </select>
            </div>
            <div className="field"><label>Llenado</label>
              <select value={sampleDir} onChange={e => setSampleDir(e.target.value)}>
                <option value="vertical">↓ Vertical (una muestra por fila)</option>
                <option value="horizontal">→ Horizontal (muestras en fila, réplicas abajo)</option>
              </select>
            </div>
          </div>
          <textarea className="input-field" value={sampleText} onChange={e => setSampleText(e.target.value)} placeholder={"Muestra 1\nMuestra 2\nMuestra 3"} style={{width:'100%',minHeight:'100px',resize:'vertical',marginBottom:'8px'}}/>
          <div style={{display:'flex',gap:'8px'}}>
            <button className="btn btn-primary" onClick={() => handleSampleImport(true)}>Poblar Placa</button>
            <button className="btn" onClick={() => handleSampleImport(false)}>Solo Crear Grupos</button>
            <label className="btn" style={{cursor:'pointer'}}>
              📂 Cargar CSV
              <input type="file" accept=".csv,.txt" style={{display:'none'}} onChange={e => {
                const f = e.target.files[0]; if (!f) return;
                const reader = new FileReader();
                reader.onload = (ev) => setSampleText(ev.target.result);
                reader.readAsText(f);
              }}/>
            </label>
          </div>
        </div>
      )}

      {/* Validation Warnings */}
      {warnings.length > 0 && (
        <div className="validation-banner no-print">
          <AlertTriangle size={18}/>
          <div><strong>Advertencias de Diseño</strong><ul>{warnings.map((w,i) => <li key={i}>{w}</li>)}</ul></div>
        </div>
      )}

      {/* Summary Statistics */}
      {stats.length > 0 && (
        <div className="glass-panel" style={{padding:'16px'}}>
          <h4 style={{marginBottom:'12px'}}>Resumen Estadístico por Grupo</h4>
          <table className="plate-results-table">
            <thead><tr><th></th><th>Grupo</th><th>Tipo</th><th>n</th><th>Media</th><th>DE</th>{state && <th>Acción</th>}</tr></thead>
            <tbody>
              {stats.map(s => (
                <tr key={s.group.id}>
                  <td><div className="legend-swatch" style={{background:s.group.color}}></div></td>
                  <td>{s.group.name}</td>
                  <td><span className="well-type-badge" style={{color:WELL_TYPES[s.group.wellType]?.color}}>{WELL_TYPES[s.group.wellType]?.abbr}</span></td>
                  <td>{s.n}</td>
                  <td>{isNaN(s.mean) ? '—' : s.mean.toFixed(4)}</td>
                  <td>{s.sd.toFixed(4)}</td>
                  {state && (
                    <td style={{display:'flex',gap:'8px'}}>
                      <select className="input-field" style={{padding:'2px',fontSize:'0.8rem',width:'150px'}} value={selectedExports[s.group.id]||'NEW'} onChange={e => setSelectedExports({...selectedExports,[s.group.id]:e.target.value})}>
                        <option value="NEW">Crear Nueva Muestra</option>
                        {state.subjects.map(subj => <option key={subj.id} value={subj.id}>Vincular: {subj.name}</option>)}
                      </select>
                      <button className="btn" style={{padding:'2px 8px',fontSize:'0.8rem'}} onClick={() => handleExportGroup(s)} disabled={isNaN(s.mean)}>Exportar</button>
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
