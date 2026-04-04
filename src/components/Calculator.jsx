import React, { useState } from 'react';
import { Beaker, FlaskConical, MinusCircle, ArrowRightLeft, FlaskRound } from 'lucide-react';
import './Calculator.css';

// ── Conversion factor tables (ported from lab/calculations.py) ──────────────
const MASS_FACTORS = { kg: 1e3, g: 1, mg: 1e-3, 'µg': 1e-6, ng: 1e-9 };
const VOLUME_FACTORS = { L: 1, mL: 1e-3, 'µL': 1e-6 };
const CONC_FACTORS = { M: 1, mM: 1e-3, 'µM': 1e-6, nM: 1e-9 };

const UNIT_GROUPS = {
  mass:   { label: 'Masa',          units: Object.keys(MASS_FACTORS),   factors: MASS_FACTORS },
  volume: { label: 'Volumen',       units: Object.keys(VOLUME_FACTORS), factors: VOLUME_FACTORS },
  conc:   { label: 'Concentración', units: Object.keys(CONC_FACTORS),   factors: CONC_FACTORS },
};

function convertUnit(value, from, to, factors) {
  if (!value || !from || !to || !factors[from] || !factors[to]) return null;
  const base = parseFloat(value) * factors[from];
  return base / factors[to];
}

function formatSmart(val) {
  if (val === null || val === undefined || isNaN(val)) return '—';
  if (val === 0) return '0';
  if (Math.abs(val) >= 1000) return val.toFixed(2);
  if (Math.abs(val) >= 1) return val.toFixed(4);
  if (Math.abs(val) >= 0.001) return val.toFixed(6);
  return val.toExponential(4);
}

