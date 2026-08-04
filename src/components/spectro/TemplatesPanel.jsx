import { v4 as uuidv4 } from 'uuid';
import { Save, Plus, Trash2 } from 'lucide-react';

export default function TemplatesPanel({
  adminTemplateName,
  setAdminTemplateName,
  adminCurves,
  setAdminCurves,
  adminActiveCurveIdx,
  setAdminActiveCurveIdx,
  spectroTemplates,
  onSaveTemplate,
  onDeleteTemplate,
}) {
  return (
    <div className="spectro-grid">
      <div className="spectro-left">
        <div className="spectro-card">
          <h3>⚙️ Crear Plantilla de Concentraciones</h3>
          <p className="text-muted" style={{marginBottom: '16px'}}>Define las concentraciones oficiales para estandarizar el cálculo. Los usuarios no podrán modificar estas concentraciones cuando usen la plantilla.</p>

          <div className="settings-row" style={{marginBottom: '16px'}}>
            <div className="field" style={{flex: 1}}>
              <label>Nombre de la Plantilla</label>
              <input type="text" value={adminTemplateName} onChange={e => setAdminTemplateName(e.target.value)} placeholder="Ej: Método de Lowry Oficial" />
            </div>
            <div style={{display: 'flex', alignItems: 'flex-end'}}>
              <button className="btn btn-primary" onClick={onSaveTemplate}>
                <Save size={16}/> Guardar Plantilla
              </button>
            </div>
          </div>

          <div className="curves-tabs">
            {adminCurves.map((curve, idx) => (
              <button
                key={curve.id}
                className={`btn ${adminActiveCurveIdx === idx ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setAdminActiveCurveIdx(idx)}
              >
                {curve.name} ({curve.points.length} pts)
              </button>
            ))}
          </div>

          <table className="spectro-table">
            <thead>
              <tr>
                <th>Concentración [ ]</th>
                <th width="30"></th>
              </tr>
            </thead>
            <tbody>
              {adminCurves[adminActiveCurveIdx].points.map((p, i) => (
                <tr key={p.id}>
                  <td>
                    <input type="number" step="any" value={p.concentration} onChange={e => {
                      const newCurves = [...adminCurves];
                      newCurves[adminActiveCurveIdx].points[i].concentration = e.target.value;
                      setAdminCurves(newCurves);
                    }} placeholder="Ej: 5.0" />
                  </td>
                  <td>
                    <button className="btn-icon" onClick={() => {
                      const newCurves = [...adminCurves];
                      newCurves[adminActiveCurveIdx].points = newCurves[adminActiveCurveIdx].points.filter(pt => pt.id !== p.id);
                      setAdminCurves(newCurves);
                    }}><Trash2 size={16}/></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button className="btn btn-outline" style={{marginTop:'10px', width:'100%'}} onClick={() => {
            const newCurves = [...adminCurves];
            newCurves[adminActiveCurveIdx].points.push({ id: uuidv4(), concentration: '', abs1: '', abs2: '', abs3: '' });
            setAdminCurves(newCurves);
          }}>
            <Plus size={16}/> Agregar Concentración
          </button>
        </div>
      </div>

      <div className="spectro-right">
        <div className="spectro-card sticky-card">
          <h3>📂 Plantillas Oficiales Existentes</h3>
          {spectroTemplates.length === 0 ? (
            <p className="text-muted">No hay plantillas creadas.</p>
          ) : (
            <div style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
              {spectroTemplates.map(t => (
                <div key={t.id} style={{padding: '12px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                  <div>
                    <strong>{t.nombre}</strong>
                    <div style={{fontSize: '0.85rem', color: 'var(--text-secondary)'}}>
                      C1: {t.curvas?.[0]?.points?.length || 0} pts | C2: {t.curvas?.[1]?.points?.length || 0} pts | C3: {t.curvas?.[2]?.points?.length || 0} pts
                    </div>
                  </div>
                  <button className="btn-icon" style={{color: '#ef4444'}} onClick={() => onDeleteTemplate(t.id)}>
                    <Trash2 size={18}/>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}