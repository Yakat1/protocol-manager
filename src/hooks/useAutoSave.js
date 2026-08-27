import { useEffect } from 'react';

/**
 * Auto-save debounce (5s). Solo programa el guardado cuando el cambio provino
 * de una edición LOCAL (isLocalUpdateRef); los ecos de Firebase y la carga
 * inicial se ignoran para no escribir redundante.
 *
 * El guardado LOCAL (IndexedDB) ya es inmediato en los updaters de LabContext;
 * aquí solo se persiste a la nube con debounce, delegando en `onSave` (que
 * maneja versiones/conflictos en el contexto). El flush final ante cierre lo
 * maneja useFlushOnExit.
 *
 * PITFALL (bug de "no se podían crear cultivos"): el cleanup del effect NO debe
 * cancelar el debounce pendiente. Antes, un snapshot remoto (otro usuario o el
 * eco de un save propio) re-ejecutaba el effect con isLocalUpdateRef=false y el
 * cleanup cancelaba el timer del debounce sin reprogramarlo → la edición local
 * quedaba SOLO en el caché local y nunca subía a la nube. Aquí:
 *   - No hay cleanup destructivo: el timer sobrevive a los cambios remotos.
 *   - El timer sube siempre el ÚLTIMO estado (stateRef.current), no un closure.
 *   - El timer solo se limpia al desmontar el provider.
 */
export function useAutoSave({ state, activeLabId, saveTimerRef, isLocalUpdateRef, onSave, stateRef }) {
  useEffect(() => {
    if (!state) return;

    if (!isLocalUpdateRef.current) {
      // Cambio remoto / carga inicial: NO tocar el debounce pendiente.
      return;
    }

    isLocalUpdateRef.current = false;

    // Edición local: reiniciar el debounce con el estado MÁS reciente.
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null; // Limpiar ref para que snapshots remotos puedan fluir
      if (activeLabId && onSave) {
        onSave(stateRef.current);
      }
    }, 5000);
  }, [state, activeLabId, saveTimerRef, isLocalUpdateRef, onSave, stateRef]);

  // Limpiar el debounce SOLO al desmontar (logout/cambio de lab completo),
  // nunca en medio de la sesión por un snapshot remoto.
  useEffect(() => () => { clearTimeout(saveTimerRef.current); saveTimerRef.current = null; }, [saveTimerRef]);
}
