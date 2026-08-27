/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useReducer, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { saveStateLocal, mergeCloudWithLocalImages } from '../utils/storage';
import { exportCSV, exportBackup } from '../utils/export';
import { saveLabState, setUserProfile, getLabMemberRole } from '../utils/firebase';
import { splitState, describeDeltas } from '../utils/firestoreSync';
import usePermissions from '../hooks/usePermissions';
import { useAuth } from '../hooks/useAuth';
import { useLabSync } from '../hooks/useLabSync';
import { useAutoSave } from '../hooks/useAutoSave';
import { useFlushOnExit } from '../hooks/useFlushOnExit';
import { usePresence } from '../hooks/usePresence';
import { useInactivityLogout } from '../hooks/useInactivityLogout';
import { audit } from '../utils/audit';

export const TABS = [
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

export const ADMIN_TAB = { id: 'admin', label: 'Admin', icon: '🛡️' };

import { labStateReducer } from '../utils/labStateReducer';

const LabContext = createContext(null);

export function LabProvider({ children }) {
  const [state, dispatch] = useReducer(labStateReducer, null);

  // Espejo del último estado aplicado. Se sincroniza en cada render para que
  // los updaters puedan calcular el "next" estado de forma síncrona.
  const stateRef = useRef(null);
  stateRef.current = state;

  // ── Concurrencia multi-usuario ─────────────────────────────────────────────
  const versionRef = useRef({});            // slice -> última versión remota conocida
  const remoteStateRef = useRef(null);      // estado remoto completo (para "cargar remoto")
  const baselineRef = useRef(null);         // último estado remoto ACEPTADO (para diff del banner)
  const pendingSlicesRef = useRef(new Set()); // slices con edición local pendiente de subir
  const conflictRef = useRef(null);         // { slices } del conflicto activo
  const [conflict, setConflict] = useState(null);

  // Acepta tanto objetos como updaters funcionales.
  const setState = useCallback((updater) => {
    if (typeof updater === 'function') {
      dispatch({ type: 'FUNC', updater });
    } else {
      stateRef.current = updater;
      dispatch({ type: 'SET', payload: updater });
    }
  }, []);

  const [toast, setToast] = useState('');
  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  }, []);

  const [activeSubjectId, setActiveSubjectId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [isSuspended, setIsSuspended] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  const sessionIdRef = useRef(uuidv4());
  const saveTimerRef = useRef(null);
  const isLocalUpdateRef = useRef(false);
  const firestoreUnsubRef = useRef(null);

  // ── Navigation (HashRouter) ───────────────────────────────────────────────
  const location = useLocation();
  const navigate = useNavigate();
  const activeTab = location.pathname.slice(1) || 'home';

  const navigateTab = useCallback((tabId) => {
    navigate(tabId === 'home' ? '/' : `/${tabId}`);
  }, [navigate]);

  // ── Auth + lab profile ────────────────────────────────────────────────────
  const {
    user,
    setUser,
    emailVerified,
    setEmailVerified,
    labProfile,
    activeLabId,
    userRole,
    needsLabSetup,
    setLabProfile,
    setActiveLabId,
    setUserRole,
    setNeedsLabSetup,
    logout,
  } = useAuth({ setState, showToast, firestoreUnsubRef });

  const { can } = usePermissions(userRole);

  const visibleTabs = userRole === 'admin' ? [...TABS, ADMIN_TAB] : TABS;

  // Presencia en vivo (quién más está editando este lab)
  const { activeEditors } = usePresence({ labId: activeLabId, user });

  // ── Guardado en nube centralizado (versiones + conflictos) ────────────────
  const runCloudSave = useCallback((next) => {
    if (!activeLabId || !user) return Promise.resolve({ status: 'ok', conflicts: [], versions: {} });
    pendingSlicesRef.current = new Set(Object.keys(splitState(next)));
    return saveLabState(activeLabId, next, {
      sessionId: sessionIdRef.current,
      userId: user.uid,
      baseVersions: versionRef.current,
    })
      .then((res) => {
        if (res.status === 'conflict') {
          conflictRef.current = res;
          setConflict({
            slices: res.conflicts,
            // El resto de slices SÍ se guardó; actualizar sus versiones.
            savedVersions: res.versions,
          });
          versionRef.current = { ...versionRef.current, ...res.versions };
        } else {
          versionRef.current = { ...versionRef.current, ...res.versions };
          pendingSlicesRef.current = new Set();
        }
        return res;
      })
      .catch((err) => {
        console.error('Cloud save failed:', err);
        return { status: 'ok', conflicts: [], versions: {} };
      });
  }, [activeLabId, user]);

  // ── Immediate-save helper ──────────────────────────────────────────────────
  const saveNow = useCallback((next) => {
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = null;
    if (activeLabId && !isSuspended && user) {
      saveStateLocal(next, activeLabId);
      runCloudSave(next);
    }
  }, [activeLabId, isSuspended, user, runCloudSave]);

  // ── Slice updaters (estables vía useCallback) ──────────────────────────────
  // El guardado LOCAL es INMEDIATO en cada edición (durable); la nube se
  // debouncea en useAutoSave y se flushea en useFlushOnExit.
  const setInventory = useCallback((inventory, { immediate = false } = {}) => {
    isLocalUpdateRef.current = true;
    const next = { ...stateRef.current, inventory };
    setState(next);
    saveStateLocal(next, activeLabId).catch(() => {});
    if (immediate) saveNow(next);
  }, [setState, saveNow, activeLabId]);

  const setCultureProtocols = useCallback((cultureProtocols, { immediate = false } = {}) => {
    isLocalUpdateRef.current = true;
    const next = { ...stateRef.current, cultureProtocols };
    setState(next);
    saveStateLocal(next, activeLabId).catch(() => {});
    if (immediate) saveNow(next);
  }, [setState, saveNow, activeLabId]);

  const setBufferRecipes = useCallback((bufferRecipes, { immediate = false } = {}) => {
    isLocalUpdateRef.current = true;
    const next = { ...stateRef.current, bufferRecipes };
    setState(next);
    saveStateLocal(next, activeLabId).catch(() => {});
    if (immediate) saveNow(next);
  }, [setState, saveNow, activeLabId]);

  const updateState = useCallback((partial, { immediate = false } = {}) => {
    isLocalUpdateRef.current = true;
    const next = { ...stateRef.current, ...partial };
    setState(next);
    saveStateLocal(next, activeLabId).catch(() => {});
    if (immediate) saveNow(next);
  }, [setState, saveNow, activeLabId]);

  // ── Realtime sync + autosave + flush + inactivity + presence ──────────────
  useLabSync({
    activeLabId, user, setState, setIsSuspended,
    sessionIdRef, saveTimerRef, firestoreUnsubRef,
    versionRef, remoteStateRef, baselineRef, pendingSlicesRef, stateRef,
  });
  useAutoSave({ state, activeLabId, isSuspended, saveTimerRef, isLocalUpdateRef, onSave: runCloudSave });
  useFlushOnExit({ stateRef, activeLabId, user, isSuspended, saveTimerRef, onFlush: runCloudSave });

  // 0) PWA install prompt
  useEffect(() => {
    const handler = (e) => { e.preventDefault(); setDeferredPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallPWA = useCallback(async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') setDeferredPrompt(null);
    }
  }, [deferredPrompt]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleLogout = useCallback(async () => {
    await logout();
    showToast('Sesión cerrada.');
  }, [logout, showToast]);

  useInactivityLogout({ user, onLogout: handleLogout });

  const switchLab = useCallback(async (labId) => {
    if (labId === activeLabId) return;
    // Flush del save pendiente del lab ACTUAL antes de cambiarlo
    if (stateRef.current && activeLabId && !isSuspended && user) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
      runCloudSave(stateRef.current);
    }
    // Read authoritative role from members BEFORE switching
    try {
      const role = await getLabMemberRole(labId, user.uid);
      setState(null); // triggers loading state
      pendingSlicesRef.current = new Set();
      setConflict(null);
      conflictRef.current = null;
      setActiveLabId(labId);
      setUserRole(role || 'student');
      if (user?.uid) {
        setUserProfile(user.uid, { activeLab: labId }).catch(console.error);
      }
    } catch {
      showToast('No se pudo verificar el rol; revisa tu conexión.');
    }
  }, [activeLabId, user, isSuspended, runCloudSave, setState, setUserRole, setActiveLabId, showToast]);

  const handleLabReady = useCallback(async (profile) => {
    setLabProfile(profile);
    const labId = profile.activeLab || profile.labs[0]?.labId;
    setActiveLabId(labId);
    try {
      const role = await getLabMemberRole(labId, user.uid);
      setUserRole(role || 'student');
    } catch {
      setUserRole(profile.labs?.find(l => l.labId === labId)?.role || 'student');
    }
    setNeedsLabSetup(false);
  }, [user, setUserRole, setActiveLabId, setLabProfile, setNeedsLabSetup]);

  const handleExportCSV = useCallback(() => {
    exportCSV(state);
    showToast('CSV exportado');
  }, [state, showToast]);

  const handleExportBackup = useCallback(() => {
    exportBackup(state);
    showToast('Respaldo JSON exportado');
  }, [state, showToast]);

  const handleImportBackup = useCallback((e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target.result);
        if (json.protocolName && json.subjects) {
          isLocalUpdateRef.current = true;
          setState(json);
          saveStateLocal(json, activeLabId).catch(() => {});
          setActiveSubjectId(null);
          showToast('Respaldo cargado');
        } else throw new Error("Format invalid");
      } catch { alert('El archivo no es un respaldo válido.'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [setState, setActiveSubjectId, showToast, activeLabId]);

  const takeControl = useCallback(() => {
    sessionIdRef.current = uuidv4();
    setIsSuspended(false);
    saveStateLocal(state, activeLabId);
    if (activeLabId) {
      runCloudSave(state);
    }
  }, [activeLabId, state, runCloudSave]);

  // ── Resolución de conflicto (1.4) ─────────────────────────────────────────
  // Vista para el banner: qué cambió TÚ (local vs baseline) y qué cambió el
  // equipo (remoto vs baseline).
  const conflictView = useCallback(() => {
    const base = baselineRef.current;
    const local = stateRef.current;
    const remote = remoteStateRef.current;
    if (!conflictRef.current) return null;
    return {
      slices: conflictRef.current.slices,
      yours: base && local ? describeDeltas(base, local) : [],
      theirs: base && remote ? describeDeltas(base, remote) : [],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conflict]);

  const resolveConflict = useCallback(async (mode) => {
    if (!activeLabId || !user) return;
    const was = conflictRef.current;
    conflictRef.current = null;
    setConflict(null);
    pendingSlicesRef.current = new Set();

    if (mode === 'remote') {
      // Cargar versión del equipo: descarta mis ediciones locales pendientes.
      const remote = remoteStateRef.current;
      if (remote) {
        const merged = mergeCloudWithLocalImages(remote, stateRef.current);
        setState(merged);
        saveStateLocal(merged, activeLabId).catch(() => {});
        baselineRef.current = remote;
      }
      audit(activeLabId, user, 'conflict_resolved', 'load_remote', { slices: was?.slices || [] });
      showToast('Se cargó la versión del equipo.');
    } else {
      // Mantener lo mío: sobrescribir usando la versión remota más reciente
      // como base (ya no habrá conflicto, se pisa el estado del otro).
      await runCloudSave(stateRef.current);
      saveStateLocal(stateRef.current, activeLabId).catch(() => {});
      audit(activeLabId, user, 'conflict_resolved', 'keep_local', { slices: was?.slices || [] });
      showToast('Tus cambios se guardaron por encima de los del equipo.');
    }
  }, [activeLabId, user, setState, runCloudSave, showToast]);

  const value = {
    // lab data + updaters
    state,
    setState,
    updateState,
    setInventory,
    setCultureProtocols,
    setBufferRecipes,
    saveNow,
    // auth + lab context
    user,
    setUser,
    emailVerified,
    setEmailVerified,
    labProfile,
    activeLabId,
    activeLabName: labProfile?.labs?.find(l => l.labId === activeLabId)?.labName || 'Laboratorio',
    userRole,
    can,
    visibleTabs,
    needsLabSetup,
    // ui state
    activeSubjectId,
    setActiveSubjectId,
    activeTab,
    navigateTab,
    isSuspended,
    takeControl,
    toast,
    showToast,
    sidebarOpen,
    setSidebarOpen,
    showProfileModal,
    setShowProfileModal,
    deferredPrompt,
    handleInstallPWA,
    // concurrencia
    conflict,
    conflictView,
    resolveConflict,
    activeEditors,
    // handlers
    handleLogout,
    switchLab,
    handleLabReady,
    handleExportCSV,
    handleExportBackup,
    handleImportBackup,
  };

  return <LabContext value={value}>{children}</LabContext>;
}

export function useLab() {
  const ctx = useContext(LabContext);
  if (!ctx) throw new Error('useLab must be used within LabProvider');
  return ctx;
}
