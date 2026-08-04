/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useReducer, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { saveStateLocal } from '../utils/storage';
import { exportCSV, exportBackup } from '../utils/export';
import { saveLabState, setUserProfile, getLabMemberRole } from '../utils/firebase';
import usePermissions from '../hooks/usePermissions';
import { useAuth } from '../hooks/useAuth';
import { useLabSync } from '../hooks/useLabSync';
import { useAutoSave } from '../hooks/useAutoSave';
import { useInactivityLogout } from '../hooks/useInactivityLogout';

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

function labStateReducer(prevState, action) {
  switch (action.type) {
    case 'SET':
      return action.payload;
    case 'FUNC':
      return action.updater(prevState);
    default:
      return prevState;
  }
}

const LabContext = createContext(null);

export function LabProvider({ children }) {
  const [state, dispatch] = useReducer(labStateReducer, null);

  // Espejo del último estado aplicado. Se sincroniza en cada render para que
  // los updaters puedan calcular el "next" estado de forma síncrona (los
  // writes con objectos actualizan el ref de inmediato; los writes con
  // funciones quedan resueltos por el reducer en el siguiente render).
  const stateRef = useRef(null);
  stateRef.current = state;

  // Acepta tanto objetos como updaters funcionales (estos últimos solo se
  // usan en la suscripción de Firebase para fusionar el snapshot remoto).
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
  const [activeTab, setActiveTab] = useState('home');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [isSuspended, setIsSuspended] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  const sessionIdRef = useRef(uuidv4());
  const saveTimerRef = useRef(null);
  const isLocalUpdateRef = useRef(false);
  const firestoreUnsubRef = useRef(null);

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

  // ── Slice updaters (estables vía useCallback) ──────────────────────────────
  // Todos soportan { immediate: true } para guardado instantáneo (eliminaciones)
  const setInventory = useCallback((inventory, { immediate = false } = {}) => {
    isLocalUpdateRef.current = true;
    const next = { ...stateRef.current, inventory };
    setState(next);
    if (immediate) saveNow(next);
  }, [setState, saveNow]);

  const setCultureProtocols = useCallback((cultureProtocols, { immediate = false } = {}) => {
    isLocalUpdateRef.current = true;
    const next = { ...stateRef.current, cultureProtocols };
    setState(next);
    if (immediate) saveNow(next);
  }, [setState, saveNow]);

  const setBufferRecipes = useCallback((bufferRecipes, { immediate = false } = {}) => {
    isLocalUpdateRef.current = true;
    const next = { ...stateRef.current, bufferRecipes };
    setState(next);
    if (immediate) saveNow(next);
  }, [setState, saveNow]);

  // Updater genérico para componentes que modifican múltiples slices
  // { immediate: true } guarda al servidor sin esperar debounce (usar para eliminaciones)
  const updateState = useCallback((partial, { immediate = false } = {}) => {
    isLocalUpdateRef.current = true;
    const next = { ...stateRef.current, ...partial };
    setState(next);
    if (immediate) saveNow(next);
  }, [setState, saveNow]);

  // ── Realtime sync + autosave + inactivity ─────────────────────────────────
  useLabSync({ activeLabId, user, setState, setIsSuspended, sessionIdRef, saveTimerRef, firestoreUnsubRef });
  useAutoSave({ state, activeLabId, isSuspended, user, saveTimerRef, isLocalUpdateRef, sessionIdRef });

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
    // Read authoritative role from members BEFORE switching so a failure
    // never leaves the lab half-switched (old role, new lab).
    try {
      const role = await getLabMemberRole(labId, user.uid);
      setState(null); // triggers loading state
      setActiveLabId(labId);
      setUserRole(role || 'student');
      // Update user profile with active lab
      if (user?.uid) {
        setUserProfile(user.uid, { activeLab: labId }).catch(console.error);
      }
    } catch {
      showToast('No se pudo verificar el rol; revisa tu conexión.');
    }
  }, [activeLabId, user, setState, setUserRole, setActiveLabId, showToast]);

  const handleLabReady = useCallback(async (profile) => {
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
          setActiveSubjectId(null);
          showToast('Respaldo cargado');
        } else throw new Error("Format invalid");
      } catch { alert('El archivo no es un respaldo válido.'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [setState, setActiveSubjectId, showToast]);

  const takeControl = useCallback(() => {
    sessionIdRef.current = uuidv4();
    setIsSuspended(false);
    saveStateLocal(state);
    if (activeLabId) {
      saveLabState(activeLabId, state, sessionIdRef.current, user.uid).catch(console.error);
    }
  }, [activeLabId, user, state]);

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
    setActiveTab,
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
