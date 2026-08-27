import { Component } from 'react';
import { captureError, autoSaveDiagnostic, downloadDiagnosticTxt } from '../utils/diagnostics';

export default class ErrorBoundary extends Component {
  state = { hasError: false, savedPath: null, txt: '' };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info);
    // Diagnóstico temporal: genera el .txt y lo guarda en Electron si es posible.
    const { txt } = captureError(error, info);
    this.setState({ txt });
    autoSaveDiagnostic(txt).then((path) => {
      if (path) this.setState({ savedPath: path });
    });
  }

  handleDownload = () => {
    if (this.state.txt) downloadDiagnosticTxt(this.state.txt);
  };

  handleRetry = () => {
    // Reintenta renderizando de nuevo el subtree. Si el error fue transitorio
    // (carrera de commits, red, etc.) se recupera sin recargar; si persiste, el
    // boundary vuelve a atrapar el error y se muestra otra vez este mensaje.
    this.setState({ hasError: false, savedPath: null, txt: '' });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="app-container">
          <div style={{ margin: 'auto', maxWidth: '440px', textAlign: 'center', color: 'white' }}>
            <div className="glass-panel" style={{ padding: '32px' }}>
              <div style={{ fontSize: '3rem', marginBottom: '16px' }}>⚠️</div>
              <h2 style={{ marginBottom: '8px' }}>Algo salió mal</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '20px' }}>
                Ocurrió un error inesperado al cargar el módulo. Reintenta o recarga la página para continuar.
              </p>

              {/* Diagnóstico temporal */}
              <div style={{
                marginBottom: '16px', padding: '10px 12px', borderRadius: '8px',
                background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)',
                fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'left',
              }}>
                <div style={{ fontWeight: 'bold', color: '#fbbf24', marginBottom: '4px', textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.5px' }}>
                  🔧 Diagnóstico de error
                </div>
                {this.state.savedPath ? (
                  <div style={{ wordBreak: 'break-all' }}>
                    ✅ Guardado en:<br />{this.state.savedPath}
                  </div>
                ) : (
                  <div>
                    Descarga el .txt con los detalles del error y envíalo para poder diagnosticarlo.
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={this.handleDownload}>
                  📥 Descargar diagnóstico (.txt)
                </button>
                <button className="btn" style={{ width: '100%', justifyContent: 'center' }} onClick={this.handleRetry}>
                  🔁 Reintentar
                </button>
                <button className="btn" style={{ width: '100%', justifyContent: 'center' }} onClick={() => window.location.reload()}>
                  🔄 Recargar
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
