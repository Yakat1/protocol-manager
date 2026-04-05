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
      </div>

      {/* Tab Navigation Menu */}
      <div className="sidebar-nav">
        {[
          { label: 'Visión General', items: ['home', 'charts', 'journal'] },
          { label: 'Gestión Principal', items: ['subjects', 'culture', 'inventory', 'protocols'] },
          { label: 'Herramientas', items: ['plate', 'calculator', 'timers', 'counter'] },
          { label: 'Reportes WB', items: ['western', 'wbreport'] },
          { label: 'Ajustes', items: ['admin'] } // admin tab is conditional
        ].map((group, idx) => {
          const groupTabs = group.items.map(tid => tabs.find(t => t.id === tid)).filter(Boolean);
          if (groupTabs.length === 0) return null;
          
          return (
            <div key={idx}>
              <span className="nav-group-label">{group.label}</span>
              <div className="sidebar-tabs">
                {groupTabs.map(tab => (
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
          );
        })}
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
            className="btn" 
            style={{ 
              width: '100%', 
              padding: '12px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'flex-start', 
              gap: '12px', 
              border: 'none', 
              background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)', 
              color: 'white',
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(234, 88, 12, 0.3)'
            }} 
            onClick={onOpenProfile}
          >
            <div style={{ background: 'rgba(255,255,255,0.2)', color: 'white', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <User size={18}/>
            </div>
            <div style={{ textAlign: 'left', overflow: 'hidden', flex: 1 }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: 'white', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                Mi Perfil
              </div>
              <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.8)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                {user.isGuest ? 'Invitado' : user.email}
              </div>
            </div>
            <div style={{ color: 'rgba(255,255,255,0.8)' }}>
              <ChevronDown size={16} />
            </div>
          </button>
        )}
      </div>
    </div>
  );
}
