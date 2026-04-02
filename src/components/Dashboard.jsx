import React, { useState, useEffect } from 'react';
import { Activity, AlertTriangle, Box, Clock, Microscope, TrendingUp, CloudUpload, HardDriveDownload } from 'lucide-react';
import './Dashboard.css';

function formatDuration(ms) {
  if (ms < 0) ms = 0;
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

export default function Dashboard({ state, setActiveTab, updateState, showToast }) {
  const [timers, setTimers] = useState([]);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    // Leer timers de local storage y mantener actualizados
    const fetchTimers = () => {
      try {
        const stored = JSON.parse(localStorage.getItem('protocol_timers')) || [];
        setTimers(stored);
      } catch (err) {}
    };
    
    fetchTimers();
    const interval = setInterval(() => {
      setNow(Date.now());
      fetchTimers(); // Refrescar si hubo cambios en otra pestaÃ±a
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // 1. CÃ¡lculos de Inventario Bajo
  const inventory = state?.inventory || [];
  const lowInventory = inventory.filter(item => item.quantity <= 5).sort((a,b) => a.quantity - b.quantity);

  // 2. CÃ¡lculos de Cultivos y SemÃ¡foro de DÃ­as
  const activeCultures = (state?.cultures || []).filter(c => c.status === 'Activo');
  const allLogs = state?.cultureLogs || [];

  const cultureStatusList = activeCultures.map(c => {
    // Obtener logs del cultivo y ordenar descendente
    const logs = allLogs.filter(l => l.cultureId === c.id).sort((a,b) => new Date(b.date) - new Date(a.date));
    const targetDateStr = logs.length > 0 ? logs[0].date : c.dateStarted;
    
    // Calcular dÃ­as trancurridos desde la Ãºltima acciÃ³n (a las 00:00hrs relativas para evitar desfase de zona local)
    const targetDate = new Date(targetDateStr + "T00:00:00");
    const today = new Date();
    today.setHours(0,0,0,0);
    
    const diffTime = today - targetDate;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    let statusText = 'Hace 0-1 dÃ­a';
    let colorClass = 'status-green'; // Verde 0-1 dia
    
    if (diffDays === 1) statusText = 'Hace 1 dÃ­a';
    
    if (diffDays === 2) {
      colorClass = 'status-yellow';
      statusText = 'Hace 2 dÃ­as';
    } else if (diffDays === 3) {
      colorClass = 'status-orange';
      statusText = 'Hace 3 dÃ­as';
    } else if (diffDays > 3) {
      colorClass = 'status-red';
      statusText = `Â¡Hace ${diffDays} dÃ­as!`;
    }

    return { 
      ...c, 
      diffDays, 
      colorClass, 
      statusText,
      lastAction: logs.length > 0 ? logs[0].action : 'Inicio de Cultivo' 
    };
  }).sort((a,b) => b.diffDays - a.diffDays);

  const runningTimers = timers.filter(t => !t.isPaused);

  // MÃ³dulo de Respaldo HÃ­brido OS
  const [backupLoading, setBackupLoading] = useState(false);
  const handleSelectFolder = async () => {
    if (!window.electronAPI) return alert("Esta funciÃ³n sÃ³lo estÃ¡ habilitada en la aplicaciÃ³n .exe de Windows.");
    const path = await window.electronAPI.selectFolder();
    if (path) {
      setState({...state, backupPath: path});
      showToast("Nueva ruta de respaldo configurada.");
    }
  };

  const fireBackup = async () => {
    if (!window.electronAPI) return alert("Requiere entorno LIMS Escritorio Windows.");
    if (!state?.backupPath) return alert("Por favor seleccione primero una carpeta destino de su disco duro.");
    
    setBackupLoading(true);
    // Exportamos el state general a JSON format (lo mismo que el json export antiguo)
    const dataString = JSON.stringify(state, null, 2);
    
    const res = await window.electronAPI.saveBackup(state.backupPath, dataString);
    if (res.success) {
      showToast(`Base de datos asegurada en: ${res.path}`);
    } else {
      alert("Error al escribir respaldo: " + res.error);
    }
    setBackupLoading(false);
  };

  return (
    <div className="dashboard-container">
      <div style={{marginBottom: '24px'}}>
        <h1 style={{color: 'var(--text-primary)', margin: '0 0 8px 0'}}>Panel de Control LIMS</h1>
        <p style={{color: 'var(--text-secondary)', margin: 0}}>Resumen de operaciones y alertas biolÃ³gicas del experimento <strong>{state?.protocolName || 'Actual'}</strong>.</p>
      </div>

      {/* Tarjetas de Resumen Global */}
      <div className="dash-kpi-grid">
        <div className="glass-panel kpi-card" onClick={() => setActiveTab('culture')} style={{cursor:'pointer'}}>
          <div className="kpi-icon" style={{background: 'rgba(59, 130, 246, 0.2)', color: 'var(--accent)'}}><Microscope size={24}/></div>
          <div className="kpi-info">
            <h3>{activeCultures.length}</h3>
            <p>Cultivos Activos</p>
          </div>
        </div>
        
        <div className="glass-panel kpi-card" onClick={() => setActiveTab('inventory')} style={{cursor:'pointer'}}>
          <div className="kpi-icon" style={{background: lowInventory.length > 0 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)', color: lowInventory.length > 0 ? 'var(--danger)' : 'var(--success)'}}><Box size={24}/></div>
          <div className="kpi-info">
            <h3 style={{color: lowInventory.length > 0 ? 'var(--danger)' : 'inherit'}}>{lowInventory.length}</h3>
            <p>Reactivos con Stock CrÃ­tico (â‰¤ 5)</p>
          </div>
        </div>
        
        <div className="glass-panel kpi-card" onClick={() => setActiveTab('timers')} style={{cursor:'pointer'}}>
          <div className="kpi-icon" style={{background: runningTimers.length > 0 ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255, 255, 255, 0.1)', color: runningTimers.length > 0 ? '#f59e0b' : 'var(--text-secondary)'}}><Clock size={24}/></div>
          <div className="kpi-info">
            <h3>{runningTimers.length}</h3>
            <p>Temporizadores Corriendo</p>
          </div>
        </div>
      </div>

      {/* Grid Principal Modulos */}
      <div className="dash-modules-grid">
        {/* Modulo 1: Estado de Cultivos (SemÃ¡foro) */}
        <div className="dash-module glass-panel">
          <div className="module-header">
            <h3 style={{display:'flex', alignItems:'center', gap:'8px'}}><Activity size={18} color="var(--success)"/> Monitor de Cultivos</h3>
          </div>
          <div className="module-body">
            {cultureStatusList.length === 0 ? (
              <div className="empty-mini">No hay cultivos activos.</div>
            ) : (
              <div className="dash-list">
                {cultureStatusList.map(c => (
                  <div key={c.id} className="dash-list-item" onClick={() => setActiveTab('culture')} title="Ir a Cultivos">
                    <div style={{display:'flex', flexDirection:'column'}}>
                      <span style={{fontWeight: 600, color: 'var(--text-primary)'}}>{c.cellLine}</span>
                      <span style={{fontSize: '0.8rem', color: 'var(--text-secondary)'}}>Ãšltimo: {c.lastAction}</span>
                    </div>
                    <div className={`culture-badge ${c.colorClass}`}>
                      {c.statusText}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Modulo 2: Inventario CrÃ­tico */}
        <div className="dash-module glass-panel">
          <div className="module-header">
            <h3 style={{display:'flex', alignItems:'center', gap:'8px'}}><AlertTriangle size={18} color="var(--danger)"/> Alertas de Inventario</h3>
          </div>
          <div className="module-body">
            {lowInventory.length === 0 ? (
              <div className="empty-mini" style={{color: 'var(--success)'}}>Todo el stock es mayor a 5 unidades.</div>
            ) : (
              <div className="dash-list">
                {lowInventory.map(item => (
                  <div key={item.id} className="dash-list-item warning-item" onClick={() => setActiveTab('inventory')} title="Ir al Inventario">
                    <div style={{display:'flex', flexDirection:'column'}}>
                      <span style={{fontWeight: 600, color: 'var(--text-primary)'}}>{item.name}</span>
                      <span style={{fontSize: '0.8rem', color: 'var(--text-secondary)'}}>{item.type}</span>
                    </div>
                    <div style={{fontWeight: 'bold', fontSize: '1.2rem', color: 'var(--danger)'}}>
                      {item.quantity} <span style={{fontSize: '0.8rem', fontWeight: 'normal'}}>{item.unit}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Modulo 3: Timers Activos en Vivo */}
        <div className="dash-module glass-panel module-full-center">
          <div className="module-header">
            <h3 style={{display:'flex', alignItems:'center', gap:'8px'}}><TrendingUp size={18} color="#f59e0b"/> EstÃ­mulos Activos</h3>
          </div>
          <div className="module-body">
            {runningTimers.length === 0 ? (
              <div className="empty-mini">No hay cronÃ³metros activos actualmente.</div>
            ) : (
              <div className="dash-list">
                {runningTimers.map(t => {
                  const totalElapsed = t.accumulatedMs + (now - t.startedAt);
                  return (
                    <div key={t.id} className="dash-list-item live-timer-item" onClick={() => setActiveTab('timers')} title="Administrar Timer">
                      <div style={{display:'flex', flexDirection:'column'}}>
                        <span style={{fontWeight: 600, color: 'var(--text-primary)'}}>{t.label}</span>
                      </div>
                      <div style={{fontFamily: 'monospace', fontWeight: 'bold', fontSize: '1.1rem', color: 'var(--accent)'}}>
                        {formatDuration(totalElapsed)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Modulo 4: Sistema de Respaldo HÃ­brido C++ */}
        <div className="dash-module glass-panel">
          <div className="module-header">
            <h3 style={{display:'flex', alignItems:'center', gap:'8px'}}><CloudUpload size={18} color="var(--accent)"/> Respaldo Nativo</h3>
          </div>
          <div className="module-body" style={{display: 'flex', flexDirection: 'column', gap: '16px'}}>
            <div style={{fontSize: '0.85rem', color: 'var(--text-secondary)'}}>
              La LIMS de Escritorio puede exportar silenciosamente la totalidad de la base de datos y adjuntos directamente a sus discos duros locales o unidades de red.
            </div>
            
            <div style={{background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '8px', display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', justifyContent: 'space-between'}}>
              <div>
                <strong style={{display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)'}}>Directorio de SincronizaciÃ³n Destino</strong>
                <span style={{fontSize: '0.9rem', color: state?.backupPath ? 'var(--success)' : 'var(--danger)', wordBreak: 'break-all'}}>{state?.backupPath || "Ninguna ruta asignada."}</span>
              </div>
              <button className="btn" onClick={handleSelectFolder} style={{padding: '4px 8px', fontSize: '0.8rem'}}>Cambiar Carpeta</button>
            </div>

            <button 
              className="btn btn-primary" 
              onClick={fireBackup} 
              disabled={!state?.backupPath || backupLoading}
              style={{width: '100%', display: 'flex', justifyContent: 'center', gap: '8px'}}
            >
              <HardDriveDownload size={16}/> {backupLoading ? "Escribiendo en disco..." : "Forzar Respaldo Ahora"}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
