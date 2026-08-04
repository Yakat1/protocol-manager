import { useState } from 'react';
import { FlaskConical } from 'lucide-react';
import { parseCalcFloat } from '../../utils/calculations';

export default function FentonCard() {
  const [fenton, setFenton] = useState({ h2o2Target: '150', feRatio: '6', volumeMl: '1' });

  const fRes = () => {
    const h2o2 = parseCalcFloat(fenton.h2o2Target);
    const ratio = parseCalcFloat(fenton.feRatio);
    const vol = parseCalcFloat(fenton.volumeMl);
    if (!h2o2 || !ratio || !vol) return null;
    return { feConc: h2o2 / ratio, h2o2, vol };
  };

  const result = fRes();

  return (
    <div className="glass-panel calc-card">
      <h4><FlaskConical size={18}/> Reacción de Fenton (Fe²⁺ + H₂O₂)</h4>
      <div className="calc-row">
        <div className="input-group">
          <label className="input-label">H₂O₂ Objetivo (µM)</label>
          <input className="input-field" type="text" inputMode="decimal" value={fenton.h2o2Target} onChange={e => setFenton({...fenton, h2o2Target: e.target.value})} />
        </div>
        <div className="input-group">
          <label className="input-label">Ratio Fe:H₂O₂ (1:X)</label>
          <input className="input-field" type="text" inputMode="decimal" value={fenton.feRatio} onChange={e => setFenton({...fenton, feRatio: e.target.value})} />
        </div>
      </div>
      <div className="input-group">
        <label className="input-label">Volumen Final (mL)</label>
        <input className="input-field" type="text" inputMode="decimal" value={fenton.volumeMl} onChange={e => setFenton({...fenton, volumeMl: e.target.value})} />
      </div>
      {result && (
        <div className="calc-result">
          <div className="calc-result-value">FeSO₄: {result.feConc.toFixed(1)} µM</div>
          <div className="calc-result-label">
            Agregar FeSO₄ a {result.feConc.toFixed(1)} µM primero. Esperar 5 min, luego agregar H₂O₂ a {result.h2o2} µM en {result.vol} mL totales.
          </div>
        </div>
      )}
    </div>
  );
}
