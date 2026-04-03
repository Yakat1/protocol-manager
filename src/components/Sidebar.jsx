import { Plus, Trash2, Download, Upload, Save, User } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { exportCSV, exportBackup } from '../utils/export';

export default function Sidebar({ state, updateState, activeSubjectId, setActiveSubjectId, activeTab, setActiveTab, tabs, user, onLogout, onOpenProfile, isOpen, onClose, deferredPrompt, onInstallPWA }) {
  const addSubject = () => {
    const newSubject = {
      id: uuidv4(),
      name: `Muestra ${state.subjects.length + 1}`,
      group: 'Control',
      measurements: {},
      images: []
    };
    updateState({ subjects: [...state.subjects, newSubject] });
    setActiveSubjectId(newSubject.id);
  };

  const removeSubject = (id, e) => {
    e.stopPropagation();
    if(confirm('¿Seguro que deseas eliminar este sujeto? Sus datos e imágenes serán borrados de este protocolo.')) {
      const newSubjects = state.subjects.filter(s => s.id !== id);
      updateState({ subjects: newSubjects });
      if(activeSubjectId === id) setActiveSubjectId(null);
    }
  };

  const updateProtocolName = (e) => {
    updateState({ protocolName: e.target.value });
  };

  return (
    <div className={`sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-header">
        <div className="protocol-title">
          <input 
            className="input-field" 
            style={{fontWeight: 'bold', fontSize: '1.1rem', width: '100%', background: 'transparent', border: '1px solid transparent', padding: '6px'}}
            value={state.protocolName} 
            onChange={updateProtocolName} 
            placeholder="Título del Protocolo"
          />
        </div>

        {/* Tab Navigation */}
        <div className="sidebar-tabs">
          {tabs.map(tab => (
            <button 
              key={tab.id}
              className={`sidebar-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
              title={tab.label}
            >
              <span className="sidebar-tab-icon">{tab.icon}</span>
              <span className="sidebar-tab-label">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'subjects' && (
        <>
          <div style={{padding: '12px'}}>
            <button className="btn btn-primary" onClick={addSubject} style={{justifyContent: 'center', width: '100%'}}>
              <Plus size={18} /> Nuevo Sujeto
            </button>
          </div>
          <div className="sidebar-content">
            {state.subjects.map(s => (
              <div 
                key={s.id} 
                className={`subject-item ${activeSubjectId === s.id ? 'active' : ''}`}
                onClick={() => setActiveSubjectId(s.id)}
              >
                <span style={{fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
                  {s.name}
                </span>
                <button className="btn-icon" onClick={(e) => removeSubject(s.id, e)} title="Eliminar Sujeto">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            {state.subjects.length === 0 && (
              <div style={{color:'var(--text-secondary)', fontSize:'0.9rem', textAlign:'center', marginTop:'30px'}}>
                Aún no hay sujetos. Añade uno para comenzar.
              </div>
            )}
          </div>
        </>
      )}

      {activeTab !== 'subjects' && (
        <div className="sidebar-content" style={{display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'center', padding: '40px 20px'}}>
          <div>
            <div style={{fontSize: '2.5rem', marginBottom: '12px'}}>{tabs.find(t => t.id === activeTab)?.icon}</div>
            <div>{tabs.find(t => t.id === activeTab)?.label}</div>
            <div style={{fontSize: '0.8rem', marginTop: '8px', opacity: 0.7}}>Herramienta independiente del protocolo de sujetos.</div>
          </div>
        </div>
      )}

      <div className="sidebar-footer">
        {deferredPrompt && (
          <button className="btn btn-primary" style={{width: '100%', justifyContent: 'center', fontSize: '0.9rem', marginBottom: '8px'}} onClick={onInstallPWA}>
             📱 Instalar App
          </button>
        )}
        <div style={{display: 'flex', gap: '8px', marginBottom: '8px'}}>
          <button className="btn" style={{flex: 1, justifyContent: 'center', fontSize: '0.8rem', padding: '6px'}} onClick={() => exportBackup(state)}>
            <Save size={14}/> Backup (JSON)
          </button>
        </div>
        {user && (
          <button 
            className="btn glass-panel" 
            style={{ width: '100%', padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '10px', border: '1px solid var(--border)', background: 'transparent' }} 
            onClick={onOpenProfile}
          >
            <div style={{ background: 'var(--primary)', color: 'white', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <User size={16}/>
            </div>
            <div style={{ textAlign: 'left', overflow: 'hidden' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-primary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                Mi Perfil
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                {user.isGuest ? 'Invitado' : user.email}
              </div>
            </div>
          </button>
        )}
      </div>
    </div>
  );
}
