import { useEffect, useRef } from 'react';

const INACTIVITY_TIMEOUT_MS = 60 * 60 * 1000; // 60 minutes

/**
 * Auto-logout after one hour without activity while signed in.
 */
export function useInactivityLogout({ user, onLogout }) {
  const inactivityTimerRef = useRef(null);
  const onLogoutRef = useRef(onLogout);

  useEffect(() => {
    onLogoutRef.current = onLogout;
  }, [onLogout]);

  useEffect(() => {
    if (!user) return;

    const resetTimer = () => {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = setTimeout(() => {
        onLogoutRef.current();
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
}
