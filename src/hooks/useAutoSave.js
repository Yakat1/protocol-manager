import { useEffect } from 'react';
import { saveLabState } from '../utils/firebase';

/**
 * Auto-save debounce (5s). Only schedules a save when the change originated
 * from a local edit (isLocalUpdateRef); Firebase echoes and the initial load
 * are ignored so they never schedule redundant writes.
 *
 * El guardado LOCAL (IndexedDB) ya es inmediato en los updaters de LabContext;
 * aquí solo se persiste a la nube con debounce. El flush final ante cierre lo
 * maneja useFlushOnExit.
 */
export function useAutoSave({ state, activeLabId, isSuspended, user, saveTimerRef, isLocalUpdateRef, sessionIdRef }) {
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
      if (!isSuspended && activeLabId) {
        saveLabState(activeLabId, state, sessionIdRef.current, user.uid).catch(console.error);
      }
    }, 5000);
    return () => clearTimeout(saveTimerRef.current);
  }, [state, activeLabId, isSuspended, user, saveTimerRef, isLocalUpdateRef, sessionIdRef]);
}
