import React, { useState } from 'react';
import { loginUser, registerUser, loginWithGoogle } from '../utils/firebase';
import './AuthGate.css';

export default function AuthGate({ onAuthenticated, isElectron = false }) {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const cred = mode === 'login'
        ? await loginUser(email, password)
        : await registerUser(email, password);
      onAuthenticated(cred.user);
    } catch (err) {
      const msgs = {
        'auth/user-not-found': 'No existe una cuenta con ese correo.',
        'auth/wrong-password': 'Contraseña incorrecta.',
        'auth/email-already-in-use': 'Ya existe una cuenta con ese correo.',
        'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
        'auth/invalid-email': 'El formato del correo no es válido.',
        'auth/invalid-credential': 'Correo o contraseña incorrectos.',
      };
      setError(msgs[err.code] || 'Ocurrió un error. Intenta de nuevo.');
    }
    setLoading(false);
  };

  const handleGoogle = async () => {
    setError('');
    setLoading(true);
    try {
      const cred = await loginWithGoogle();
      onAuthenticated(cred.user);
    } catch (err) {
      setError('No se pudo iniciar sesión con Google.');
    }
    setLoading(false);
  };

  return (
    <div className="auth-overlay">
      <div className="auth-card glass-panel">
        {/* Header */}
        <div className="auth-header">
          <div className="auth-logo">🔬</div>
          <h1>LIMS Protocol Manager</h1>
          <p>Sistema de Gestión de Laboratorio</p>
        </div>

        {/* Tabs */}
        <div className="auth-tabs">
          <button
            className={`auth-tab ${mode === 'login' ? 'active' : ''}`}
            onClick={() => { setMode('login'); setError(''); }}
          >
            Iniciar Sesión
          </button>
          <button
            className={`auth-tab ${mode === 'register' ? 'active' : ''}`}
            onClick={() => { setMode('register'); setError(''); }}
          >
            Registrarse
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="auth-field">
            <label>Correo Electrónico</label>
            <input
              type="email"
              className="input-field"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="investigador@universidad.edu"
              required
              autoComplete="email"
            />
          </div>

          <div className="auth-field">
            <label>Contraseña</label>
            <input
              type="password"
              className="input-field"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder={mode === 'register' ? 'Mínimo 6 caracteres' : '••••••••'}
              required
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </div>

          {error && (
            <div className="auth-error">
              ⚠️ {error}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary auth-submit"
            disabled={loading}
          >
            {loading
              ? 'Procesando...'
              : mode === 'login' ? 'Entrar al Laboratorio' : 'Crear Cuenta'
            }
          </button>
        </form>

        {/* Divider + Google - solo en modo Web */}
        {!isElectron && (
          <>
            <div className="auth-divider"><span>o</span></div>
            <button
              className="btn auth-google-btn"
              onClick={handleGoogle}
              disabled={loading}
            >
              <svg width="18" height="18" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.1 0 5.9 1.1 8.1 3.1l6-6C34.5 3.2 29.5 1 24 1 14.8 1 7 6.7 3.9 14.6l7 5.4C12.5 13.7 17.8 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.7c-.6 3-2.3 5.5-4.8 7.2l7.4 5.7c4.3-4 6.8-9.8 7.2-16.9z"/>
                <path fill="#FBBC05" d="M10.9 28.4C10.3 26.8 10 25.1 10 23.3s.3-3.5.9-5.1l-7-5.4C2.3 16.2 1 19.6 1 23.3s1.3 7.1 3.9 9.8l7-4.7z"/>
                <path fill="#34A853" d="M24 47c5.5 0 10.1-1.8 13.4-4.9l-7.4-5.7c-1.8 1.2-4.1 1.9-6 1.9-6.2 0-11.5-4.2-13.3-9.9l-7 4.7C7 38.4 14.8 47 24 47z"/>
              </svg>
              Continuar con Google
            </button>
          </>
        )}

        <div className="auth-divider"><span>o</span></div>
        <button
          type="button"
          className="btn"
          style={{ width: '100%', marginTop: '8px', opacity: 0.8 }}
          onClick={() => onAuthenticated({ isGuest: true, email: 'Modo Local' })}
        >
          Continuar como Invitado (Modo Local)
        </button>

        {isElectron && (
          <div style={{textAlign: 'center', fontSize: '0.78rem', color: 'rgba(255,255,255,0.3)', padding: '4px 0'}}>
            🌐 Para iniciar sesión con Google, usa la versión web:<br/>
            <span style={{color: 'rgba(59,130,246,0.7)'}}>yakat1.github.io/protocol-manager</span>
          </div>
        )}

        <p className="auth-footer">
          Tus datos están cifrados y protegidos por Firebase.<br/>
          Cada cuenta accede únicamente a sus propios experimentos.
        </p>
      </div>
    </div>
  );
}
