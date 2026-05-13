import React from 'react';
import './GLPPrintLayout.css';

export default function GLPPrintLayout({ children, state, user, labProfile, activeLabId, disabled }) {
  if (disabled) return <>{children}</>;

  // Configuración para el GLP Header
  const activeLabName = labProfile?.labs?.find(l => l.labId === activeLabId)?.labName || 'Laboratorio LIMS';
  const protocolName = state?.protocolName || 'Protocolo General';
  const operatorName = user?.displayName || user?.email || 'Operador Anónimo';
  
  const now = new Date();
  const dateStr = now.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div className="glp-print-wrapper">
      {/* GLP Header (Se repite en impresión gracias a fixed/tfoot thead nativo si se wrappea, 
          pero aquí usaremos un diseño de tabla para asegurar su repetición en todas las páginas) */}
      <table className="glp-print-table">
        <thead>
          <tr>
            <td>
              <div className="glp-header">
                <div className="glp-header-top">
                  <div className="glp-brand">
                    <h2>{activeLabName}</h2>
                    <p>Reporte de Trazabilidad y Gestión (GLP Standard)</p>
                  </div>
                  <div className="glp-meta">
                    <p><strong>Operador:</strong> {operatorName}</p>
                    <p><strong>Fecha Impresión:</strong> {dateStr}</p>
                    <p><strong>Firma de Tiempo:</strong> {timeStr}</p>
                  </div>
                </div>
                <div className="glp-header-bottom">
                  <h3>Protocolo: {protocolName}</h3>
                </div>
              </div>
            </td>
          </tr>
        </thead>
        
        <tbody>
          <tr>
            <td>
              {/* Contenido Inyectado */}
              <div className="glp-content">
                {children}
              </div>
            </td>
          </tr>
        </tbody>

        <tfoot>
          <tr>
            <td>
              <div className="glp-footer">
                <div className="glp-signature-line">
                  <div className="line"></div>
                  <span>Firma del Investigador Principal / Operador</span>
                </div>
                {/* Nota: En navegadores modernos, CSS se encarga del page numbering con counter(page) */}
                <div className="glp-page-number"></div>
              </div>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
