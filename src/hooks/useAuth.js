import { useCallback, useEffect, useRef, useState } from 'react';
import { onUserChange, logoutUser, getUserProfile, getLabMemberRole } from '../utils/firebase';
import { loadStateLocal, getDefaultState } from '../utils/storage';

/**
 * Auth subscription + lab-profile resolution.
 * Owns the onAuthStateChanged listener with its offline retry loop, and
 * resolves the user's lab profile, active lab and authoritative role.
 */
export function useAuth({ setState, showToast, firestoreUnsubRef }) {
  const [user, setUser] = useState(undefined);
  const [emailVerified, setEmailVerified] = useState(true);
  const [labProfile, setLabProfile] = useState(null);
  const [activeLabId, setActiveLabId] = useState(null);
  const [userRole, setUserRole] = useState(null); // 'admin' | 'student'
  const [needsLabSetup, setNeedsLabSetup] = useState(false);
  const [retrying, setRetrying] = useState(false); // offline profile-retry loop
  const retryTimerRef = useRef(null);

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
        if (firestoreUnsubRef.current) {
          firestoreUnsubRef.current();
          firestoreUnsubRef.current = null;
        }
        const loaded = await loadStateLocal(null);
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
  }, [retrying, setState, showToast, firestoreUnsubRef]);

  const logout = useCallback(async () => {
    await logoutUser();
    setLabProfile(null);
    setActiveLabId(null);
    setUserRole(null);
  }, []);

  return {
    user,
    setUser,
    emailVerified,
    setEmailVerified,
    labProfile,
    setLabProfile,
    activeLabId,
    setActiveLabId,
    userRole,
    setUserRole,
    needsLabSetup,
    setNeedsLabSetup,
    logout,
  };
}
