import { FileText, BookOpen, Save } from 'lucide-react';

export default function ProtocolBar({
  selectedTemplateId,
  spectroTemplates,
  activeProtocolId,
  savedProtocols,
  onLoadTemplate,
  onLoadProtocol,
  protocolName,
  setProtocolName,
  protocolNotes,
  setProtocolNotes,
  isReadOnly,
  onSaveToCloud,
}) {
  return (
    <div className="protocol-bar">
      {/* Row 1: selectors */}
      <div className="protocol-selector-row">
        <div className="protocol-selector-group">
          <FileText size={18} style={{color: '#10b981', flexShrink: 0}}/>
          <select className="protocol-select" value={selectedTemplateId} onChange={onLoadTemplate} style={{borderColor: '#10b981'}}>
            <option value="">-- Cargar desde Plantilla Oficial --</option>
            {spectroTemplates.map(t => (
              <option key={t.id} value={t.id}>{t.nombre}</option>
            ))}
          </select>
        </div>

        <div className="protocol-selector-group">
          <BookOpen size={18} style={{color: '#6366f1', flexShrink: 0}}/>
          <select className="protocol-select" value={activeProtocolId} onChange={onLoadProtocol}>
            <option value="">-- Abrir Sesión Guardada --</option>
            {savedProtocols.map(p => (
              <option key={p.id} value={p.id}>{p.nombre} ({new Date(p.fecha).toLocaleDateString()}) – {p.autor}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Row 2: name + notes + save */}
      <div className="protocol-meta-row">
        <input
          type="text"
          placeholder="Nombre de Sesión (Ej: Lowry Lote 4)"
          value={protocolName}
          onChange={e => setProtocolName(e.target.value)}
          className="input-field"
          style={{ flex: '1', minWidth: '180px' }}
          disabled={isReadOnly}
        />
        <input
          type="text"
          placeholder="Notas u Observaciones..."
          value={protocolNotes}
          onChange={e => setProtocolNotes(e.target.value)}
          className="input-field"
          style={{ flex: '2', minWidth: '180px' }}
          disabled={isReadOnly}
        />
        <div className="admin-actions">
          {!isReadOnly && (
            <button className="btn btn-primary" onClick={onSaveToCloud}>
              <Save size={16}/> Guardar Sesión
            </button>
          )}
        </div>
      </div>
    </div>
  );
}