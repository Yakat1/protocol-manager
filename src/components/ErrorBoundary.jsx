import { Component } from 'react';

export default class ErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="app-container">
          <div style={{ margin: 'auto', maxWidth: '420px', textAlign: 'center', color: 'white' }}>
            <div className="glass-panel" style={{ padding: '32px' }}>
              <div style={{ fontSize: '3rem', marginBottom: '16px' }}>⚠️</div>
              <h2 style={{ marginBottom: '8px' }}>Algo salió mal</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '24px' }}>
                Ocurrió un error inesperado al cargar el módulo. Recarga la página para continuar.
              </p>
              <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => window.location.reload()}>
                🔄 Recargar
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
