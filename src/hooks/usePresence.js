import { useCallback, useEffect, useRef, useState } from 'react';
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
 * usuarios (con TTL). Es la base del indicador "X está editando", del bloqueo
 * por módulo (activeSlices) y del bloqueo POR CULTIVO (editCultures).
 *
 * `editCulturesRef` es un ref a un mapa { cultureId: timestamp } de los cultivos
 * que ESTE usuario ha editado recientemente. Se incluye en el heartbeat, y los
 * demás usuarios lo usan para bloquear SOLO esos cultivos (no el módulo entero).
 *
 * `forceTouch()` fuerza una escritura inmediata de presencia (p. ej. cuando el
 * usuario acaba de editar un cultivo, para que el candado se propague ya).
 */
export function usePresence({ labId, user, presenceInfo, editCulturesRef }) {
  const [activeEditors, setActiveEditors] = useState([]);
  const lastTouchRef = useRef(0);
  const lastSlicesKeyRef = useRef('');
  const lastListKeyRef = useRef('');

  // Refs estables para que `touch`/`forceTouch` no dependan de valores en render.
  // Se actualizan en un effect (no durante el render) para cumplir la regla
  // react-hooks/refs.
  const labIdRef = useRef(labId);
  const userRef = useRef(user);
  const infoRef = useRef(presenceInfo);
  const editRef = useRef(editCulturesRef);
  useEffect(() => {
    labIdRef.current = labId;
    userRef.current = user;
    infoRef.current = presenceInfo;
    editRef.current = editCulturesRef;
  });

  const recentCultures = () => {
    const map = editRef.current?.current;
    if (!map) return [];
    const now = Date.now();
    return Object.entries(map)
      .filter(([, ts]) => now - ts < TTL_MS)
      .map(([id]) => id);
  };

  const touch = useCallback((force = false) => {
    const labId = labIdRef.current;
    const user = userRef.current;
    if (!labId || !user) return;
    const info = infoRef.current || {};
    const slices = info.slices || [];
    const slicesKey = [...slices].sort().join(',');
    const slicesChanged = slicesKey !== lastSlicesKeyRef.current;
    const debounced = Date.now() - lastTouchRef.current < HEARTBEAT_DEBOUNCE_MS;
    if (!force && debounced && !slicesChanged) return;
    lastTouchRef.current = Date.now();
    lastSlicesKeyRef.current = slicesKey;
    touchPresence(labId, user, {
      activeSlices: slices,
      tab: info.tab || null,
      sessionId: info.sessionId || null,
      editCultures: recentCultures(),
    }).catch(() => {});
  }, []);

  const forceTouch = useCallback(() => touch(true), [touch]);

  useEffect(() => {
    if (!labId || !user) return;

    // Filtro TTL dentro del callback de suscripción (no en render).
    const unsub = subscribeToPresence(labId, (list) => {
      const now = Date.now();
      const active = list.filter(
        (e) => e.uid !== user.uid && now - lastSeenTs(e) < TTL_MS
      );
      // GUARDA DE RENDER: no disparar setState si la lista visible no cambió
      // (incluye editCultures para que el candado por cultivo reaccione).
      const key = active
        .map((e) => `${e.uid}|${(e.activeSlices || []).join(',')}|${(e.editCultures || []).join(',')}|${e.displayName || ''}`)
        .join(';;');
      if (key !== lastListKeyRef.current) {
        lastListKeyRef.current = key;
        setActiveEditors(active);
      }
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
  }, [labId, user, touch]);

  return { activeEditors, forceTouch };
}
