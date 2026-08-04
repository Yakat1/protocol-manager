import { useState, useEffect, useRef, lazy, Suspense, useCallback } from 'react';
import { saveStateLocal, loadStateLocal, getDefaultState, mergeCloudWithLocalImages } from './utils/storage';
import { exportCSV, exportBackup } from './utils/export';
import { onUserChange, logoutUser, subscribeToLabState, saveLabState, getUserProfile, setUserProfile, getLabMemberRole, sendVerificationEmail, auth } from './utils/firebase';
import { v4 as uuidv4 } from 'uuid';
import usePermissions from './hooks/usePermissions';
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
  { id: 'scheduler', label: 'Cronograma', icon: '📅' },
  { id: 'journal', label: 'Bitácora', icon: '📔' },
  { id: 'spectro', label: 'Espectrofotometría', icon: '🌈' },
];

const ADMIN_TAB = { id: 'admin', label: 'Admin', icon: '🛡️' };

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
  const sessionIdRef = useRef(uuidv4());
  const isLocalUpdateRef = useRef(false);
  const [isSuspended, setIsSuspended] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [emailVerified, setEmailVerified] = useState(true);

  // ── Lab Context ─────────────────────────────────────────────────────────────
  const [labProfile, setLabProfile] = useState(null); // full user profile with labs[]
  const [activeLabId, setActiveLabId] = useState(null);
  const [userRole, setUserRole] = useState(null); // 'admin' | 'student'
  const [needsLabSetup, setNeedsLabSetup] = useState(false);
  const [retrying, setRetrying] = useState(false); // offline profile-retry loop
  const retryTimerRef = useRef(null);

  const { can } = usePermissions(userRole);

  // Determine active tabs based on role
  const visibleTabs = userRole === 'admin' ? [...TABS, ADMIN_TAB] : TABS;

  // ── Immediate-save helper ──────────────────────────────────────────────────
  // Persiste una actualización al servidor (y en caché local) sin esperar el
  // debounce de autosave. Usado para eliminaciones y ediciones instantáneas.
  const saveNow = useCallback((next) => {
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = null;
    if (activeLabId && !isSuspended && user) {
      saveStateLocal(next);
      saveLabState(activeLabId, next, sessionIdRef.current, user.uid).catch(console.error);
    }
  }, [activeLabId, isSuspended, user]);

  // ── Slice updaters (estables vía useCallback + functional setState) ────────
  // Todos soportan { immediate: true } para guardado instantáneo (eliminaciones)
  const setInventory = useCallback((inventory, { immediate = false } = {}) => {
    isLocalUpdateRef.current = true;
    setState(prev => {
      const next = { ...prev, inventory };
      if (immediate) saveNow(next);
      return next;
    });
  }, [saveNow]);

  const setCultureProtocols = useCallback((cultureProtocols, { immediate = false } = {}) => {
    isLocalUpdateRef.current = true;
    setState(prev => {
      const next = { ...prev, cultureProtocols };
      if (immediate) saveNow(next);
      return next;
    });
  }, [saveNow]);

  const setBufferRecipes = useCallback((bufferRecipes, { immediate = false } = {}) => {
    isLocalUpdateRef.current = true;
    setState(prev => {
      const next = { ...prev, bufferRecipes };
      if (immediate) saveNow(next);
      return next;
    });
  }, [saveNow]);

  // Updater genérico para componentes que modifican múltiples slices
  // { immediate: true } guarda al servidor sin esperar debounce (usar para eliminaciones)
  const updateState = useCallback((partial, { immediate = false } = {}) => {
    isLocalUpdateRef.current = true;
    setState(prev => {
      const next = { ...prev, ...partial };
      if (immediate) saveNow(next);
      return next;
    });
  }, [saveNow]);

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
      setUser(firebaseUser ?? null);

      if (firebaseUser) {
        const isGoogle = firebaseUser.providerData?.some(p => p.providerId === 'google.com');
        setEmailVerified(isGoogle || firebaseUser.emailVerified);
        // Check if user has a lab profile
        try {
          const profile = await getUserProfile(firebaseUser.uid);
          setRetrying(false);
          if (profile?.labs?.length > 0) {
            setLabProfile(profile);
            const labId = profile.activeLab || profile.labs[0].labId;
            setActiveLabId(labId);
            // Read authoritative role from lab members (not profile cache)
            const role = await getLabMemberRole(labId, firebaseUser.uid);
            setUserRole(role || 'student');
            setNeedsLabSetup(false);
          } else {
            setNeedsLabSetup(true);
          }
        } catch (err) {
          const isNetworkErr = ['unavailable', 'network-request-failed', 'resource-exhausted'].includes(err?.code);
          if (isNetworkErr) {
            // Transient network/offline: stay in the loading state and retry.
            // Toggling `retrying` re-runs this effect, which re-subscribes to
            // auth and re-fires onUserChange with the current user.
            console.warn('Sin conexión con la nube, reintentando perfil:', err);
            if (!retrying) showToast('Sin conexión con la nube. Reintentando…');
            clearTimeout(retryTimerRef.current);
            retryTimerRef.current = setTimeout(() => setRetrying(v => !v), retrying ? 3000 : 1000);
          } else {
            console.warn('Could not load lab profile, falling back:', err);
            setRetrying(false);
            setNeedsLabSetup(true);
          }
        }
      } else {
        setRetrying(false);
        if (firestoreUnsubRef.current) { firestoreUnsubRef.current(); firestoreUnsubRef.current = null; }
        const loaded = await loadStateLocal();
        setState(loaded || getDefaultState());
        setLabProfile(null);
        setActiveLabId(null);
        setUserRole(null);
        setNeedsLabSetup(false);
      }
    });

    return () => {
      unsubAuth();
      clearTimeout(retryTimerRef.current);
      if (firestoreUnsubRef.current) firestoreUnsubRef.current();
    };
  }, [retrying]);

  // ── 2) Subscribe to active lab state ───────────────────────────────────────
  useEffect(() => {
    if (!activeLabId || !user) return;

    // Load initial state from lab
    const loadLabData = async () => {
      try {
        const { loadLabState } = await import('./utils/firebase');
        const labState = await loadLabState(activeLabId);
        if (labState) {
          const localCache = await loadStateLocal();
          // Merge images from local cache
          const merged = mergeCloudWithLocalImages(labState, localCache);
          setState(merged);
        } else {
          setState(getDefaultState());
        }
      } catch (err) {
        console.warn('Failed to load lab state, using local cache:', err);
        const localCache = await loadStateLocal();
        setState(localCache || getDefaultState());
      }
    };
    loadLabData();

    // Subscribe to real-time
    if (firestoreUnsubRef.current) firestoreUnsubRef.current();
    firestoreUnsubRef.current = subscribeToLabState(activeLabId, (remoteData) => {
      if (
        remoteData.activeUserId === user.uid &&
        remoteData.sessionId && 
        remoteData.sessionId !== sessionIdRef.current
      ) {
        setIsSuspended(true);
      }
      
      // Ignorar ecos de nuestra propia sesión
      if (remoteData.sessionId === sessionIdRef.current) {
        return;
      }

      // Si hay un guardado local pendiente, no sobrescribir el estado local.
      // Cuando el save local se ejecute y su echo regrese, será ignorado por
      // el filtro de sessionId, y el SIGUIENTE snapshot remoto sí se aplicará.
      if (saveTimerRef.current) {
        return;
      }

      const remoteState = remoteData.state;
      setState(prev => mergeCloudWithLocalImages(remoteState, prev));
    });

    return () => { if (firestoreUnsubRef.current) firestoreUnsubRef.current(); };
  }, [activeLabId, user]);

  // ── 3) Auto-save debounce (5s) ────────────────────────────────────────────
  useEffect(() => {
    if (!state) return;

    if (!isLocalUpdateRef.current) {
      // La actualización vino de Firebase o de la carga inicial.
      // No programar un nuevo save, pero NO cancelar saves pendientes
      // para que las ediciones locales en curso lleguen al servidor.
      return;
    }

    isLocalUpdateRef.current = false;

    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null; // Limpiar ref para que snapshots remotos puedan fluir
      if (!isSuspended) {
        // Always save locally
        saveStateLocal(state);
        // Save to lab if active
        if (activeLabId) {
          saveLabState(activeLabId, state, sessionIdRef.current, user.uid).catch(console.error);
        }
      }
    }, 5000);
    return () => clearTimeout(saveTimerRef.current);
  }, [state, activeLabId, isSuspended]);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3500); };

  const handleLogout = async () => {
    await logoutUser();
    setLabProfile(null); setActiveLabId(null); setUserRole(null);
    showToast('Sesión cerrada.');
  };

  const handleLogoutRef = useRef(handleLogout);
  useEffect(() => { handleLogoutRef.current = handleLogout; });

  const INACTIVITY_TIMEOUT_MS = 60 * 60 * 1000; // 60 minutes
  const inactivityTimerRef = useRef(null);

  useEffect(() => {
    if (!user) return;

    const resetTimer = () => {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = setTimeout(() => {
        handleLogoutRef.current();
      }, INACTIVITY_TIMEOUT_MS);
    };

    const events = ['mousedown', 'keydown', 'touchstart', 'scroll', 'mousemove'];
    events.forEach(evt => window.addEventListener(evt, resetTimer, { passive: true }));
    resetTimer();

    return () => {
      events.forEach(evt => window.removeEventListener(evt, resetTimer));
      clearTimeout(inactivityTimerRef.current);
    };
  }, [user]);

  // ── Lab switching ──────────────────────────────────────────────────────────
  const switchLab = async (labId) => {
    if (labId === activeLabId) return;
    // Read authoritative role from members BEFORE switching so a failure
    // never leaves the lab half-switched (old role, new lab).
    try {
      const role = await getLabMemberRole(labId, user.uid);
      setActiveLabId(labId);
      setUserRole(role || 'student');
      setState(null); // triggers loading state
      // Update user profile with active lab
      if (user?.uid) {
        setUserProfile(user.uid, { activeLab: labId }).catch(console.error);
      }
    } catch {
      showToast('No se pudo verificar el rol; revisa tu conexión.');
    }
  };

  const handleLabReady = async (profile) => {
    setLabProfile(profile);
    const labId = profile.activeLab || profile.labs[0]?.labId;
    setActiveLabId(labId);
    try {
      const role = await getLabMemberRole(labId, user.uid);
      setUserRole(role || 'student');
    } catch {
      // Fall back to the role cached in the user profile
      setUserRole(profile.labs?.find(l => l.labId === labId)?.role || 'student');
    }
    setNeedsLabSetup(false);
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
          isLocalUpdateRef.current = true;
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

  // ── Render por pestaña (cada componente recibe solo las slices que necesita) ─
  const renderMainContent = () => {
    switch (activeTab) {
      case 'home':
        return <Dashboard state={state} setActiveTab={setActiveTab} updateState={updateState} showToast={showToast} />;
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
        return <Spectrophotometry state={state} updateState={updateState} user={user} userRole={userRole} />;
      case 'admin':
        return userRole === 'admin' ? <LabAdmin labId={activeLabId} user={user} /> : null;
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
            userRole={userRole}
          />
        );
    }
  };

  return (
    <div className="app-container">
      {showProfileModal && user && (
        <ProfileSettings
          user={user}
          state={state}
          updateState={updateState}
          onClose={() => setShowProfileModal(false)}
          onLogout={handleLogout}
          showToast={showToast}
          onProfileUpdate={handleLabReady}
          activeLabId={activeLabId}
          activeLabName={user.labs?.find(l => l.labId === activeLabId)?.labName || 'Laboratorio'}
        />
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
            onClick={() => {
              sessionIdRef.current = uuidv4();
              setIsSuspended(false);
              saveStateLocal(state);
              if (activeLabId) {
                saveLabState(activeLabId, state, sessionIdRef.current, user.uid).catch(console.error);
              }
            }}
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

      <Sidebar
        state={state}
        updateState={updateState}
        activeSubjectId={activeSubjectId}
        setActiveSubjectId={(id) => { setActiveSubjectId(id); setActiveTab('subjects'); setSidebarOpen(false); }}
        activeTab={activeTab}
        setActiveTab={(tab) => { setActiveTab(tab); setSidebarOpen(false); }}
        tabs={visibleTabs}
        user={user}
        onLogout={handleLogout}
        onOpenProfile={() => { setShowProfileModal(true); setSidebarOpen(false); }}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        deferredPrompt={deferredPrompt}
        onInstallPWA={handleInstallPWA}
        labProfile={labProfile}
        activeLabId={activeLabId}
        onSwitchLab={switchLab}
        userRole={userRole}
        can={can}
      />
      <div className="workspace">
        <Suspense fallback={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)', gap: '12px' }}>
            <div className="lazy-spinner" />
            Cargando módulo…
          </div>
        }>
          <GLPPrintLayout state={state} user={user} labProfile={labProfile} activeLabId={activeLabId} disabled={activeTab === 'plate'}>
            {renderMainContent()}
          </GLPPrintLayout>
        </Suspense>
      </div>
      {toast && <div className="toaster">{toast}</div>}
    </div>
  );
}
