import { lazy, Suspense } from 'react';
import { LabProvider, useLab } from './context/LabContext';
import { sendVerificationEmail, auth } from './utils/firebase';
import AuthGate from './components/AuthGate';
import LabSetup from './components/LabSetup';
import Sidebar from './components/Sidebar';
import ProfileSettings from './components/ProfileSettings';
import GLPPrintLayout from './components/GLPPrintLayout';
import './index.css';

// ── Lazy-loaded modules ──
const Dashboard = lazy(() => import('./components/Dashboard'));
const Workspace = lazy(() => import('./components/Workspace'));
const PlateMapper = lazy(() => import('./components/PlateMapper'));
const Calculator = lazy(() => import('./components/Calculator'));
const Timers = lazy(() => import('./components/Timers'));
const CellCounter = lazy(() => import('./components/CellCounter'));
const Charts = lazy(() => import('./components/Charts'));
const WesternBlot = lazy(() => import('./components/WesternBlot'));
const WBReport = lazy(() => import('./components/WBReport'));
const Inventory = lazy(() => import('./components/Inventory'));
const ProtocolsManager = lazy(() => import('./components/ProtocolsManager'));
const CellCulture = lazy(() => import('./components/CellCulture'));
const LabAdmin = lazy(() => import('./components/LabAdmin'));
const PersonalLog = lazy(() => import('./components/PersonalLog'));
const Scheduler = lazy(() => import('./components/Scheduler'));
const Spectrophotometry = lazy(() => import('./components/Spectrophotometry'));

