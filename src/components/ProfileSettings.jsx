import React, { useState, useEffect } from 'react';
import { updateUserPassword, getMyInvitations, acceptInvitation, declineInvitation, getUserProfile } from '../utils/firebase';
import { X, Lock, LogOut, Code, User, Inbox, Check } from 'lucide-react';
import './AuthGate.css'; // Reuse glass-panel and overlay styles

export default function ProfileSettings({ user, state, updateState, onClose, onLogout, showToast, onProfileUpdate }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Invitations state
  const [invitations, setInvitations] = useState([]);
  const [invLoading, setInvLoading] = useState(false);

  useEffect(() => {
    if (user?.email && !user.isGuest) {
      getMyInvitations(user.email).then(setInvitations).catch(console.error);
    }
  }, [user]);

  const handleAcceptInv = async (inv) => {
    setInvLoading(true);
    try {
      await acceptInvitation(user, inv);
      const profile = await getUserProfile(user.uid);
      if (onProfileUpdate) onProfileUpdate(profile);
      showToast('Invitación aceptada. Laboratorio añadido a tu cuenta.');
      setInvitations(prev => prev.filter(i => i.labId !== inv.labId));
    } catch (err) {
      setError('Error al aceptar invitación: ' + err.message);
    }
    setInvLoading(false);
  };

  const handleDeclineInv = async (inv) => {
    setInvLoading(true);
    try {
      await declineInvitation(user.email, inv.labId);
      setInvitations(prev => prev.filter(i => i.labId !== inv.labId));
      showToast('Invitación rechazada.');
    } catch (err) {
      console.error(err);
    }
    setInvLoading(false);
  };
  
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

        {/* Pending Invitations Section */}
        {!user.isGuest && invitations.length > 0 && (
          <div style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '1rem', color: 'var(--accent)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Inbox size={18} /> Invitaciones a Laboratorios
            </h3>
            {invitations.map((inv, i) => (
              <div key={i} style={{
                background: 'rgba(255,255,255,0.05)', borderRadius: '6px', padding: '10px', marginBottom: '8px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px'
              }}>
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>🏢 {inv.labName}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                    Rol: {inv.role === 'admin' ? 'Administrador' : 'Estudiante'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button className="btn btn-primary" title="Aceptar" style={{ padding: '6px' }} onClick={() => handleAcceptInv(inv)} disabled={invLoading}>
                    <Check size={14} />
                  </button>
                  <button className="btn" title="Rechazar" style={{ padding: '6px', color: 'var(--danger)' }} onClick={() => handleDeclineInv(inv)} disabled={invLoading}>
                    <X size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

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
