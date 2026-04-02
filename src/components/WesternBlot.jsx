import React, { useState, useRef, useCallback, useEffect } from 'react';
import { UploadCloud, Plus, Trash2, Download, Move } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import './WesternBlot.css';

export default function WesternBlot({ subjects = [], variables = [], updateState }) {
  const state = { subjects, variables }; // Compatibility shim for internal state.subjects/state.variables reads
  const [image, setImage] = useState(null);
  const [lanes, setLanes] = useState([]);
  const [selectedLaneId, setSelectedLaneId] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(null); // corner: 'se', 'nw', etc.
  const [dragStart, setDragStart] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState(null);
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const fileRef = useRef(null);
  const [selectedSubjects, setSelectedSubjects] = useState({}); // { laneId: subjectId }

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setImage({ name: file.name, data: ev.target.result });
      setLanes([]);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const getRelativePos = (e) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    };
  };

  // Measure pixel intensity inside a lane box using a hidden canvas
  const measureDensity = useCallback((laneRect) => {
    if (!canvasRef.current || !containerRef.current) return 0;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const imgEl = containerRef.current.querySelector('img');
    if (!imgEl) return 0;

    const natW = imgEl.naturalWidth;
    const natH = imgEl.naturalHeight;
    canvas.width = natW;
    canvas.height = natH;
    ctx.drawImage(imgEl, 0, 0, natW, natH);

    const x = Math.round((laneRect.x / 100) * natW);
    const y = Math.round((laneRect.y / 100) * natH);
    const w = Math.max(1, Math.round((laneRect.w / 100) * natW));
    const h = Math.max(1, Math.round((laneRect.h / 100) * natH));

    try {
      const imgData = ctx.getImageData(x, y, w, h);
      const pixels = imgData.data;
      let totalIntensity = 0;
      const numPixels = w * h;
      for (let i = 0; i < pixels.length; i += 4) {
        // Invert: dark bands = high signal. Convert to grayscale then invert.
        const gray = 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
        totalIntensity += (255 - gray); // darker = higher intensity
      }
      return totalIntensity / numPixels;
    } catch {
      return 0;
    }
  }, []);

  // Recalculate all densities when lanes change
  useEffect(() => {
    if (!image || lanes.length === 0) return;
    const timer = setTimeout(() => {
      setLanes(prev => prev.map(lane => ({
        ...lane,
        density: measureDensity(lane)
      })));
    }, 100);
    return () => clearTimeout(timer);
  }, [image, lanes.length, measureDensity]);

  const getCroppedImage = (laneRect) => {
    if (!containerRef.current) return null;
    const imgEl = containerRef.current.querySelector('img');
    if (!imgEl) return null;
    const canvas = document.createElement('canvas');
    const natW = imgEl.naturalWidth;
    const natH = imgEl.naturalHeight;
    const x = Math.round((laneRect.x / 100) * natW);
    const y = Math.round((laneRect.y / 100) * natH);
    const w = Math.max(1, Math.round((laneRect.w / 100) * natW));
    const h = Math.max(1, Math.round((laneRect.h / 100) * natH));
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(imgEl, x, y, w, h, 0, 0, w, h);
    return canvas.toDataURL('image/png');
  };

  const handleAssignToSubject = (laneId) => {
    if (!state || !setState) return;
    const subId = selectedSubjects[laneId];
    if (!subId) {
      alert('Selecciona un sujeto en el menú desplegable primero.');
      return;
    }
    const lane = lanes.find(l => l.id === laneId);
    const firstDensity = lanes[0]?.density || 1;
    const ratio = (lane.density / firstDensity).toFixed(3);
    const cropData = getCroppedImage(lane);
    
    let varId = `var_wb_${lane.label.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    let newVars = [...state.variables];
    if (!newVars.find(v => v.id === varId)) {
      newVars.push({
        id: varId,
        name: `WB: ${lane.label}`,
        unit: 'Ratio',
        type: 'number'
      });
    }

    const newSubjects = state.subjects.map(sub => {
      if (sub.id !== subId) return sub;
      const newImages = [...sub.images, { id: uuidv4(), data: cropData, name: `WB ${lane.label} - Ratio: ${ratio}` }];
      return {
        ...sub,
        measurements: { ...sub.measurements, [varId]: ratio },
        images: newImages
      };
    });

    updateState({ variables: newVars, subjects: newSubjects });
    alert(`Banda guardada en ${state.subjects.find(s=>s.id === subId)?.name} con éxito.\nRatio = ${ratio}`);
    setSelectedSubjects(prev => { const n = {...prev}; delete n[laneId]; return n; });
  };

  // Draw new box
  const handleMouseDown = (e) => {
    if (e.target.closest('.wb-lane-box')) return; // clicked on an existing lane
    const pos = getRelativePos(e);
    setIsDrawing(true);
    setDrawStart(pos);
    setSelectedLaneId(null);
  };

  const handleMouseMove = (e) => {
    if (isDrawing && drawStart) {
      const pos = getRelativePos(e);
      const preview = document.getElementById('wb-draw-preview');
      if (preview) {
        const x = Math.min(drawStart.x, pos.x);
        const y = Math.min(drawStart.y, pos.y);
        const w = Math.abs(pos.x - drawStart.x);
        const h = Math.abs(pos.y - drawStart.y);
        preview.style.left = `${x}%`;
        preview.style.top = `${y}%`;
        preview.style.width = `${w}%`;
        preview.style.height = `${h}%`;
        preview.style.display = 'block';
      }
    }

    if (isDragging && selectedLaneId && dragStart) {
      const pos = getRelativePos(e);
      const dx = pos.x - dragStart.x;
      const dy = pos.y - dragStart.y;
      setLanes(prev => prev.map(l => {
        if (l.id !== selectedLaneId) return l;
        return { ...l, x: l.x + dx, y: l.y + dy };
      }));
      setDragStart(pos);
    }

    if (isResizing && selectedLaneId && dragStart) {
      const pos = getRelativePos(e);
      const dx = pos.x - dragStart.x;
      const dy = pos.y - dragStart.y;
      setLanes(prev => prev.map(l => {
        if (l.id !== selectedLaneId) return l;
        let { x, y, w, h } = l;
        if (isResizing.includes('e')) { w = Math.max(2, w + dx); }
        if (isResizing.includes('s')) { h = Math.max(2, h + dy); }
        if (isResizing.includes('w')) { x += dx; w = Math.max(2, w - dx); }
        if (isResizing.includes('n')) { y += dy; h = Math.max(2, h - dy); }
        return { ...l, x, y, w, h };
      }));
      setDragStart(pos);
    }
  };

  const handleMouseUp = (e) => {
    if (isDrawing && drawStart) {
      const pos = getRelativePos(e);
      const x = Math.min(drawStart.x, pos.x);
      const y = Math.min(drawStart.y, pos.y);
      const w = Math.abs(pos.x - drawStart.x);
      const h = Math.abs(pos.y - drawStart.y);

      if (w > 1 && h > 1) {
        const newLane = {
          id: uuidv4(),
          label: `Banda ${lanes.length + 1}`,
          x, y, w, h,
          density: 0,
        };
        newLane.density = measureDensity(newLane);
        setLanes(prev => [...prev, newLane]);
        setSelectedLaneId(newLane.id);
      }

      const preview = document.getElementById('wb-draw-preview');
      if (preview) preview.style.display = 'none';
    }

    setIsDrawing(false);
    setDrawStart(null);
    setIsDragging(false);
    setIsResizing(null);
    setDragStart(null);

    // Recalc densities after move/resize
    if (isDragging || isResizing) {
      setLanes(prev => prev.map(lane => ({
        ...lane,
        density: measureDensity(lane)
      })));
    }
  };

  const startDrag = (e, laneId) => {
    e.stopPropagation();
    setSelectedLaneId(laneId);
    setIsDragging(true);
    setDragStart(getRelativePos(e));
  };

  const startResize = (e, laneId, corner) => {
    e.stopPropagation();
    setSelectedLaneId(laneId);
    setIsResizing(corner);
    setDragStart(getRelativePos(e));
  };

  const removeLane = (id) => {
    setLanes(lanes.filter(l => l.id !== id));
    if (selectedLaneId === id) setSelectedLaneId(null);
  };

  const renameLane = (id, label) => {
    setLanes(lanes.map(l => l.id === id ? { ...l, label } : l));
  };

  const maxDensity = Math.max(...lanes.map(l => l.density), 1);

  const exportLanesCSV = () => {
    const lines = ['Banda,Intensidad Relativa,Ratio vs Primera'];
    const firstDensity = lanes[0]?.density || 1;
    lanes.forEach(l => {
      lines.push(`"${l.label}",${l.density.toFixed(2)},${(l.density / firstDensity).toFixed(3)}`);
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'western_blot_densitometry.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleExportSubjects = () => {
    if (!state || !setState) return alert("Estado general no encontrado. Asegúrese de guardar o cargar protocolo.");
    
    let finalVars = [...state.variables];
    if (!finalVars.find(v => v.id === 'var_wb_density')) finalVars.push({ id: 'var_wb_density', name: 'WB Int. Cruda', unit: 'UD', type: 'number' });
    if (!finalVars.find(v => v.id === 'var_wb_ratio')) finalVars.push({ id: 'var_wb_ratio', name: 'WB Ratio Relativo', unit: '%', type: 'number' });

    let updatedSubjects = [...state.subjects];
    let linkedCount = 0;
    
    const firstDensity = lanes[0]?.density || 1;

    lanes.forEach(l => {
      const targetSubjId = selectedSubjects[l.id];
      if (targetSubjId) {
        updatedSubjects = updatedSubjects.map(s => {
          if (s.id === targetSubjId) {
            linkedCount++;
            return {
              ...s,
              measurements: {
                ...s.measurements,
                var_wb_density: l.density.toFixed(2),
                var_wb_ratio: (l.density / firstDensity).toFixed(3)
              }
            };
          }
          return s;
        });
      }
    });

    if (linkedCount > 0) {
      updateState({ variables: finalVars, subjects: updatedSubjects});
      alert(`Exportación cruzada exitosa. ${linkedCount} tubos experimentales y muestras actualizadas.`);
    } else {
      alert("Selecciona al menos una 'Muestra' en los menús desplegables debajo de cada banda.");
    }
  };

  if (!image) {
    return (
      <div className="wb-container">
        <div className="wb-instructions">
          <strong>Analizador de Western Blot:</strong> Sube una imagen de tu membrana y dibuja cajas sobre cada banda para medir la intensidad relativa (densitometría). Ideal para calcular ratios como p-p38/p38 total o CK-18/β-actina.
        </div>
        <div className="dropzone" onClick={() => fileRef.current?.click()} style={{maxWidth: '500px'}}>
          <UploadCloud size={32} style={{marginBottom: '12px'}} />
          <span style={{fontSize: '0.9rem', textAlign: 'center'}}>Sube tu imagen de Western Blot</span>
          <input type="file" ref={fileRef} accept="image/*" style={{display: 'none'}} onChange={handleFileUpload} />
        </div>
      </div>
    );
  }

  const firstDensity = lanes[0]?.density || 1;

  return (
    <div className="wb-container">
      <div className="wb-instructions">
        <Move size={14} style={{display: 'inline', verticalAlign: 'middle', marginRight: '4px'}} />
        <strong>Haz clic y arrastra</strong> sobre la imagen para dibujar una caja en cada banda. Mueve las cajas arrastrándolas y redimensiona desde las esquinas.
      </div>

      <div className="wb-toolbar">
        <button className="btn btn-danger" onClick={() => { setImage(null); setLanes([]); }}>Cambiar Imagen</button>
        <button className="btn" onClick={() => setLanes([])}><Trash2 size={14}/> Limpiar Cajas</button>
        {lanes.length > 0 && (
          <>
            <button className="btn" onClick={exportLanesCSV}><Download size={14}/> Exportar CSV Local</button>
            <button className="btn btn-primary" onClick={handleExportSubjects}>Inyectar Datos a Muestras</button>
          </>
        )}
      </div>

      <div className="glass-panel" style={{padding: '4px', display: 'inline-block', marginBottom: '24px'}}>
        <div
          ref={containerRef}
          className="wb-image-area"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <img src={image.data} alt={image.name} draggable={false} />
          <canvas ref={canvasRef} style={{display: 'none'}} />

          {/* Draw preview */}
          <div
            id="wb-draw-preview"
            style={{
              position: 'absolute',
              border: '2px dashed var(--accent)',
              background: 'rgba(88,166,255,0.1)',
              display: 'none',
              pointerEvents: 'none',
            }}
          />

          {/* Lane boxes */}
          {lanes.map(lane => (
            <div
              key={lane.id}
              className={`wb-lane-box ${selectedLaneId === lane.id ? 'selected' : ''}`}
              style={{
                left: `${lane.x}%`,
                top: `${lane.y}%`,
                width: `${lane.w}%`,
                height: `${lane.h}%`,
              }}
              onMouseDown={(e) => startDrag(e, lane.id)}
              onClick={(e) => { e.stopPropagation(); setSelectedLaneId(lane.id); }}
            >
              <div className="wb-lane-label">{lane.label}</div>
              {selectedLaneId === lane.id && state?.subjects && (
                <select 
                  className="wb-lane-select no-print"
                  value={selectedSubjects[lane.id] || ''}
                  onChange={(e) => setSelectedSubjects({...selectedSubjects, [lane.id]: e.target.value})}
                  onClick={(e) => e.stopPropagation()}
                >
                  <option value="">(Sin vincular muestra)</option>
                  {state.subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              )}
              {/* Resize handles */}
              {selectedLaneId === lane.id && (
                <>
                  <div className="wb-resize-handle nw" onMouseDown={e => startResize(e, lane.id, 'nw')} />
                  <div className="wb-resize-handle ne" onMouseDown={e => startResize(e, lane.id, 'ne')} />
                  <div className="wb-resize-handle sw" onMouseDown={e => startResize(e, lane.id, 'sw')} />
                  <div className="wb-resize-handle se" onMouseDown={e => startResize(e, lane.id, 'se')} />
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Density results */}
      {lanes.length > 0 && (
        <div className="glass-panel" style={{padding: '16px'}}>
          <h4 style={{marginBottom: '12px'}}>Densitometría Relativa</h4>
          <table className="wb-lanes-table">
            <thead>
              <tr>
                <th>Banda</th>
                <th>Nombre</th>
                <th>Intensidad</th>
                <th>Ratio vs 1ª</th>
                <th style={{width: '120px'}}>Barra</th>
                <th style={{textAlign: 'center'}}>Exportar a Sujeto</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {lanes.map((lane, idx) => (
                <tr key={lane.id} style={selectedLaneId === lane.id ? {background: 'rgba(88,166,255,0.08)'} : {}}>
                  <td style={{fontWeight: 600}}>{idx + 1}</td>
                  <td>
                    <input
                      className="group-name-input"
                      value={lane.label}
                      onChange={e => renameLane(lane.id, e.target.value)}
                      style={{width: '140px'}}
                    />
                  </td>
                  <td style={{fontVariantNumeric: 'tabular-nums'}}>{lane.density.toFixed(1)}</td>
                  <td style={{fontWeight: 600, color: 'var(--accent)', fontVariantNumeric: 'tabular-nums'}}>
                    {(lane.density / firstDensity).toFixed(3)}
                  </td>
                  <td>
                    <div
                      className="wb-density-bar"
                      style={{
                        width: `${(lane.density / maxDensity) * 100}%`,
                        background: selectedLaneId === lane.id ? '#10b981' : 'var(--accent)',
                      }}
                    />
                  </td>
                  <td style={{textAlign: 'center', whiteSpace: 'nowrap'}}>
                    {state && state.subjects.length > 0 ? (
                      <div style={{display: 'flex', gap: '4px', justifyContent: 'center'}}>
                        <select 
                          className="input-field" 
                          style={{padding: '2px 4px', fontSize: '0.8rem', width: '100px'}}
                          value={selectedSubjects[lane.id] || ''}
                          onChange={e => setSelectedSubjects({...selectedSubjects, [lane.id]: e.target.value})}
                        >
                          <option value="" disabled>Sujeto...</option>
                          {state.subjects.map(s => <option key={s.id} value={s.id}>{s.name} ({s.group || 'Sin Grupo'})</option>)}
                        </select>
                        <button className="btn btn-primary" style={{padding: '2px 6px', fontSize: '0.75rem'}} onClick={() => handleAssignToSubject(lane.id)}>
                          Guardar
                        </button>
                      </div>
                    ) : (
                      <span style={{fontSize: '0.8rem', color: 'var(--text-secondary)'}}>Sin sujetos creados</span>
                    )}
                  </td>
                  <td>
                    <button className="btn-icon" onClick={() => removeLane(lane.id)}><Trash2 size={14}/></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
