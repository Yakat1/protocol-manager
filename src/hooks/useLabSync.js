import { useEffect } from 'react';
import { subscribeToLabState, loadLabState } from '../utils/firebase';
import { loadStateLocal, getDefaultState, mergeCloudWithLocalImages } from '../utils/storage';
import { STATE_SLICES } from '../utils/firestoreSync';

/**
 * Subscribes to the active lab's realtime state (per-slice docs).
 *
 * - Carga inicial del snapshot (fusionando imágenes del caché local).
 * - Mantiene versionRef con la última versión remota de CADA slice (incluidos
 *   los ecos propios, para que la siguiente edición base correctamente).
 * - remoteStateRef guarda el estado remoto completo (para "cargar versión
 *   remota" al resolver un conflicto).
 * - baselineRef guarda el último estado remoto ACEPTADO (para describir qué
 *   cambió en el banner de conflicto).
 * - Guardas: eco de sessionId y save pendiente.
 * - Merge por slice: los slices con edición local pendiente conservan el
 *   estado local; el resto toma la versión remota.
 *
 * NOTA: ya NO hay suspensión de sesión aquí. El bloqueo es POR MÓDULO (qué
 * slices está editando otro usuario, vía presencia), manejado en LabContext.
 */
export function useLabSync({
  activeLabId, user, setState,
  sessionIdRef, saveTimerRef, firestoreUnsubRef,
  versionRef, remoteStateRef, baselineRef, pendingSlicesRef, stateRef,
}) {
  useEffect(() => {
    if (!activeLabId || !user) return;

    // Load initial state from lab
    const loadLabData = async () => {
      try {
        const loaded = await loadLabState(activeLabId);
        if (loaded.state) {
          versionRef.current = loaded.versions || {};
          remoteStateRef.current = loaded.state;
          baselineRef.current = loaded.state;
          const localCache = await loadStateLocal(activeLabId);
          // Merge images from local cache
          setState(mergeCloudWithLocalImages(loaded.state, localCache));
        } else {
          setState(getDefaultState());
        }
      } catch (err) {
        console.warn('Failed to load lab state, using local cache:', err);
        const localCache = await loadStateLocal(activeLabId);
        setState(localCache || getDefaultState());
      }
    };
    loadLabData();

    // Subscribe to real-time
    if (firestoreUnsubRef.current) firestoreUnsubRef.current();
    firestoreUnsubRef.current = subscribeToLabState(activeLabId, (remoteData) => {
      // SIEMPRE trackear versiones remotas y estado remoto completo
      // (incluido el eco de nuestra propia sesión).
      versionRef.current = { ...versionRef.current, ...(remoteData.versions || {}) };
      remoteStateRef.current = remoteData.state;

      // Ignorar ecos de nuestra propia sesión
      if (remoteData.sessionId === sessionIdRef.current) {
        return;
      }

      // Si hay un guardado local pendiente, no sobrescribir el estado local.
      if (saveTimerRef.current) {
        return;
      }

      // Merge por slice: los slices con edición local pendiente conservan el
      // estado local; el resto toma la versión remota.
      const pending = pendingSlicesRef.current;
      if (pending && pending.size > 0) {
        const merged = { ...remoteData.state };
        for (const s of STATE_SLICES) {
          if (pending.has(s) && stateRef.current?.[s] !== undefined) {
            merged[s] = stateRef.current[s];
          }
        }
        baselineRef.current = remoteData.state;
        setState((prev) => mergeCloudWithLocalImages(merged, prev));
        return;
      }

      baselineRef.current = remoteData.state;
      setState((prev) => mergeCloudWithLocalImages(remoteData.state, prev));
    });

    return () => { if (firestoreUnsubRef.current) firestoreUnsubRef.current(); };
  }, [activeLabId, user, setState, sessionIdRef, saveTimerRef, firestoreUnsubRef,
      versionRef, remoteStateRef, baselineRef, pendingSlicesRef, stateRef]);
}
