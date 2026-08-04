import { v4 as uuidv4 } from 'uuid';
import { ClipboardPaste, Plus, Trash2, Download } from 'lucide-react';

export default function SamplesPanel({
  protocolFactor,
  finalFactor,
  factorSource,
  setFactorSource,
  manualFactorInput,
  setManualFactorInput,
  globalDilution,
  setGlobalDilution,
  globalTime,
  setGlobalTime,
  samples,
  setSamples,
  isReadOnly,
  processedSamples,
  onPasteSamples,
  onExport,
}) {
  return (
    <div className="spectro-grid">
      {/* Left Column: Samples Config & Table */}
      <div className="spectro-left">
        <div className="spectro-card">
          <h3>⚙️ Configuración de Muestras</h3>
          <div className="settings-row" style={{marginBottom: '16px'}}>
            <div className="field">
              <label>Origen del Factor Matemático</label>
              <select value={factorSource} onChange={e => setFactorSource(e.target.value)}>
                <option value="protocol">Factor Promedio del Protocolo ({protocolFactor.toFixed(4)})</option>
                <option value="manual">Ingresar Factor Manual</option>
              </select>
            </div>
            {factorSource === 'manual' && (
              <div className="field" style={{width:'150px'}}>
                <label>Factor Manual</label>
                <input type="number" step="any" value={manualFactorInput} onChange={e => setManualFactorInput(e.target.value)} placeholder="Ej: 45.20" />
              </div>
            )}
          </div>
          <div className="settings-row">
            <div className="field" style={{width:'100px'}}>
              <label>Dil. Global</label>
              <input type="number" step="any" value={globalDilution} onChange={e => setGlobalDilution(e.target.value)} disabled={isReadOnly} />
            </div>
            <div className="field" style={{width:'100px'}}>
              <label>T (min)</label>
              <input type="number" step="any" value={globalTime} onChange={e => setGlobalTime(e.target.value)} disabled={isReadOnly} />
            </div>
          </div>
        </div>

        <div className="spectro-card" style={{overflowX: 'auto'}}>
          <div className="card-header-flex" style={{marginBottom: '8px'}}>
            <h3>🧬 Muestras</h3>
            {!isReadOnly && <button className="btn btn-small" onClick={onPasteSamples}><ClipboardPaste size={14}/> Pegar de Excel</button>}
          </div>

          <div className="sample-math-toggle" style={{justifyContent: 'center', backgroundColor: 'rgba(16, 185, 129, 0.1)', borderColor: '#10b981', color: '#047857'}}>
            <strong>Factor Aplicado: {finalFactor ? finalFactor.toFixed(5) : '0.00000'}</strong>
          </div>

          <table className="spectro-table samples-table" style={{marginTop:'16px'}}>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Absorbancia</th>
                <th>Dil. (Opc)</th>
                <th>T (Opc)</th>
                {!isReadOnly && <th width="30"></th>}
              </tr>
            </thead>
            <tbody>
              {samples.map((s, i) => (
                <tr key={s.id}>
                  <td>
                    <input type="text" value={s.name} onChange={e => {
                      const newS = [...samples]; newS[i].name = e.target.value; setSamples(newS);
                    }} placeholder="Muestra" style={{width:'100px'}} disabled={isReadOnly} />
                  </td>
                  <td>
                    <input type="number" step="any" value={s.value} onChange={e => {
                      const newS = [...samples]; newS[i].value = e.target.value; setSamples(newS);
                    }} placeholder="Abs" disabled={isReadOnly} />
                  </td>
                  <td>
                    <input type="number" step="any" value={s.dilution} onChange={e => {
                      const newS = [...samples]; newS[i].dilution = e.target.value; setSamples(newS);
                    }} placeholder={`(${globalDilution})`} style={{width:'60px'}} disabled={isReadOnly} />
                  </td>
                  <td>
                    <input type="number" step="any" value={s.time} onChange={e => {
                      const newS = [...samples]; newS[i].time = e.target.value; setSamples(newS);
                    }} placeholder={`(${globalTime})`} style={{width:'60px'}} disabled={isReadOnly} />
                  </td>
                  {!isReadOnly && (
                    <td>
                      <button className="btn-icon" onClick={() => setSamples(samples.filter(st => st.id !== s.id))}><Trash2 size={16}/></button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {!isReadOnly && (
            <button className="btn btn-outline" style={{marginTop:'10px', width:'100%'}} onClick={() => setSamples([...samples, { id: uuidv4(), name: `Muestra ${samples.length+1}`, value: '', dilution: '', time: '' }])}>
              <Plus size={16}/> Agregar Fila
            </button>
          )}
        </div>
      </div>

      {/* Right Column: Samples Results & Export */}
      <div className="spectro-right">
        <div className="spectro-card sticky-card">
          <h3>📝 Resultados de Muestras</h3>

          <div className="results-preview">
            <div className="results-table-container" style={{maxHeight: '400px'}}>
              <table className="spectro-results-table">
                <thead>
                  <tr>
                    <th>Muestra</th>
                    <th>Abs</th>
                    <th>[ ]</th>
                    <th>Actividad</th>
                  </tr>
                </thead>
                <tbody>
                  {processedSamples.map(s => (
                    <tr key={s.id}>
                      <td title={s.name}>{s.name.substring(0, 10) || '—'}</td>
                      <td>{s.value || '—'}</td>
                      <td>{s.calculated_concentration !== null ? s.calculated_concentration.toFixed(3) : '—'}</td>
                      <td><strong>{s.final_activity !== null ? s.final_activity.toFixed(3) : '—'}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <button className="btn btn-primary btn-large" style={{width:'100%', marginTop:'16px'}} onClick={onExport}>
            <Download size={18}/> Exportar Reporte GLP Completo
          </button>
        </div>
      </div>
    </div>
  );
}