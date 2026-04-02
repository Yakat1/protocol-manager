import { useState, useEffect, useRef, lazy, Suspense, useCallback } from 'react';
import { loadState, saveState } from './utils/storage';
import { exportCSV, exportBackup } from './utils/export';
import { onUserChange, logoutUser, subscribeToState } from './utils/firebase';
import AuthGate from './components/AuthGate';
import Sidebar from './components/Sidebar';
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

const TABS = [
  { id: 'home', label: 'Inicio', icon: '🏠' },
  { id: 'subjects', label: 'Sujetos', icon: '🧬' },
  { id: 'plate', label: 'Microplaca', icon: '🧫' },
  { id: 'charts', label: 'Gráficas', icon: '📊' },
  { id: 'calculator', label: 'Calculadora', icon: '⚗️' },
  { id: 'timers', label: 'Timers', icon: '⏱️' },
  { id: 'counter', label: 'Cell Counter', icon: '🔬' },
  { id: 'western', label: 'WB Análisis', icon: '🧪' },
  { id: 'wbreport', label: 'WB Reporte', icon: '📋' },
  { id: 'inventory', label: 'Inventario', icon: '📦' },
  { id: 'protocols', label: 'Protocolos', icon: '📜' },
  { id: 'culture', label: 'Cultivos', icon: '🦠' },
];

