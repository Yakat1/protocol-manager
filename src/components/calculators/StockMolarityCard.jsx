import { useState } from 'react';
import { Beaker, MinusCircle } from 'lucide-react';
import { parseCalcFloat } from '../../utils/calculations';

export default function StockMolarityCard({ inventory, selectedInventoryId, onSelectedInventoryIdChange, onDiscount }) {
  const [molarity, setMolarity] = useState({ mw: '34.01', stockPercent: '30', stockDensity: '1.11', targetConc: '150', targetVol: '10' });

  const mRes = () => {
    const mw = parseCalcFloat(molarity.mw);
    const pct = parseCalcFloat(molarity.stockPercent) / 100;
    const density = parseCalcFloat(molarity.stockDensity);
    const target = parseCalcFloat(molarity.targetConc);
    const vol = parseCalcFloat(molarity.targetVol);
    if (!mw || !pct || !density || !target || !vol) return null;
    const stockM = (pct * density * 1e6) / mw;
    const needed = (target / 1000 * vol) / (stockM / 1000);
    return { stockM: stockM.toFixed(1), neededUl: (needed * 1000).toFixed(2) };
  };

  const result = mRes();

  return (
    <div className="glass-panel calc-card">
      <h4><Beaker size={18}/> H₂O₂ desde Stock Concentrado (%)</h4>
      <div className="calc-row">
        <div className="input-group">
          <label className="input-label">Peso Molecular (g/mol)</label>
          <div style={{display: 'flex', gap: '4px'}}>
            <select 
              className="input-field" 
              style={{flex: '0 0 auto', width: '32px', padding: '0 2px', textAlign: 'center', cursor: 'pointer'}} 
              title="Autocompletar PM desde inventario"
              onChange={e => {
                const invItem = inventory?.find(i => i.id === e.target.value);
                if (invItem && invItem.mw) {
                  setMolarity({...molarity, mw: invItem.mw});
                }
                e.target.value = '';
              }}
            >
              <option value="">▼</option>
              {inventory?.filter(i => i.type === 'Reactivo' && i.mw).map(i => (
                <option key={i.id} value={i.id}>{i.name}</option>
              ))}
            </select>
            <input className="input-field" type="text" inputMode="decimal" value={molarity.mw} onChange={e => setMolarity({...molarity, mw: e.target.value})} style={{flex: 1}}/>
          </div>
        </div>
        <div className="input-group">
          <label className="input-label">Stock (%p/v)</label>
          <input className="input-field" type="text" inputMode="decimal" value={molarity.stockPercent} onChange={e => setMolarity({...molarity, stockPercent: e.target.value})} />
        </div>
      </div>
      <div className="calc-row">
        <div className="input-group">
          <label className="input-label">Densidad Stock (g/mL)</label>
          <input className="input-field" type="text" inputMode="decimal" value={molarity.stockDensity} onChange={e => setMolarity({...molarity, stockDensity: e.target.value})} />
        </div>
        <div className="input-group">
          <label className="input-label">Conc. Objetivo (µM)</label>
          <input className="input-field" type="text" inputMode="decimal" value={molarity.targetConc} onChange={e => setMolarity({...molarity, targetConc: e.target.value})} />
        </div>
      </div>
      <div className="input-group">
        <label className="input-label">Volumen Final (mL)</label>
        <input className="input-field" type="text" inputMode="decimal" value={molarity.targetVol} onChange={e => setMolarity({...molarity, targetVol: e.target.value})} />
      </div>
      {result && (
        <div className="calc-result">
          <div className="calc-result-value">{result.neededUl} µL de Stock</div>
          <div className="calc-result-label">
            Stock concentrado ≈ {result.stockM} mM. Agregar {result.neededUl} µL a {molarity.targetVol} mL de medio.
          </div>
          {inventory.length > 0 && (
            <div style={{marginTop: '12px', display: 'flex', gap: '8px', alignItems: 'center'}}>
              <select className="input-field" style={{padding: '4px', fontSize: '0.8rem'}} value={selectedInventoryId} onChange={e => onSelectedInventoryIdChange(e.target.value)}>
                <option value="">Seleccionar Reactivo...</option>
                {inventory.map(i => <option key={i.id} value={i.id}>{i.name} ({i.quantity} {i.unit})</option>)}
              </select>
              <button className="btn" style={{padding: '4px 8px', fontSize: '0.8rem'}} onClick={() => onDiscount(parseCalcFloat(result.neededUl))}>
                <MinusCircle size={14} style={{marginRight: '4px'}}/> Descontar
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
