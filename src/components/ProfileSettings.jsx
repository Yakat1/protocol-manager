import React, { useState } from 'react';
import { updateUserPassword } from '../utils/firebase';
import { X, Lock, LogOut, Code, User } from 'lucide-react';
import './AuthGate.css'; // Reuse glass-panel and overlay styles

export default function ProfileSettings({ user, state, updateState, onClose, onLogout, showToast }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const isGoogleUser = user?.providerData?.some(p => p.providerId === 'google.com');

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    if (newPassword.length < 6) {
      return setError('La nueva contraseña debe tener al menos 6 caracteres.');
    }

    setLoading(true);
    try {
      await updateUserPassword(currentPassword, newPassword);
      setSuccess('Contraseña actualizada correctamente.');
      setCurrentPassword('');
      setNewPassword('');
    } catch (err) {
      if (err.code === 'auth/invalid-credential') {
        setError('La contraseña actual es incorrecta.');
      } else if (err.code === 'auth/no-user') {
        setError('Sesión no válida. Inicia sesión nuevamente.');
      } else {
        setError('Error al cambiar contraseña: ' + err.message);
      }
    }
    setLoading(false);
  };

  const handleThemeChange = (e) => {
    const newSettings = { ...state.settings, theme: e.target.value };
    updateState({ settings: newSettings });
    showToast(`Tema cambiado a ${e.target.value === 'dark' ? 'Oscuro' : 'Claro'} (Simulado)`);
  };

  return (
    <div className="auth-overlay">
      <div className="auth-card glass-panel" style={{ width: '100%', maxWidth: '400px', position: 'relative' }}>
        <button 
          onClick={onClose}
          style={{ position: 'absolute', top: '15px', right: '15px', background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
        >
          <X size={20} />
        </button>

        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{ background: 'var(--primary)', color: 'white', borderRadius: '50%', width: '60px', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
            <User size={32}/>
          </div>
          <h2 style={{ marginBottom: '5px' }}>Perfil de Usuario</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', wordBreak: 'break-all' }}>
            {user.isGuest ? 'Modo Invitado (Sin guardado en nube)' : user.email}
          </p>
        </div>

        {/* Change Password Section */}
        {!user.isGuest && (
          <div style={{ background: 'rgba(0,0,0,0.1)', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Lock size={16} /> Seguridad
            </h3>
            
            {isGoogleUser ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Has iniciado sesión con Google. Gestiona tu seguridad y contraseña directamente desde tu cuenta de Google.
              </p>
            ) : (
              <form onSubmit={handlePasswordChange}>
                <div style={{ marginBottom: '10px' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '5px' }}>Contraseña Actual</label>
                  <input 
                    type="password" 
                    className="input-field" 
                    style={{ width: '100%', boxSizing: 'border-box' }}
                    value={currentPassword} 
                    onChange={e => setCurrentPassword(e.target.value)} 
                    required 
                  />
                </div>
                <div style={{ marginBottom: '10px' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '5px' }}>Nueva Contraseña</label>
                  <input 
                    type="password" 
                    className="input-field" 
                    style={{ width: '100%', boxSizing: 'border-box' }}
                    value={newPassword} 
                    onChange={e => setNewPassword(e.target.value)} 
                    required 
                  />
                </div>
                
                {error && <div style={{ color: '#ef4444', fontSize: '0.85rem', marginBottom: '10px' }}>{error}</div>}
                {success && <div style={{ color: '#10b981', fontSize: '0.85rem', marginBottom: '10px' }}>{success}</div>}
                
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  style={{ width: '100%', justifyContent: 'center' }}
                  disabled={loading}
                >
                  {loading ? 'Actualizando...' : 'Cambiar Contraseña'}
                </button>
              </form>
            )}
          </div>
        )}

        {/* Generic Profile Settings */}
        <div style={{ background: 'rgba(0,0,0,0.1)', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '1rem', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Code size={16} /> Ajustes Adicionales
          </h3>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Tema Visual</span>
            <select 
              className="input-field" 
              style={{ width: '120px', padding: '4px' }}
              value={state.settings?.theme || 'dark'}
              onChange={handleThemeChange}
            >
              <option value="dark">🌙 Oscuro</option>
              <option value="light">☀️ Claro</option>
            </select>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', opacity: 0.7, marginTop: '10px' }}>
            * Estos ajustes se guardan asociados a tu perfil.
          </p>
        </div>

        {/* Logout */}
        <button 
          className="btn" 
          style={{ width: '100%', justifyContent: 'center', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)' }}
          onClick={() => {
            onClose();
            onLogout();
          }}
        >
          <LogOut size={16} style={{ marginRight: '8px' }} /> Cerrar Sesión
        </button>
      </div>
    </div>
  );
}
