import React, { useState, useRef, useCallback, useEffect } from 'react';
import { UploadCloud, Plus, Trash2, Download, Image as ImageIcon, Crop, GripHorizontal, GripVertical } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import './WBReport.css';

export default function WBReport() {
  const [sourceImage, setSourceImage] = useState(null);
  const [strips, setStrips] = useState([]);
  const [cropStart, setCropStart] = useState(null);
  const [cropRect, setCropRect] = useState(null);
  const [dragItem, setDragItem] = useState(null); // { stripId, type: 'lane'|'kda', itemId }
  
  const fileRef = useRef(null);
  const imgRef = useRef(null);

  useEffect(() => {
    const handleGlobalMouseMove = (e) => {
      if (!dragItem) return;
      const container = document.getElementById(`strip-img-${dragItem.stripId}`);
      if (!container) return;
      const rect = container.getBoundingClientRect();

      if (dragItem.type === 'lane') {
        let x = ((e.clientX - rect.left) / rect.width) * 100;
        x = Math.max(0, Math.min(100, x));
        setStrips(prev => prev.map(s => {
          if (s.id !== dragItem.stripId) return s;
          return { ...s, laneLabels: s.laneLabels.map(l => l.id === dragItem.itemId ? { ...l, x } : l) };
        }));
      } else if (dragItem.type === 'kda') {
        let y = ((e.clientY - rect.top) / rect.height) * 100;
        y = Math.max(0, Math.min(100, y));
        setStrips(prev => prev.map(s => {
          if (s.id !== dragItem.stripId) return s;
          return { ...s, kdaMarkers: s.kdaMarkers.map(k => k.id === dragItem.itemId ? { ...k, y } : k) };
        }));
      }
    };

    const handleGlobalMouseUp = () => setDragItem(null);

    if (dragItem) {
      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('mouseup', handleGlobalMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [dragItem]);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setSourceImage({ name: file.name, data: ev.target.result });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const getRelPos = (e) => {
    const rect = imgRef.current.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
    };
  };

  const handleCropMouseDown = (e) => {
    const pos = getRelPos(e);
    setCropStart(pos);
    setCropRect(null);
  };

  const handleCropMouseMove = (e) => {
    if (!cropStart) return;
    const pos = getRelPos(e);
    setCropRect({
      x: Math.min(cropStart.x, pos.x),
      y: Math.min(cropStart.y, pos.y),
      w: Math.abs(pos.x - cropStart.x),
      h: Math.abs(pos.y - cropStart.y),
    });
  };

  const handleCropMouseUp = () => {
    if (cropRect && cropRect.w > 0.01 && cropRect.h > 0.01) {
      const img = imgRef.current;
      const canvas = document.createElement('canvas');
      const natW = img.naturalWidth;
      const natH = img.naturalHeight;
      const sx = Math.round(cropRect.x * natW);
      const sy = Math.round(cropRect.y * natH);
      const sw = Math.round(cropRect.w * natW);
      const sh = Math.round(cropRect.h * natH);
      canvas.width = sw;
      canvas.height = sh;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
      const croppedData = canvas.toDataURL('image/png');

      const newStrip = {
        id: uuidv4(),
        protein: `Proteína ${strips.length + 1}`,
        imageData: croppedData,
        laneLabels: [
          { id: uuidv4(), value: 'Control', x: 25 },
          { id: uuidv4(), value: 'Treated', x: 75 }
        ],
        kdaMarkers: [
          { id: uuidv4(), value: '50 kDa', y: 30 },
          { id: uuidv4(), value: '25 kDa', y: 70 }
        ],
      };
      setStrips([...strips, newStrip]);
    }
    setCropStart(null);
    setCropRect(null);
  };

  const updateStrip = (id, updates) => {
    setStrips(strips.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const removeStrip = (id) => {
    setStrips(strips.filter(s => s.id !== id));
  };

  const updateLaneLabel = (stripId, itemId, value) => {
    setStrips(strips.map(s => {
      if (s.id !== stripId) return s;
      return { ...s, laneLabels: s.laneLabels.map(l => l.id === itemId ? { ...l, value } : l) };
    }));
  };

  const addLaneLabel = (stripId) => {
    setStrips(strips.map(s => {
      if (s.id !== stripId) return s;
      return { ...s, laneLabels: [...s.laneLabels, { id: uuidv4(), value: 'Grupo', x: 50 }] };
    }));
  };

  const removeLaneLabel = (stripId, itemId) => {
    setStrips(strips.map(s => {
      if (s.id !== stripId) return s;
      return { ...s, laneLabels: s.laneLabels.filter(l => l.id !== itemId) };
    }));
  };

  const updateKda = (stripId, kdaId, value) => {
    setStrips(strips.map(s => {
      if (s.id !== stripId) return s;
      return { ...s, kdaMarkers: s.kdaMarkers.map(k => k.id === kdaId ? { ...k, value } : k) };
    }));
  };

  const addKda = (stripId) => {
    setStrips(strips.map(s => {
      if (s.id !== stripId) return s;
      return { ...s, kdaMarkers: [...s.kdaMarkers, { id: uuidv4(), value: '-- kDa', y: 50 }] };
    }));
  };

  const removeKda = (stripId, kdaId) => {
    setStrips(strips.map(s => {
      if (s.id !== stripId) return s;
      return { ...s, kdaMarkers: s.kdaMarkers.filter(k => k.id !== kdaId) };
    }));
  };

  const exportFigure = useCallback(() => {
    const el = document.getElementById('wb-figure-export');
    if (!el) return;
    import('html-to-image').then(module => {
      module.toPng(el, { backgroundColor: '#ffffff', pixelRatio: 3 }).then(dataUrl => {
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = 'western_blot_figure.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      });
    }).catch(() => {
      alert('Error exportando figura');
    });
  }, []);

  return (
    <div className="wb-report-container">
      {!sourceImage ? (
        <div>
          <div className="wb-instructions" style={{marginBottom: '16px'}}>
            <strong>Modo Reporte de Western Blot:</strong> Sube tu imagen completa de WB y recorta cada banda individualmente. Agrega nombre de proteína, etiquetas de carril y marcadores de peso molecular deslizables para alinearlos perfectamente con tus bandas.
          </div>
          <div className="dropzone" onClick={() => fileRef.current?.click()} style={{maxWidth: '500px'}}>
            <UploadCloud size={32} style={{marginBottom: '12px'}} />
            <span style={{fontSize: '0.9rem', textAlign: 'center'}}>Sube tu imagen de Western Blot completa</span>
            <input type="file" ref={fileRef} accept="image/*" style={{display: 'none'}} onChange={handleFileUpload} />
          </div>
        </div>
      ) : (
        <>
          <div className="wb-instructions" style={{marginBottom: '12px'}}>
            <Crop size={14} style={{display: 'inline', verticalAlign: 'middle', marginRight: '4px'}} />
            <strong>Haz clic y arrastra</strong> sobre la imagen base para recortar una banda. Luego, en la parte inferior podrás arrastrar lateralmente los nombres de los grupos para que coincidan con los pocillos, y verticalmente los kDa.
          </div>

          <div className="wb-report-actions">
            <button className="btn btn-danger" onClick={() => { setSourceImage(null); setStrips([]); }}>Cambiar Imagen Base</button>
            {strips.length > 0 && ( /* dummy comment to align */
              <button className="btn btn-primary" onClick={exportFigure}>
                <Download size={14}/> Exportar Figura PNG
              </button>
            )}
          </div>

          <div className="glass-panel" style={{padding: '4px', display: 'inline-block', marginBottom: '24px', position: 'relative'}}>
            <div style={{position: 'relative', display: 'inline-block'}}>
              <img ref={imgRef} src={sourceImage.data} alt={sourceImage.name} style={{display: 'block', maxHeight: '50vh', maxWidth: '100%'}} draggable={false} />
              <div className="wb-crop-overlay" onMouseDown={handleCropMouseDown} onMouseMove={handleCropMouseMove} onMouseUp={handleCropMouseUp} onMouseLeave={() => { setCropStart(null); setCropRect(null); }}>
                {cropRect && (
                  <div className="wb-crop-box" style={{ left: `${cropRect.x * 100}%`, top: `${cropRect.y * 100}%`, width: `${cropRect.w * 100}%`, height: `${cropRect.h * 100}%` }} />
                )}
              </div>
            </div>
          </div>

          {strips.length > 0 && (
            <div style={{marginBottom: '24px'}}>
              <h4 className="section-title" style={{marginBottom: '16px'}}>
                <ImageIcon size={18}/> Bandas Recortadas — Arrastra el texto para alinearlo
              </h4>

              {strips.map((strip) => (
                <div key={strip.id} className="glass-panel wb-strip-card" style={{userSelect: dragItem ? 'none' : 'auto'}}>
                  <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', paddingRight: '12px'}}>
                    <input className="wb-editable-field" style={{writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontWeight: 700, fontSize: '0.95rem', textAlign: 'center', width: '24px', padding: '8px 0'}} value={strip.protein} onChange={e => updateStrip(strip.id, { protein: e.target.value })} />
                  </div>

                  <div className="wb-strip-image-wrapper">
                    <div id={`strip-img-${strip.id}`} className="wb-strip-image-container">
                      {strip.laneLabels.map(lane => (
                        <div key={lane.id} className="wb-lane-draggable" style={{left: `${lane.x}%`}} onMouseDown={(e) => setDragItem({ stripId: strip.id, type: 'lane', itemId: lane.id })}>
                          <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
                            <GripHorizontal size={20} style={{opacity: 0.5, cursor: 'ew-resize', marginBottom: '4px'}} title="Arrastrar para alinear" />
                            <div style={{display: 'flex', alignItems: 'center'}}>
                              <input className="wb-lane-header-input" value={lane.value} onChange={e => updateLaneLabel(strip.id, lane.id, e.target.value)} onMouseDown={e => e.stopPropagation()} />
                              <button className="btn-icon" style={{padding: '0', opacity: 0.5}} onClick={() => removeLaneLabel(strip.id, lane.id)} title="Eliminar carril" onMouseDown={e => e.stopPropagation()}><Trash2 size={10}/></button>
                            </div>
                          </div>
                        </div>
                      ))}
                      <img src={strip.imageData} alt={strip.protein} className="wb-strip-image" draggable={false} />
                      
                      {/* Contenedor absoluto para kDa que iguala la altura de la imagen */}
                      <div style={{position: 'absolute', top: 0, right: '-70px', width: '65px', height: '100%'}}>
                        {strip.kdaMarkers.map(kda => (
                          <div key={kda.id} className="wb-kda-draggable" style={{top: `${kda.y}%`}} onMouseDown={(e) => setDragItem({ stripId: strip.id, type: 'kda', itemId: kda.id })}>
                            <div className="wb-kda-dash"></div>
                            <input className="wb-editable-field" style={{fontSize: '0.78rem', fontWeight: 600, width: '45px'}} value={kda.value} onChange={e => updateKda(strip.id, kda.id, e.target.value)} onMouseDown={e => e.stopPropagation()} />
                            <div style={{display: 'flex', alignItems: 'center', gap: '4px'}}>
                              <button className="btn-icon" style={{padding: '0', opacity: 0.4}} onClick={() => removeKda(strip.id, kda.id)} onMouseDown={e => e.stopPropagation()}><Trash2 size={10}/></button>
                              <GripVertical size={20} style={{opacity: 0.5, cursor: 'ns-resize'}} title="Arrastrar para alinear" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Botones de acción centrados debajo de la imagen */}
                    <div style={{display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '16px', paddingRight: '70px'}}>
                      <button className="add-btn" style={{fontSize: '0.7rem', padding: '4px 12px'}} onClick={() => addLaneLabel(strip.id)}><Plus size={10}/> Añadir Grupo</button>
                      <button className="add-btn" style={{fontSize: '0.7rem', padding: '4px 12px'}} onClick={() => addKda(strip.id)}><Plus size={10}/> Añadir kDa</button>
                    </div>
                  </div>

                  <div className="wb-strip-remove">
                    <button className="btn-icon" onClick={() => removeStrip(strip.id)} title="Eliminar banda"><Trash2 size={16}/></button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {strips.length > 0 && (
            <div>
              <h4 className="section-title" style={{marginBottom: '16px'}}>Vista Previa de Figura</h4>
              <div id="wb-figure-export" className="wb-preview-container">
                {strips.map(strip => (
                  <div key={strip.id} className="wb-preview-strip">
                    <div className="wb-preview-protein">{strip.protein}</div>
                    
                    <div className="wb-preview-img-wrapper">
                      <div className="wb-preview-lanes-container">
                        {strip.laneLabels.map(lane => (
                          <span key={lane.id} className="wb-preview-lane-item" style={{left: `${lane.x}%`}}>{lane.value}</span>
                        ))}
                      </div>
                      <img src={strip.imageData} alt={strip.protein} className="wb-preview-img" />
                      <div style={{position: 'absolute', top: 0, right: '-65px', width: '60px', height: '100%'}}>
                        {strip.kdaMarkers.map(kda => (
                          <div key={kda.id} className="wb-preview-kda-item-abs" style={{top: `${kda.y}%`}}>
                            <div className="wb-preview-kda-dash"></div>
                            {kda.value}
                          </div>
                        ))}
                      </div>
                    </div>
                    {/* Add spacer to accommodate absolute kDa markers on the right without overflow issues */}
                    <div style={{width: '65px'}}></div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