export default function App() {
  const [user, setUser] = useState(undefined);
  const [state, setState] = useState(null);
  const [activeSubjectId, setActiveSubjectId] = useState(null);
  const [activeTab, setActiveTab] = useState('home');
  const [toast, setToast] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const firestoreUnsubRef = useRef(null);
  const saveTimerRef = useRef(null);

  // ── Slice updaters (estables vía useCallback + functional setState) ────────
  const setInventory = useCallback((inventory) => {
    setState(prev => ({ ...prev, inventory }));
  }, []);

  const setCultureProtocols = useCallback((cultureProtocols) => {
    setState(prev => ({ ...prev, cultureProtocols }));
  }, []);

  // Updater genérico para componentes que modifican múltiples slices
  const updateState = useCallback((partial) => {
    setState(prev => ({ ...prev, ...partial }));
  }, []);

  // 0) PWA install prompt
  useEffect(() => {
    const handler = (e) => { e.preventDefault(); setDeferredPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallPWA = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') setDeferredPrompt(null);
    }
  };

  // ── 1) Auth listener ──────────────────────────────────────────────────────
  useEffect(() => {
    const unsubAuth = onUserChange(async (firebaseUser) => {
      setUser((current) => {
        if (current?.isGuest) return current;
        return firebaseUser ?? null;
      });

      if (firebaseUser) {
        const loaded = await loadState(firebaseUser.uid);
        setState(loaded);

        if (firestoreUnsubRef.current) firestoreUnsubRef.current();
        firestoreUnsubRef.current = subscribeToState(firebaseUser.uid, (remoteState) => {
          setState(prev => {
            const mergedSubjects = (remoteState.subjects || []).map(rs => {
              const local = (prev?.subjects || []).find(s => s.id === rs.id);
              return local ? { ...rs, images: local.images || [] } : rs;
            });
            const mergedLogs = (remoteState.cultureLogs || []).map(rl => {
              const local = (prev?.cultureLogs || []).find(l => l.id === rl.id);
              return local ? { ...rl, images: local.images || [] } : rl;
            });
            return { ...remoteState, subjects: mergedSubjects, cultureLogs: mergedLogs };
          });
        });
      } else {
        if (firestoreUnsubRef.current) { firestoreUnsubRef.current(); firestoreUnsubRef.current = null; }
        const loaded = await loadState();
        setState(loaded);
      }
    });

    return () => { unsubAuth(); if (firestoreUnsubRef.current) firestoreUnsubRef.current(); };
  }, []);

  // ── 2) Auto-save debounce (5s) ────────────────────────────────────────────
  useEffect(() => {
    if (!state) return;
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveState(state, user?.uid ?? null).catch(console.error);
    }, 5000);
    return () => clearTimeout(saveTimerRef.current);
  }, [state, user]);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3500); };

  const handleLogout = async () => {
    if (user?.isGuest) { setUser(null); } else { await logoutUser(); }
    showToast('Sesión cerrada.');
  };

  const handleExportCSV = () => { exportCSV(state); showToast('CSV exportado'); };
  const handleExportBackup = () => { exportBackup(state); showToast('Respaldo JSON exportado'); };

  const handleImportBackup = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target.result);
        if (json.protocolName && json.subjects) {
          setState(json); setActiveSubjectId(null); showToast('Respaldo cargado');
        } else throw new Error("Format invalid");
      } catch { alert('El archivo no es un respaldo válido.'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

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

  const isElectron = !!window.electronAPI;
  if (!user && state) {
    return <AuthGate onAuthenticated={(u) => setUser(u)} isElectron={isElectron} />;
  }

  if (!state) {
    return (
      <div className="app-container">
        <div style={{ margin: 'auto', color: 'white' }}>Cargando Asistente de Laboratorio...</div>
      </div>
    );
  }

  // ── Render por pestaña (cada componente recibe solo las slices que necesita) ─
  const renderMainContent = () => {
    switch (activeTab) {
      case 'home':
        return <Dashboard state={state} setActiveTab={setActiveTab} updateState={updateState} showToast={showToast} />;
      case 'plate':
        return <PlateMapper state={state} updateState={updateState} />;
      case 'calculator':
        return <Calculator inventory={state.inventory} setInventory={setInventory} />;
      case 'timers':
        return <Timers />;
      case 'counter':
        return <CellCounter />;
      case 'charts':
        return <Charts subjects={state.subjects} variables={state.variables} />;
      case 'western':
        return <WesternBlot subjects={state.subjects} variables={state.variables} updateState={updateState} />;
      case 'wbreport':
        return <WBReport />;
      case 'inventory':
        return <Inventory inventory={state.inventory} setInventory={setInventory} />;
      case 'protocols':
        return <ProtocolsManager protocols={state.cultureProtocols} inventory={state.inventory} setCultureProtocols={setCultureProtocols} />;
      case 'culture':
        return <CellCulture state={state} updateState={updateState} />;
      default:
        return (
          <Workspace
            state={state}
            updateState={updateState}
            activeSubjectId={activeSubjectId}
            setActiveSubjectId={setActiveSubjectId}
            onExportCSV={handleExportCSV}
            onExportBackup={handleExportBackup}
            onImportBackup={handleImportBackup}
          />
        );
    }
  };

  return (
    <div className="app-container">
      <div className="mobile-topbar">
        <div className="mobile-topbar-title">🔬 {state?.protocolName || 'LIMS'}</div>
        <button className="hamburger-btn" onClick={() => setSidebarOpen(true)} aria-label="Abrir menú">☰</button>
      </div>

      <div className={`sidebar-overlay ${sidebarOpen ? 'visible' : ''}`} onClick={() => setSidebarOpen(false)} />

      <Sidebar
        state={state}
        updateState={updateState}
        activeSubjectId={activeSubjectId}
        setActiveSubjectId={(id) => { setActiveSubjectId(id); setActiveTab('subjects'); setSidebarOpen(false); }}
        activeTab={activeTab}
        setActiveTab={(tab) => { setActiveTab(tab); setSidebarOpen(false); }}
        tabs={TABS}
        user={user}
        onLogout={handleLogout}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        deferredPrompt={deferredPrompt}
        onInstallPWA={handleInstallPWA}
      />
      <div className="workspace">
        <Suspense fallback={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)', gap: '12px' }}>
            <div className="lazy-spinner" />
            Cargando módulo…
          </div>
        }>
          {renderMainContent()}
        </Suspense>
      </div>
      {toast && <div className="toaster">{toast}</div>}
    </div>
  );
}