function AppContent() {
  const {
    state,
    updateState,
    setInventory,
    setCultureProtocols,
    setBufferRecipes,
    user,
    setUser,
    emailVerified,
    setEmailVerified,
    userRole,
    can,
    activeLabId,
    activeTab,
    activeSubjectId,
    setActiveSubjectId,
    isSuspended,
    takeControl,
    toast,
    showToast,
    sidebarOpen,
    setSidebarOpen,
    showProfileModal,
    handleLogout,
    handleLabReady,
    handleExportCSV,
    handleExportBackup,
    handleImportBackup,
    needsLabSetup,
  } = useLab();

  // ── Loading / Auth gates ──────────────────────────────────────────────────
  if (user === undefined) {
    return (
      <div className="app-container">
        <div style={{ margin: 'auto', color: 'white', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: '12px' }}>🔬</div>
          Cargando LIMS...
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthGate onAuthenticated={(u) => setUser(u)} />;
  }

  // Email verification gate
  if (user && !emailVerified) {
    return (
      <div className="app-container">
        <div style={{ margin: 'auto', maxWidth: '420px', padding: '24px', textAlign: 'center' }}>
          <div className="glass-panel" style={{ padding: '32px' }}>
            <div style={{ fontSize: '3rem', marginBottom: '16px' }}>📧</div>
            <h2 style={{ marginBottom: '8px' }}>Verifica tu correo electrónico</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '24px' }}>
              Hemos enviado un enlace de verificación a <strong>{user.email}</strong>.
              Revisa tu bandeja de entrada (y spam) y haz clic en el enlace.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}
                onClick={async () => {
                  await user.reload();
                  if (auth.currentUser?.emailVerified) {
                    setEmailVerified(true);
                  } else {
                    showToast('Aún no se ha verificado. Revisa tu correo.');
                  }
                }}
              >
                ✅ Ya verifiqué mi correo
              </button>
              <button className="btn" style={{ width: '100%', justifyContent: 'center' }}
                onClick={async () => {
                  try {
                    await sendVerificationEmail(user);
                    showToast('Correo de verificación reenviado.');
                  } catch { showToast('Espera un momento antes de reenviar.'); }
                }}
              >
                📩 Reenviar correo de verificación
              </button>
              <button className="btn" style={{ width: '100%', justifyContent: 'center', color: 'var(--danger)' }}
                onClick={handleLogout}
              >
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Lab setup gate (for authenticated users without a lab)
  if (user && needsLabSetup) {
    return <LabSetup user={user} onLabReady={handleLabReady} />;
  }

  if (!state) {
    return (
      <div className="app-container">
        <div style={{ margin: 'auto', color: 'white' }}>Cargando Asistente de Laboratorio...</div>
      </div>
    );
  }

  // ── Render por pestaña ────────────────────────────────────────────────────
  const renderMainContent = () => {
    switch (activeTab) {
      case 'home':
        return <Dashboard />;
      case 'plate':
        return <PlateMapper state={state} updateState={updateState} />;
      case 'calculator':
        return <Calculator inventory={state.inventory} setInventory={setInventory} bufferRecipes={state.bufferRecipes || []} setBufferRecipes={setBufferRecipes} can={can} user={user} labId={activeLabId} />;
      case 'timers':
        return <Timers />;
      case 'counter':
        return <CellCounter />;
      case 'charts':
        return <Charts subjects={state.subjects} variables={state.variables} cultures={state.cultures} cultureLogs={state.cultureLogs} />;
      case 'western':
        return <WesternBlot subjects={state.subjects} variables={state.variables} updateState={updateState} />;
      case 'wbreport':
        return <WBReport />;
      case 'inventory':
        return <Inventory inventory={state.inventory} setInventory={setInventory} can={can} user={user} labId={activeLabId} />;
      case 'protocols':
        return <ProtocolsManager protocols={state.cultureProtocols} inventory={state.inventory} bufferRecipes={state.bufferRecipes} setCultureProtocols={setCultureProtocols} can={can} user={user} labId={activeLabId} />;
      case 'culture':
        return <CellCulture state={state} updateState={updateState} can={can} user={user} labId={activeLabId} />;
      case 'scheduler':
        return <Scheduler state={state} updateState={updateState} can={can} />;
      case 'journal':
        return <PersonalLog labId={activeLabId} user={user} can={can} />;
      case 'spectro':
        return <Spectrophotometry />;
      case 'admin':
        return userRole === 'admin' ? <LabAdmin labId={activeLabId} user={user} /> : null;
      default:
        return (
          <Workspace
            activeSubjectId={activeSubjectId}
            setActiveSubjectId={setActiveSubjectId}
            onExportCSV={handleExportCSV}
            onExportBackup={handleExportBackup}
            onImportBackup={handleImportBackup}
            userRole={userRole}
          />
        );
    }
  };

  return (
    <div className="app-container">
      {showProfileModal && user && (
        <ProfileSettings />
      )}
      {isSuspended && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 9999,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          color: 'white', textAlign: 'center', padding: '24px'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>⏸️</div>
          <h2 style={{ marginBottom: '12px', color: '#f87171' }}>Sesión Suspendida</h2>
          <p style={{ maxWidth: '400px', marginBottom: '24px', lineHeight: '1.5', color: '#9ca3af' }}>
            Otra pestaña o dispositivo está modificando este protocolo actualmente.
            Esta sesión ha sido pausada para evitar pérdida de datos por sobrescritura.
          </p>
          <button
            style={{ padding: '10px 20px', fontSize: '1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
            onClick={takeControl}
          >
            Tomar el Control y Seguir Editando
          </button>
        </div>
      )}
      <div className="mobile-topbar">
        <div className="mobile-topbar-title">🔬 {state?.protocolName || 'LIMS'}</div>
        <button className="hamburger-btn" onClick={() => setSidebarOpen(true)} aria-label="Abrir menú">☰</button>
      </div>

      <div className={`sidebar-overlay ${sidebarOpen ? 'visible' : ''}`} onClick={() => setSidebarOpen(false)} />

      <Sidebar />
      <div className="workspace">
        <Suspense fallback={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)', gap: '12px' }}>
            <div className="lazy-spinner" />
            Cargando módulo…
          </div>
        }>
          <GLPPrintLayout disabled={activeTab === 'plate'}>
            {renderMainContent()}
          </GLPPrintLayout>
        </Suspense>
      </div>
      {toast && <div className="toaster">{toast}</div>}
    </div>
  );
}

export default function App() {
  return (
    <LabProvider>
      <AppContent />
    </LabProvider>
  );
}
