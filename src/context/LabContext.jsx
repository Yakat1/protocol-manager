/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';
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

// ── Bloqueo por módulo ───────────────────────────────────────────────────────
// Mapea cada módulo (tab) a los slices de estado compartido que edita. Cuando
// un usuario tiene un módulo abierto, reporta esos slices en su doc de
// presencia; los demás usuarios ven ese módulo bloqueado (pero el resto de la
// app sigue funcionando). Tabs no listados (timers, counter, charts, journal,
// wbreport, admin, home) no editan slices compartidos → no bloquean nada.
//
// NOTA: el Cronograma (scheduler) NO se bloquea a propósito. Es una herramienta
// de planeación compartida: los eventos se agregan de forma concurrente y los
// choques reales de versión los resuelve ConflictBanner. Bloquear calendarEvents
// por presencia hacía que tener Cultivos abierto "congelara" el calendario de
// los demás (calendarEvents estaba en ambos tabs).
export const TAB_SLICES = {
  subjects: ['subjects', 'variables', 'modelTypes'],
  plate: ['plateLayouts'],
  culture: ['cultures', 'cultureLogs', 'cultureActions'],
  inventory: ['inventory'],
  protocols: ['cultureProtocols', 'bufferRecipes'],
  calculator: ['inventory', 'bufferRecipes'],
  spectro: ['spectroProtocols', 'spectroTemplates'],
  western: ['subjects', 'variables'],
};

const SLICE_LABELS = {
  subjects: 'Sujetos',
  variables: 'Variables',
  settings: 'Ajustes',
  protocolName: 'Protocolo',
  inventory: 'Inventario',
  cultures: 'Cultivos',
  cultureLogs: 'Bitácora de Cultivos',
  cultureProtocols: 'Protocolos',
  bufferRecipes: 'Recetas de Buffer',
  cages: 'Jaulas',
  calendarEvents: 'Cronograma',
  cultureActions: 'Acciones de Cultivo',
  plateLayouts: 'Microplaca',
  modelTypes: 'Modelos',
  spectroProtocols: 'Protocolos de Espectro',
  spectroTemplates: 'Plantillas de Espectro',
};

