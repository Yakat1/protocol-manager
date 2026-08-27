import { useEffect } from 'react';
import { saveStateLocal } from '../utils/storage';

/**
 * Flush del estado pendiente cuando la pestaña va a cerrarse o quedar oculta.
 *
 * Cancela el debounce pendiente y guarda de inmediato: en local (durable) y en
 * la nube (best-effort, vía onFlush). Sin esto, las ediciones hechas en los
 * últimos 5s antes de cerrar la pestaña se perdían en silencio.
 *
 * `pagehide` es la señal de cierre/recarga; `visibilitychange → hidden` cubre
 * el caso de cambiar de pestaña/app (con algo más de margen para el fetch de
 * nube, que el navegador puede suspender durante pagehide).
 */
export function useFlushOnExit({ stateRef, activeLabId, user, isSuspended, saveTimerRef, onFlush }) {
  useEffect(() => {
    const flush = () => {
      const current = stateRef.current;
      if (!current) return;

      // Cancela el debounce pendiente para no duplicar el write.
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;

      // Guardado local durable (la garantía real ante cierre).
      saveStateLocal(current, activeLabId).catch(() => {});

      // Guardado en nube best-effort.
      if (activeLabId && !isSuspended && user && onFlush) {
        onFlush(current);
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };

    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [stateRef, activeLabId, user, isSuspended, saveTimerRef, onFlush]);
}
