import React, { useState } from 'react';
import { Beaker, FlaskConical, MinusCircle } from 'lucide-react';
import './Calculator.css';

export default function Calculator({ inventory: inventoryProp, setInventory }) {
  const inventory = inventoryProp || [];
  // Dilution Calculator: C1V1 = C2V2
  const [dilution, setDilution] = useState({ c1: '', v1: '', c2: '', vf: '' });
  // Fenton Calculator
  const [fenton, setFenton] = useState({ h2o2Target: '150', feRatio: '6', volumeMl: '1' });
  const [molarity, setMolarity] = useState({ mw: '34.01', stockPercent: '30', stockDensity: '1.11', targetConc: '150', targetVol: '10' });
  const [selectedInventoryId, setSelectedInventoryId] = useState('');

  const handleDiscount = (amount) => {
    if (!inventory || inventory.length === 0) return alert("Inventario no disponible o componente no guardado.");
    if (!selectedInventoryId) return alert("Por favor, selecciona un elemento del inventario.");
    const inv = inventory.find(i => i.id === selectedInventoryId);
    if (!inv) return;

    if (confirm(`Voy a descontar ${amount.toFixed(2)} unds del inventario "${inv.name}". \nStock Actual: ${inv.quantity} ${inv.unit}\n¿Estás de acuerdo?`)) {
      const newQuantity = Math.max(0, inv.quantity - amount);
      setInventory(inventory.map(i => i.id === selectedInventoryId ? { ...i, quantity: newQuantity } : i));
      alert(`Descuento exitoso. Nuevo saldo: ${newQuantity.toFixed(2)} ${inv.unit}`);
    }
  };

  const dilutionResult = () => {
    const { c1, c2, vf } = dilution;
    if (c1 && c2 && vf && parseFloat(c1) > 0) {
      const v1 = (parseFloat(c2) * parseFloat(vf)) / parseFloat(c1);
      return v1;
    }
    return null;
  };

  const fentonResult = () => {
    const h2o2 = parseFloat(fenton.h2o2Target);
    const ratio = parseFloat(fenton.feRatio);
    const vol = parseFloat(fenton.volumeMl);
    if (!h2o2 || !ratio || !vol) return null;
    const feConc = h2o2 / ratio; // µM
    return { feConc, h2o2, vol };
  };

  const molarityResult = () => {
    const mw = parseFloat(molarity.mw);
    const pct = parseFloat(molarity.stockPercent) / 100;
    const density = parseFloat(molarity.stockDensity);
    const target = parseFloat(molarity.targetConc);
    const vol = parseFloat(molarity.targetVol);
    if (!mw || !pct || !density || !target || !vol) return null;
    const stockM = (pct * density * 1e6) / mw; // mM
    const needed = (target / 1000 * vol) / (stockM / 1000); // mL
    return { stockM: stockM.toFixed(1), neededUl: (needed * 1000).toFixed(2) };
  };

  const dRes = dilutionResult();
  const fRes = fentonResult();
  const mRes = molarityResult();

  return (
    <div className="calculator-container">
      <div className="calc-cards">
        {/* C1V1 = C2V2 */}
        <div className="glass-panel calc-card">
          <h4><Beaker size={18}/> Dilución Simple (C₁V₁ = C₂V₂)</h4>
          <div className="calc-row">
            <div className="input-group">
              <label className="input-label">C₁ (Conc. Stock)</label>
              <input className="input-field" type="number" placeholder="ej. 1000 µM" value={dilution.c1} onChange={e => setDilution({...dilution, c1: e.target.value})} />
            </div>
            <div className="input-group">
              <label className="input-label">C₂ (Conc. Deseada)</label>
              <input className="input-field" type="number" placeholder="ej. 150 µM" value={dilution.c2} onChange={e => setDilution({...dilution, c2: e.target.value})} />
            </div>
          </div>
          <div className="input-group">
            <label className="input-label">Vf (Vol. Final deseado, µL)</label>
            <input className="input-field" type="number" placeholder="ej. 1000 µL" value={dilution.vf} onChange={e => setDilution({...dilution, vf: e.target.value})} />
          </div>
          {dRes !== null && (
            <div className="calc-result">
              <div className="calc-result-value">{dRes.toFixed(2)} c.u.</div>
              <div className="calc-result-label">Volumen de Stock necesario (V₁). Agregar {(parseFloat(dilution.vf) - dRes).toFixed(2)} c.u. de solvente.</div>
              {inventory.length > 0 && (
                <div style={{marginTop: '12px', display: 'flex', gap: '8px', alignItems: 'center'}}>
                  <select className="input-field" style={{padding: '4px', fontSize: '0.8rem'}} value={selectedInventoryId} onChange={e => setSelectedInventoryId(e.target.value)}>
                    <option value="">Seleccionar Reactivo...</option>
                    {inventory.map(i => <option key={i.id} value={i.id}>{i.name} ({i.quantity} {i.unit})</option>)}
                  </select>
                  <button className="btn" style={{padding: '4px 8px', fontSize: '0.8rem'}} onClick={() => handleDiscount(dRes)}>
                    <MinusCircle size={14} style={{marginRight: '4px'}}/> Descontar Stock
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Fenton */}
        <div className="glass-panel calc-card">
          <h4><FlaskConical size={18}/> Reacción de Fenton (Fe²⁺ + H₂O₂)</h4>
          <div className="calc-row">
            <div className="input-group">
              <label className="input-label">H₂O₂ Objetivo (µM)</label>
              <input className="input-field" type="number" value={fenton.h2o2Target} onChange={e => setFenton({...fenton, h2o2Target: e.target.value})} />
            </div>
            <div className="input-group">
              <label className="input-label">Ratio Fe:H₂O₂ (1:X)</label>
              <input className="input-field" type="number" value={fenton.feRatio} onChange={e => setFenton({...fenton, feRatio: e.target.value})} />
            </div>
          </div>
          <div className="input-group">
            <label className="input-label">Volumen Final (mL)</label>
            <input className="input-field" type="number" value={fenton.volumeMl} onChange={e => setFenton({...fenton, volumeMl: e.target.value})} />
          </div>
          {fRes && (
            <div className="calc-result">
              <div className="calc-result-value">FeSO₄: {fRes.feConc.toFixed(1)} µM</div>
              <div className="calc-result-label">
                Agregar FeSO₄ a {fRes.feConc.toFixed(1)} µM primero. Esperar 5 min, luego agregar H₂O₂ a {fRes.h2o2} µM en {fRes.vol} mL totales.
              </div>
            </div>
          )}
        </div>

        {/* Stock % → µL */}
        <div className="glass-panel calc-card">
          <h4><Beaker size={18}/> H₂O₂ desde Stock Concentrado (%)</h4>
          <div className="calc-row">
            <div className="input-group">
              <label className="input-label">Peso Molecular (g/mol)</label>
              <input className="input-field" type="number" value={molarity.mw} onChange={e => setMolarity({...molarity, mw: e.target.value})} />
            </div>
            <div className="input-group">
              <label className="input-label">Stock (%p/v)</label>
              <input className="input-field" type="number" value={molarity.stockPercent} onChange={e => setMolarity({...molarity, stockPercent: e.target.value})} />
            </div>
          </div>
          <div className="calc-row">
            <div className="input-group">
              <label className="input-label">Densidad Stock (g/mL)</label>
              <input className="input-field" type="number" value={molarity.stockDensity} onChange={e => setMolarity({...molarity, stockDensity: e.target.value})} />
            </div>
            <div className="input-group">
              <label className="input-label">Conc. Objetivo (µM)</label>
              <input className="input-field" type="number" value={molarity.targetConc} onChange={e => setMolarity({...molarity, targetConc: e.target.value})} />
            </div>
          </div>
          <div className="input-group">
            <label className="input-label">Volumen Final (mL)</label>
            <input className="input-field" type="number" value={molarity.targetVol} onChange={e => setMolarity({...molarity, targetVol: e.target.value})} />
          </div>
          {mRes && (
            <div className="calc-result">
              <div className="calc-result-value">{mRes.neededUl} µL de Stock</div>
              <div className="calc-result-label">
                Stock concentrado ≈ {mRes.stockM} mM. Agregar {mRes.neededUl} µL a {molarity.targetVol} mL de medio.
              </div>
              {inventory.length > 0 && (
                <div style={{marginTop: '12px', display: 'flex', gap: '8px', alignItems: 'center'}}>
                  <select className="input-field" style={{padding: '4px', fontSize: '0.8rem'}} value={selectedInventoryId} onChange={e => setSelectedInventoryId(e.target.value)}>
                    <option value="">Seleccionar Reactivo...</option>
                    {inventory.map(i => <option key={i.id} value={i.id}>{i.name} ({i.quantity} {i.unit})</option>)}
                  </select>
                  <button className="btn" style={{padding: '4px 8px', fontSize: '0.8rem'}} onClick={() => handleDiscount(parseFloat(mRes.neededUl))}>
                    <MinusCircle size={14} style={{marginRight: '4px'}}/> Descontar
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
