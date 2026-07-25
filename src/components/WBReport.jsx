import React, { useState, useRef, useCallback, useEffect } from 'react';
import { UploadCloud, Plus, Trash2, Download, Image as ImageIcon, Crop, GripHorizontal, GripVertical } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import './WBReport.css';

/* ─── Utilidades de cálculo ─── */

const calculateLaneIntensitiesFromCanvas = (canvas, columns) => {
  const width = canvas.width;
  const height = canvas.height;
  const ctx = canvas.getContext('2d');
  const imgDataObj = ctx.getImageData(0, 0, width, height);
  const data = imgDataObj.data;

  const sortedCols = [...columns].sort((a, b) => a.x - b.x);

  const boundaries = [0];
  for (let i = 0; i < sortedCols.length - 1; i++) {
    boundaries.push(((sortedCols[i].x + sortedCols[i + 1].x) / 2) * width / 100);
  }
  boundaries.push(width);

  const intensities = {};
  sortedCols.forEach((col) => { intensities[col.id] = 0; });

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const colIdx = sortedCols.findIndex((_, idx) => x >= boundaries[idx] && x < boundaries[idx + 1]);
      if (colIdx !== -1) {
        const i = (y * width + x) * 4;
        intensities[sortedCols[colIdx].id] += 255 - (data[i] + data[i + 1] + data[i + 2]) / 3;
      }
    }
  }

  const result = {};
  for (const id in intensities) result[id] = Math.round(intensities[id]);
  return result;
};

const estimateKda = (markers, targetY) => {
  const valid = markers
    .map((m) => { const match = m.value.match(/(\d+(\.\d+)?)/); return match ? { y: m.y, kda: parseFloat(match[0]) } : null; })
    .filter((m) => m && m.kda > 0);
  if (valid.length < 2) return null;
  let sx = 0, sy = 0, sxy = 0, sx2 = 0;
  const n = valid.length;
  valid.forEach(({ y, kda }) => { const lk = Math.log10(kda); sx += y; sy += lk; sxy += y * lk; sx2 += y * y; });
  const den = n * sx2 - sx * sx;
  if (!den) return null;
  const slope = (n * sxy - sx * sy) / den;
  const intercept = (sy - slope * sx) / n;
  return Math.round(Math.pow(10, slope * targetY + intercept));
};

/* ─── Recalcular intensidades de TODAS las bandas ─── */
const recalcAllStrips = (strips, columns) => {
  return strips.map((strip) => {
    const el = document.querySelector(`#strip-img-${strip.id} .wb-strip-image`);
    if (!el || !el.naturalWidth) return strip;
    const canvas = document.createElement('canvas');
    canvas.width = el.naturalWidth;
    canvas.height = el.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(el, 0, 0);
    return { ...strip, laneIntensities: calculateLaneIntensitiesFromCanvas(canvas, columns) };
  });
};

