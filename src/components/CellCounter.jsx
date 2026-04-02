import React, { useState, useRef } from 'react';
import { UploadCloud, X, RotateCcw, MousePointerClick } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import './CellCounter.css';

export default function CellCounter() {
  const [image, setImage] = useState(null);
  const [markers, setMarkers] = useState([]);
  const [mode, setMode] = useState('positive'); // 'positive' | 'negative'
  const containerRef = useRef(null);
  const fileRef = useRef(null);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setImage({ name: file.name, data: ev.target.result });
      setMarkers([]);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleClick = (e) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setMarkers([...markers, { id: uuidv4(), x, y, type: mode }]);
  };

  const undoLast = () => {
    setMarkers(markers.slice(0, -1));
  };

  const positiveCount = markers.filter(m => m.type === 'positive').length;
  const negativeCount = markers.filter(m => m.type === 'negative').length;
  const total = positiveCount + negativeCount;
  const percentage = total > 0 ? ((positiveCount / total) * 100).toFixed(1) : '0.0';

  if (!image) {
    return (
      <div style={{padding: '24px'}}>
        <div className="counter-instructions">
          <MousePointerClick size={16} style={{display: 'inline', verticalAlign: 'middle', marginRight: '6px'}} />
          Sube una imagen de microscopía (ej. tinción SAβ-gal o inmunofluorescencia CK-18/Vimentina) y haz clic sobre cada célula para contarla como Positiva o Negativa. El porcentaje se calcula automáticamente.
        </div>
        <div className="dropzone" onClick={() => fileRef.current?.click()} style={{maxWidth: '500px'}}>
          <UploadCloud size={32} style={{marginBottom: '12px'}} />
          <span style={{fontSize: '0.9rem', textAlign: 'center'}}>Click o arrastra imágenes de microscopía</span>
          <input type="file" ref={fileRef} accept="image/*" style={{display: 'none'}} onChange={handleFileUpload} />
        </div>
      </div>
    );
  }

  return (
    <div style={{padding: '24px'}}>
      <div className="counter-instructions">
        <strong>Click izquierdo</strong> = marcar célula. Usa los botones para cambiar entre <span style={{color: 'var(--success)'}}>Positiva ✓</span> y <span style={{color: 'var(--danger)'}}>Negativa ✗</span>.
      </div>

      <div style={{display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap'}}>
        <button className={`btn ${mode === 'positive' ? 'btn-primary' : ''}`} style={mode === 'positive' ? {background: 'var(--success)'} : {}} onClick={() => setMode('positive')}>
          Positiva (SAβ-gal⁺)
        </button>
        <button className={`btn ${mode === 'negative' ? 'btn-primary' : ''}`} style={mode === 'negative' ? {background: 'var(--danger)'} : {}} onClick={() => setMode('negative')}>
          Negativa
        </button>
        <button className="btn" onClick={undoLast} disabled={markers.length === 0}>
          <RotateCcw size={14}/> Deshacer
        </button>
        <button className="btn" onClick={() => setMarkers([])}>
          <X size={14}/> Limpiar Todo
        </button>
        <button className="btn" onClick={() => { setImage(null); setMarkers([]); }}>
          Cambiar Imagen
        </button>
      </div>

      <div className="glass-panel" style={{padding: '4px', display: 'inline-block', position: 'relative'}}>
        <div ref={containerRef} style={{position: 'relative', display: 'inline-block', maxHeight: '65vh', overflow: 'hidden'}}>
          <img 
            src={image.data} 
            alt={image.name} 
            style={{display: 'block', maxHeight: '65vh', maxWidth: '100%', objectFit: 'contain'}}
            draggable={false}
          />
          <div className="cell-counter-overlay" onClick={handleClick}>
            {markers.map(m => (
              <div 
                key={m.id} 
                className={`cell-marker ${m.type}`}
                style={{ left: `${m.x}%`, top: `${m.y}%` }}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="counter-stats">
        <div className="counter-stat">
          <div className="counter-stat-value" style={{color: 'var(--success)'}}>{positiveCount}</div>
          <div className="counter-stat-label">Positivas</div>
        </div>
        <div className="counter-stat">
          <div className="counter-stat-value" style={{color: 'var(--danger)'}}>{negativeCount}</div>
          <div className="counter-stat-label">Negativas</div>
        </div>
        <div className="counter-stat">
          <div className="counter-stat-value">{total}</div>
          <div className="counter-stat-label">Total</div>
        </div>
        <div style={{marginLeft: 'auto'}}>
          <div className="counter-stat-value" style={{color: 'var(--accent)', fontSize: '2.2rem'}}>{percentage}%</div>
          <div className="counter-stat-label">% Positividad</div>
        </div>
      </div>
    </div>
  );
}
