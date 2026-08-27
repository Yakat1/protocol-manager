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
 * - Guardas: eco de sessionId, save pendiente y suspensión cross-tab.
 * - Merge por slice: los slices con edición local pendiente conservan el
 *   estado local; el resto toma la versión remota.
 */
export function useLabSync({
  activeLabId, user, setState, setIsSuspended,
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
      // Cross-tab suspension: SOLO si el editor activo es OTRO usuario.
      // NO comparar sessionId del mismo uid: con StrictMode + autosave + el doc
      // de sesión reescrito en cada save (merge:false), el snapshot remoto puede
      // llegar con un sessionId que no coincide con el ref local aunque sea la
      // misma única pestaña → falsos positivos de "Sesión Suspendida" a cada rato.
      if (
        remoteData.activeUserId &&
        remoteData.activeUserId !== user.uid &&
        remoteData.sessionId &&
        remoteData.sessionId !== sessionIdRef.current
      ) {
        setIsSuspended(true);
      }

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
  }, [activeLabId, user, setState, setIsSuspended, sessionIdRef, saveTimerRef, firestoreUnsubRef,
      versionRef, remoteStateRef, baselineRef, pendingSlicesRef, stateRef]);
}
