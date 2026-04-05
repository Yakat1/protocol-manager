import React, { useState, useEffect } from 'react';
import { createLab, getMyInvitations, acceptInvitation, declineInvitation, migrateUserToLab, getUserProfile } from '../utils/firebase';

export default function LabSetup({ user, onLabReady }) {
  const [mode, setMode] = useState('loading'); // 'loading' | 'choose' | 'create' | 'migrating'
  const [labName, setLabName] = useState('');
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const init = async () => {
      try {
        // Check for pending invitations
        if (user.email) {
          const invs = await getMyInvitations(user.email);
          setInvitations(invs);
        }

        // Check if user already has labs (maybe from re-login)
        const profile = await getUserProfile(user.uid);
        if (profile?.labs?.length > 0) {
          onLabReady(profile);
          return;
        }

        setMode('choose');
      } catch (err) {
        console.error('LabSetup init error:', err);
        setMode('choose');
      }
    };
    init();
  }, [user]);

  const handleCreateLab = async () => {
    if (!labName.trim()) return setError('Ingresa un nombre para tu laboratorio.');
    setLoading(true); setError('');
    try {
      await createLab(user, labName.trim());
      const profile = await getUserProfile(user.uid);
      onLabReady(profile);
    } catch (err) {
      setError('Error creando laboratorio: ' + err.message);
      setLoading(false);
    }
  };

  const handleMigrate = async () => {
    setMode('migrating'); setError('');
    try {
      const profile = await migrateUserToLab(user);
      onLabReady(profile);
    } catch (err) {
      setError('Error migrando datos: ' + err.message);
      setMode('choose');
    }
  };

  const handleAccept = async (inv) => {
    setLoading(true); setError('');
    try {
      await acceptInvitation(user, inv);
      const profile = await getUserProfile(user.uid);
      onLabReady(profile);
    } catch (err) {
      setError('Error aceptando invitación: ' + err.message);
      setLoading(false);
    }
  };

  const handleDecline = async (inv) => {
    try {
      await declineInvitation(user.email, inv.labId);
      setInvitations(prev => prev.filter(i => i.labId !== inv.labId));
    } catch (err) {
      console.error('Error declining:', err);
    }
  };

  if (mode === 'loading' || mode === 'migrating') {
    return (
      <div className="app-container">
        <div style={{ margin: 'auto', color: 'white', textAlign: 'center' }}>
          <div className="lazy-spinner" style={{ margin: '0 auto 16px' }} />
          <p>{mode === 'migrating' ? 'Migrando tus datos al nuevo sistema de laboratorio...' : 'Cargando...'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <div style={{ margin: 'auto', maxWidth: '480px', padding: '24px' }}>
        <div className="glass-panel" style={{ padding: '28px', textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🔬</div>
          <h2 style={{ color: 'var(--text-primary)', marginBottom: '4px' }}>Configurar Laboratorio</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '24px' }}>
            Crea tu laboratorio o únete a uno existente.
          </p>

          {error && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', padding: '10px', borderRadius: '6px', marginBottom: '16px', fontSize: '0.85rem' }}>
              {error}
            </div>
          )}

          {/* Pending Invitations */}
          {invitations.length > 0 && (
            <div style={{ marginBottom: '20px', textAlign: 'left' }}>
              <h4 style={{ color: 'var(--accent)', marginBottom: '10px', fontSize: '0.9rem' }}>📩 Invitaciones Pendientes</h4>
              {invitations.map((inv, i) => (
                <div key={i} style={{
                  background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)',
                  borderRadius: '8px', padding: '12px', marginBottom: '8px',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px'
                }}>
                  <div>
                    <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>🏢 {inv.labName}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      Rol: {inv.role === 'admin' ? 'Administrador' : 'Estudiante'} · Invitado por {inv.invitedBy}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button className="btn btn-primary" style={{ fontSize: '0.75rem', padding: '5px 10px' }} onClick={() => handleAccept(inv)} disabled={loading}>
                      Unirme
                    </button>
                    <button className="btn" style={{ fontSize: '0.75rem', padding: '5px 10px' }} onClick={() => handleDecline(inv)} disabled={loading}>
                      Rechazar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* Create lab */}
            <div style={{ textAlign: 'left', border: '1px solid var(--border)', borderRadius: '8px', padding: '16px' }}>
              <h4 style={{ marginBottom: '10px', fontSize: '0.9rem' }}>🏗️ Crear Nuevo Laboratorio</h4>
              <input
                className="input-field"
                placeholder="Nombre del Laboratorio (ej. Lab Bioquímica UANL)"
                value={labName}
                onChange={e => setLabName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreateLab()}
                style={{ marginBottom: '10px' }}
              />
              <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={handleCreateLab} disabled={loading}>
                {loading ? 'Creando...' : 'Crear Laboratorio'}
              </button>
            </div>

            {/* Migrate existing data */}
            <button className="btn" style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: '0.85rem' }} onClick={handleMigrate}>
              📂 Ya tengo datos guardados — Migrar a Lab
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
