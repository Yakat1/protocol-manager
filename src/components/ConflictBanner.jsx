import React from 'react';
import { AlertTriangle, Users, Check, ArrowDownToLine } from 'lucide-react';
import { useLab } from '../context/LabContext';

const SLICE_LABELS = {
  subjects: 'Sujetos',
  inventory: 'Inventario',
  cultures: 'Cultivos',
  cultureLogs: 'Bitácora cultivos',
  cultureProtocols: 'Protocolos',
  bufferRecipes: 'Recetas de buffer',
  spectroProtocols: 'Protocolos espectro',
  spectroTemplates: 'Plantillas espectro',
  variables: 'Variables',
  settings: 'Ajustes',
  protocolName: 'Título',
  cages: 'Jaulas',
};

const fmtCount = (c) => (c == null ? '—' : `${c} ítem${c === 1 ? '' : 's'}`);

const initial = (name) => (name ? name.trim().charAt(0).toUpperCase() : '?');

/**
 * Banner de conflicto (resolución colaborativa).
 * Sigue el diseño del mockup: dos columnas (tus cambios vs cambios del equipo)
 * con acentos diferenciados, avatares y dos botones de decisión explícita.
 * Bloquea la edición hasta decidir (no hay sobrescritura silenciosa).
 */
export default function ConflictBanner() {
  const { conflict, conflictView, resolveConflict, activeEditors, user } = useLab();
  const view = conflictView();

  if (!conflict || !view) return null;

  const otherEditors = activeEditors.filter((e) => e.uid !== user?.uid);
  const otherName = otherEditors[0]?.displayName || 'otro miembro';
  const otherInitial = initial(otherName);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9990,
      background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
      backdropFilter: 'blur(3px)',
    }}>
      <div className="glass-panel" style={{
        width: '100%', maxWidth: '760px', maxHeight: '90vh', overflowY: 'auto',
        padding: '24px', border: '1px solid rgba(245,158,11,0.4)',
      }}>
        {/* Encabezado */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
          <div style={{
            width: '44px', height: '44px', borderRadius: '50%', flexShrink: 0,
            background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f59e0b',
          }}>
            <AlertTriangle size={22} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.15rem' }}>
              Conflicto de edición
            </h3>
            <p style={{ margin: '2px 0 0', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              {otherName} guardó cambios en <strong>{view.slices.map(s => SLICE_LABELS[s] || s).join(', ')}</strong> mientras editabas.
            </p>
          </div>
        </div>

        {/* Estado en vivo */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          fontSize: '0.75rem', color: '#34d399', background: 'rgba(52,211,153,0.1)',
          border: '1px solid rgba(52,211,153,0.25)', borderRadius: '12px',
          padding: '3px 10px', marginBottom: '16px',
        }}>
          <Users size={12} /> Edición en vivo: {activeEditors.length + 1} usuario{activeEditors.length + 1 === 1 ? '' : 's'} activo{activeEditors.length + 1 === 1 ? '' : 's'}
        </div>

        {/* Dos columnas de comparación */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '18px',
        }}>
          {/* Tus cambios */}
          <div style={{
            border: '1px solid rgba(231,76,60,0.4)', borderLeft: '4px solid #e74c3c',
            borderRadius: '10px', padding: '14px', background: 'rgba(231,76,60,0.04)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <div style={{
                width: '26px', height: '26px', borderRadius: '50%', flexShrink: 0,
                background: '#e74c3c', color: 'white', fontWeight: 'bold',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem',
              }}>
                {initial(user?.displayName || user?.email || 'Tú')}
              </div>
              <span style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>Tus cambios</span>
            </div>
            {view.yours.length === 0 ? (
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
                Sin cambios locales pendientes.
              </p>
            ) : (
              <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '0.85rem', display: 'grid', gap: '4px' }}>
                {view.yours.map((d) => (
                  <li key={d.slice}>
                    <strong>{SLICE_LABELS[d.slice] || d.slice}</strong> · {fmtCount(d.from)} → {fmtCount(d.to)}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Cambios del equipo */}
          <div style={{
            border: '1px solid rgba(52,152,219,0.4)', borderLeft: '4px solid #3498db',
            borderRadius: '10px', padding: '14px', background: 'rgba(52,152,219,0.04)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <div style={{
                width: '26px', height: '26px', borderRadius: '50%', flexShrink: 0,
                background: '#3498db', color: 'white', fontWeight: 'bold',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem',
              }}>
                {otherInitial}
              </div>
              <span style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>Cambios de {otherName}</span>
            </div>
            {view.theirs.length === 0 ? (
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
                Sin cambios detectados en esta comparación.
              </p>
            ) : (
              <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '0.85rem', display: 'grid', gap: '4px' }}>
                {view.theirs.map((d) => (
                  <li key={d.slice}>
                    <strong>{SLICE_LABELS[d.slice] || d.slice}</strong> · {fmtCount(d.from)} → {fmtCount(d.to)}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Acciones */}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button
            className="btn"
            onClick={() => resolveConflict('remote')}
            style={{
              background: '#3498db', color: 'white', border: '1px solid #3498db',
              justifyContent: 'center', alignItems: 'center',
            }}
          >
            <ArrowDownToLine size={14} /> Cargar versión del equipo
          </button>
          <button
            className="btn"
            onClick={() => resolveConflict('mine')}
            style={{
              background: 'rgba(231,76,60,0.1)', color: '#e74c3c',
              border: '1px solid rgba(231,76,60,0.5)',
              justifyContent: 'center', alignItems: 'center',
            }}
          >
            <Check size={14} /> Mantener mis cambios
          </button>
        </div>
        <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', margin: '12px 0 0', textAlign: 'right' }}>
          Se registrará la decisión en la bitácora de auditoría.
        </p>
      </div>
    </div>
  );
}
