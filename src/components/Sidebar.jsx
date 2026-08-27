import { Save, User, ChevronDown } from 'lucide-react';
import { exportBackup } from '../utils/export';
import { useLab } from '../context/LabContext';

export default function Sidebar() {
  const {
    state,
    updateState,
    activeTab,
    navigateTab,
    visibleTabs,
    user,
    userRole,
    labProfile,
    activeLabId,
    switchLab,
    sidebarOpen,
    setSidebarOpen,
    setShowProfileModal,
    deferredPrompt,
    handleInstallPWA,
    activeEditors,
  } = useLab();

  const updateProtocolName = (e) => {
    updateState({ protocolName: e.target.value });
  };

  const openTab = (tabId) => {
    navigateTab(tabId);
    setSidebarOpen(false);
  };

  const openProfile = () => {
    setShowProfileModal(true);
    setSidebarOpen(false);
  };

  const labs = labProfile?.labs || [];

  return (
    <div className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
      <div className="sidebar-header">
        {/* Lab Switcher */}
        {labs.length > 0 && (
          <div style={{ marginBottom: '8px' }}>
            <select
              className="input-field"
              value={activeLabId || ''}
              onChange={e => switchLab && switchLab(e.target.value)}
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
          { label: 'Gestión Principal', items: ['subjects', 'culture', 'scheduler', 'inventory', 'protocols'] },
          { label: 'Herramientas', items: ['plate', 'spectro', 'calculator', 'timers', 'counter'] },
          { label: 'Reportes WB', items: ['western', 'wbreport'] },
          { label: 'Ajustes', items: ['admin'] } // admin tab is conditional
        ].map((group, idx) => {
          const groupTabs = group.items.map(tid => visibleTabs.find(t => t.id === tid)).filter(Boolean);
          if (groupTabs.length === 0) return null;
          
          return (
            <div key={idx}>
              <span className="nav-group-label">{group.label}</span>
              <div className="sidebar-tabs">
                {groupTabs.map(tab => (
                  <button 
                    key={tab.id}
                    className={`sidebar-tab ${activeTab === tab.id ? 'active' : ''}`}
                    onClick={() => openTab(tab.id)}
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
        {/* Presencia en vivo */}
        {activeEditors.length > 0 && (
          <div style={{
            marginBottom: '8px', padding: '8px 10px', borderRadius: '8px',
            background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.25)',
            fontSize: '0.72rem', color: 'var(--text-secondary)',
          }}>
            <div style={{ fontWeight: 'bold', color: '#34d399', marginBottom: '4px', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              ● Editando ahora
            </div>
            {activeEditors.map((e) => (
              <div key={e.uid} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                <span style={{
                  width: '18px', height: '18px', borderRadius: '50%', flexShrink: 0,
                  background: '#3498db', color: 'white', fontSize: '0.6rem',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold',
                }}>
                  {(e.displayName || '?').trim().charAt(0).toUpperCase()}
                </span>
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {e.displayName}
                </span>
              </div>
            ))}
          </div>
        )}
        {deferredPrompt && (
          <button className="btn btn-primary" style={{width: '100%', justifyContent: 'center', fontSize: '0.9rem', marginBottom: '8px'}} onClick={handleInstallPWA}>
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
            onClick={openProfile}
          >
            <div style={{ background: 'rgba(255,255,255,0.2)', color: 'white', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <User size={18}/>
            </div>
            <div style={{ textAlign: 'left', overflow: 'hidden', flex: 1 }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: 'white', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                Mi Perfil
              </div>
              <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.8)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                {user.email}
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
