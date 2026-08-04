import React, { useState, useRef, useCallback, useEffect } from 'react';
import { UploadCloud, Plus, Trash2, Download, Image as ImageIcon, Crop, GripHorizontal, BarChart2, BookOpen } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import './WBReport.css';
import WBReportFAQ from './WBReportFAQ';
import { calculateLaneIntensitiesWithBackground, recalcAllStrips, normalizedRatio } from '../utils/westernBlotAnalysis';
import StripCard from './wbreport/StripCard';
import FigurePreview from './wbreport/FigurePreview';

export default function WBReport() {
  const [imageLibrary, setImageLibrary] = useState([]);
  const [activeImageId, setActiveImageId] = useState(null);
  const [globalColumns, setGlobalColumns] = useState([
    { id: uuidv4(), value: 'Control', x: 25 },
    { id: uuidv4(), value: 'Treated', x: 75 },
  ]);
  const [strips, setStrips] = useState([]);
  const [cropStart, setCropStart] = useState(null);
  const [cropRect, setCropRect] = useState(null);
  const [dragItem, setDragItem] = useState(null);
  const [editingStripId, setEditingStripId] = useState(null);
  const [editCropStart, setEditCropStart] = useState(null);
  const [editCropRect, setEditCropRect] = useState(null);
  const [showFaq, setShowFaq] = useState(false);

  // Estados cuantitativos avanzados
  const [modality, setModality] = useState('chemiluminescence');
  const [normMode, setNormMode] = useState('totalProtein');
  const [grayMode, setGrayMode] = useState('average');

  const fileRef = useRef(null);
  const addMoreRef = useRef(null);
  const imgRef = useRef(null);
  const editImgRef = useRef(null);
  const previousDragItem = useRef(null);
  const globalHeaderRef = useRef(null);

  const activeImage = imageLibrary.find((img) => img.id === activeImageId) ?? null;
  const normStrip = strips.find((s) => s.normRole === 'totalProtein' || s.normRole === 'housekeeping' || s.isHousekeeping) || null;

  /* ─── Recalcular al soltar columna ─── */
  useEffect(() => {
    const prev = previousDragItem.current;
    if (prev?.type === 'column' && dragItem === null)
      setStrips((s) => recalcAllStrips(s, globalColumns, grayMode));
    previousDragItem.current = dragItem;
  }, [dragItem, globalColumns, grayMode]);

  /* ─── Drag global ─── */
  useEffect(() => {
    const onMove = (e) => {
      if (!dragItem) return;
      if (dragItem.type === 'column') {
        const header = globalHeaderRef.current;
        if (!header) return;
        const rect = header.getBoundingClientRect();
        let x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
        setGlobalColumns((cols) => cols.map((c) => c.id === dragItem.id ? { ...c, x } : c));
      } else {
        const container = document.getElementById(`strip-img-${dragItem.stripId}`);
        if (!container) return;
        const rect = container.getBoundingClientRect();
        let y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
        if (dragItem.type === 'kda')
          setStrips((prev) => prev.map((s) => s.id !== dragItem.stripId ? s :
            { ...s, kdaMarkers: s.kdaMarkers.map((k) => k.id === dragItem.id ? { ...k, y } : k) }));
        else if (dragItem.type === 'target')
          setStrips((prev) => prev.map((s) => s.id !== dragItem.stripId ? s : { ...s, targetY: y }));
      }
    };
    const onUp = () => setDragItem(null);
    if (dragItem) { window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp); }
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [dragItem]);

  /* ─── Librería ─── */
  const loadFiles = (files) => {
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const newImg = { id: uuidv4(), name: file.name, data: ev.target.result };
        setImageLibrary((prev) => { if (prev.length === 0) setActiveImageId(newImg.id); return [...prev, newImg]; });
      };
      reader.readAsDataURL(file);
    });
  };
  const handleFileUpload = (e) => { if (e.target.files.length > 0) loadFiles(e.target.files); e.target.value = ''; };
  const removeFromLibrary = (imgId) => {
    if (strips.some((s) => s.sourceImageId === imgId) && !window.confirm('Esta imagen tiene bandas asociadas. ¿Eliminarla?')) return;
    setImageLibrary((prev) => { const next = prev.filter((img) => img.id !== imgId); if (activeImageId === imgId) setActiveImageId(next[0]?.id ?? null); return next; });
  };

  /* ─── Recorte ─── */
  const getRelPos = (e) => {
    const rect = imgRef.current.getBoundingClientRect();
    return { x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)), y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)) };
  };
  const handleCropMouseDown = (e) => { setCropStart(getRelPos(e)); setCropRect(null); };
  const handleCropMouseMove = (e) => { if (!cropStart) return; const p = getRelPos(e); setCropRect({ x: Math.min(cropStart.x, p.x), y: Math.min(cropStart.y, p.y), w: Math.abs(p.x - cropStart.x), h: Math.abs(p.y - cropStart.y) }); };
  const handleCropMouseUp = () => {
    if (cropRect && cropRect.w > 0.01 && cropRect.h > 0.01 && activeImage) {
      const img = imgRef.current;
      const canvas = document.createElement('canvas');
      const sx = Math.round(cropRect.x * img.naturalWidth), sy = Math.round(cropRect.y * img.naturalHeight);
      const sw = Math.round(cropRect.w * img.naturalWidth), sh = Math.round(cropRect.h * img.naturalHeight);
      canvas.width = sw; canvas.height = sh;
      const ctx = canvas.getContext('2d'); ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
      const laneIntensities = calculateLaneIntensitiesWithBackground(canvas, globalColumns, grayMode);
      setStrips((prev) => [...prev, {
        id: uuidv4(), sourceImageId: activeImageId,
        protein: `Proteína ${prev.length + 1}`,
        imageData: canvas.toDataURL('image/png'),
        crop: cropRect, laneIntensities,
        isHousekeeping: false, normRole: 'none', targetY: 50,
        brightness: 0, contrast: 0,
        quantOpen: false,
        kdaMarkers: [{ id: uuidv4(), value: '50 kDa', y: 30 }, { id: uuidv4(), value: '25 kDa', y: 70 }],
      }]);
    }
    setCropStart(null); setCropRect(null);
  };

  /* ─── CRUD Bandas ─── */
  const updateStrip = (id, updates) => setStrips(strips.map((s) => s.id === id ? { ...s, ...updates } : s));
  const removeStrip = (id) => setStrips(strips.filter((s) => s.id !== id));
  const updateKda = (sid, kid, value) => setStrips(strips.map((s) => s.id !== sid ? s : { ...s, kdaMarkers: s.kdaMarkers.map((k) => k.id === kid ? { ...k, value } : k) }));
  const addKda = (sid) => setStrips(strips.map((s) => s.id !== sid ? s : { ...s, kdaMarkers: [...s.kdaMarkers, { id: uuidv4(), value: '-- kDa', y: 50 }] }));
  const removeKda = (sid, kid) => setStrips(strips.map((s) => s.id !== sid ? s : { ...s, kdaMarkers: s.kdaMarkers.filter((k) => k.id !== kid) }));
  const setNormRole = (id, role) => {
    if (role !== 'none') setNormMode(role);
    setStrips(strips.map((s) => ({
      ...s,
      normRole: s.id === id ? role : (role !== 'none' ? 'none' : s.normRole),
      isHousekeeping: s.id === id ? role === 'housekeeping' : (role !== 'none' ? false : s.isHousekeeping),
    })));
  };
  const handleNormModeChange = (mode) => {
    setNormMode(mode);
    if (mode === 'none') {
      setStrips(strips.map((s) => ({ ...s, normRole: 'none', isHousekeeping: false })));
    } else {
      setStrips(strips.map((s) => {
        const isRef = s.normRole !== 'none' || s.isHousekeeping;
        return {
          ...s,
          normRole: isRef ? mode : 'none',
          isHousekeeping: isRef ? mode === 'housekeeping' : false,
        };
      }));
    }
  };

  /* ─── CRUD Columnas Globales ─── */
  const addGlobalColumn = () => {
    const newCol = { id: uuidv4(), value: 'Grupo', x: 50 };
    const newCols = [...globalColumns, newCol];
    setGlobalColumns(newCols);
    setTimeout(() => setStrips((s) => recalcAllStrips(s, newCols, grayMode)), 50);
  };
  const removeGlobalColumn = (colId) => {
    const newCols = globalColumns.filter((c) => c.id !== colId);
    setGlobalColumns(newCols);
    setStrips((s) => recalcAllStrips(s.map((strip) => { const { [colId]: _, ...rest } = strip.laneIntensities ?? {}; return { ...strip, laneIntensities: rest }; }), newCols, grayMode));
  };
  const updateGlobalColumnLabel = (colId, value) => setGlobalColumns((cols) => cols.map((c) => c.id === colId ? { ...c, value } : c));

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
      const sx = Math.round(editCropRect.x * img.naturalWidth), sy = Math.round(editCropRect.y * img.naturalHeight);
      const sw = Math.round(editCropRect.w * img.naturalWidth), sh = Math.round(editCropRect.h * img.naturalHeight);
      canvas.width = sw; canvas.height = sh;
      const ctx = canvas.getContext('2d'); ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
      const laneIntensities = calculateLaneIntensitiesWithBackground(canvas, globalColumns, grayMode);
      setStrips(strips.map((s) => s.id !== editingStripId ? s : { ...s, imageData: canvas.toDataURL('image/png'), crop: editCropRect, laneIntensities }));
    }
    setEditingStripId(null); setEditCropRect(null);
  };
  const getEditSourceImage = () => { const s = strips.find((s) => s.id === editingStripId); return s ? (imageLibrary.find((img) => img.id === s.sourceImageId) ?? null) : null; };

  /* ─── Exportar PNG ─── */
  const exportFigure = useCallback(() => {
    const el = document.getElementById('wb-figure-export');
    if (!el) return;
    import('html-to-image').then((mod) => mod.toPng(el, { backgroundColor: '#ffffff', pixelRatio: 3 }).then((dataUrl) => {
      const a = document.createElement('a'); a.href = dataUrl; a.download = 'western_blot_figure.png';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    })).catch(() => alert('Error exportando figura'));
  }, []);

  /* ─── Exportar CSV (con metadatos de auditoría) ─── */
  const exportCSV = useCallback(() => {
    const sortedCols = [...globalColumns].sort((a, b) => a.x - b.x);
    const meta = [
      `# WBReport v2.0 - Audit Trail`,
      `# fecha,${new Date().toISOString()}`,
      `# modalidad_deteccion,${modality}`,
      `# modo_escala_grises,${grayMode}`,
      `# metodo_sustraccion_fondo,valle-a-valle_1d`,
      `# umbral_alerta_saturacion,1.0%`,
      `# normalizacion_activa,${normMode}`,
      `# nota_integridad,ajustes brillo/contraste solo para visualizacion; densitometria e integracion AUC ejecutada sobre pixeles crudos ImageData inmutables`,
    ].join('\n');
    const header = 'Banda,Carril,Volumen_Neto,Volumen_Crudo,Fondo_Estimado,Fraccion_Saturada,Ratio_Normalizado,Estado_Saturacion';
    const rows = [];
    strips.forEach((strip) => {
      sortedCols.forEach((col) => {
        const li = strip.laneIntensities?.[col.id] ?? {};
        const net = li.net ?? (typeof li === 'number' ? li : 0);
        const raw = li.raw ?? (typeof li === 'number' ? li : 0);
        const bg = li.background ?? 0;
        const satFrac = li.saturatedFraction ?? 0;
        const satFlag = satFrac > 0.01 ? `ADVERTENCIA: ${(satFrac * 100).toFixed(1)}% px saturados` : 'OK';
        const ratio = normStrip ? (strip.id === normStrip.id ? '1.000' : normalizedRatio(strip, col, normStrip) ?? 'N/A') : 'N/A';
        rows.push(`"${strip.protein}","${col.value}",${net},${raw},${bg},${satFrac},${ratio},"${satFlag}"`);
      });
    });
    const blob = new Blob([`${meta}\n${header}\n${rows.join('\n')}`], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'wb_quantification_audit_trail.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }, [strips, globalColumns, normStrip, modality, grayMode, normMode]);

  const sortedColumns = [...globalColumns].sort((a, b) => a.x - b.x);
  const boundaries = [];
  for (let i = 0; i < sortedColumns.length - 1; i++) {
    boundaries.push((sortedColumns[i].x + sortedColumns[i + 1].x) / 2);
  }

  return (
    <div className="wb-report-container">
      {imageLibrary.length === 0 ? (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '16px', flexWrap: 'wrap' }}>
            <div className="wb-instructions" style={{ margin: 0, flex: 1, minWidth: '280px' }}>
              <strong>Modo Reporte de Western Blot:</strong> Sube una o más imágenes de WB. Selecciona la imagen activa en la librería lateral y recorta cada banda individualmente.
            </div>
            <button className="btn btn-secondary" onClick={() => setShowFaq(true)} style={{ borderColor: '#818cf8', color: '#818cf8', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
              <BookOpen size={15} /> Guía Científica y FAQ
            </button>
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

          {/* Barra de acciones y Configuración Cuantitativa */}
          <div className="wb-report-actions" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <button className="btn btn-danger" onClick={() => { setImageLibrary([]); setActiveImageId(null); setStrips([]); }}>Reiniciar todo</button>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                <button className="btn btn-secondary" onClick={() => setShowFaq(true)} style={{ borderColor: '#818cf8', color: '#818cf8', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                  <BookOpen size={14} /> Guía Científica y FAQ
                </button>
                {strips.length > 0 && (
                  <>
                    <button className="btn btn-primary" onClick={exportFigure}><Download size={14} /> Exportar Figura PNG</button>
                    <button className="btn btn-secondary" onClick={exportCSV}><BarChart2 size={14} /> Descargar CSV de Auditoría</button>
                  </>
                )}
              </div>
            </div>

            {/* Cabecera cuantitativa y selectores de auditoría */}
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', background: 'rgba(255,255,255,0.03)', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)', alignItems: 'center', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Detección:</span>
                <select value={modality} onChange={(e) => setModality(e.target.value)} style={{ background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '4px 8px', fontSize: '0.8rem' }}>
                  <option value="chemiluminescence">Quimioluminiscencia (ECL)</option>
                  <option value="fluorescence">Fluorescencia (IR/RGB)</option>
                  <option value="colorimetric">Colorimétrica / DAB</option>
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Escala de Grises:</span>
                <select value={grayMode} onChange={(e) => setGrayMode(e.target.value)} style={{ background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '4px 8px', fontSize: '0.8rem' }}>
                  <option value="average">Promedio RGB</option>
                  <option value="rec709">Luminancia (Rec. 709)</option>
                  <option value="green">Canal Verde (G)</option>
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Normalización:</span>
                <select value={normMode} onChange={(e) => handleNormModeChange(e.target.value)} style={{ background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '4px 8px', fontSize: '0.8rem' }}>
                  <option value="totalProtein">Proteína Total (Recomendado)</option>
                  <option value="housekeeping">Proteína Housekeeping (Actina/Tubulina)</option>
                  <option value="none">Sin Normalizar (Solo vol. netos)</option>
                </select>
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px', color: '#10b981', fontSize: '0.75rem', fontWeight: 600 }}>
                ✓ Fondo: Valle-a-Valle 1D (Inmutable)
              </div>
            </div>
          </div>

          <div className="wb-workspace-layout">
            {/* SIDEBAR */}
            <aside className="wb-sidebar">
              <div className="wb-sidebar-header">
                <span className="wb-sidebar-title">Librería</span>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>{imageLibrary.length} img</span>
              </div>
              {imageLibrary.map((img) => (
                <div key={img.id} className={`wb-library-item${img.id === activeImageId ? ' active' : ''}`} onClick={() => setActiveImageId(img.id)} title={img.name}>
                  {img.id === activeImageId && <span className="wb-library-active-badge">Activa</span>}
                  <img src={img.data} alt={img.name} className="wb-library-thumbnail" />
                  <div className="wb-library-item-footer">
                    <span className="wb-library-item-name">{img.name}</span>
                    <button className="btn-icon" style={{ padding: 0, opacity: 0.5, flexShrink: 0 }} onClick={(e) => { e.stopPropagation(); removeFromLibrary(img.id); }}><Trash2 size={11} /></button>
                  </div>
                </div>
              ))}
              <button className="wb-sidebar-add-btn" onClick={() => addMoreRef.current?.click()}><Plus size={13} /> Añadir imagen</button>
            </aside>

            {/* ÁREA DE TRABAJO */}
            <div className="wb-main-content">
              <div className="wb-instructions" style={{ marginBottom: '12px' }}>
                <Crop size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
                <strong>Imagen activa: {activeImage?.name}</strong> — Haz clic y arrastra para recortar una banda.
              </div>

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

              {strips.length > 0 && (
                <div style={{ marginBottom: '24px' }}>
                  <h4 className="section-title" style={{ marginBottom: '8px' }}><ImageIcon size={18} /> Bandas Recortadas</h4>

                  {/* ENCABEZADO GLOBAL */}
                  <div className="wb-global-header">
                    <div style={{ width: '40px', flexShrink: 0 }} />
                    <div className="wb-global-columns-bar" ref={globalHeaderRef}>
                      {globalColumns.map((col) => (
                        <div key={col.id} className="wb-global-col-handle" style={{ left: `${col.x}%` }} onMouseDown={() => setDragItem({ type: 'column', id: col.id })}>
                          <GripHorizontal size={16} style={{ opacity: 0.5, cursor: 'ew-resize', marginBottom: '2px' }} />
                          <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                            <input className="wb-lane-header-input" value={col.value} onChange={(e) => updateGlobalColumnLabel(col.id, e.target.value)} onMouseDown={(e) => e.stopPropagation()} />
                            <button className="btn-icon" style={{ padding: 0, opacity: 0.5 }} onClick={() => removeGlobalColumn(col.id)} onMouseDown={(e) => e.stopPropagation()}><Trash2 size={9} /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <button className="add-btn" style={{ fontSize: '0.7rem', padding: '4px 10px', marginLeft: '8px', flexShrink: 0 }} onClick={addGlobalColumn}><Plus size={10} /> Grupo</button>
                    <div style={{ width: '80px', flexShrink: 0 }} />
                  </div>

                  {/* TARJETAS DE BANDAS */}
                  {strips.map((strip) => {
                    const srcImg = imageLibrary.find((img) => img.id === strip.sourceImageId);
                    return (
                      <StripCard
                        key={strip.id}
                        strip={strip}
                        srcImg={srcImg}
                        sortedColumns={sortedColumns}
                        boundaries={boundaries}
                        normStrip={normStrip}
                        dragItem={dragItem}
                        globalColumns={globalColumns}
                        grayMode={grayMode}
                        onSetDragItem={setDragItem}
                        onUpdateStrip={updateStrip}
                        onUpdateKda={updateKda}
                        onAddKda={addKda}
                        onRemoveKda={removeKda}
                        onSetNormRole={setNormRole}
                        onStartEditCrop={startEditCrop}
                        onRemoveStrip={removeStrip}
                      />
                    );
                  })}
                </div>
              )}

              {/* Vista previa exportable */}
              {strips.length > 0 && (
                <div>
                  <h4 className="section-title" style={{ marginBottom: '16px' }}>Vista Previa de Figura</h4>
                  <FigurePreview strips={strips} sortedColumns={sortedColumns} />
                </div>
              )}
            </div>
          </div>

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

      {/* Modal de Fundamentos Científicos y FAQ */}
      <WBReportFAQ isOpen={showFaq} onClose={() => setShowFaq(false)} />
    </div>
  );
}