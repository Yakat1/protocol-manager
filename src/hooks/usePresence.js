import { useEffect, useRef, useState } from 'react';
import { touchPresence, subscribeToPresence } from '../utils/firebase';

const TTL_MS = 60_000;          // un editor se considera "activo" 60s tras su último heartbeat
const HEARTBEAT_DEBOUNCE_MS = 30_000; // no escribir más de una vez cada 30s
const HEARTBEAT_INTERVAL_MS = 60_000; // re-anclar el heartbeat aunque no haya actividad

function lastSeenTs(e) {
  const t = e?.lastSeen;
  if (!t) return 0;
  if (typeof t.toDate === 'function') return t.toDate().getTime();
  if (typeof t === 'string' || typeof t === 'number') return new Date(t).getTime();
  return 0;
}

/**
 * Presencia en vivo: escribe un heartbeat en labs/{labId}/editors/{uid} al
 * detectar actividad (y periódicamente) y expone los editores activos de otros
 * usuarios (con TTL). Es la base del indicador "X está editando".
 */
export function usePresence({ labId, user }) {
  const [activeEditors, setActiveEditors] = useState([]);
  const lastTouchRef = useRef(0);

  useEffect(() => {
    if (!labId || !user) return;

    const touch = () => {
      if (Date.now() - lastTouchRef.current < HEARTBEAT_DEBOUNCE_MS) return;
      lastTouchRef.current = Date.now();
      touchPresence(labId, user).catch(() => {});
    };

    // Filtro TTL dentro del callback de suscripción (no en render).
    const unsub = subscribeToPresence(labId, (list) => {
      const now = Date.now();
      const active = list.filter(
        (e) => e.uid !== user.uid && now - lastSeenTs(e) < TTL_MS
      );
      setActiveEditors(active);
    });
    touch();

    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach((e) => window.addEventListener(e, touch, { passive: true }));
    const interval = setInterval(touch, HEARTBEAT_INTERVAL_MS);

    return () => {
      events.forEach((e) => window.removeEventListener(e, touch));
      clearInterval(interval);
      unsub();
    };
  }, [labId, user]);

  return { activeEditors };
}
