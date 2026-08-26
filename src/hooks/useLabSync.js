import { useEffect } from 'react';
import { subscribeToLabState, loadLabState } from '../utils/firebase';
import { loadStateLocal, getDefaultState, mergeCloudWithLocalImages } from '../utils/storage';

/**
 * Subscribes to the active lab's realtime state.
 * Loads the initial snapshot (merging images from the local cache), then keeps
 * the subscription in sync: session-id echo guard, pending-save guard and
 * cross-tab suspension detection.
 */
export function useLabSync({ activeLabId, user, setState, setIsSuspended, sessionIdRef, saveTimerRef, firestoreUnsubRef }) {
  useEffect(() => {
    if (!activeLabId || !user) return;

    // Load initial state from lab
    const loadLabData = async () => {
      try {
        const labState = await loadLabState(activeLabId);
        if (labState) {
          const localCache = await loadStateLocal(activeLabId);
          // Merge images from local cache
          setState(mergeCloudWithLocalImages(labState, localCache));
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

      setState(prev => mergeCloudWithLocalImages(remoteData.state, prev));
    });

    return () => { if (firestoreUnsubRef.current) firestoreUnsubRef.current(); };
  }, [activeLabId, user, setState, setIsSuspended, sessionIdRef, saveTimerRef, firestoreUnsubRef]);
}