export default function Calculator({ inventory: inventoryProp, setInventory }) {
  const inventory = inventoryProp || [];

  // ── Existing calculators ──────────────────────────────────────────────────
  const [dilution, setDilution] = useState({ c1: '', v1: '', c2: '', vf: '' });
  const [fenton, setFenton] = useState({ h2o2Target: '150', feRatio: '6', volumeMl: '1' });
  const [molarity, setMolarity] = useState({ mw: '34.01', stockPercent: '30', stockDensity: '1.11', targetConc: '150', targetVol: '10' });
  const [selectedInventoryId, setSelectedInventoryId] = useState('');

  // ── NEW: Buffer Creator ───────────────────────────────────────────────────
  const [buffer, setBuffer] = useState({ mw: '', targetConc: '', targetVol: '', concUnit: 'mM', volUnit: 'mL' });

  // ── NEW: Unit Converter ───────────────────────────────────────────────────
  const [converter, setConverter] = useState({ value: '', fromUnit: 'g', toUnit: 'mg', type: 'mass' });

  // ── Inventory discount handler ────────────────────────────────────────────
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

  // ── Calculation functions ─────────────────────────────────────────────────
  const dilutionResult = () => {
    const { c1, c2, vf } = dilution;
    if (c1 && c2 && vf && parseFloat(c1) > 0) {
      return (parseFloat(c2) * parseFloat(vf)) / parseFloat(c1);
    }
    return null;
  };

  const fentonResult = () => {
    const h2o2 = parseFloat(fenton.h2o2Target);
    const ratio = parseFloat(fenton.feRatio);
    const vol = parseFloat(fenton.volumeMl);
    if (!h2o2 || !ratio || !vol) return null;
    return { feConc: h2o2 / ratio, h2o2, vol };
  };

  const molarityResult = () => {
    const mw = parseFloat(molarity.mw);
    const pct = parseFloat(molarity.stockPercent) / 100;
    const density = parseFloat(molarity.stockDensity);
    const target = parseFloat(molarity.targetConc);
    const vol = parseFloat(molarity.targetVol);
    if (!mw || !pct || !density || !target || !vol) return null;
    const stockM = (pct * density * 1e6) / mw;
    const needed = (target / 1000 * vol) / (stockM / 1000);
    return { stockM: stockM.toFixed(1), neededUl: (needed * 1000).toFixed(2) };
  };

  // ── NEW: Buffer calculation ───────────────────────────────────────────────
  const bufferResult = () => {
    const mw = parseFloat(buffer.mw);
    const conc = parseFloat(buffer.targetConc);
    const vol = parseFloat(buffer.targetVol);
    if (!mw || !conc || !vol || mw <= 0) return null;

    const concM = conc * (CONC_FACTORS[buffer.concUnit] || 1);
    const volL  = vol  * (VOLUME_FACTORS[buffer.volUnit] || 1);
    const massG = concM * volL * mw;
    return massG;
  };

  // ── NEW: Unit conversion ──────────────────────────────────────────────────
  const converterResult = () => {
    const group = UNIT_GROUPS[converter.type];
    if (!group) return null;
    return convertUnit(converter.value, converter.fromUnit, converter.toUnit, group.factors);
  };

  const dRes = dilutionResult();
  const fRes = fentonResult();
  const mRes = molarityResult();
  const bRes = bufferResult();
  const cRes = converterResult();

  // Helper to format mass result smartly
  const formatMassResult = (massG) => {
    if (massG >= 1)       return { val: massG.toFixed(4),          unit: 'g' };
    if (massG >= 1e-3)    return { val: (massG * 1e3).toFixed(4),  unit: 'mg' };
    if (massG >= 1e-6)    return { val: (massG * 1e6).toFixed(4),  unit: 'µg' };
    return                       { val: (massG * 1e9).toFixed(4),  unit: 'ng' };
  };

  return (
    <div className="calculator-container">
      <div className="calc-cards">

        {/* ════════════════  C1V1 = C2V2  ════════════════ */}
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

        {/* ════════════════  Fenton  ════════════════ */}
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

        {/* ════════════════  Stock % → µL  ════════════════ */}
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

        {/* ════════════════  NEW: Buffer Creator  ════════════════ */}
        <div className="glass-panel calc-card">
          <h4><FlaskRound size={18}/> Creador de Buffer / Solución</h4>
          <p style={{fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '12px', marginTop: '-8px'}}>
            Calcula cuánto pesar de un reactivo sólido para preparar una solución a la concentración y volumen deseados.
          </p>
          <div className="calc-row">
            <div className="input-group">
              <label className="input-label">Peso Molecular (g/mol)</label>
              <input className="input-field" type="number" placeholder="ej. 58.44 (NaCl)" value={buffer.mw} onChange={e => setBuffer({...buffer, mw: e.target.value})} />
            </div>
            <div className="input-group">
              <label className="input-label">Concentración Deseada</label>
              <div style={{display: 'flex', gap: '6px'}}>
                <input className="input-field" type="number" placeholder="ej. 150" value={buffer.targetConc} onChange={e => setBuffer({...buffer, targetConc: e.target.value})} style={{flex: 1}} />
                <select className="input-field" style={{width: '70px', padding: '4px'}} value={buffer.concUnit} onChange={e => setBuffer({...buffer, concUnit: e.target.value})}>
                  {Object.keys(CONC_FACTORS).map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>
          </div>
          <div className="input-group">
            <label className="input-label">Volumen Final</label>
            <div style={{display: 'flex', gap: '6px'}}>
              <input className="input-field" type="number" placeholder="ej. 500" value={buffer.targetVol} onChange={e => setBuffer({...buffer, targetVol: e.target.value})} style={{flex: 1}} />
              <select className="input-field" style={{width: '70px', padding: '4px'}} value={buffer.volUnit} onChange={e => setBuffer({...buffer, volUnit: e.target.value})}>
                {Object.keys(VOLUME_FACTORS).map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>
          {bRes !== null && (
            <div className="calc-result">
              {(() => {
                const fmt = formatMassResult(bRes);
                return (
                  <>
                    <div className="calc-result-value">Pesar {fmt.val} {fmt.unit}</div>
                    <div className="calc-result-label">
                      Disolver en {buffer.targetVol} {buffer.volUnit} de solvente para obtener una solución {buffer.targetConc} {buffer.concUnit}.
                    </div>
                    <div className="calc-result-label" style={{marginTop: '6px', opacity: 0.7}}>
                      Masa exacta en gramos: {bRes.toExponential(4)} g
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </div>

        {/* ════════════════  NEW: Unit Converter  ════════════════ */}
        <div className="glass-panel calc-card">
          <h4><ArrowRightLeft size={18}/> Conversor de Unidades</h4>
          <div className="input-group" style={{marginBottom: '12px'}}>
            <label className="input-label">Tipo de Unidad</label>
            <select className="input-field" value={converter.type} onChange={e => {
              const newType = e.target.value;
              const units = UNIT_GROUPS[newType].units;
              setConverter({ value: converter.value, fromUnit: units[0], toUnit: units[1], type: newType });
            }}>
              {Object.entries(UNIT_GROUPS).map(([key, g]) => <option key={key} value={key}>{g.label}</option>)}
            </select>
          </div>
          <div className="input-group">
            <label className="input-label">Valor</label>
            <input className="input-field" type="number" placeholder="Ingresa un valor" value={converter.value} onChange={e => setConverter({...converter, value: e.target.value})} />
          </div>
          <div className="calc-row" style={{marginTop: '12px'}}>
            <div className="input-group">
              <label className="input-label">De</label>
              <select className="input-field" value={converter.fromUnit} onChange={e => setConverter({...converter, fromUnit: e.target.value})}>
                {UNIT_GROUPS[converter.type].units.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div className="input-group">
              <label className="input-label">A</label>
              <select className="input-field" value={converter.toUnit} onChange={e => setConverter({...converter, toUnit: e.target.value})}>
                {UNIT_GROUPS[converter.type].units.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>
          {cRes !== null && converter.value && (
            <div className="calc-result">
              <div className="calc-result-value">{formatSmart(cRes)} {converter.toUnit}</div>
              <div className="calc-result-label">
                {converter.value} {converter.fromUnit} = {formatSmart(cRes)} {converter.toUnit}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
