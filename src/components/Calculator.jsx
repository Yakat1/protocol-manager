import React, { useState } from 'react';
import { Beaker, FlaskConical, MinusCircle, ArrowRightLeft, FlaskRound, Plus, Trash2, Box, TestTubes } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
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

function parseCalcFloat(valString) {
  if (valString === null || valString === undefined) return NaN;
  if (typeof valString !== 'string') valString = String(valString);
  valString = valString.trim();
  if (valString === '') return NaN;
  
  if (valString.toLowerCase().includes('e')) {
    const parts = valString.toLowerCase().split('e');
    if (parts.length === 2) {
      const base = Number.parseFloat(parts[0]);
      const exponent = Number.parseFloat(parts[1]);
      if (!isNaN(base) && !isNaN(exponent)) {
        return base * Math.pow(10, exponent);
      }
    }
  }
  
  return Number.parseFloat(valString);
}

function convertUnit(value, from, to, factors) {
  if (!value || !from || !to || !factors[from] || !factors[to]) return null;
  const base = parseCalcFloat(value) * factors[from];
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

export default function Calculator({ inventory: inventoryProp, setInventory, bufferRecipes: bufferRecipesProp, setBufferRecipes, can, user, labId }) {
  const inventory = inventoryProp || [];
  const bufferRecipes = bufferRecipesProp || [];

  // ── Existing calculators ──────────────────────────────────────────────────
  const [dilution, setDilution] = useState({ c1: '', v1: '', c2: '', vf: '' });
  const [fenton, setFenton] = useState({ h2o2Target: '150', feRatio: '6', volumeMl: '1' });
  const [molarity, setMolarity] = useState({ mw: '34.01', stockPercent: '30', stockDensity: '1.11', targetConc: '150', targetVol: '10' });
  const [selectedInventoryId, setSelectedInventoryId] = useState('');

  // ── Buffer Creator (multi-component) ──────────────────────────────────────
  const [bufferName, setBufferName] = useState('');
  const [bufferComponents, setBufferComponents] = useState([
    { id: uuidv4(), name: '', mw: '', targetConc: '', concUnit: 'mM' }
  ]);
  const [bufferVol, setBufferVol] = useState({ vol: '', unit: 'mL' });

  // ── Recipe Library State ───────────────────────────────────────────────
  const [showRecipes, setShowRecipes] = useState(false);
  const [recipeSearch, setRecipeSearch] = useState('');
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [recipeToSave, setRecipeToSave] = useState({ name: '', category: '' });
  const [pendingDelete, setPendingDelete] = useState(null);

  // ── Unit Converter ───────────────────────────────────────────────────
  const [converter, setConverter] = useState({ value: '', fromUnit: 'g', toUnit: 'mg', type: 'mass' });

  // ── pH Estimation (Henderson-Hasselbalch) ─────────────────────────────
  const [bufferPH, setBufferPH] = useState({ pKa: '', acidConc: '', baseConc: '' });

  // ── Serial Dilutions ──────────────────────────────────────────────────
  const [serial, setSerial] = useState({ stockConc: '', dilFactor: '2', steps: '7', tubeVol: '200' });

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
    if (c1 && c2 && vf && parseCalcFloat(c1) > 0) {
      return (parseCalcFloat(c2) * parseCalcFloat(vf)) / parseCalcFloat(c1);
    }
    return null;
  };

  const fentonResult = () => {
    const h2o2 = parseCalcFloat(fenton.h2o2Target);
    const ratio = parseCalcFloat(fenton.feRatio);
    const vol = parseCalcFloat(fenton.volumeMl);
    if (!h2o2 || !ratio || !vol) return null;
    return { feConc: h2o2 / ratio, h2o2, vol };
  };

  const molarityResult = () => {
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

  // ── Buffer calculation (multi-component) ──────────────────────────────────
  const bufferResults = () => {
    const vol = parseCalcFloat(bufferVol.vol);
    if (!vol || vol <= 0) return null;
    const volL = vol * (VOLUME_FACTORS[bufferVol.unit] || 1);

    const results = [];
    for (const comp of bufferComponents) {
      const mw = parseCalcFloat(comp.mw);
      const conc = parseCalcFloat(comp.targetConc);
      if (!mw || !conc || mw <= 0) continue;
      const concM = conc * (CONC_FACTORS[comp.concUnit] || 1);
      const massG = concM * volL * mw;
      results.push({ id: comp.id, name: comp.name || 'Sin nombre', massG, concLabel: `${conc} ${comp.concUnit}` });
    }
    return results.length > 0 ? results : null;
  };

  const addBufferComponent = () => {
    setBufferComponents(prev => [...prev, { id: uuidv4(), name: '', mw: '', targetConc: '', concUnit: 'mM' }]);
  };

  const removeBufferComponent = (id) => {
    if (bufferComponents.length <= 1) return;
    setBufferComponents(prev => prev.filter(c => c.id !== id));
  };

  const updateBufferComponent = (id, field, value) => {
    setBufferComponents(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const handleSaveBufferToInventory = () => {
    const bResults = bufferResults();
    if (!bResults) return alert('Calcula los componentes primero.');
    const name = bufferName.trim() || 'Buffer sin nombre';
    const concDescription = bResults.map(r => `${r.concLabel} ${r.name}`).join(', ');
    const newItem = {
      id: uuidv4(),
      name: name,
      type: 'Solución Stock',
      concentration: concDescription,
      quantity: parseCalcFloat(bufferVol.vol) || 0,
      unit: bufferVol.unit,
      location: 'Mesa',
      prepDate: new Date().toISOString().split('T')[0],
      expDate: '',
      notes: `Preparado desde Calculadora. Componentes: ${concDescription}`,
    };
    setInventory([newItem, ...inventory]);
    alert(`"${name}" guardado en Inventario como Solución Stock.`);
  };

  // ── Recipe Handlers ────────────────────────────────────────────────────────
  const handleSaveRecipe = () => {
    const name = recipeToSave.name.trim() || bufferName.trim() || 'Sin nombre';
    const category = recipeToSave.category.trim() || 'General';
    const newRecipe = {
      id: uuidv4(),
      name,
      category,
      components: bufferComponents.map(c => ({...c, id: uuidv4()})),
      createdAt: new Date().toISOString(),
    };
    setBufferRecipes([newRecipe, ...bufferRecipes]);
    setShowSaveForm(false);
    setRecipeToSave({ name: '', category: '' });
    alert(`Receta "${name}" guardada en la categoría "${category}".`);
  };

  const handleLoadRecipe = (recipe) => {
    setBufferComponents(recipe.components.map(c => ({...c, id: uuidv4()})));
    setBufferName(recipe.name);
    setShowRecipes(false);
  };

  const handleDeleteRecipe = (id) => {
    if (pendingDelete === id) {
      if (confirm('¿Estas seguro de que deseas eliminar esta receta? Esta acción no se puede deshacer.')) {
        setBufferRecipes(bufferRecipes.filter(r => r.id !== id));
      }
      setPendingDelete(null);
    } else {
      setPendingDelete(id);
    }
  };

  // Grouped by category for display
  const groupedRecipes = bufferRecipes
    .filter(r => !recipeSearch || r.name.toLowerCase().includes(recipeSearch.toLowerCase()) || r.category.toLowerCase().includes(recipeSearch.toLowerCase()))
    .reduce((acc, r) => { acc[r.category] = [...(acc[r.category] || []), r]; return acc; }, {});

  // ── Unit Conversion ──────────────────────────────────────────────────
  const converterResult = () => {
    const group = UNIT_GROUPS[converter.type];
    if (!group) return null;
    return convertUnit(converter.value, converter.fromUnit, converter.toUnit, group.factors);
  };

  const dRes = dilutionResult();
  const fRes = fentonResult();
  const mRes = molarityResult();
  const bResults = bufferResults();
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
          {dRes !== null && (
            <div className="calc-result">
              <div className="calc-result-value">{dRes.toFixed(2)} c.u.</div>
              <div className="calc-result-label">Volumen de Stock necesario (V₁). Agregar {(parseCalcFloat(dilution.vf) - dRes).toFixed(2)} c.u. de solvente.</div>
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
              <input className="input-field" type="text" inputMode="decimal" value={molarity.mw} onChange={e => setMolarity({...molarity, mw: e.target.value})} />
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
                  <button className="btn" style={{padding: '4px 8px', fontSize: '0.8rem'}} onClick={() => handleDiscount(parseCalcFloat(mRes.neededUl))}>
                    <MinusCircle size={14} style={{marginRight: '4px'}}/> Descontar
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ════════════════  Buffer Creator (Multi-Component)  ════════════════ */}
        <div className="glass-panel calc-card">
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px'}}>
            <h4 style={{margin: 0}}><FlaskRound size={18}/> Creador de Buffer</h4>
            <button className="btn" style={{fontSize: '0.75rem', padding: '4px 8px'}} onClick={() => { setShowRecipes(!showRecipes); setPendingDelete(null); }}>
              📂 {showRecipes ? 'Cerrar Biblioteca' : `Biblioteca${bufferRecipes.length > 0 ? ` (${bufferRecipes.length})` : ''}`}
            </button>
          </div>
          <p style={{fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '12px', marginTop: '4px'}}>
            Agrega los componentes de tu buffer y calcula cuánto pesar de cada uno.
          </p>

          {/* ── Recipe Library Panel ── */}
          {showRecipes && (
            <div style={{background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '12px', marginBottom: '16px', borderTop: '2px solid var(--primary)'}}>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px'}}>
                <span style={{fontWeight: 'bold', fontSize: '0.9rem'}}>📚 Recetas Guardadas</span>
              </div>
              <input
                className="input-field"
                type="text"
                placeholder="Buscar por nombre o categoría..."
                value={recipeSearch}
                onChange={e => setRecipeSearch(e.target.value)}
                style={{marginBottom: '10px', fontSize: '0.8rem'}}
              />
              {Object.keys(groupedRecipes).length === 0 && (
                <p style={{color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'center', padding: '12px 0'}}>No hay recetas guardadas.</p>
              )}
              {Object.entries(groupedRecipes).map(([cat, recipes]) => (
                <div key={cat} style={{marginBottom: '12px'}}>
                  <div style={{fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px'}}>📁 {cat}</div>
                  {recipes.map(recipe => (
                    <div key={recipe.id} style={{display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', marginBottom: '4px'}}>
                      <div style={{flex: 1, minWidth: 0}}>
                        <div style={{fontWeight: '600', fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{recipe.name}</div>
                        <div style={{fontSize: '0.7rem', color: 'var(--text-secondary)'}}>{recipe.components.length} componente{recipe.components.length !== 1 ? 's' : ''}</div>
                      </div>
                      <button className="btn" style={{fontSize: '0.75rem', padding: '3px 8px', flex: '0 0 auto'}} onClick={() => handleLoadRecipe(recipe)}>Cargar</button>
                      <button
                        className="btn"
                        style={{fontSize: '0.75rem', padding: '3px 8px', flex: '0 0 auto', background: pendingDelete === recipe.id ? 'rgba(239,68,68,0.2)' : 'transparent', border: pendingDelete === recipe.id ? '1px solid #ef4444' : '1px solid var(--border)', color: pendingDelete === recipe.id ? '#ef4444' : 'var(--text-secondary)'}}
                        onClick={() => handleDeleteRecipe(recipe.id)}
                        title={pendingDelete === recipe.id ? 'Confirmar eliminación' : 'Eliminar receta'}
                      >
                        {pendingDelete === recipe.id ? '⚠️ Confirmar' : '🗑️'}
                      </button>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* Save Recipe Form */}
          {showSaveForm && (
            <div style={{background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: '8px', padding: '12px', marginBottom: '14px'}}>
              <div style={{fontWeight: 'bold', fontSize: '0.9rem', marginBottom: '10px'}}>💾 Guardar como Receta</div>
              <div className="calc-row">
                <div className="input-group">
                  <label className="input-label" style={{fontSize: '0.75rem'}}>Nombre de la Receta</label>
                  <input className="input-field" type="text" placeholder={bufferName || 'Ej. PBS 1x'} value={recipeToSave.name} onChange={e => setRecipeToSave({...recipeToSave, name: e.target.value})} />
                </div>
                <div className="input-group">
                  <label className="input-label" style={{fontSize: '0.75rem'}}>Categoría</label>
                  <input className="input-field" type="text" placeholder="Ej. Electroforesis, Lisis" value={recipeToSave.category} onChange={e => setRecipeToSave({...recipeToSave, category: e.target.value})} list="recipe-categories" />
                  <datalist id="recipe-categories">
                    {[...new Set(bufferRecipes.map(r => r.category))].map(cat => <option key={cat} value={cat}/>)}
                    {['Electroforesis','Lisis','Purificación','Inmunoensayo','General'].map(c => <option key={c} value={c}/>)}
                  </datalist>
                </div>
              </div>
              <div style={{display: 'flex', gap: '8px', marginTop: '8px'}}>
                <button className="btn btn-primary" style={{flex: 1, justifyContent: 'center', fontSize: '0.8rem'}} onClick={handleSaveRecipe}>Confirmar Guardar</button>
                <button className="btn" style={{fontSize: '0.8rem'}} onClick={() => setShowSaveForm(false)}>Cancelar</button>
              </div>
            </div>
          )}

          {/* Buffer name + volume */}
          <div className="calc-row" style={{marginBottom: '12px'}}>
            <div className="input-group">
              <label className="input-label">Nombre del Buffer</label>
              <input className="input-field" type="text" placeholder="ej. PBS 1X, Buffer de Lisis" value={bufferName} onChange={e => setBufferName(e.target.value)} />
            </div>
            <div className="input-group">
              <label className="input-label">Volumen Final</label>
              <div style={{display: 'flex', gap: '6px'}}>
                <input className="input-field" type="text" inputMode="decimal" placeholder="ej. 500" value={bufferVol.vol} onChange={e => setBufferVol({...bufferVol, vol: e.target.value})} style={{flex: 1}} />
                <select className="input-field" style={{width: '70px', padding: '4px'}} value={bufferVol.unit} onChange={e => setBufferVol({...bufferVol, unit: e.target.value})}>
                  {Object.keys(VOLUME_FACTORS).map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Component rows */}
          <div style={{borderTop: '1px solid var(--border)', paddingTop: '12px'}}>
            <label className="input-label" style={{marginBottom: '8px', display: 'block'}}>Componentes</label>
            {bufferComponents.map((comp, idx) => (
              <div key={comp.id} style={{display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'flex-end', flexWrap: 'wrap'}}>
                <div style={{flex: '1 1 120px', minWidth: '100px'}}>
                  {idx === 0 && <label className="input-label" style={{fontSize: '0.7rem'}}>Nombre</label>}
                  <input className="input-field" type="text" placeholder="ej. NaCl" value={comp.name} onChange={e => updateBufferComponent(comp.id, 'name', e.target.value)} />
                </div>
                <div style={{flex: '0 1 100px', minWidth: '80px'}}>
                  {idx === 0 && <label className="input-label" style={{fontSize: '0.7rem'}}>PM (g/mol)</label>}
                  <input className="input-field" type="text" inputMode="decimal" placeholder="58.44" value={comp.mw} onChange={e => updateBufferComponent(comp.id, 'mw', e.target.value)} />
                </div>
                <div style={{flex: '0 1 100px', minWidth: '80px'}}>
                  {idx === 0 && <label className="input-label" style={{fontSize: '0.7rem'}}>Conc.</label>}
                  <input className="input-field" type="text" inputMode="decimal" placeholder="150" value={comp.targetConc} onChange={e => updateBufferComponent(comp.id, 'targetConc', e.target.value)} />
                </div>
                <div style={{flex: '0 0 65px'}}>
                  {idx === 0 && <label className="input-label" style={{fontSize: '0.7rem'}}>Unidad</label>}
                  <select className="input-field" style={{padding: '4px', width: '100%'}} value={comp.concUnit} onChange={e => updateBufferComponent(comp.id, 'concUnit', e.target.value)}>
                    {Object.keys(CONC_FACTORS).map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <button 
                  className="btn" 
                  style={{padding: '4px 6px', opacity: bufferComponents.length <= 1 ? 0.3 : 1, flex: '0 0 auto'}} 
                  onClick={() => removeBufferComponent(comp.id)} 
                  disabled={bufferComponents.length <= 1}
                  title="Eliminar componente"
                >
                  <Trash2 size={14}/>
                </button>
              </div>
            ))}
            <button className="btn" style={{fontSize: '0.8rem', padding: '6px 12px', marginTop: '4px'}} onClick={addBufferComponent}>
              <Plus size={14} style={{marginRight: '4px'}}/> Añadir Componente
            </button>
          </div>

          {/* Results table */}
          {bResults && (
            <div className="calc-result" style={{marginTop: '16px'}}>
              <div className="calc-result-value" style={{fontSize: '1.1rem', marginBottom: '10px'}}>
                {bufferName || 'Buffer'} — {bufferVol.vol} {bufferVol.unit}
              </div>
              <table style={{width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem'}}>
                <thead>
                  <tr style={{borderBottom: '1px solid var(--border)', textAlign: 'left'}}>
                    <th style={{padding: '6px 8px', color: 'var(--text-secondary)'}}>Componente</th>
                    <th style={{padding: '6px 8px', color: 'var(--text-secondary)'}}>Concentración</th>
                    <th style={{padding: '6px 8px', color: 'var(--text-secondary)', textAlign: 'right'}}>Masa a Pesar</th>
                  </tr>
                </thead>
                <tbody>
                  {bResults.map(r => {
                    const fmt = formatMassResult(r.massG);
                    return (
                      <tr key={r.id} style={{borderBottom: '1px solid rgba(255,255,255,0.05)'}}>
                        <td style={{padding: '6px 8px', fontWeight: 'bold'}}>{r.name}</td>
                        <td style={{padding: '6px 8px', color: 'var(--text-secondary)'}}>{r.concLabel}</td>
                        <td style={{padding: '6px 8px', textAlign: 'right', color: 'var(--accent)', fontWeight: '600'}}>{fmt.val} {fmt.unit}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div style={{display: 'flex', gap: '8px', marginTop: '12px'}}>
                <button 
                  className="btn btn-primary" 
                  style={{flex: 1, justifyContent: 'center', fontSize: '0.8rem', padding: '8px'}}
                  onClick={handleSaveBufferToInventory}
                >
                  <Box size={14} style={{marginRight: '6px'}}/> A Inventario
                </button>
                <button
                  className="btn"
                  style={{flex: 1, justifyContent: 'center', fontSize: '0.8rem', padding: '8px', border: '1px solid var(--primary)', color: 'var(--primary)'}}
                  onClick={() => { setShowSaveForm(true); setShowRecipes(false); }}
                >
                  ⭐ Guardar Receta
                </button>
              </div>
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
            <input className="input-field" type="text" inputMode="decimal" placeholder="Ingresa un valor" value={converter.value} onChange={e => setConverter({...converter, value: e.target.value})} />
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

        {/* ════════════════  pH Estimator (Henderson-Hasselbalch)  ════════════════ */}
        <div className="glass-panel calc-card">
          <h4>🧪 Estimación de pH (Henderson-Hasselbalch)</h4>
          <p style={{fontSize: '0.75rem', color: 'var(--warning)', marginBottom: '10px', marginTop: '-6px'}}>pH = pKa + log₁₀([A⁻] / [HA]). Estimación teórica, verificar con pHímetro.</p>
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
          <div className="input-group" style={{marginTop: '8px'}}>
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

        {/* ════════════════  Serial Dilutions  ════════════════ */}
        <div className="glass-panel calc-card">
          <h4><TestTubes size={18}/> Diluciones Seriadas</h4>
          <p style={{fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '12px', marginTop: '-8px'}}>Calcula volúmenes para curvas estándar (Bradford, ELISA, etc.)</p>
          <div className="calc-row">
            <div className="input-group">
              <label className="input-label">Conc. Stock Inicial</label>
              <input className="input-field" type="text" inputMode="decimal" placeholder="ej. 2000" value={serial.stockConc} onChange={e => setSerial({...serial, stockConc: e.target.value})} />
            </div>
            <div className="input-group">
              <label className="input-label">Factor de Dilución</label>
              <input className="input-field" type="text" inputMode="decimal" placeholder="ej. 2 (1:2)" value={serial.dilFactor} onChange={e => setSerial({...serial, dilFactor: e.target.value})} />
            </div>
          </div>
          <div className="calc-row" style={{marginTop: '8px'}}>
            <div className="input-group">
              <label className="input-label">Nº de Tubos</label>
              <input className="input-field" type="text" inputMode="decimal" min="2" max="20" value={serial.steps} onChange={e => setSerial({...serial, steps: e.target.value})} />
            </div>
            <div className="input-group">
              <label className="input-label">Vol. Final / Tubo (µL)</label>
              <input className="input-field" type="text" inputMode="decimal" placeholder="200" value={serial.tubeVol} onChange={e => setSerial({...serial, tubeVol: e.target.value})} />
            </div>
          </div>
          {(() => {
            const stock = parseCalcFloat(serial.stockConc);
            const factor = parseCalcFloat(serial.dilFactor);
            const steps = parseInt(serial.steps);
            const vol = parseCalcFloat(serial.tubeVol);
            if (!stock || !factor || !steps || !vol || factor <= 1 || steps < 2) return null;

            const tubes = [];
            for (let i = 0; i < steps; i++) {
              const conc = stock / Math.pow(factor, i);
              const transferVol = vol / factor;
              const bufferVol = vol - transferVol;
              tubes.push({
                num: i + 1,
                conc: conc,
                transferFrom: i === 0 ? `Stock (${vol} µL)` : `${transferVol.toFixed(1)} µL del Tubo ${i}`,
                bufferAdd: i === 0 ? '—' : `${bufferVol.toFixed(1)} µL`,
              });
            }
            return (
              <div className="calc-result" style={{marginTop: '12px'}}>
                <div className="calc-result-value" style={{fontSize: '1rem', marginBottom: '8px'}}>Curva de {steps} puntos (1:{factor})</div>
                <table style={{width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem'}}>
                  <thead>
                    <tr style={{borderBottom: '1px solid var(--border)', textAlign: 'left'}}>
                      <th style={{padding: '5px 6px', color: 'var(--text-secondary)'}}>Tubo</th>
                      <th style={{padding: '5px 6px', color: 'var(--text-secondary)'}}>Conc.</th>
                      <th style={{padding: '5px 6px', color: 'var(--text-secondary)'}}>Pasar de</th>
                      <th style={{padding: '5px 6px', color: 'var(--text-secondary)'}}>+ Buffer</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tubes.map(t => (
                      <tr key={t.num} style={{borderBottom: '1px solid rgba(255,255,255,0.05)'}}>
                        <td style={{padding: '5px 6px', fontWeight: 'bold'}}>{t.num}</td>
                        <td style={{padding: '5px 6px', color: 'var(--accent)', fontWeight: '600'}}>{t.conc >= 1 ? t.conc.toFixed(2) : t.conc.toExponential(2)}</td>
                        <td style={{padding: '5px 6px', fontSize: '0.75rem'}}>{t.transferFrom}</td>
                        <td style={{padding: '5px 6px', fontSize: '0.75rem'}}>{t.bufferAdd}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </div>

      </div>
    </div>
  );
}
