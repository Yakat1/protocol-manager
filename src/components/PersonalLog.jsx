import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Edit3, Save, X, Download, Filter, BookOpen, Clock, AlertTriangle, Tag, User } from 'lucide-react';
import { addPersonalLog, updatePersonalLog, deletePersonalLog, subscribeToPersonalLogs, getLabMembers } from '../utils/firebase';

const MOOD_OPTIONS = [
  { emoji: '😊', label: 'Productivo' },
  { emoji: '😐', label: 'Normal' },
  { emoji: '😴', label: 'Cansado' },
  { emoji: '🤯', label: 'Estresado' },
  { emoji: '🎉', label: 'Excelente' },
  { emoji: '🤔', label: 'Confundido' },
];

const EQUIPMENT_OPTIONS = [
  'Campana de Flujo Laminar', 'Centrífuga', 'Microscopio', 'PCR Termociclador', 'Espectrofotómetro',
  'Incubadora CO₂', 'Autoclave', 'Balanza Analítica', 'pH-metro', 'Sonicador',
  'Electroforesis', 'Vórtex', 'Baño María', 'Agitador Orbital', 'Otro'
];

const TAG_PRESETS = ['PCR', 'WB', 'ELISA', 'Cultivo', 'Pasaje', 'Buffer', 'Extracción', 'Cuantificación', 'Clonación', 'Transfección'];

