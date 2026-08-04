import { Plus, Trash2, GripVertical, BarChart2, ChevronDown, ChevronUp, RotateCcw, Crop } from 'lucide-react';
import { estimateKda, getCssFilter } from '../../utils/westernBlotAnalysis';
import PeaksChart from './PeaksChart';
import IntensityBars from './IntensityBars';

export default function StripCard({
  strip,
  srcImg,
  sortedColumns,
  boundaries,
  normStrip,
  dragItem,
  globalColumns,
  grayMode,
  onSetDragItem,
  onUpdateStrip,
  onUpdateKda,
  onAddKda,
  onRemoveKda,
  onSetNormRole,
  onStartEditCrop,
  onRemoveStrip,
}) {
  const cssFilter = getCssFilter(strip.brightness, strip.contrast);

  const getRatioDisplay = (col) => {
    if (!normStrip || strip.id === normStrip.id) return null;
    const t = strip.laneIntensities?.[col.id]?.net ?? (typeof strip.laneIntensities?.[col.id] === 'number' ? strip.laneIntensities[col.id] : null);
    const h = normStrip.laneIntensities?.[col.id]?.net ?? (typeof normStrip.laneIntensities?.[col.id] === 'number' ? normStrip.laneIntensities[col.id] : null);
    if (t === null || h === null || h === 0) return null;
    return <div style={{ color: '#ffcc00', fontWeight: 'bold', fontSize: '0.65rem', textShadow: '0 0 2px rgba(0,0,0,0.8)' }}>Rat: {(t / h).toFixed(2)}</div>;
  };

  const estimatedKda = estimateKda(strip.kdaMarkers, strip.targetY ?? 50);

  return (
    <div className="glass-panel wb-strip-card" style={{ userSelect: dragItem ? 'none' : 'auto' }}>

      {/* Nombre proteína + kDa estimado */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingRight: '12px', width: '40px', flexShrink: 0 }}>
        <input className="wb-editable-field" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontWeight: 700, fontSize: '0.95rem', textAlign: 'center', width: '24px', padding: '8px 0' }} value={strip.protein} onChange={(e) => onUpdateStrip(strip.id, { protein: e.target.value })} />
        {estimatedKda !== null && (
          <div style={{ fontSize: '0.65rem', color: '#ff3333', fontWeight: 'bold', marginTop: '6px', writingMode: 'vertical-rl', transform: 'rotate(180deg)', textAlign: 'center' }}>
            ~{estimatedKda} kDa
          </div>
        )}
      </div>

      {/* Imagen + guías + kDa */}
      <div className="wb-strip-image-wrapper">
        <div id={`strip-img-${strip.id}`} className="wb-strip-image-container">
          <img src={strip.imageData} alt={strip.protein} className="wb-strip-image" draggable={false} style={{ filter: cssFilter }} />
          {sortedColumns.map((col) => {
            const li = strip.laneIntensities?.[col.id];
            const val = li?.net ?? (typeof li === 'number' ? li : null);
            return (
              <div key={col.id} className="wb-guide-line" style={{ left: `${col.x}%` }}>
                <div className="wb-guide-chip">
                  <div style={{ fontSize: '0.55rem', opacity: 0.85 }}>Int: {val !== null ? val.toLocaleString() : '—'}</div>
                  {(!normStrip || strip.id !== normStrip.id) && getRatioDisplay(col)}
                </div>
              </div>
            );
          })}
          {boundaries.map((bx, idx) => (
            <div key={idx} className="wb-lane-boundary-line" style={{ left: `${bx}%` }} title="Límite de carril (Punto medio automatizado)" />
          ))}
          <div className="wb-kda-draggable" style={{ top: `${strip.targetY ?? 50}%`, left: '10px' }} onMouseDown={() => onSetDragItem({ type: 'target', id: 'target', stripId: strip.id })}>
            <div style={{ display: 'flex', alignItems: 'center', color: '#ff3333' }}>
              <div style={{ fontWeight: 'bold', fontSize: '0.7rem', padding: '2px 4px', cursor: 'ns-resize', whiteSpace: 'nowrap', textShadow: '0 0 3px black' }}>Centro <GripVertical size={11} style={{ display: 'inline', verticalAlign: 'middle' }} /></div>
            </div>
          </div>
          <div style={{ position: 'absolute', top: `${strip.targetY ?? 50}%`, left: 0, width: '100%', height: 0, borderTop: '1px dashed #ff3333', pointerEvents: 'none', zIndex: 2 }} />
          <div style={{ position: 'absolute', top: 0, right: '-70px', width: '65px', height: '100%' }}>
            {strip.kdaMarkers.map((kda) => (
              <div key={kda.id} className="wb-kda-draggable" style={{ top: `${kda.y}%` }} onMouseDown={() => onSetDragItem({ type: 'kda', id: kda.id, stripId: strip.id })}>
                <div className="wb-kda-dash" />
                <input className="wb-editable-field" style={{ fontSize: '0.78rem', fontWeight: 600, width: '45px' }} value={kda.value} onChange={(e) => onUpdateKda(strip.id, kda.id, e.target.value)} onMouseDown={(e) => e.stopPropagation()} />
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <button className="btn-icon" style={{ padding: 0, opacity: 0.4 }} onClick={() => onRemoveKda(strip.id, kda.id)} onMouseDown={(e) => e.stopPropagation()}><Trash2 size={10} /></button>
                  <GripVertical size={18} style={{ opacity: 0.5, cursor: 'ns-resize' }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Origen + botones */}
        {srcImg && <div style={{ fontSize: '0.58rem', color: 'var(--text-secondary)', marginTop: '4px', paddingRight: '70px', fontStyle: 'italic' }}>Origen: {srcImg.name}</div>}
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '8px', paddingRight: '70px' }}>
          <button className="add-btn" style={{ fontSize: '0.7rem', padding: '4px 12px' }} onClick={() => onAddKda(strip.id)}><Plus size={10} /> Añadir kDa</button>
        </div>

        {/* ── PANEL DE CUANTIFICACIÓN ── */}
        <div className="wb-quant-panel">
          <button className="wb-quant-toggle" onClick={() => onUpdateStrip(strip.id, { quantOpen: !strip.quantOpen })}>
            <BarChart2 size={13} />
            {strip.quantOpen ? 'Ocultar cuantificación' : 'Ver cuantificación'}
            {strip.quantOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>

          {strip.quantOpen && (
            <div className="wb-quant-content">
              {/* Brillo / Contraste */}
              <div className="wb-bc-controls">
                <span className="wb-bc-title">Ajuste visual (no afecta densitometría)</span>
                <div className="wb-bc-row">
                  <label className="wb-bc-label">Brillo</label>
                  <input type="range" min="-100" max="100" value={strip.brightness ?? 0} onChange={(e) => onUpdateStrip(strip.id, { brightness: Number(e.target.value) })} className="wb-bc-slider" />
                  <span className="wb-bc-val">{strip.brightness ?? 0}</span>
                </div>
                <div className="wb-bc-row">
                  <label className="wb-bc-label">Contraste</label>
                  <input type="range" min="-100" max="100" value={strip.contrast ?? 0} onChange={(e) => onUpdateStrip(strip.id, { contrast: Number(e.target.value) })} className="wb-bc-slider" />
                  <span className="wb-bc-val">{strip.contrast ?? 0}</span>
                </div>
                <button className="add-btn" style={{ fontSize: '0.65rem', padding: '3px 10px', marginTop: '4px' }} onClick={() => onUpdateStrip(strip.id, { brightness: 0, contrast: 0 })}>
                  <RotateCcw size={10} /> Reset
                </button>
              </div>

              {/* Gráfico de picos */}
              <div style={{ marginTop: '12px' }}>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 600 }}>PERFIL DE INTENSIDAD Y FONDO (VALLE A VALLE)</div>
                <PeaksChart strip={strip} globalColumns={globalColumns} grayMode={grayMode} />
              </div>

              {/* Barras de intensidad */}
              <div style={{ marginTop: '12px' }}>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 600 }}>INTENSIDAD NET POR CARRIL{normStrip && strip.id !== normStrip.id ? ' — Ratio vs Ref.' : ''}</div>
                <IntensityBars strip={strip} globalColumns={globalColumns} normStrip={normStrip} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Controles */}
      <div className="wb-strip-remove" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <select
          value={strip.normRole || 'none'}
          onChange={(e) => onSetNormRole(strip.id, e.target.value)}
          style={{ background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '2px 6px', fontSize: '0.72rem', cursor: 'pointer' }}
        >
          <option value="none">Rol: Normal</option>
          <option value="totalProtein">Rol: Proteína Total</option>
          <option value="housekeeping">Rol: Housekeeping</option>
        </select>
        <button className="btn-icon" onClick={() => onStartEditCrop(strip)} title="Reajustar recorte"><Crop size={16} /></button>
        <button className="btn-icon" onClick={() => onRemoveStrip(strip.id)} title="Eliminar banda"><Trash2 size={16} /></button>
      </div>
    </div>
  );
}