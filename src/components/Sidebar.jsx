import { Plus, Trash2, Download, Upload, Save, User, ChevronDown } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { exportCSV, exportBackup } from '../utils/export';

export default function Sidebar({ state, updateState, activeSubjectId, setActiveSubjectId, activeTab, setActiveTab, tabs, user, onLogout, onOpenProfile, isOpen, onClose, deferredPrompt, onInstallPWA, labProfile, activeLabId, onSwitchLab, userRole, can }) {
  const updateProtocolName = (e) => {
    updateState({ protocolName: e.target.value });
  };

  const labs = labProfile?.labs || [];

  return (
    <div className={`sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-header">
        {/* Lab Switcher */}
        {labs.length > 0 && (
          <div style={{ marginBottom: '8px' }}>
            <select
              className="input-field"
              value={activeLabId || ''}
              onChange={e => onSwitchLab && onSwitchLab(e.target.value)}
              style={{
                width: '100%', fontSize: '0.8rem', padding: '6px 8px',
                background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)',
                fontWeight: 'bold', cursor: 'pointer'
              }}
            >
              {labs.map(lab => (
                <option key={lab.labId} value={lab.labId}>
                  🏢 {lab.labName} {lab.role === 'admin' ? '(Admin)' : '(Estudiante)'}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="protocol-title">
          <input 
            className="input-field" 
            style={{fontWeight: 'bold', fontSize: '1.1rem', width: '100%', background: 'transparent', border: '1px solid transparent', padding: '6px'}}
            value={state.protocolName} 
            onChange={updateProtocolName} 
            placeholder="Título del Protocolo"
            readOnly={userRole === 'student'}
          />
        </div>

        {/* Role badge */}
        {userRole && (
          <div style={{ textAlign: 'center', marginBottom: '4px' }}>
            <span style={{
              fontSize: '0.65rem', padding: '2px 8px', borderRadius: '10px',
              background: userRole === 'admin' ? 'rgba(245,158,11,0.15)' : 'rgba(59,130,246,0.15)',
              color: userRole === 'admin' ? '#f59e0b' : '#3b82f6',
              fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px'
            }}>
              {userRole === 'admin' ? '🛡️ Administrador' : '📚 Estudiante'}
            </span>
          </div>
        )}

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

      <div className="sidebar-content" style={{display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'center', padding: '40px 20px'}}>
        <div>
          <div style={{fontSize: '2.5rem', marginBottom: '12px'}}>{tabs.find(t => t.id === activeTab)?.icon}</div>
          <div>{tabs.find(t => t.id === activeTab)?.label}</div>
          <div style={{fontSize: '0.8rem', marginTop: '8px', opacity: 0.7}}>Viendo sección {tabs.find(t => t.id === activeTab)?.label}</div>
        </div>
      </div>

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
