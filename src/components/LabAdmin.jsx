import React, { useState, useEffect, useRef } from 'react';
import { getLabMembers, inviteMember, updateMemberRole, removeMember, subscribeToAuditLog, getLabInfo } from '../utils/firebase';
import { Shield, Users, FileText, Trash2, Download } from 'lucide-react';

const ACTION_LABELS = {
  inventory_discount: '📦 Descuento de inventario',
  inventory_add: '📦 Ítem añadido',
  inventory_delete: '📦 Ítem eliminado',
  inventory_edit: '📦 Edición de inventario',
  culture_log_add: '🦠 Evento de cultivo añadido',
  culture_log_delete: '🦠 Evento de cultivo eliminado',
  culture_add: '🦠 Cultivo creado',
  culture_delete: '🦠 Cultivo eliminado',
};

export default function LabAdmin({ labId, user }) {
  const [tab, setTab] = useState('members'); // 'members' | 'audit'
  const [members, setMembers] = useState([]);
  const [auditEntries, setAuditEntries] = useState([]);
  const [labInfo, setLabInfo] = useState(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('student');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteMsg, setInviteMsg] = useState('');
  const [auditFilter, setAuditFilter] = useState('');
  const auditUnsub = useRef(null);

  useEffect(() => {
    if (!labId) return;
    loadMembers();
    getLabInfo(labId).then(setLabInfo);
    
    // Subscribe to audit log
    auditUnsub.current = subscribeToAuditLog(labId, setAuditEntries);
    return () => { if (auditUnsub.current) auditUnsub.current(); };
  }, [labId]);

  const loadMembers = async () => {
    const m = await getLabMembers(labId);
    setMembers(m);
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviteLoading(true); setInviteMsg('');
    try {
      await inviteMember(labId, labInfo?.name || 'Lab', inviteEmail.trim(), inviteRole, user.displayName || user.email);
      setInviteMsg(`✅ Invitación enviada a ${inviteEmail}`);
      setInviteEmail('');
    } catch (err) {
      setInviteMsg(`❌ ${err.message}`);
    }
    setInviteLoading(false);
  };

  const handleRoleChange = async (memberId, newRole) => {
    if (!confirm(`¿Cambiar rol a "${newRole === 'admin' ? 'Administrador' : 'Estudiante'}"?`)) return;
    try {
      await updateMemberRole(labId, memberId, newRole);
      loadMembers();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const handleRemove = async (member) => {
    if (member.id === user.uid) return alert('No puedes removerte a ti mismo.');
    if (!confirm(`¿Remover a "${member.displayName || member.email}" del laboratorio? Esta acción es irreversible.`)) return;
    try {
      await removeMember(labId, member.id);
      loadMembers();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const filteredAudit = auditEntries.filter(e => {
    if (!auditFilter) return true;
    const q = auditFilter.toLowerCase();
    return (e.displayName || '').toLowerCase().includes(q) ||
           (e.target || '').toLowerCase().includes(q) ||
           (e.action || '').toLowerCase().includes(q);
  });

  const exportAuditCSV = () => {
    if (filteredAudit.length === 0) return;
    let csv = 'Fecha,Usuario,Acción,Objetivo,Detalles\n';
    filteredAudit.forEach(e => {
      const details = e.details ? JSON.stringify(e.details).replace(/"/g, "'") : '';
      csv += `"${e.timestamp}","${e.displayName}","${ACTION_LABELS[e.action] || e.action}","${e.target || ''}","${details}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'bitacora_auditoria.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <div className="glass-panel" style={{ padding: '20px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <Shield size={24} color="var(--warning)" /> Panel de Administración
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              🏢 {labInfo?.name || 'Laboratorio'} · <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>ID: {labId?.slice(0, 8)}...</span>
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className={`btn ${tab === 'members' ? 'btn-primary' : ''}`} onClick={() => setTab('members')}>
              <Users size={14} /> Miembros ({members.length})
            </button>
            <button className={`btn ${tab === 'audit' ? 'btn-primary' : ''}`} onClick={() => setTab('audit')}>
              <FileText size={14} /> Bitácora ({auditEntries.length})
            </button>
          </div>
        </div>
      </div>

      {tab === 'members' ? (
        <>
          {/* Invite Section */}
          <div className="glass-panel" style={{ padding: '16px', marginBottom: '16px' }}>
            <h4 style={{ marginBottom: '12px', fontSize: '0.9rem' }}>📩 Invitar Miembro por Email</h4>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <input className="input-field" placeholder="correo@ejemplo.com" value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleInvite()}
                style={{ flex: '1 1 200px' }} />
              <select className="input-field" value={inviteRole} onChange={e => setInviteRole(e.target.value)} style={{ width: '140px' }}>
                <option value="student">Estudiante</option>
                <option value="admin">Administrador</option>
              </select>
              <button className="btn btn-primary" onClick={handleInvite} disabled={inviteLoading}>
                {inviteLoading ? '...' : 'Invitar'}
              </button>
            </div>
            {inviteMsg && <div style={{ marginTop: '8px', fontSize: '0.85rem' }}>{inviteMsg}</div>}
          </div>

          {/* Members List */}
          <div className="glass-panel" style={{ padding: '16px' }}>
            <h4 style={{ marginBottom: '12px', fontSize: '0.9rem' }}>👥 Miembros del Laboratorio</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {members.map(m => (
                <div key={m.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px',
                  border: '1px solid var(--border)', flexWrap: 'wrap', gap: '8px'
                }}>
                  <div>
                    <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>
                      {m.displayName || m.email}
                      {m.id === user.uid && <span style={{ color: 'var(--accent)', fontSize: '0.7rem', marginLeft: '6px' }}>(Tú)</span>}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {m.email} · Ingresó: {m.joinedAt?.split('T')[0]}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <select className="input-field" value={m.role} style={{ width: '130px', fontSize: '0.8rem' }}
                      onChange={e => handleRoleChange(m.id, e.target.value)} disabled={m.id === user.uid}>
                      <option value="admin">🛡️ Admin</option>
                      <option value="student">📚 Estudiante</option>
                    </select>
                    {m.id !== user.uid && (
                      <button className="btn-icon" style={{ color: 'var(--danger)' }} onClick={() => handleRemove(m)}><Trash2 size={14} /></button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        /* ── Audit Log ── */
        <div className="glass-panel" style={{ padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
            <h4 style={{ margin: 0, fontSize: '0.9rem' }}>📜 Bitácora de Auditoría</h4>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input className="input-field" placeholder="Filtrar por usuario, acción..." value={auditFilter}
                onChange={e => setAuditFilter(e.target.value)} style={{ width: '200px', fontSize: '0.8rem' }} />
              <button className="btn" style={{ fontSize: '0.75rem' }} onClick={exportAuditCSV}>
                <Download size={12} /> CSV
              </button>
            </div>
          </div>
          
          {filteredAudit.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              <FileText size={32} style={{ opacity: 0.2, marginBottom: '8px' }} />
              <p>No hay entradas de auditoría{auditFilter ? ' que coincidan con el filtro' : ' aún'}.</p>
            </div>
          ) : (
            <div style={{ maxHeight: '500px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {filteredAudit.map(e => (
                <div key={e.id} style={{
                  display: 'flex', gap: '10px', padding: '8px 10px', fontSize: '0.8rem',
                  background: 'rgba(255,255,255,0.02)', borderRadius: '4px', borderLeft: '3px solid var(--accent)',
                  alignItems: 'flex-start'
                }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', minWidth: '90px' }}>
                    {e.timestamp?.split('T')[0]}<br />
                    <span style={{ fontSize: '0.65rem' }}>{e.timestamp?.split('T')[1]?.slice(0, 8)}</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: 'bold' }}>👤 {e.displayName}</span>
                    {' · '}
                    <span style={{ color: 'var(--accent)' }}>{ACTION_LABELS[e.action] || e.action}</span>
                    {e.target && <span> → <strong>{e.target}</strong></span>}
                    {e.details && Object.keys(e.details).length > 0 && (
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        {e.details.before != null && <span>Antes: {e.details.before}</span>}
                        {e.details.after != null && <span> → Después: {e.details.after}</span>}
                        {e.details.note && <span>{e.details.note}</span>}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