export function sliceLabel(slice) {
  return SLICE_LABELS[slice] || slice;
}

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

  // Presencia en vivo: qué módulo estoy editando ahora (para el bloqueo por
  // módulo). Solo cambia al navegar entre tabs, para no re-suscribir a cada render.
  const presenceInfo = useMemo(
    () => ({
      slices: TAB_SLICES[activeTab] || [],
      tab: activeTab,
      sessionId: sessionIdRef.current,
    }),
    [activeTab]
  );
  const { activeEditors } = usePresence({ labId: activeLabId, user, presenceInfo });

  // Slices bloqueados por OTROS usuarios: los slices que reportan en su doc de
  // presencia (los del módulo que tienen abierto). El resto de la app sigue
  // funcionando; solo esos módulos quedan en solo-lectura.
  const lockedSlices = useMemo(() => {
    const locked = {};
    for (const editor of activeEditors) {
      for (const s of editor.activeSlices || []) {
        if (!locked[s]) locked[s] = { by: editor.displayName || 'Otro usuario', uid: editor.uid };
      }
    }
    return locked;
  }, [activeEditors]);
  const lockedSlicesRef = useRef(lockedSlices);
  lockedSlicesRef.current = lockedSlices;

  // Helpers de bloqueo (estables vía ref, para usarlos en useCallback).
  const isSliceLocked = useCallback((slice) => !!lockedSlicesRef.current[slice], []);
  const isModuleLocked = useCallback((tabId) => {
    const slices = TAB_SLICES[tabId] || [];
    return slices.some((s) => lockedSlicesRef.current[s]);
  }, []);

  // Módulo actual bloqueado → { by, uid } para el banner de App.
  const lockedModule = useMemo(() => {
    const slices = TAB_SLICES[activeTab] || [];
    for (const s of slices) {
      const lock = lockedSlices[s];
      if (lock) return lock;
    }
    return null;
  }, [activeTab, lockedSlices]);

  // Rechaza una edición si el slice está bloqueado por otro usuario.
  const assertSlicesEditable = useCallback((partial) => {
    for (const key of Object.keys(partial)) {
      const lock = lockedSlicesRef.current[key];
      if (lock) {
        showToast(`🔒 ${lock.by} está editando ${sliceLabel(key)}. Este módulo está bloqueado para ti en este momento.`);
        return false;
      }
    }
    return true;
  }, [showToast]);

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
    if (activeLabId && user) {
      saveStateLocal(next, activeLabId);
      runCloudSave(next);
    }
  }, [activeLabId, user, runCloudSave]);

  // ── Slice updaters (estables vía useCallback) ──────────────────────────────
  // El guardado LOCAL es INMEDIATO en cada edición (durable); la nube se
  // debouncea en useAutoSave y se flushea en useFlushOnExit. Si el slice que se
  // intenta editar está bloqueado por OTRO usuario (presencia), la edición se
  // rechaza con un aviso — sin suspender el resto de la app.
  const setInventory = useCallback((inventory, { immediate = false } = {}) => {
    if (!assertSlicesEditable({ inventory })) return;
    isLocalUpdateRef.current = true;
    const next = { ...stateRef.current, inventory };
    setState(next);
    saveStateLocal(next, activeLabId).catch(() => {});
    if (immediate) saveNow(next);
  }, [setState, saveNow, activeLabId, assertSlicesEditable]);

  const setCultureProtocols = useCallback((cultureProtocols, { immediate = false } = {}) => {
    if (!assertSlicesEditable({ cultureProtocols })) return;
    isLocalUpdateRef.current = true;
    const next = { ...stateRef.current, cultureProtocols };
    setState(next);
    saveStateLocal(next, activeLabId).catch(() => {});
    if (immediate) saveNow(next);
  }, [setState, saveNow, activeLabId, assertSlicesEditable]);

  const setBufferRecipes = useCallback((bufferRecipes, { immediate = false } = {}) => {
    if (!assertSlicesEditable({ bufferRecipes })) return;
    isLocalUpdateRef.current = true;
    const next = { ...stateRef.current, bufferRecipes };
    setState(next);
    saveStateLocal(next, activeLabId).catch(() => {});
    if (immediate) saveNow(next);
  }, [setState, saveNow, activeLabId, assertSlicesEditable]);

  const updateState = useCallback((partial, { immediate = false } = {}) => {
    if (!assertSlicesEditable(partial)) return;
    isLocalUpdateRef.current = true;
    const next = { ...stateRef.current, ...partial };
    setState(next);
    saveStateLocal(next, activeLabId).catch(() => {});
    if (immediate) saveNow(next);
  }, [setState, saveNow, activeLabId, assertSlicesEditable]);

  // ── Realtime sync + autosave + flush + inactivity + presence ──────────────
  useLabSync({
    activeLabId, user, setState,
    sessionIdRef, saveTimerRef, firestoreUnsubRef,
    versionRef, remoteStateRef, baselineRef, pendingSlicesRef, stateRef,
  });
  useAutoSave({ state, stateRef, activeLabId, saveTimerRef, isLocalUpdateRef, onSave: runCloudSave });
  useFlushOnExit({ stateRef, activeLabId, user, saveTimerRef, onFlush: runCloudSave });

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
    if (stateRef.current && activeLabId && user) {
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
  }, [activeLabId, user, runCloudSave, setState, setUserRole, setActiveLabId, showToast]);

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
    toast,
    showToast,
    sidebarOpen,
    setSidebarOpen,
    showProfileModal,
    setShowProfileModal,
    deferredPrompt,
    handleInstallPWA,
    // concurrencia: bloqueo por módulo (en vez de suspensión global)
    lockedSlices,
    lockedModule,
    isSliceLocked,
    isModuleLocked,
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
