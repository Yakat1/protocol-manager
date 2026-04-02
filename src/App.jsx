import { useState, useEffect, useRef } from 'react';
import { loadState, saveState } from './utils/storage';
import { exportCSV, exportBackup } from './utils/export';
import { onUserChange, logoutUser, subscribeToState } from './utils/firebase';
import AuthGate from './components/AuthGate';
import Sidebar from './components/Sidebar';
import Workspace from './components/Workspace';
import PlateMapper from './components/PlateMapper';
import Calculator from './components/Calculator';
import Timers from './components/Timers';
import CellCounter from './components/CellCounter';
import Charts from './components/Charts';
import WesternBlot from './components/WesternBlot';
import WBReport from './components/WBReport';
import Inventory from './components/Inventory';
import ProtocolsManager from './components/ProtocolsManager';
import CellCulture from './components/CellCulture';
import Dashboard from './components/Dashboard';
import './index.css';

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
  const [user, setUser] = useState(undefined); // undefined = cargando, null = sin sesión
  const [state, setState] = useState(null);
  const [activeSubjectId, setActiveSubjectId] = useState(null);
  const [activeTab, setActiveTab] = useState('home');
  const [toast, setToast] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const firestoreUnsubRef = useRef(null);
  const saveTimerRef = useRef(null);

  // 0) Escuchar evento de instalación de la PWA
  useEffect(() => {
    const handler = (e) => {
      e.preventDefault(); // Evitar que Chrome muestre el mini-infobar automático
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallPWA = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    }
  };

  // ── 1) Escuchar cambios de autenticación ──────────────────────────────────
  useEffect(() => {
    const unsubAuth = onUserChange(async (firebaseUser) => {
      setUser((current) => {
        if (current?.isGuest) return current;
        return firebaseUser ?? null;
      });
      
      if (firebaseUser) {
        // Cargar estado de Firestore (con fallback a IndexedDB)
        const loaded = await loadState(firebaseUser.uid);
        setState(loaded);

        // Suscripción en tiempo real: si otro dispositivo guarda, actualizo aquí
        if (firestoreUnsubRef.current) firestoreUnsubRef.current();
        firestoreUnsubRef.current = subscribeToState(firebaseUser.uid, (remoteState) => {
          setState(prev => {
            // Preservar imágenes locales al recibir actualización remota
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
        // Sin sesión: cargar solo desde IndexedDB (modo offline / Electron sin login)
        if (firestoreUnsubRef.current) {
          firestoreUnsubRef.current();
          firestoreUnsubRef.current = null;
        }
        const loaded = await loadState();
        setState(loaded);
      }
    });

    return () => {
      unsubAuth();
      if (firestoreUnsubRef.current) firestoreUnsubRef.current();
    };
  }, []);

  // ── 2) Auto-guardar con debounce (1s) cuando cambia el estado ─────────────
  useEffect(() => {
    if (!state) return;

    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveState(state, user?.uid ?? null).catch(console.error);
    }, 1000);

    return () => clearTimeout(saveTimerRef.current);
  }, [state, user]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  };

  const handleLogout = async () => {
    if (user?.isGuest) {
      setUser(null);
    } else {
      await logoutUser();
    }
    showToast('Sesión iniciada/cerrada.');
  };

  const handleExportCSV = () => {
    exportCSV(state);
    showToast('Archivo CSV exportado con éxito');
  };

  const handleExportBackup = () => {
    exportBackup(state);
    showToast('Respaldo JSON exportado con éxito');
  };

  const handleImportBackup = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target.result);
        if (json.protocolName && json.subjects) {
          setState(json);
          setActiveSubjectId(null);
          showToast('Respaldo cargado correctamente');
        } else throw new Error("Format invalid");
      } catch {
        alert('El archivo no es un respaldo válido.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // ── Pantallas de carga ────────────────────────────────────────────────────
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

  // ── AuthGate: requerido en TODOS los modos (Web y Electron) ────────────────
  // En Electron ocultamos el botón de Google (los popups OAuth requieren config extra).
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

  const renderMainContent = () => {
    switch (activeTab) {
      case 'home':
        return <Dashboard state={state} setActiveTab={setActiveTab} setState={setState} showToast={showToast} />;
      case 'plate':
        return <PlateMapper state={state} setState={setState} />;
      case 'calculator':
        return <Calculator state={state} setState={setState} />;
      case 'timers':
        return <Timers />;
      case 'counter':
        return <CellCounter />;
      case 'charts':
        return <Charts state={state} />;
      case 'western':
        return <WesternBlot state={state} setState={setState} />;
      case 'wbreport':
        return <WBReport />;
      case 'inventory':
        return <Inventory state={state} setState={setState} />;
      case 'protocols':
        return <ProtocolsManager state={state} setState={setState} />;
      case 'culture':
        return <CellCulture state={state} setState={setState} />;
      default:
        return (
          <Workspace
            state={state}
            setState={setState}
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
      {/* Barra superior móvil con hamburguesa */}
      <div className="mobile-topbar">
        <div className="mobile-topbar-title">
          🔬 {state?.protocolName || 'LIMS'}
        </div>
        <button className="hamburger-btn" onClick={() => setSidebarOpen(true)} aria-label="Abrir menú">
          ☰
        </button>
      </div>

      {/* Overlay oscuro (solo móvil) */}
      <div
        className={`sidebar-overlay ${sidebarOpen ? 'visible' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      <Sidebar
        state={state}
        setState={setState}
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
        {renderMainContent()}
      </div>
      {toast && <div className="toaster">{toast}</div>}
    </div>
  );
}
