// ─── Diagnóstico temporal de errores ─────────────────────────────────────────
// OPCIÓN TEMPORAL para depurar: cuando ocurre un error, se genera un .txt con
// todo el contexto (mensaje, stack, URL, usuario, últimos mensajes de consola).
// - En Electron (.exe): se guarda SOLO en el Escritorio automáticamente.
// - En web/PWA: se descarga el .txt (deduplicado: 1 cada 30s por mismo error).
// Para quitar esta opción: eliminar la llamada a registerGlobalErrorHandlers()
// en main.jsx y el bloque de diagnóstico en ErrorBoundary.
//
// Se mantiene un buffer con los últimos mensajes de consola (ERROR/WARN) para
// que el .txt incluya qué estaba pasando justo antes del fallo.

const BUFFER_MAX = 80;
const buffer = [];

function fmt(v) {
  if (v instanceof Error) {
    return `${v.name || 'Error'}: ${v.message || ''}${v.stack ? '\n' + v.stack : ''}`;
  }
  if (typeof v === 'object' && v !== null) {
    try { return JSON.stringify(v); } catch { return String(v); }
  }
  return String(v);
}

function push(level, args) {
  try {
    buffer.push(`[${new Date().toISOString()}] ${level} ${args.map(fmt).join(' | ')}`);
    if (buffer.length > BUFFER_MAX) buffer.shift();
  } catch { /* nunca romper por el buffer */ }
}

// Interceptar consola para el buffer (mantiene el comportamiento original).
(function hookConsole() {
  const origError = console.error.bind(console);
  const origWarn = console.warn.bind(console);
  console.error = (...args) => { push('ERROR', args); origError(...args); };
  console.warn = (...args) => { push('WARN', args); origWarn(...args); };
})();

const ts = () => new Date().toISOString().replace(/[:.]/g, '-');

/**
 * Arma el texto del .txt de diagnóstico.
 * @param {Error} [error] Error capturado.
 * @param {{componentStack?: string}} [info] Info de React (component stack).
 */
export function buildDiagnosticTxt(error, info) {
  const lines = [];
  lines.push('==============================================');
  lines.push('LIMS Protocol Manager — DIAGNÓSTICO DE ERROR');
  lines.push('==============================================');
  lines.push('');
  lines.push(`Fecha: ${new Date().toLocaleString()}`);
  lines.push(`URL: ${typeof location !== 'undefined' ? location.href : '(n/a)'}`);
  lines.push(`Módulo/Ruta: ${typeof location !== 'undefined' ? (location.hash || '(home)') : '(n/a)'}`);
  lines.push(`Navegador: ${typeof navigator !== 'undefined' ? navigator.userAgent : '(n/a)'}`);
  lines.push(`Online: ${typeof navigator !== 'undefined' ? navigator.onLine : '(n/a)'}`);
  lines.push(`Plataforma: ${window.electronAPI?.platform ? 'Electron (' + window.electronAPI.platform + ')' : 'Web/PWA'}`);

  const user = window.__LIMS_USER__;
  lines.push(`Usuario: ${user ? (user.email || user.uid) : '(sin sesión)'}`);
  lines.push(`Laboratorio: ${user?.labId || '(n/a)'}`);
  lines.push('');

  if (error) {
    lines.push('── ERROR ─────────────────────────────────');
    lines.push(`Nombre: ${error.name || 'Error'}`);
    lines.push(`Mensaje: ${error.message || String(error)}`);
    if (error.stack) {
      lines.push('Stack:');
      lines.push(error.stack);
    }
    lines.push('');
  }

  if (info && info.componentStack) {
    lines.push('── ÁRBOL DE COMPONENTES ──────────────────');
    lines.push(info.componentStack);
    lines.push('');
  }

  lines.push('── ÚLTIMOS MENSAJES DE CONSOLA (ERROR/WARN) ──');
  lines.push(buffer.slice(-40).join('\n') || '(sin mensajes capturados)');
  lines.push('');

  return lines.join('\n');
}

function defaultFilename() {
  return `LIMS_diagnostico_${ts()}.txt`;
}

/** Descarga el .txt en el navegador (web/PWA). */
export function downloadDiagnosticTxt(txt, filename) {
  try {
    const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || defaultFilename();
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  } catch (err) {
    console.warn('No se pudo descargar el diagnóstico:', err);
  }
}

/** Guarda el .txt en el Escritorio vía Electron. Devuelve la ruta o null. */
export async function saveDiagnosticElectron(txt) {
  if (!window.electronAPI?.saveDiagnostic) return null;
  try {
    const res = await window.electronAPI.saveDiagnostic(txt);
    return res?.success ? res.path : null;
  } catch (err) {
    console.warn('No se pudo guardar el diagnóstico en disco:', err);
    return null;
  }
}

/**
 * Captura un error: genera el .txt y lo devuelve (la UI decide si guardarlo en
 * Electron o ofrecerlo como descarga).
 */
export function captureError(error, info) {
  const txt = buildDiagnosticTxt(error, info);
  return { txt };
}

// Re-exportar el guardado de Electron por separado para que ErrorBoundary pueda
// auto-guardar y además mostrar el botón de descarga.
export async function autoSaveDiagnostic(txt) {
  return saveDiagnosticElectron(txt);
}

// ─── Handlers globales (errores fuera de React) ─────────────────────────────
let lastDumpKey = '';
let lastDumpAt = 0;

function dumpOnce(err) {
  const key = err?.message || 'unknown';
  // Dedup: 1 descarga cada 30s por el mismo mensaje (evita avalancha).
  if (key === lastDumpKey && Date.now() - lastDumpAt < 30000) return;
  lastDumpKey = key;
  lastDumpAt = Date.now();

  const txt = buildDiagnosticTxt(err, null);
  saveDiagnosticElectron(txt).then((path) => {
    if (path) console.log('[diagnóstico guardado en]', path);
    else downloadDiagnosticTxt(txt); // web/PWA: descarga
  });
}

/** Registra window.onerror + unhandledrejection. Llamar UNA vez al arrancar. */
export function registerGlobalErrorHandlers() {
  if (window.__LIMS_DIAGNOSTICS_REGISTERED__) return;
  window.__LIMS_DIAGNOSTICS_REGISTERED__ = true;

  window.addEventListener('error', (e) => {
    const err = e.error || new Error(e.message || 'window.onerror');
    if (e.filename || e.lineno) {
      err.message = `${err.message} @ ${e.filename || ''}:${e.lineno}:${e.colno}`;
    }
    dumpOnce(err);
  });

  window.addEventListener('unhandledrejection', (e) => {
    const err = e.reason instanceof Error
      ? e.reason
      : new Error(`Promesa rechazada: ${fmt(e.reason)}`);
    dumpOnce(err);
  });
}