export default function PersonalLog({ labId, user, can }) {
  const [logs, setLogs] = useState([]);
  const [members, setMembers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [filterUser, setFilterUser] = useState('all');
  const [filterTag, setFilterTag] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const unsubRef = useRef(null);

  // Form state
  const [form, setForm] = useState(getEmptyForm());

  function getEmptyForm() {
    return {
      date: new Date().toISOString().split('T')[0],
      time: new Date().toTimeString().slice(0, 5),
      activity: '',
      observations: '',
      equipment: [],
      incidents: '',
      mood: '😊',
      tags: [],
      adminNote: '',
    };
  }

  useEffect(() => {
    if (!labId) return;
    unsubRef.current = subscribeToPersonalLogs(labId, setLogs);
    if (can?.viewAllLogs) {
      getLabMembers(labId).then(setMembers);
    }
    return () => { if (unsubRef.current) unsubRef.current(); };
  }, [labId]);

  const resetForm = () => {
    setForm(getEmptyForm());
    setShowForm(false);
    setEditingId(null);
  };

  const handleSave = async () => {
    if (!form.activity.trim()) return alert('La actividad es obligatoria.');
    
    const logData = {
      ...form,
      userId: user.uid,
      userName: user.displayName || user.email,
    };

    try {
      if (editingId) {
        // If admin edits someone else's log, mark it
        const originalLog = logs.find(l => l.id === editingId);
        if (originalLog && originalLog.userId !== user.uid) {
          logData.adminEdit = {
            isEdited: true,
            editedBy: user.displayName || user.email,
            editedAt: new Date().toISOString(),
            adminNote: form.adminNote || '',
          };
          // Preserve original author
          logData.userId = originalLog.userId;
          logData.userName = originalLog.userName;
        }
        await updatePersonalLog(labId, editingId, logData);
      } else {
        await addPersonalLog(labId, logData);
      }
      resetForm();
    } catch (err) {
      alert('Error guardando: ' + err.message);
    }
  };

  const handleEdit = (log) => {
    const isOwn = log.userId === user.uid;
    if (!isOwn && !can?.editOthersLogs) return;
    setForm({
      date: log.date || '',
      time: log.time || '',
      activity: log.activity || '',
      observations: log.observations || '',
      equipment: log.equipment || [],
      incidents: log.incidents || '',
      mood: log.mood || '😊',
      tags: log.tags || [],
      adminNote: log.adminEdit?.adminNote || '',
    });
    setEditingId(log.id);
    setShowForm(true);
  };

  const handleDelete = async (log) => {
    const isOwn = log.userId === user.uid;
    if (!isOwn && !can?.deleteOthersLogs) return;
    if (!confirm('¿Eliminar esta entrada de la bitácora?')) return;
    try {
      await deletePersonalLog(labId, log.id);
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const toggleEquipment = (eq) => {
    setForm(prev => ({
      ...prev,
      equipment: prev.equipment.includes(eq)
        ? prev.equipment.filter(e => e !== eq)
        : [...prev.equipment, eq]
    }));
  };

  const toggleTag = (tag) => {
    setForm(prev => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter(t => t !== tag)
        : [...prev.tags, tag]
    }));
  };

  // Filtering
  const filtered = logs.filter(log => {
    if (filterUser === 'mine' && log.userId !== user.uid) return false;
    if (filterUser !== 'all' && filterUser !== 'mine' && log.userId !== filterUser) return false;
    if (filterTag && !(log.tags || []).includes(filterTag)) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return (log.activity || '').toLowerCase().includes(q) ||
             (log.observations || '').toLowerCase().includes(q) ||
             (log.userName || '').toLowerCase().includes(q);
    }
    return true;
  });

  // Group by date
  const groupedByDate = {};
  filtered.forEach(log => {
    const d = log.date || 'Sin fecha';
    if (!groupedByDate[d]) groupedByDate[d] = [];
    groupedByDate[d].push(log);
  });
  const sortedDates = Object.keys(groupedByDate).sort((a, b) => b.localeCompare(a));

  const exportCSV = () => {
    if (filtered.length === 0) return;
    let csv = 'Fecha,Hora,Usuario,Actividad,Observaciones,Equipos,Incidentes,Mood,Tags\n';
    filtered.forEach(l => {
      csv += `"${l.date}","${l.time}","${l.userName}","${(l.activity||'').replace(/"/g,"'")}","${(l.observations||'').replace(/"/g,"'")}","${(l.equipment||[]).join('; ')}","${(l.incidents||'').replace(/"/g,"'")}","${l.mood}","${(l.tags||[]).join(', ')}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'bitacora_personal.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      {/* Header */}
      <div className="glass-panel" style={{ padding: '20px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <BookOpen size={24} color="var(--accent)" /> Bitácora de Laboratorio
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              Registro diario de actividades, observaciones e incidentes.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-primary" onClick={() => { resetForm(); setShowForm(true); }}>
              <Plus size={14} /> Nueva Entrada
            </button>
            <button className="btn" onClick={exportCSV} title="Exportar CSV">
              <Download size={14} /> CSV
            </button>
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
          <div className="search-box" style={{ flex: '1 1 180px' }}>
            <Filter size={14} />
            <input className="input-field" placeholder="Buscar actividad..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
          <select className="input-field" value={filterUser} onChange={e => setFilterUser(e.target.value)} style={{ width: '160px' }}>
            <option value="all">👥 Todos</option>
            <option value="mine">👤 Mis entradas</option>
            {can?.viewAllLogs && members.map(m => (
              <option key={m.id} value={m.id}>👤 {m.displayName || m.email}</option>
            ))}
          </select>
          <select className="input-field" value={filterTag} onChange={e => setFilterTag(e.target.value)} style={{ width: '140px' }}>
            <option value="">🏷️ Todas las tags</option>
            {TAG_PRESETS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0 }}>{editingId ? '✏️ Editar Entrada' : '📝 Nueva Entrada'}</h3>
              <button className="btn-icon" onClick={resetForm}><X size={18} /></button>
            </div>

            {/* Date & Time */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>📅 Fecha</label>
                <input type="date" className="input-field" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>🕐 Hora</label>
                <input type="time" className="input-field" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} />
              </div>
            </div>

            {/* Activity */}
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>🔬 Actividad Realizada *</label>
              <textarea className="input-field" rows={3} value={form.activity} onChange={e => setForm({ ...form, activity: e.target.value })} placeholder="Describe la actividad realizada..." style={{ resize: 'vertical' }} />
            </div>

            {/* Observations */}
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>📋 Observaciones Especiales</label>
              <textarea className="input-field" rows={2} value={form.observations} onChange={e => setForm({ ...form, observations: e.target.value })} placeholder="Resultados, datos, anomalías..." style={{ resize: 'vertical' }} />
            </div>

            {/* Equipment */}
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>⚙️ Equipos Utilizados</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {EQUIPMENT_OPTIONS.map(eq => (
                  <button key={eq} onClick={() => toggleEquipment(eq)}
                    style={{
                      padding: '3px 8px', fontSize: '0.7rem', borderRadius: '12px', cursor: 'pointer',
                      background: form.equipment.includes(eq) ? 'var(--primary)' : 'rgba(255,255,255,0.06)',
                      border: `1px solid ${form.equipment.includes(eq) ? 'var(--primary)' : 'var(--border)'}`,
                      color: form.equipment.includes(eq) ? 'white' : 'var(--text-secondary)',
                      transition: 'all 0.15s',
                    }}>{eq}</button>
                ))}
              </div>
            </div>

            {/* Incidents */}
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>
                <AlertTriangle size={12} style={{ verticalAlign: 'middle' }} /> Incidentes / Errores
              </label>
              <textarea className="input-field" rows={2} value={form.incidents} onChange={e => setForm({ ...form, incidents: e.target.value })} placeholder="Derrames, errores de pipeteo, cortes de luz..." style={{ resize: 'vertical' }} />
            </div>

            {/* Mood */}
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>💭 Estado de Ánimo</label>
              <div style={{ display: 'flex', gap: '6px' }}>
                {MOOD_OPTIONS.map(m => (
                  <button key={m.emoji} onClick={() => setForm({ ...form, mood: m.emoji })}
                    title={m.label}
                    style={{
                      fontSize: '1.3rem', padding: '6px', borderRadius: '8px', cursor: 'pointer',
                      background: form.mood === m.emoji ? 'rgba(59,130,246,0.2)' : 'transparent',
                      border: `2px solid ${form.mood === m.emoji ? 'var(--primary)' : 'transparent'}`,
                      transition: 'all 0.15s',
                    }}>{m.emoji}</button>
                ))}
              </div>
            </div>

            {/* Tags */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>
                <Tag size={12} style={{ verticalAlign: 'middle' }} /> Etiquetas
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {TAG_PRESETS.map(tag => (
                  <button key={tag} onClick={() => toggleTag(tag)}
                    style={{
                      padding: '3px 8px', fontSize: '0.7rem', borderRadius: '12px', cursor: 'pointer',
                      background: form.tags.includes(tag) ? 'var(--accent)' : 'rgba(255,255,255,0.06)',
                      border: `1px solid ${form.tags.includes(tag) ? 'var(--accent)' : 'var(--border)'}`,
                      color: form.tags.includes(tag) ? 'white' : 'var(--text-secondary)',
                      transition: 'all 0.15s',
                    }}>#{tag}</button>
                ))}
              </div>
            </div>

            {/* Admin Note (only shown when admin edits someone else's log) */}
            {editingId && (() => {
              const originalLog = logs.find(l => l.id === editingId);
              if (originalLog && originalLog.userId !== user.uid && can?.editOthersLogs) {
                return (
                  <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '8px' }}>
                    <label style={{ fontSize: '0.8rem', color: '#f59e0b', marginBottom: '4px', display: 'block', fontWeight: 'bold' }}>
                      🛡️ Nota de Admin (obligatoria por transparencia)
                    </label>
                    <textarea className="input-field" rows={2} value={form.adminNote} onChange={e => setForm({ ...form, adminNote: e.target.value })}
                      placeholder="Razón de la edición: corrección de datos, revisión, etc."
                      style={{ resize: 'vertical', borderColor: 'rgba(245,158,11,0.3)' }} />
                  </div>
                );
              }
              return null;
            })()}

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button className="btn" onClick={resetForm}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave}>
                <Save size={14} /> {editingId ? 'Actualizar' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Timeline */}
      {sortedDates.length === 0 ? (
        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center' }}>
          <BookOpen size={48} style={{ opacity: 0.15, marginBottom: '12px' }} />
          <p style={{ color: 'var(--text-secondary)' }}>No hay entradas en la bitácora{filterUser !== 'all' || filterTag || searchTerm ? ' que coincidan con el filtro' : ' aún'}.</p>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Haz clic en "Nueva Entrada" para registrar tu primera actividad.</p>
        </div>
      ) : (
        sortedDates.map(date => (
          <div key={date} style={{ marginBottom: '16px' }}>
            {/* Date header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', padding: '0 4px' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--accent)', whiteSpace: 'nowrap' }}>
                📅 {date}
              </div>
              <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                {groupedByDate[date].length} entrada{groupedByDate[date].length > 1 ? 's' : ''}
              </div>
            </div>

            {/* Entries */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {groupedByDate[date].map(log => {
                const isOwn = log.userId === user.uid;
                const canEdit = isOwn || can?.editOthersLogs;
                const canDelete = isOwn || can?.deleteOthersLogs;

                return (
                  <div key={log.id} className="glass-panel" style={{
                    padding: '14px 16px',
                    borderLeft: `3px solid ${isOwn ? 'var(--primary)' : 'var(--accent)'}`,
                    position: 'relative',
                  }}>
                    {/* Top row: time, user, mood, actions */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <Clock size={11} /> {log.time || '--:--'}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: isOwn ? 'var(--primary)' : 'var(--accent)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <User size={11} /> {log.userName || 'Anónimo'}
                        </span>
                        <span style={{ fontSize: '1rem' }}>{log.mood}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        {canEdit && <button className="btn-icon" onClick={() => handleEdit(log)} title="Editar"><Edit3 size={13} /></button>}
                        {canDelete && <button className="btn-icon" onClick={() => handleDelete(log)} title="Eliminar" style={{ color: 'var(--danger)' }}><Trash2 size={13} /></button>}
                      </div>
                    </div>

                    {/* Activity */}
                    <div style={{ fontSize: '0.9rem', fontWeight: '500', marginBottom: '4px', lineHeight: '1.4' }}>
                      {log.activity}
                    </div>

                    {/* Observations */}
                    {log.observations && (
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px', lineHeight: '1.4', fontStyle: 'italic' }}>
                        📋 {log.observations}
                      </div>
                    )}

                    {/* Incidents */}
                    {log.incidents && (
                      <div style={{ fontSize: '0.8rem', color: '#f87171', marginBottom: '4px', display: 'flex', alignItems: 'flex-start', gap: '4px' }}>
                        <AlertTriangle size={12} style={{ marginTop: '2px', flexShrink: 0 }} /> {log.incidents}
                      </div>
                    )}

                    {/* Equipment */}
                    {log.equipment?.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', marginBottom: '4px' }}>
                        {log.equipment.map(eq => (
                          <span key={eq} style={{ fontSize: '0.65rem', padding: '1px 6px', borderRadius: '8px', background: 'rgba(59,130,246,0.1)', color: 'var(--primary)', border: '1px solid rgba(59,130,246,0.15)' }}>
                            ⚙️ {eq}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Tags */}
                    {log.tags?.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', marginBottom: '4px' }}>
                        {log.tags.map(tag => (
                          <span key={tag} style={{ fontSize: '0.65rem', padding: '1px 6px', borderRadius: '8px', background: 'rgba(16,185,129,0.1)', color: 'var(--accent)', border: '1px solid rgba(16,185,129,0.15)' }}>
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Admin edit badge */}
                    {log.adminEdit?.isEdited && (
                      <div style={{
                        marginTop: '6px', padding: '6px 10px', borderRadius: '6px',
                        background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
                        fontSize: '0.7rem', color: '#f59e0b',
                      }}>
                        🛡️ <strong>Editado por Admin:</strong> {log.adminEdit.editedBy}
                        {log.adminEdit.editedAt && <span> · {log.adminEdit.editedAt.split('T')[0]}</span>}
                        {log.adminEdit.adminNote && <div style={{ marginTop: '2px', color: 'var(--text-secondary)' }}>Nota: {log.adminEdit.adminNote}</div>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
