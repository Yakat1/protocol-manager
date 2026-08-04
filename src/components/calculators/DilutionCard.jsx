import { useState } from 'react';
import { Beaker, MinusCircle } from 'lucide-react';
import { parseCalcFloat } from '../../utils/calculations';

export default function DilutionCard({ inventory, selectedInventoryId, onSelectedInventoryIdChange, onDiscount }) {
  const [dilution, setDilution] = useState({ c1: '', c2: '', vf: '' });

  const dRes = () => {
    const { c1, c2, vf } = dilution;
    if (c1 && c2 && vf && parseCalcFloat(c1) > 0) {
      return (parseCalcFloat(c2) * parseCalcFloat(vf)) / parseCalcFloat(c1);
    }
    return null;
  };

  const result = dRes();

  return (
    <div className="glass-panel calc-card">
      <h4><Beaker size={18}/> Dilución Simple (C₁V₁ = C₂V₂)</h4>
      <div className="calc-row">
        <div className="input-group">
          <label className="input-label">C₁ (Conc. Stock)</label>
          <input className="input-field" type="text" inputMode="decimal" placeholder="ej. 1000 µM" value={dilution.c1} onChange={e => setDilution({...dilution, c1: e.target.value})} />
        </div>
        <div className="input-group">
          <label className="input-label">C₂ (Conc. Deseada)</label>
          <input className="input-field" type="text" inputMode="decimal" placeholder="ej. 150 µM" value={dilution.c2} onChange={e => setDilution({...dilution, c2: e.target.value})} />
        </div>
      </div>
      <div className="input-group">
        <label className="input-label">Vf (Vol. Final deseado, µL)</label>
        <input className="input-field" type="text" inputMode="decimal" placeholder="ej. 1000 µL" value={dilution.vf} onChange={e => setDilution({...dilution, vf: e.target.value})} />
      </div>
      {result !== null && (
        <div className="calc-result">
          <div className="calc-result-value">{result.toFixed(2)} c.u.</div>
          <div className="calc-result-label">Volumen de Stock necesario (V₁). Agregar {(parseCalcFloat(dilution.vf) - result).toFixed(2)} c.u. de solvente.</div>
          {inventory.length > 0 && (
            <div style={{marginTop: '12px', display: 'flex', gap: '8px', alignItems: 'center'}}>
              <select className="input-field" style={{padding: '4px', fontSize: '0.8rem'}} value={selectedInventoryId} onChange={e => onSelectedInventoryIdChange(e.target.value)}>
                <option value="">Seleccionar Reactivo...</option>
                {inventory.map(i => <option key={i.id} value={i.id}>{i.name} ({i.quantity} {i.unit})</option>)}
              </select>
              <button className="btn" style={{padding: '4px 8px', fontSize: '0.8rem'}} onClick={() => onDiscount(result)}>
                <MinusCircle size={14} style={{marginRight: '4px'}}/> Descontar Stock
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
