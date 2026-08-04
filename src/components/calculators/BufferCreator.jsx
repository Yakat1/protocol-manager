import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { FlaskRound, Plus, Trash2, Box } from 'lucide-react';
import { softDelete } from '../../utils/softDelete';
import { CONC_FACTORS, VOLUME_FACTORS, parseCalcFloat, formatMassResult } from '../../utils/calculations';

export default function BufferCreator({ inventory, bufferRecipes, setBufferRecipes, setInventory, user }) {
  const [bufferName, setBufferName] = useState('');
  const [bufferComponents, setBufferComponents] = useState([
    { id: uuidv4(), name: '', mw: '', targetConc: '', concUnit: 'mM' }
  ]);
  const [bufferVol, setBufferVol] = useState({ vol: '', unit: 'mL' });
  const [showRecipes, setShowRecipes] = useState(false);
  const [recipeSearch, setRecipeSearch] = useState('');
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [recipeToSave, setRecipeToSave] = useState({ name: '', category: '' });
  const [pendingDelete, setPendingDelete] = useState(null);

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

  const bResults = bufferResults();

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
        setBufferRecipes(
          softDelete(bufferRecipes, id, user),
          { immediate: true }
        );
      }
      setPendingDelete(null);
    } else {
      setPendingDelete(id);
    }
  };

  const groupedRecipes = bufferRecipes
    .filter(r => !r.deletedAt)
    .filter(r => !recipeSearch || r.name.toLowerCase().includes(recipeSearch.toLowerCase()) || r.category.toLowerCase().includes(recipeSearch.toLowerCase()))
    .reduce((acc, r) => { acc[r.category] = [...(acc[r.category] || []), r]; return acc; }, {});

  return (
    <div className="glass-panel calc-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
        <h4 style={{ margin: 0 }}><FlaskRound size={18}/> Creador de Buffer</h4>
        <button className="btn" style={{ fontSize: '0.75rem', padding: '4px 8px' }} onClick={() => { setShowRecipes(!showRecipes); setPendingDelete(null); }}>
          📂 {showRecipes ? 'Cerrar Biblioteca' : `Biblioteca${bufferRecipes.length > 0 ? ` (${bufferRecipes.length})` : ''}`}
        </button>
      </div>
      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '12px', marginTop: '4px' }}>
        Agrega los componentes de tu buffer y calcula cuánto pesar de cada uno.
      </p>

      {/* ── Recipe Library Panel ── */}
      {showRecipes && (
        <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '12px', marginBottom: '16px', borderTop: '2px solid var(--primary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>📚 Recetas Guardadas</span>
          </div>
          <input
            className="input-field"
            type="text"
            placeholder="Buscar por nombre o categoría..."
            value={recipeSearch}
            onChange={e => setRecipeSearch(e.target.value)}
            style={{ marginBottom: '10px', fontSize: '0.8rem' }}
          />
          {Object.keys(groupedRecipes).length === 0 && (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'center', padding: '12px 0' }}>No hay recetas guardadas.</p>
          )}
          {Object.entries(groupedRecipes).map(([cat, recipes]) => (
            <div key={cat} style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>📁 {cat}</div>
              {recipes.map(recipe => (
                <div key={recipe.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', marginBottom: '4px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: '600', fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{recipe.name}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{recipe.components.length} componente{recipe.components.length !== 1 ? 's' : ''}</div>
                  </div>
                  <button className="btn" style={{ fontSize: '0.75rem', padding: '3px 8px', flex: '0 0 auto' }} onClick={() => handleLoadRecipe(recipe)}>Cargar</button>
                  <button
                    className="btn"
                    style={{ fontSize: '0.75rem', padding: '3px 8px', flex: '0 0 auto', background: pendingDelete === recipe.id ? 'rgba(239,68,68,0.2)' : 'transparent', border: pendingDelete === recipe.id ? '1px solid #ef4444' : '1px solid var(--border)', color: pendingDelete === recipe.id ? '#ef4444' : 'var(--text-secondary)' }}
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
        <div style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: '8px', padding: '12px', marginBottom: '14px' }}>
          <div style={{ fontWeight: 'bold', fontSize: '0.9rem', marginBottom: '10px' }}>💾 Guardar como Receta</div>
          <div className="calc-row">
            <div className="input-group">
              <label className="input-label" style={{ fontSize: '0.75rem' }}>Nombre de la Receta</label>
              <input className="input-field" type="text" placeholder={bufferName || 'Ej. PBS 1x'} value={recipeToSave.name} onChange={e => setRecipeToSave({...recipeToSave, name: e.target.value})} />
            </div>
            <div className="input-group">
              <label className="input-label" style={{ fontSize: '0.75rem' }}>Categoría</label>
              <input className="input-field" type="text" placeholder="Ej. Electroforesis, Lisis" value={recipeToSave.category} onChange={e => setRecipeToSave({...recipeToSave, category: e.target.value})} list="recipe-categories" />
              <datalist id="recipe-categories">
                {[...new Set(bufferRecipes.filter(r => !r.deletedAt).map(r => r.category))].map(cat => <option key={cat} value={cat}/>)}
                {['Electroforesis','Lisis','Purificación','Inmunoensayo','General'].map(c => <option key={c} value={c}/>)}
              </datalist>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center', fontSize: '0.8rem' }} onClick={handleSaveRecipe}>Confirmar Guardar</button>
            <button className="btn" style={{ fontSize: '0.8rem' }} onClick={() => setShowSaveForm(false)}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Buffer name + volume */}
      <div className="calc-row" style={{ marginBottom: '12px' }}>
        <div className="input-group">
          <label className="input-label">Nombre del Buffer</label>
          <input className="input-field" type="text" placeholder="ej. PBS 1X, Buffer de Lisis" value={bufferName} onChange={e => setBufferName(e.target.value)} />
        </div>
        <div className="input-group">
          <label className="input-label">Volumen Final</label>
          <div style={{ display: 'flex', gap: '6px' }}>
            <input className="input-field" type="text" inputMode="decimal" placeholder="ej. 500" value={bufferVol.vol} onChange={e => setBufferVol({...bufferVol, vol: e.target.value})} style={{ flex: 1 }} />
            <select className="input-field" style={{ width: '70px', padding: '4px' }} value={bufferVol.unit} onChange={e => setBufferVol({...bufferVol, unit: e.target.value})}>
              {Object.keys(VOLUME_FACTORS).map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Component rows */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
        <label className="input-label" style={{ marginBottom: '8px', display: 'block' }}>Componentes</label>
        {bufferComponents.map((comp, idx) => (
          <div key={comp.id} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 120px', minWidth: '100px' }}>
              {idx === 0 && <label className="input-label" style={{ fontSize: '0.7rem' }}>Nombre</label>}
              <div style={{ display: 'flex', gap: '4px' }}>
                <select 
                  className="input-field" 
                  style={{ flex: '0 0 auto', width: '32px', padding: '0 2px', textAlign: 'center', cursor: 'pointer' }} 
                  title="Seleccionar del inventario"
                  onChange={e => {
                    const invItem = inventory?.find(i => i.id === e.target.value);
                    if (invItem) {
                      updateBufferComponent(comp.id, 'name', invItem.name);
                      if (invItem.mw) updateBufferComponent(comp.id, 'mw', invItem.mw);
                    }
                    e.target.value = '';
                  }}
                >
                  <option value="">▼</option>
                  {inventory?.filter(i => i.type === 'Reactivo' || i.type === 'Solución Stock').map(i => (
                    <option key={i.id} value={i.id}>{i.name}</option>
                  ))}
                </select>
                <input className="input-field" type="text" placeholder="ej. NaCl" value={comp.name} onChange={e => updateBufferComponent(comp.id, 'name', e.target.value)} style={{ flex: 1 }}/>
              </div>
            </div>
            <div style={{ flex: '0 1 100px', minWidth: '80px' }}>
              {idx === 0 && <label className="input-label" style={{ fontSize: '0.7rem' }}>PM (g/mol)</label>}
              <input className="input-field" type="text" inputMode="decimal" placeholder="58.44" value={comp.mw} onChange={e => updateBufferComponent(comp.id, 'mw', e.target.value)} />
            </div>
            <div style={{ flex: '0 1 100px', minWidth: '80px' }}>
              {idx === 0 && <label className="input-label" style={{ fontSize: '0.7rem' }}>Conc.</label>}
              <input className="input-field" type="text" inputMode="decimal" placeholder="150" value={comp.targetConc} onChange={e => updateBufferComponent(comp.id, 'targetConc', e.target.value)} />
            </div>
            <div style={{ flex: '0 0 65px' }}>
              {idx === 0 && <label className="input-label" style={{ fontSize: '0.7rem' }}>Unidad</label>}
              <select className="input-field" style={{ padding: '4px', width: '100%' }} value={comp.concUnit} onChange={e => updateBufferComponent(comp.id, 'concUnit', e.target.value)}>
                {Object.keys(CONC_FACTORS).map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <button 
              className="btn" 
              style={{ padding: '4px 6px', opacity: bufferComponents.length <= 1 ? 0.3 : 1, flex: '0 0 auto' }} 
              onClick={() => removeBufferComponent(comp.id)} 
              disabled={bufferComponents.length <= 1}
              title="Eliminar componente"
            >
              <Trash2 size={14}/>
            </button>
          </div>
        ))}
        <button className="btn" style={{ fontSize: '0.8rem', padding: '6px 12px', marginTop: '4px' }} onClick={addBufferComponent}>
          <Plus size={14} style={{ marginRight: '4px' }}/> Añadir Componente
        </button>
      </div>

      {/* Results table */}
      {bResults && (
        <div className="calc-result" style={{ marginTop: '16px' }}>
          <div className="calc-result-value" style={{ fontSize: '1.1rem', marginBottom: '10px' }}>
            {bufferName || 'Buffer'} — {bufferVol.vol} {bufferVol.unit}
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                <th style={{ padding: '6px 8px', color: 'var(--text-secondary)' }}>Componente</th>
                <th style={{ padding: '6px 8px', color: 'var(--text-secondary)' }}>Concentración</th>
                <th style={{ padding: '6px 8px', color: 'var(--text-secondary)', textAlign: 'right' }}>Masa a Pesar</th>
              </tr>
            </thead>
            <tbody>
              {bResults.map(r => {
                const fmt = formatMassResult(r.massG);
                return (
                  <tr key={r.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '6px 8px', fontWeight: 'bold' }}>{r.name}</td>
                    <td style={{ padding: '6px 8px', color: 'var(--text-secondary)' }}>{r.concLabel}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--accent)', fontWeight: '600' }}>{fmt.val} {fmt.unit}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
            <button 
              className="btn btn-primary" 
              style={{ flex: 1, justifyContent: 'center', fontSize: '0.8rem', padding: '8px' }}
              onClick={handleSaveBufferToInventory}
            >
              <Box size={14} style={{ marginRight: '6px' }}/> A Inventario
            </button>
            <button
              className="btn"
              style={{ flex: 1, justifyContent: 'center', fontSize: '0.8rem', padding: '8px', border: '1px solid var(--primary)', color: 'var(--primary)' }}
              onClick={() => { setShowSaveForm(true); setShowRecipes(false); }}
            >
              ⭐ Guardar Receta
            </button>
          </div>
        </div>
      )}
    </div>
  );
}