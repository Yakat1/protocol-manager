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
 * usuarios (con TTL). Es la base del indicador "X está editando" y del bloqueo
 * por módulo: cada usuario reporta en su doc de presencia los slices que está
 * editando (los de su módulo activo), y los demás usan esa info para bloquear
 * SOLO esos módulos (no toda la sesión).
 *
 * `presenceInfo` = { slices: string[], tab: string }. Se fuerza un heartbeat
 * inmediato cuando cambian los slices (p. ej. al cambiar de módulo) para que el
 * bloqueo se libere/active sin esperar el debounce de 30s.
 */
export function usePresence({ labId, user, presenceInfo }) {
  const [activeEditors, setActiveEditors] = useState([]);
  const lastTouchRef = useRef(0);
  const lastSlicesKeyRef = useRef('');

  useEffect(() => {
    if (!labId || !user) return;

    const slices = presenceInfo?.slices || [];
    const slicesKey = [...slices].sort().join(',');

    const touch = (force = false) => {
      const slicesChanged = slicesKey !== lastSlicesKeyRef.current;
      const debounced = Date.now() - lastTouchRef.current < HEARTBEAT_DEBOUNCE_MS;
      if (!force && debounced && !slicesChanged) return;
      lastTouchRef.current = Date.now();
      lastSlicesKeyRef.current = slicesKey;
      touchPresence(labId, user, {
        activeSlices: slices,
        tab: presenceInfo?.tab || null,
        sessionId: presenceInfo?.sessionId || null,
      }).catch(() => {});
    };

    // Filtro TTL dentro del callback de suscripción (no en render).
    const unsub = subscribeToPresence(labId, (list) => {
      const now = Date.now();
      const active = list.filter(
        (e) => e.uid !== user.uid && now - lastSeenTs(e) < TTL_MS
      );
      setActiveEditors(active);
    });
    touch(true);

    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach((e) => window.addEventListener(e, touch, { passive: true }));
    const interval = setInterval(() => touch(false), HEARTBEAT_INTERVAL_MS);

    return () => {
      events.forEach((e) => window.removeEventListener(e, touch));
      clearInterval(interval);
      unsub();
    };
  }, [labId, user, presenceInfo]);

  return { activeEditors };
}
