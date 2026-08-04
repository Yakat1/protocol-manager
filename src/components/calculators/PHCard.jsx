import { useState } from 'react';
import { parseCalcFloat } from '../../utils/calculations';

export default function PHCard() {
  const [bufferPH, setBufferPH] = useState({ pKa: '', acidConc: '', baseConc: '' });

  return (
    <div className="glass-panel calc-card">
      <h4>🧪 Estimación de pH (Henderson-Hasselbalch)</h4>
      <p style={{ fontSize: '0.75rem', color: 'var(--warning)', marginBottom: '10px', marginTop: '-6px' }}>pH = pKa + log₁₀([A⁻] / [HA]). Estimación teórica, verificar con pHímetro.</p>
      <div className="calc-row">
        <div className="input-group">
          <label className="input-label">pKa del Buffer</label>
          <input className="input-field" type="text" inputMode="decimal" step="0.01" placeholder="ej. 6.86 (fosfato)" value={bufferPH.pKa} onChange={e => setBufferPH({...bufferPH, pKa: e.target.value})} />
        </div>
        <div className="input-group">
          <label className="input-label">[A⁻] Base conjugada (mM)</label>
          <input className="input-field" type="text" inputMode="decimal" placeholder="ej. 80" value={bufferPH.baseConc} onChange={e => setBufferPH({...bufferPH, baseConc: e.target.value})} />
        </div>
      </div>
      <div className="input-group" style={{ marginTop: '8px' }}>
        <label className="input-label">[HA] Ácido (mM)</label>
        <input className="input-field" type="text" inputMode="decimal" placeholder="ej. 20" value={bufferPH.acidConc} onChange={e => setBufferPH({...bufferPH, acidConc: e.target.value})} />
      </div>
      {(() => {
        const pKa = parseCalcFloat(bufferPH.pKa);
        const base = parseCalcFloat(bufferPH.baseConc);
        const acid = parseCalcFloat(bufferPH.acidConc);
        if (!pKa || !base || !acid || acid <= 0) return null;
        const pH = pKa + Math.log10(base / acid);
        return (
          <div className="calc-result">
            <div className="calc-result-value">pH ≈ {pH.toFixed(2)}</div>
            <div className="calc-result-label">Ratio [A⁻]/[HA] = {(base/acid).toFixed(2)} | pKa = {pKa}</div>
          </div>
        );
      })()}
    </div>
  );
}