import { useState, useEffect } from 'react';
import { registerSW } from 'virtual:pwa-register';

/**
 * Detecta una nueva versión del Service Worker y ofrece actualizar.
 * Con registerType:'prompt' el SW nuevo queda en espera hasta que el usuario
 * acepta; recargamos para que la página use el index.html y chunks nuevos.
 * Esto evita el error "Algo salió mal" (ErrorBoundary) que ocurría cuando el
 * SW viejo servía un index.html con chunks ya borrados de gh-pages.
 */
export default function PWAUpdatePrompt() {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);

  useEffect(() => {
    const updateSW = registerSW({
      immediate: true,
      onNeedRefresh() { setNeedRefresh(true); },
      onOfflineReady() { setOfflineReady(true); },
    });

    // Toast de "lista offline" transitorio
    let t;
    if (offlineReady) {
      t = setTimeout(() => setOfflineReady(false), 4000);
    }
    return () => { clearTimeout(t); updateSW; };
  }, [offlineReady]);

  if (!needRefresh && !offlineReady) return null;

  return (
    <div style={{
      position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)',
      zIndex: 10000, display: 'flex', alignItems: 'center', gap: '10px',
      background: 'rgba(20,20,35,0.95)', border: '1px solid var(--border)',
      borderRadius: '12px', padding: '10px 16px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
      color: 'var(--foreground)', fontSize: '0.85rem', maxWidth: '90vw',
    }}>
      {needRefresh ? (
        <>
          <span>🆕 Hay una nueva versión disponible.</span>
          <button
            className="btn btn-primary"
            style={{ justifyContent: 'center', fontSize: '0.8rem', padding: '6px 12px', whiteSpace: 'nowrap' }}
            onClick={() => {
              // Recarga para activar el SW nuevo
              window.location.reload();
            }}
          >
            Actualizar
          </button>
        </>
      ) : (
        <span>✅ App lista para usar sin conexión.</span>
      )}
    </div>
  );
}
