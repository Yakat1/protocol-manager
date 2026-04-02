import React, { useState, useEffect } from 'react';
import { Play, Trash2, Plus, Clock, X, RotateCcw } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import './Timers.css';

const DEFAULT_TIMEPOINTS = [
  { hours: 2, label: 'ROS (DCF-DA) T+2h' },
  { hours: 6, label: 'p38-MAPK / ROS T+6h' },
  { hours: 24, label: 'MTT / ELISA / WB T+24h' },
  { hours: 48, label: 'Senescencia / EMT T+48h' },
];

const LS_KEY = 'protocol_timers';

function loadTimers() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY)) || [];
  } catch {
    return [];
  }
}

function saveTimers(timers) {
  localStorage.setItem(LS_KEY, JSON.stringify(timers));
}

function formatDuration(ms) {
  if (ms < 0) ms = 0;
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function TimerCard({ timer, removeTimer, updateTimer, now }) {
  const [customHours, setCustomHours] = useState('');
  const [customLabel, setCustomLabel] = useState('');

  const totalElapsed = timer.isPaused 
    ? timer.accumulatedMs 
    : timer.accumulatedMs + (now - timer.startedAt);

  const togglePause = () => {
    if (timer.isPaused) {
      updateTimer(timer.id, { 
        isPaused: false, 
        startedAt: Date.now() 
      });
    } else {
      updateTimer(timer.id, { 
        isPaused: true, 
        accumulatedMs: totalElapsed 
      });
    }
  };

  const addTimepoint = () => {
    const h = parseFloat(customHours);
    if (!isNaN(h) && h > 0) {
      const newTp = { id: uuidv4(), hours: h, label: customLabel || `T+${h}h` };
      const newTps = [...timer.timepoints, newTp].sort((a, b) => a.hours - b.hours);
      updateTimer(timer.id, { timepoints: newTps });
      setCustomHours('');
      setCustomLabel('');
    }
  };

  const removeTimepoint = (tpId) => {
    updateTimer(timer.id, { timepoints: timer.timepoints.filter(t => t.id !== tpId) });
  };

  const updateTimepointLabel = (tpId, newLabel) => {
    updateTimer(timer.id, { 
      timepoints: timer.timepoints.map(t => t.id === tpId ? { ...t, label: newLabel } : t) 
    });
  };

  const creationDate = new Date(timer.createdAt || timer.startedAt);

  return (
    <div className={`glass-panel timer-card ${timer.isPaused ? 'paused' : 'running'}`}>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
        <div>
          <div className="timer-label">{timer.label}</div>
          <div className="timer-started">
            Creado: {creationDate.toLocaleDateString('es-MX')} {creationDate.toLocaleTimeString('es-MX', {hour: '2-digit', minute: '2-digit'})}
          </div>
        </div>
        <button className="btn-icon" onClick={() => removeTimer(timer.id)} title="Eliminar Estímulo" style={{color: 'var(--danger)'}}><Trash2 size={16}/></button>
      </div>

      <div style={{display: 'flex', alignItems: 'center', gap: '16px', margin: '12px 0', flexWrap: 'wrap'}}>
        <div className="timer-elapsed">{formatDuration(totalElapsed)}</div>
        <div style={{display: 'flex', gap: '8px'}}>
          <button 
            className="btn" 
            onClick={togglePause} 
            style={{padding: '4px 12px', fontSize: '0.8rem', background: timer.isPaused ? 'var(--success)' : 'rgba(255,255,255,0.1)'}}
          >
            {timer.isPaused ? '▶ Reanudar' : '⏸ Pausar'}
          </button>
          <button 
            className="btn" 
            onClick={() => {
              if (confirm("¿Reiniciar el temporizador T=0?")) {
                updateTimer(timer.id, { startedAt: Date.now(), accumulatedMs: 0, isPaused: false });
              }
            }} 
            title="Reiniciar a cero"
            style={{padding: '4px 8px', fontSize: '0.8rem', background: 'transparent', border: '1px solid var(--panel-border)'}}
          >
            <RotateCcw size={14}/>
          </button>
        </div>
      </div>

      <div className="timepoint-list" style={{maxHeight: '180px', overflowY: 'auto'}}>
        {timer.timepoints.map(tp => {
          const tpMs = tp.hours * 3600 * 1000;
          const reached = totalElapsed >= tpMs;
          const remaining = tpMs - totalElapsed;
          
          const nextTp = timer.timepoints.find(t => (t.hours * 3600 * 1000) > totalElapsed);
          const isNext = nextTp && nextTp.id === tp.id && !timer.isPaused;

          return (
            <div key={tp.id} className={`timepoint-item ${reached ? 'reached' : ''} ${isNext ? 'next' : ''}`} style={{display: 'flex', alignItems: 'center'}}>
              <input 
                value={tp.label} 
                onChange={(e) => updateTimepointLabel(tp.id, e.target.value)} 
                style={{flex: 1, background: 'transparent', border: 'none', color: 'inherit', outline: 'none', fontSize: 'inherit', textDecoration: reached ? 'line-through' : 'none'}}
              />
              <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                <span className="timepoint-countdown" style={{minWidth: '70px', textAlign: 'right'}}>
                  {reached ? '✓ Listo' : `−${formatDuration(remaining)}`}
                </span>
                <button className="btn-icon" style={{padding: '2px', opacity: 0.5}} onClick={() => removeTimepoint(tp.id)}>
                  <X size={12}/>
                </button>
              </div>
            </div>
          );
        })}
        {timer.timepoints.length === 0 && <div style={{fontSize: '0.8rem', opacity: 0.5}}>Sin timepoints programados.</div>}
      </div>

      <div style={{marginTop: '12px', display: 'flex', gap: '8px', alignItems: 'center'}}>
        <input 
          className="input-field" 
          style={{width: '60px', padding: '6px 8px', fontSize: '0.8rem'}} 
          type="number" 
          placeholder="Hrs" 
          value={customHours}
          onChange={e => setCustomHours(e.target.value)}
        />
        <input 
          className="input-field" 
          style={{flex: 1, padding: '6px 8px', fontSize: '0.8rem'}} 
          placeholder="Etiqueta (opcional)" 
          value={customLabel}
          onChange={e => setCustomLabel(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addTimepoint()}
        />
        <button className="btn" style={{fontSize: '0.75rem', padding: '6px 10px'}} onClick={addTimepoint}>
          <Plus size={14}/> Add
        </button>
      </div>
    </div>
  );
}

export default function Timers() {
  const [timers, setTimers] = useState(loadTimers);
  const [newLabel, setNewLabel] = useState('');
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    saveTimers(timers);
  }, [timers]);

  const addTimer = () => {
    const timer = {
      id: uuidv4(),
      label: newLabel || `Estímulo ${timers.length + 1}`,
      createdAt: Date.now(),
      startedAt: Date.now(),
      accumulatedMs: 0,
      isPaused: false,
      timepoints: DEFAULT_TIMEPOINTS.map(tp => ({ ...tp, id: uuidv4() })),
    };
    setTimers([...timers, timer]);
    setNewLabel('');
  };

  const updateTimer = (id, newProps) => {
    setTimers(prev => prev.map(t => t.id === id ? { ...t, ...newProps } : t));
  };

  const removeTimer = (id) => {
    if (confirm("¿Estás seguro de eliminar este contador por completo?")) {
      setTimers(prev => prev.filter(t => t.id !== id));
    }
  };

  return (
    <div className="timers-container">
      <div className="add-timer-form">
        <div className="input-group" style={{marginBottom: 0}}>
          <label className="input-label">Nombre del Estímulo / Experimento</label>
          <input 
            className="input-field" 
            value={newLabel} 
            onChange={e => setNewLabel(e.target.value)}
            placeholder="ej. H₂O₂ 150µM - Donante 3"
            onKeyDown={e => e.key === 'Enter' && addTimer()}
          />
        </div>
        <button className="btn btn-primary" onClick={addTimer} style={{height: '42px'}}>
          <Play size={16}/> Iniciar T=0
        </button>
      </div>

      {timers.length === 0 && (
        <div style={{color: 'var(--text-secondary)', textAlign: 'center', marginTop: '60px'}}>
          <Clock size={48} style={{opacity: 0.3, marginBottom: '12px'}}/>
          <p>No hay temporizadores activos. Haz clic en "Iniciar T=0" cuando agregues el estímulo a las células.</p>
        </div>
      )}

      <div className="timers-grid">
        {timers.map(timer => (
          <TimerCard 
            key={timer.id} 
            timer={timer} 
            now={now} 
            removeTimer={removeTimer} 
            updateTimer={updateTimer} 
          />
        ))}
      </div>
    </div>
  );
}