/* ─── Componente principal ─── */
export default function WBReport() {
  // Librería de imágenes
  const [imageLibrary, setImageLibrary] = useState([]);
  const [activeImageId, setActiveImageId] = useState(null);

  // Columnas globales — definidas una vez, aplicadas a todas las bandas
  const [globalColumns, setGlobalColumns] = useState([
    { id: uuidv4(), value: 'Control', x: 25 },
    { id: uuidv4(), value: 'Treated', x: 75 },
  ]);

  // Bandas
  const [strips, setStrips] = useState([]);
  const [cropStart, setCropStart] = useState(null);
  const [cropRect, setCropRect] = useState(null);
  const [dragItem, setDragItem] = useState(null); // { type: 'column'|'kda'|'target', id, stripId? }

  // Modal de reajuste
  const [editingStripId, setEditingStripId] = useState(null);
  const [editCropStart, setEditCropStart] = useState(null);
  const [editCropRect, setEditCropRect] = useState(null);

  const fileRef = useRef(null);
  const addMoreRef = useRef(null);
  const imgRef = useRef(null);
  const editImgRef = useRef(null);
  const previousDragItem = useRef(null);
  const globalHeaderRef = useRef(null);

  const activeImage = imageLibrary.find((img) => img.id === activeImageId) ?? null;

  /* ─── Recalcular todas las bandas cuando se suelta una columna global ─── */
  useEffect(() => {
    const prev = previousDragItem.current;
    if (prev && prev.type === 'column' && dragItem === null) {
      setStrips((s) => recalcAllStrips(s, globalColumns));
    }
    previousDragItem.current = dragItem;
  }, [dragItem, globalColumns]);

  /* ─── Drag global: columnas, kDa, target ─── */
  useEffect(() => {
    const onMove = (e) => {
      if (!dragItem) return;

      if (dragItem.type === 'column') {
        // Usar el encabezado global como referencia de anchura
        const header = globalHeaderRef.current;
        if (!header) return;
        const rect = header.getBoundingClientRect();
        let x = ((e.clientX - rect.left) / rect.width) * 100;
        x = Math.max(0, Math.min(100, x));
        setGlobalColumns((cols) => cols.map((c) => (c.id === dragItem.id ? { ...c, x } : c)));

      } else if (dragItem.type === 'kda' || dragItem.type === 'target') {
        const container = document.getElementById(`strip-img-${dragItem.stripId}`);
        if (!container) return;
        const rect = container.getBoundingClientRect();
        let y = ((e.clientY - rect.top) / rect.height) * 100;
        y = Math.max(0, Math.min(100, y));

        if (dragItem.type === 'kda') {
          setStrips((prev) => prev.map((s) =>
            s.id !== dragItem.stripId ? s :
            { ...s, kdaMarkers: s.kdaMarkers.map((k) => k.id === dragItem.id ? { ...k, y } : k) }
          ));
        } else {
          setStrips((prev) => prev.map((s) =>
            s.id !== dragItem.stripId ? s : { ...s, targetY: y }
          ));
        }
      }
    };

    const onUp = () => setDragItem(null);

    if (dragItem) {
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    }
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [dragItem]);

  /* ─── Librería de imágenes ─── */
  const loadFiles = (files) => {
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const newImg = { id: uuidv4(), name: file.name, data: ev.target.result };
        setImageLibrary((prev) => {
          if (prev.length === 0) setActiveImageId(newImg.id);
          return [...prev, newImg];
        });
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFileUpload = (e) => { if (e.target.files.length > 0) loadFiles(e.target.files); e.target.value = ''; };

  const removeFromLibrary = (imgId) => {
    const used = strips.some((s) => s.sourceImageId === imgId);
    if (used && !window.confirm('Esta imagen tiene bandas asociadas. ¿Eliminarla de todas formas?')) return;
    setImageLibrary((prev) => {
      const next = prev.filter((img) => img.id !== imgId);
      if (activeImageId === imgId) setActiveImageId(next[0]?.id ?? null);
      return next;
    });
  };

  /* ─── Recorte de banda ─── */
  const getRelPos = (e) => {
    const rect = imgRef.current.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
    };
  };

  const handleCropMouseDown = (e) => { setCropStart(getRelPos(e)); setCropRect(null); };
  const handleCropMouseMove = (e) => {
    if (!cropStart) return;
    const p = getRelPos(e);
    setCropRect({ x: Math.min(cropStart.x, p.x), y: Math.min(cropStart.y, p.y), w: Math.abs(p.x - cropStart.x), h: Math.abs(p.y - cropStart.y) });
  };

  const handleCropMouseUp = () => {
    if (cropRect && cropRect.w > 0.01 && cropRect.h > 0.01 && activeImage) {
      const img = imgRef.current;
      const canvas = document.createElement('canvas');
      const sx = Math.round(cropRect.x * img.naturalWidth);
      const sy = Math.round(cropRect.y * img.naturalHeight);
      const sw = Math.round(cropRect.w * img.naturalWidth);
      const sh = Math.round(cropRect.h * img.naturalHeight);
      canvas.width = sw; canvas.height = sh;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

      // Calcular intensidades con las columnas globales actuales
      const laneIntensities = calculateLaneIntensitiesFromCanvas(canvas, globalColumns);

      setStrips((prev) => [...prev, {
        id: uuidv4(),
        sourceImageId: activeImageId,
        protein: `Proteína ${prev.length + 1}`,
        imageData: canvas.toDataURL('image/png'),
        crop: cropRect,
        laneIntensities,
        isHousekeeping: false,
        targetY: 50,
        kdaMarkers: [
          { id: uuidv4(), value: '50 kDa', y: 30 },
          { id: uuidv4(), value: '25 kDa', y: 70 },
        ],
      }]);
    }
    setCropStart(null);
    setCropRect(null);
  };

  /* ─── CRUD Columnas Globales ─── */
  const addGlobalColumn = () => {
    const newCol = { id: uuidv4(), value: 'Grupo', x: 50 };
    const newCols = [...globalColumns, newCol];
    setGlobalColumns(newCols);
    // Disparar recálculo en el próximo frame (cuando el DOM tenga las imágenes)
    setTimeout(() => setStrips((s) => recalcAllStrips(s, newCols)), 50);
  };

  const removeGlobalColumn = (colId) => {
    const newCols = globalColumns.filter((c) => c.id !== colId);
    setGlobalColumns(newCols);
    setStrips((s) => recalcAllStrips(s.map((strip) => {
      const { [colId]: _, ...rest } = strip.laneIntensities ?? {};
      return { ...strip, laneIntensities: rest };
    }), newCols));
  };

  const updateGlobalColumnLabel = (colId, value) =>
    setGlobalColumns((cols) => cols.map((c) => (c.id === colId ? { ...c, value } : c)));

  /* ─── CRUD Bandas ─── */
  const updateStrip = (id, updates) => setStrips(strips.map((s) => (s.id === id ? { ...s, ...updates } : s)));
  const removeStrip = (id) => setStrips(strips.filter((s) => s.id !== id));

  const updateKda = (stripId, kdaId, value) =>
    setStrips(strips.map((s) => s.id !== stripId ? s : { ...s, kdaMarkers: s.kdaMarkers.map((k) => k.id === kdaId ? { ...k, value } : k) }));

  const addKda = (stripId) =>
    setStrips(strips.map((s) => s.id !== stripId ? s : { ...s, kdaMarkers: [...s.kdaMarkers, { id: uuidv4(), value: '-- kDa', y: 50 }] }));

  const removeKda = (stripId, kdaId) =>
    setStrips(strips.map((s) => s.id !== stripId ? s : { ...s, kdaMarkers: s.kdaMarkers.filter((k) => k.id !== kdaId) }));

  /* ─── Modal de reajuste ─── */
  const startEditCrop = (strip) => { setEditingStripId(strip.id); setEditCropRect(strip.crop); };

  const handleEditCropMouseDown = (e) => {
    const rect = editImgRef.current.getBoundingClientRect();
    setEditCropStart({ x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)), y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)) });
    setEditCropRect(null);
  };
  const handleEditCropMouseMove = (e) => {
    if (!editCropStart) return;
    const rect = editImgRef.current.getBoundingClientRect();
    const p = { x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)), y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)) };
    setEditCropRect({ x: Math.min(editCropStart.x, p.x), y: Math.min(editCropStart.y, p.y), w: Math.abs(p.x - editCropStart.x), h: Math.abs(p.y - editCropStart.y) });
  };
  const handleEditCropMouseUp = () => setEditCropStart(null);

  const saveEditedCrop = () => {
    if (editCropRect && editCropRect.w > 0.01 && editCropRect.h > 0.01) {
      const img = editImgRef.current;
      const canvas = document.createElement('canvas');
      const sx = Math.round(editCropRect.x * img.naturalWidth);
      const sy = Math.round(editCropRect.y * img.naturalHeight);
      const sw = Math.round(editCropRect.w * img.naturalWidth);
      const sh = Math.round(editCropRect.h * img.naturalHeight);
      canvas.width = sw; canvas.height = sh;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

      const laneIntensities = calculateLaneIntensitiesFromCanvas(canvas, globalColumns);
      setStrips(strips.map((s) => s.id !== editingStripId ? s : { ...s, imageData: canvas.toDataURL('image/png'), crop: editCropRect, laneIntensities }));
    }
    setEditingStripId(null);
    setEditCropRect(null);
  };

  /* ─── Exportar PNG ─── */
  const exportFigure = useCallback(() => {
    const el = document.getElementById('wb-figure-export');
    if (!el) return;
    import('html-to-image').then((mod) =>
      mod.toPng(el, { backgroundColor: '#ffffff', pixelRatio: 3 }).then((dataUrl) => {
        const a = document.createElement('a');
        a.href = dataUrl; a.download = 'western_blot_figure.png';
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
      })
    ).catch(() => alert('Error exportando figura'));
  }, []);

  /* ─── Housekeeping y ratio ─── */
  const setHousekeeping = (id) =>
    setStrips(strips.map((s) => ({ ...s, isHousekeeping: s.id === id ? !s.isHousekeeping : false })));

  const getRatioDisplay = (strip, col) => {
    const hk = strips.find((s) => s.isHousekeeping);
    if (!hk) return null;
    const targetInt = strip.laneIntensities?.[col.id];
    const hkInt = hk.laneIntensities?.[col.id];
    if (!targetInt || !hkInt) return null;
    return <div style={{ color: '#ffcc00', fontWeight: 'bold', fontSize: '0.6rem' }}>Rat: {(targetInt / hkInt).toFixed(2)}</div>;
  };

  const getEditSourceImage = () => {
    const strip = strips.find((s) => s.id === editingStripId);
    return strip ? (imageLibrary.find((img) => img.id === strip.sourceImageId) ?? null) : null;
  };

  const sortedColumns = [...globalColumns].sort((a, b) => a.x - b.x);

  /* ════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════ */
  return (
    <div className="wb-report-container">

      {/* Pantalla sin imágenes */}
      {imageLibrary.length === 0 ? (
        <div>
          <div className="wb-instructions" style={{ marginBottom: '16px' }}>
            <strong>Modo Reporte de Western Blot:</strong> Sube una o más imágenes de WB. Selecciona la imagen activa en la librería lateral y recorta cada banda individualmente.
          </div>
          <div className="dropzone" onClick={() => fileRef.current?.click()} style={{ maxWidth: '500px' }}>
            <UploadCloud size={32} style={{ marginBottom: '12px' }} />
            <span style={{ fontSize: '0.9rem', textAlign: 'center' }}>Sube tus imágenes de Western Blot</span>
            <input type="file" ref={fileRef} accept="image/*" multiple style={{ display: 'none' }} onChange={handleFileUpload} />
          </div>
        </div>
      ) : (
        <>
          <input type="file" ref={addMoreRef} accept="image/*" multiple style={{ display: 'none' }} onChange={handleFileUpload} />

          {/* Barra de acciones */}
          <div className="wb-report-actions">
            <button className="btn btn-danger" onClick={() => { setImageLibrary([]); setActiveImageId(null); setStrips([]); }}>
              Reiniciar todo
            </button>
            {strips.length > 0 && (
              <button className="btn btn-primary" onClick={exportFigure}>
                <Download size={14} /> Exportar Figura PNG
              </button>
            )}
          </div>

          {/* Layout: sidebar + área de trabajo */}
          <div className="wb-workspace-layout">

            {/* SIDEBAR */}
            <aside className="wb-sidebar">
              <div className="wb-sidebar-header">
                <span className="wb-sidebar-title">Librería</span>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>{imageLibrary.length} img</span>
              </div>

              {imageLibrary.map((img) => (
                <div
                  key={img.id}
                  className={`wb-library-item${img.id === activeImageId ? ' active' : ''}`}
                  onClick={() => setActiveImageId(img.id)}
                  title={img.name}
                >
                  {img.id === activeImageId && <span className="wb-library-active-badge">Activa</span>}
                  <img src={img.data} alt={img.name} className="wb-library-thumbnail" />
                  <div className="wb-library-item-footer">
                    <span className="wb-library-item-name">{img.name}</span>
                    <button className="btn-icon" style={{ padding: 0, opacity: 0.5, flexShrink: 0 }} onClick={(e) => { e.stopPropagation(); removeFromLibrary(img.id); }}>
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
              ))}

              <button className="wb-sidebar-add-btn" onClick={() => addMoreRef.current?.click()}>
                <Plus size={13} /> Añadir imagen
              </button>
            </aside>

            {/* ÁREA DE TRABAJO */}
            <div className="wb-main-content">
              <div className="wb-instructions" style={{ marginBottom: '12px' }}>
                <Crop size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
                <strong>Imagen activa: {activeImage?.name}</strong> — Haz clic y arrastra para recortar una banda.
              </div>

              {/* Imagen activa */}
              {activeImage && (
                <div className="glass-panel" style={{ padding: '4px', display: 'inline-block', marginBottom: '24px', position: 'relative' }}>
                  <div style={{ position: 'relative', display: 'inline-block' }}>
                    <img ref={imgRef} src={activeImage.data} alt={activeImage.name} style={{ display: 'block', maxHeight: '50vh', maxWidth: '100%' }} draggable={false} />
                    <div className="wb-crop-overlay" onMouseDown={handleCropMouseDown} onMouseMove={handleCropMouseMove} onMouseUp={handleCropMouseUp} onMouseLeave={() => { setCropStart(null); setCropRect(null); }}>
                      {cropRect && <div className="wb-crop-box" style={{ left: `${cropRect.x * 100}%`, top: `${cropRect.y * 100}%`, width: `${cropRect.w * 100}%`, height: `${cropRect.h * 100}%` }} />}
                    </div>
                  </div>
                </div>
              )}

              {/* Bandas recortadas */}
              {strips.length > 0 && (
                <div style={{ marginBottom: '24px' }}>
                  <h4 className="section-title" style={{ marginBottom: '8px' }}>
                    <ImageIcon size={18} /> Bandas Recortadas
                  </h4>

                  {/* ═══ ENCABEZADO GLOBAL DE COLUMNAS ═══ */}
                  <div className="wb-global-header">
                    {/* Hueco para el label de proteína */}
                    <div style={{ width: '40px', flexShrink: 0 }} />

                    {/* Zona de arrastre de columnas */}
                    <div className="wb-global-columns-bar" ref={globalHeaderRef}>
                      {globalColumns.map((col) => (
                        <div
                          key={col.id}
                          className="wb-global-col-handle"
                          style={{ left: `${col.x}%` }}
                          onMouseDown={() => setDragItem({ type: 'column', id: col.id })}
                        >
                          <GripHorizontal size={16} style={{ opacity: 0.5, cursor: 'ew-resize', marginBottom: '2px' }} />
                          <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                            <input
                              className="wb-lane-header-input"
                              value={col.value}
                              onChange={(e) => updateGlobalColumnLabel(col.id, e.target.value)}
                              onMouseDown={(e) => e.stopPropagation()}
                            />
                            <button
                              className="btn-icon"
                              style={{ padding: 0, opacity: 0.5 }}
                              onClick={() => removeGlobalColumn(col.id)}
                              onMouseDown={(e) => e.stopPropagation()}
                            >
                              <Trash2 size={9} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Botón añadir grupo */}
                    <button className="add-btn" style={{ fontSize: '0.7rem', padding: '4px 10px', marginLeft: '8px', flexShrink: 0 }} onClick={addGlobalColumn}>
                      <Plus size={10} /> Grupo
                    </button>

                    {/* Hueco para kDa */}
                    <div style={{ width: '80px', flexShrink: 0 }} />
                  </div>

                  {/* Bandas */}
                  {strips.map((strip) => {
                    const srcImg = imageLibrary.find((img) => img.id === strip.sourceImageId);
                    return (
                      <div key={strip.id} className="glass-panel wb-strip-card" style={{ userSelect: dragItem ? 'none' : 'auto' }}>

                        {/* Nombre proteína + kDa estimado */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingRight: '12px', width: '40px', flexShrink: 0 }}>
                          <input
                            className="wb-editable-field"
                            style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontWeight: 700, fontSize: '0.95rem', textAlign: 'center', width: '24px', padding: '8px 0' }}
                            value={strip.protein}
                            onChange={(e) => updateStrip(strip.id, { protein: e.target.value })}
                          />
                          {estimateKda(strip.kdaMarkers, strip.targetY ?? 50) !== null && (
                            <div style={{ fontSize: '0.65rem', color: '#ff3333', fontWeight: 'bold', marginTop: '6px', writingMode: 'vertical-rl', transform: 'rotate(180deg)', textAlign: 'center' }}>
                              ~{estimateKda(strip.kdaMarkers, strip.targetY ?? 50)} kDa
                            </div>
                          )}
                        </div>

                        {/* Imagen + líneas guía + kDa markers */}
                        <div className="wb-strip-image-wrapper">
                          <div id={`strip-img-${strip.id}`} className="wb-strip-image-container">

                            {/* Imagen */}
                            <img src={strip.imageData} alt={strip.protein} className="wb-strip-image" draggable={false} />

                            {/* Líneas guía verticales desde columnas globales */}
                            {sortedColumns.map((col) => (
                              <div key={col.id} className="wb-guide-line" style={{ left: `${col.x}%` }}>
                                {/* Chip de intensidad + ratio flotante */}
                                <div className="wb-guide-chip">
                                  <div style={{ fontSize: '0.55rem', opacity: 0.85 }}>
                                    Int: {strip.laneIntensities?.[col.id]?.toLocaleString() ?? '—'}
                                  </div>
                                  {!strip.isHousekeeping && getRatioDisplay(strip, col)}
                                </div>
                              </div>
                            ))}

                            {/* Marcador de centro para kDa */}
                            <div className="wb-kda-draggable" style={{ top: `${strip.targetY ?? 50}%`, left: '10px' }} onMouseDown={() => setDragItem({ type: 'target', id: 'target', stripId: strip.id })}>
                              <div style={{ display: 'flex', alignItems: 'center', color: '#ff3333' }}>
                                <div style={{ fontWeight: 'bold', fontSize: '0.7rem', padding: '2px 4px', cursor: 'ns-resize', whiteSpace: 'nowrap', textShadow: '0 0 3px black' }}>
                                  Centro <GripVertical size={11} style={{ display: 'inline', verticalAlign: 'middle' }} />
                                </div>
                              </div>
                            </div>
                            <div style={{ position: 'absolute', top: `${strip.targetY ?? 50}%`, left: 0, width: '100%', height: 0, borderTop: '1px dashed #ff3333', pointerEvents: 'none', zIndex: 2 }} />

                            {/* kDa markers */}
                            <div style={{ position: 'absolute', top: 0, right: '-70px', width: '65px', height: '100%' }}>
                              {strip.kdaMarkers.map((kda) => (
                                <div key={kda.id} className="wb-kda-draggable" style={{ top: `${kda.y}%` }} onMouseDown={() => setDragItem({ type: 'kda', id: kda.id, stripId: strip.id })}>
                                  <div className="wb-kda-dash" />
                                  <input className="wb-editable-field" style={{ fontSize: '0.78rem', fontWeight: 600, width: '45px' }} value={kda.value} onChange={(e) => updateKda(strip.id, kda.id, e.target.value)} onMouseDown={(e) => e.stopPropagation()} />
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <button className="btn-icon" style={{ padding: 0, opacity: 0.4 }} onClick={() => removeKda(strip.id, kda.id)} onMouseDown={(e) => e.stopPropagation()}><Trash2 size={10} /></button>
                                    <GripVertical size={18} style={{ opacity: 0.5, cursor: 'ns-resize' }} />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Origen de imagen */}
                          {srcImg && (
                            <div style={{ fontSize: '0.58rem', color: 'var(--text-secondary)', marginTop: '4px', paddingRight: '70px', fontStyle: 'italic' }}>
                              Origen: {srcImg.name}
                            </div>
                          )}

                          {/* Botón añadir kDa */}
                          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '8px', paddingRight: '70px' }}>
                            <button className="add-btn" style={{ fontSize: '0.7rem', padding: '4px 12px' }} onClick={() => addKda(strip.id)}>
                              <Plus size={10} /> Añadir kDa
                            </button>
                          </div>
                        </div>

                        {/* Controles de banda */}
                        <div className="wb-strip-remove" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <label style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', marginRight: '8px' }}>
                            <input type="checkbox" checked={!!strip.isHousekeeping} onChange={() => setHousekeeping(strip.id)} />
                            Ref
                          </label>
                          <button className="btn-icon" onClick={() => startEditCrop(strip)} title="Reajustar recorte"><Crop size={16} /></button>
                          <button className="btn-icon" onClick={() => removeStrip(strip.id)} title="Eliminar banda"><Trash2 size={16} /></button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Vista previa exportable */}
              {strips.length > 0 && (
                <div>
                  <h4 className="section-title" style={{ marginBottom: '16px' }}>Vista Previa de Figura</h4>
                  <div id="wb-figure-export" className="wb-preview-container">
                    {/* Encabezado de columnas en la preview */}
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '2px' }}>
                      <div style={{ width: '40px', flexShrink: 0 }} />
                      <div style={{ flex: 1, position: 'relative', height: '14px' }}>
                        {sortedColumns.map((col) => (
                          <span key={col.id} className="wb-preview-lane-item" style={{ left: `${col.x}%` }}>{col.value}</span>
                        ))}
                      </div>
                      <div style={{ width: '65px', flexShrink: 0 }} />
                    </div>

                    {strips.map((strip) => (
                      <div key={strip.id} className="wb-preview-strip">
                        <div className="wb-preview-protein">{strip.protein}</div>
                        <div className="wb-preview-img-wrapper">
                          <img src={strip.imageData} alt={strip.protein} className="wb-preview-img" />
                          <div style={{ position: 'absolute', top: 0, right: '-65px', width: '60px', height: '100%' }}>
                            {strip.kdaMarkers.map((kda) => (
                              <div key={kda.id} className="wb-preview-kda-item-abs" style={{ top: `${kda.y}%` }}>
                                <div className="wb-preview-kda-dash" />
                                {kda.value}
                              </div>
                            ))}
                          </div>
                        </div>
                        <div style={{ width: '65px', flexShrink: 0 }} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>{/* fin wb-main-content */}
          </div>{/* fin wb-workspace-layout */}

          {/* Modal de reajuste */}
          {editingStripId && getEditSourceImage() && (
            <div className="wb-modal-overlay" onMouseDown={() => setEditingStripId(null)}>
              <div className="wb-modal-content" onMouseDown={(e) => e.stopPropagation()}>
                <h4 style={{ marginBottom: '16px' }}>Reajustar Recorte</h4>
                <div style={{ position: 'relative', display: 'inline-block', marginBottom: '16px' }}>
                  <img ref={editImgRef} src={getEditSourceImage().data} alt="Edición" style={{ display: 'block', maxHeight: '60vh', maxWidth: '100%' }} draggable={false} />
                  <div className="wb-crop-overlay" onMouseDown={handleEditCropMouseDown} onMouseMove={handleEditCropMouseMove} onMouseUp={handleEditCropMouseUp} onMouseLeave={() => setEditCropStart(null)}>
                    {editCropRect && <div className="wb-crop-box" style={{ left: `${editCropRect.x * 100}%`, top: `${editCropRect.y * 100}%`, width: `${editCropRect.w * 100}%`, height: `${editCropRect.h * 100}%` }} />}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                  <button className="btn" onClick={() => setEditingStripId(null)}>Cancelar</button>
                  <button className="btn btn-primary" onClick={saveEditedCrop}>Guardar Reajuste</button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
