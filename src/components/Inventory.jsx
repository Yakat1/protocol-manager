import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Plus, Trash2, Box, Droplet, Search, Download, Grid } from 'lucide-react';
import { exportInventoryCSV } from '../utils/export';
import './Inventory.css';

const ITEM_TYPES = ['Reactivo', 'Solución Stock', 'Anticuerpo 1°', 'Anticuerpo 2°', 'Medio de Cultivo', 'Material'];
const UNITS = ['mL', 'L', 'µL', 'Alícuotas', 'g', 'mg', 'Unidades', 'Cajas', 'Paquetes'];
const GRID_SIZE = 9;
const GRID_ROWS = 'ABCDEFGHI'.split('');

// ── Aliquot Grid Modal ─────────────────────────────────────────────────────
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function AliquotGridModal({ item, updateItemMulti, onClose }) {
  const initRows = item.gridRows || 9;
  const initCols = item.gridCols || 9;
  const initMap = (item.storageMap && item.storageMap.length === initRows * initCols)
    ? [...item.storageMap]
    : Array(initRows * initCols).fill(false);

  const [rows, setRows] = useState(initRows);
  const [cols, setCols] = useState(initCols);
  const [map, setMap] = useState(initMap);
  const [boxName, setBoxName] = useState(item.boxName || '');
  const [pendingRows, setPendingRows] = useState(initRows);
  const [pendingCols, setPendingCols] = useState(initCols);

  const saveToInventory = (newMap, newRows, newCols, newBoxName) => {
    updateItemMulti(item.id, {
      storageMap: newMap,
      quantity: newMap.filter(Boolean).length,
      gridRows: newRows,
      gridCols: newCols,
      boxName: newBoxName,
    });
  };

  const toggle = (idx) => {
    setMap(prev => {
      const next = [...prev];
      next[idx] = !next[idx];
      saveToInventory(next, rows, cols, boxName);
      return next;
    });
  };

  const fillAll = () => {
    const next = Array(rows * cols).fill(true);
    setMap(next);
    saveToInventory(next, rows, cols, boxName);
  };

  const clearAll = () => {
    const next = Array(rows * cols).fill(false);
    setMap(next);
    saveToInventory(next, rows, cols, boxName);
  };

  const applyDimensions = () => {
    const newMap = Array(pendingRows * pendingCols).fill(false);
    // Preserve existing filled positions that fit
    for (let r = 0; r < Math.min(rows, pendingRows); r++) {
      for (let c = 0; c < Math.min(cols, pendingCols); c++) {
        newMap[r * pendingCols + c] = map[r * cols + c] || false;
      }
    }
    setRows(pendingRows);
    setCols(pendingCols);
    setMap(newMap);
    saveToInventory(newMap, pendingRows, pendingCols, boxName);
  };

  const handleBoxNameChange = (val) => {
    setBoxName(val);
    updateItemMulti(item.id, { boxName: val });
  };

  const occupied = map.filter(Boolean).length;
  const rowLabels = ALPHABET.slice(0, rows).split('');

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="glass-panel" style={{padding: '24px', maxWidth: '520px', width: '95vw', maxHeight: '90vh', overflowY: 'auto'}} onClick={e => e.stopPropagation()}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px'}}>
          <h4 style={{margin: 0}}>🧊 Caja de Alícuotas: {item.name}</h4>
          <button className="btn-icon" onClick={onClose} style={{fontSize: '1.2rem', lineHeight: 1}}>×</button>
        </div>

        {/* Box name */}
        <div style={{marginBottom: '10px'}}>
          <label style={{fontSize: '0.8rem', color: 'var(--text-secondary)'}}>Nombre de la Caja</label>
          <input className="input-field" placeholder="Ej. Caja A1 - Freezer 2" value={boxName} onChange={e => handleBoxNameChange(e.target.value)} />
        </div>

        {/* Dimension picker */}
        <div style={{display: 'flex', gap: '8px', alignItems: 'flex-end', marginBottom: '12px', flexWrap: 'wrap'}}>
          <div>
            <label style={{fontSize: '0.75rem', color: 'var(--text-secondary)'}}>Filas (A–Z)</label>
            <input type="number" className="input-field" min={1} max={26} value={pendingRows}
              onChange={e => setPendingRows(Math.max(1, Math.min(26, parseInt(e.target.value) || 1)))}
              style={{width: '70px'}} />
          </div>
          <div>
            <label style={{fontSize: '0.75rem', color: 'var(--text-secondary)'}}>Columnas</label>
            <input type="number" className="input-field" min={1} max={26} value={pendingCols}
              onChange={e => setPendingCols(Math.max(1, Math.min(26, parseInt(e.target.value) || 1)))}
              style={{width: '70px'}} />
          </div>
          <button className="btn btn-primary" style={{fontSize: '0.8rem', padding: '7px 12px'}} onClick={applyDimensions}>
            Aplicar {pendingRows}×{pendingCols}
          </button>
          <span style={{fontSize: '0.8rem', color: 'var(--text-secondary)', alignSelf: 'center'}}>{rows}×{cols} actual</span>
        </div>

        {/* Stats + quick actions */}
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px'}}>
          <span style={{fontSize: '0.85rem', fontWeight: 'bold'}}>
            {occupied} / {rows * cols} ocupadas
          </span>
          <div style={{display: 'flex', gap: '6px'}}>
            <button className="btn" style={{fontSize: '0.7rem', padding: '3px 8px'}} onClick={fillAll}>Llenar Todas</button>
            <button className="btn" style={{fontSize: '0.7rem', padding: '3px 8px'}} onClick={clearAll}>Vaciar Todas</button>
          </div>
        </div>

        {/* Grid */}
        <div style={{overflowX: 'auto'}}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: `24px repeat(${cols}, minmax(22px, 1fr))`,
            gap: '3px',
            minWidth: `${24 + cols * 25}px`,
          }}>
            {/* Column header */}
            <div />
            {Array.from({length: cols}, (_, i) => (
              <div key={i} style={{textAlign: 'center', fontWeight: 'bold', fontSize: '0.65rem', color: 'var(--text-secondary)', paddingBottom: '2px'}}>{i + 1}</div>
            ))}
            {/* Rows */}
            {rowLabels.map((row, ri) => (
              <React.Fragment key={row}>
                <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.7rem', color: 'var(--text-secondary)'}}>{row}</div>
                {Array.from({length: cols}, (_, ci) => {
                  const idx = ri * cols + ci;
                  const filled = map[idx] || false;
                  return (
                    <div
                      key={idx}
                      onClick={() => toggle(idx)}
                      title={`${row}${ci + 1}`}
                      style={{
                        aspectRatio: '1', borderRadius: '3px', cursor: 'pointer',
                        background: filled ? 'var(--primary)' : 'rgba(255,255,255,0.07)',
                        border: '1px solid ' + (filled ? 'var(--primary)' : 'var(--border)'),
                        transition: 'background 0.1s, border-color 0.1s',
                        userSelect: 'none',
                      }}
                    />
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>

        <div style={{textAlign: 'center', marginTop: '12px', fontSize: '0.75rem', color: 'var(--text-secondary)'}}>
          Haz clic en cada posición para marcar / desmarcar una alícuota.
        </div>
      </div>
    </div>
  );
}

const renderDynamicFields = (item, updateItem, isExpired, isLowStock) => {
  const t = item.type;
  
  if (t === 'Anticuerpo 1°' || t === 'Anticuerpo 2°') {
    return (
      <>
        <div className="inv-field-group">
          <label>Marca</label>
          <input className="input-field" value={item.brand || ''} onChange={e => updateItem(item.id, 'brand', e.target.value)} placeholder="Ej. Abcam, Cell Signaling" />
        </div>
        <div className="inv-field-group">
          <label>Sitio de Incubación</label>
          <input className="input-field" value={item.target || ''} onChange={e => updateItem(item.id, 'target', e.target.value)} placeholder="Ej. Rabbit anti-Mouse" />
        </div>
        <div className="inv-field-group">
          <label>Lote</label>
          <input className="input-field" value={item.batch || item.concentration || ''} onChange={e => updateItem(item.id, 'batch', e.target.value)} placeholder="Número de lote" />
        </div>
        <div className="inv-field-group" style={{gridColumn: '1 / -1'}}>
          <label>Cantidad Disponible {(isLowStock && item.quantity > 0) && <span style={{color: 'var(--warning)', fontSize: '0.75rem', marginLeft:'4px'}}>(Stock Bajo)</span>}</label>
          <div style={{display: 'flex', gap: '8px', width: '100%'}}>
            <input type="number" className="input-field" style={{flex: '1 1 auto', minWidth: '80px'}} value={item.quantity || ''} onChange={e => updateItem(item.id, 'quantity', e.target.value)} />
            <select className="input-field" value={item.unit || 'µL'} onChange={e => updateItem(item.id, 'unit', e.target.value)} style={{flex: '0 0 auto', width: '90px'}}>
              <option value="µL">µL</option>
              <option value="Alícuotas">Alícuotas</option>
            </select>
          </div>
        </div>
      </>
    );
  }

  if (t === 'Solución Stock') {
    return (
      <>
        <div className="inv-field-group">
          <label>Concentración</label>
          <input className="input-field" value={item.concentration || ''} onChange={e => updateItem(item.id, 'concentration', e.target.value)} placeholder="Ej. 10x, 1mg/ml" />
        </div>
        <div className="inv-field-group">
          <label>Elaborado Por</label>
          <input className="input-field" value={item.author || ''} onChange={e => updateItem(item.id, 'author', e.target.value)} placeholder="Autor" />
        </div>
        <div className="inv-field-group">
          <label>Fecha Elaboración</label>
          <input type="date" className="input-field" value={item.creationDate || ''} onChange={e => updateItem(item.id, 'creationDate', e.target.value)} />
        </div>
        <div className="inv-field-group" style={{gridColumn: '1 / -1'}}>
          <label>Cantidad Disponible {(isLowStock && item.quantity > 0) && <span style={{color: 'var(--warning)', fontSize: '0.75rem', marginLeft:'4px'}}>(Stock Bajo)</span>}</label>
          <div style={{display: 'flex', gap: '8px', width: '100%'}}>
            <input type="number" className="input-field" style={{flex: '1 1 auto', minWidth: '80px'}} value={item.quantity || ''} onChange={e => updateItem(item.id, 'quantity', e.target.value)} />
            <select className="input-field" value={item.unit || 'mL'} onChange={e => updateItem(item.id, 'unit', e.target.value)} style={{flex: '0 0 auto', width: '90px'}}>
              {['mL', 'L', 'g', 'mg'].map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        </div>
      </>
    );
  }

  if (t === 'Material') {
    return (
      <>
        <div className="inv-field-group">
          <label>Marca</label>
          <input className="input-field" value={item.brand || ''} onChange={e => updateItem(item.id, 'brand', e.target.value)} placeholder="Ej. Eppendorf, Corning" />
        </div>
        <div className="inv-field-group">
          <label>Especificación / Tamaño</label>
          <input className="input-field" value={item.specs || item.concentration || ''} onChange={e => updateItem(item.id, 'specs', e.target.value)} placeholder="Ej. 1.5mL, 10µL" />
        </div>
        <div className="inv-field-group" style={{gridColumn: '1 / -1'}}>
          <label>Cantidad Disponible {(isLowStock && item.quantity > 0) && <span style={{color: 'var(--warning)', fontSize: '0.75rem', marginLeft:'4px'}}>(Stock Bajo)</span>}</label>
          <div style={{display: 'flex', gap: '8px', width: '100%'}}>
            <input type="number" className="input-field" style={{flex: '1 1 auto', minWidth: '80px'}} value={item.quantity || ''} onChange={e => updateItem(item.id, 'quantity', e.target.value)} />
            <select className="input-field" value={item.unit || 'Cajas'} onChange={e => updateItem(item.id, 'unit', e.target.value)} style={{flex: '0 0 auto', width: '90px'}}>
              {['Unidades', 'Cajas', 'Paquetes'].map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        </div>
      </>
    );
  }

  if (t === 'Medio de Cultivo') {
    return (
      <>
        <div className="inv-field-group" style={{gridColumn: '1 / -1'}}>
          <label>Suplementos</label>
          <input className="input-field" value={item.supplements || item.concentration || ''} onChange={e => updateItem(item.id, 'supplements', e.target.value)} placeholder="Ej. 10% FBS, 1% PenStrep" />
        </div>
        <div className="inv-field-group">
          <label>Fecha Elaboración</label>
          <input type="date" className="input-field" value={item.creationDate || ''} onChange={e => updateItem(item.id, 'creationDate', e.target.value)} />
        </div>
        <div className="inv-field-group">
          <label style={{color: isExpired ? 'var(--danger)' : 'var(--text-secondary)'}}>Caducidad {isExpired && '⚠️'}</label>
          <input type="date" className="input-field" value={item.expDate || ''} onChange={e => updateItem(item.id, 'expDate', e.target.value)} style={{borderColor: isExpired ? 'var(--danger)' : ''}} />
        </div>
        <div className="inv-field-group" style={{gridColumn: '1 / -1'}}>
          <label>Cantidad Disponible {(isLowStock && item.quantity > 0) && <span style={{color: 'var(--warning)', fontSize: '0.75rem', marginLeft:'4px'}}>(Stock Bajo)</span>}</label>
          <div style={{display: 'flex', gap: '8px', width: '100%'}}>
            <input type="number" className="input-field" style={{flex: '1 1 auto', minWidth: '80px'}} value={item.quantity || ''} onChange={e => updateItem(item.id, 'quantity', e.target.value)} />
            <select className="input-field" value={item.unit || 'mL'} onChange={e => updateItem(item.id, 'unit', e.target.value)} style={{flex: '0 0 auto', width: '90px'}}>
              {['mL', 'L', 'Alícuotas'].map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        </div>
      </>
    );
  }

  // Fallback: Reactivo genérico
  return (
    <>
      <div className="inv-field-group">
        <label>Marca</label>
        <input className="input-field" value={item.brand || ''} onChange={e => updateItem(item.id, 'brand', e.target.value)} placeholder="Ej. Sigma-Aldrich" />
      </div>
      <div className="inv-field-group">
        <label>Número de Catálogo</label>
        <input className="input-field" value={item.catalog || ''} onChange={e => updateItem(item.id, 'catalog', e.target.value)} placeholder="Ej. M4659" />
      </div>
      <div className="inv-field-group">
        <label>Peso Molecular</label>
        <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
          <input type="number" className="input-field" style={{flex: 1, minWidth: 0}} value={item.mw || ''} onChange={e => updateItem(item.id, 'mw', e.target.value)} placeholder="Ej. 18.01" />
          <span style={{fontSize: '0.85rem', color: 'var(--text-secondary)'}}>g/mol</span>
        </div>
      </div>
      <div className="inv-field-group">
        <label style={{color: isExpired ? 'var(--danger)' : 'var(--text-secondary)'}}>Caducidad {isExpired && '⚠️'}</label>
        <input type="date" className="input-field" value={item.expDate || ''} onChange={e => updateItem(item.id, 'expDate', e.target.value)} style={{borderColor: isExpired ? 'var(--danger)' : ''}} />
      </div>
      <div className="inv-field-group" style={{gridColumn: '1 / -1'}}>
        <label>Cantidad Disponible {(isLowStock && item.quantity > 0) && <span style={{color: 'var(--warning)', fontSize: '0.75rem', marginLeft:'4px'}}>(Stock Bajo)</span>}</label>
        <div style={{display: 'flex', gap: '8px', width: '100%'}}>
          <input type="number" className="input-field" style={{flex: '1 1 auto', minWidth: '80px'}} value={item.quantity || ''} onChange={e => updateItem(item.id, 'quantity', e.target.value)} />
          <select className="input-field" value={item.unit || 'mL'} onChange={e => updateItem(item.id, 'unit', e.target.value)} style={{flex: '0 0 auto', width: '90px'}}>
            {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
      </div>
    </>
  );
};

export default function Inventory({ inventory: inventoryProp, setInventory }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [aliquotModalId, setAliquotModalId] = useState(null);
  
  const inventory = inventoryProp || [];

  const addItem = () => {
    const newItem = {
      id: uuidv4(),
      name: 'Nuevo Item',
      type: 'Reactivo',
      concentration: '',
      quantity: 1,
      unit: 'mL',
      location: '-20°C',
      expDate: '',
      notes: ''
    };
    setInventory([newItem, ...inventory]);
  };

  const updateItem = (id, field, value) => {
    setInventory(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  // Atomic multi-field update — avoids stale closure when updating several fields at once
  const updateItemMulti = (id, updates) => {
    setInventory(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
  };

  const removeItem = (id) => {
    if (confirm('¿Seguro que deseas eliminar este ítem del inventario?')) {
      setInventory(inventory.filter(item => item.id !== id));
    }
  };

  const filteredInventory = inventory.filter(item => {
    const matchSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        (item.location && item.location.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchType = typeFilter ? item.type === typeFilter : true;
    return matchSearch && matchType;
  });

  return (
    <div className="inventory-container">
      <div className="inventory-header glass-panel">
        <div>
          <h2 style={{color: 'var(--text-primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px'}}>
            <Box size={24} color="var(--accent)"/> Inventario de Laboratorio
          </h2>
          <p style={{color: 'var(--text-secondary)', fontSize: '0.9rem'}}>Gestiona tus reactivos, soluciones madre y anticuerpos.</p>
        </div>
        
        <div style={{display: 'flex', gap: '12px', flexWrap: 'wrap'}}>
          <div className="search-box">
            <Search size={16} />
            <input 
              className="input-field" 
              placeholder="Buscar ítem o ubicación..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <select 
            className="input-field" 
            value={typeFilter} 
            onChange={e => setTypeFilter(e.target.value)}
            style={{cursor: 'pointer'}}
          >
            <option value="">Todos los Tipos</option>
            {ITEM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <button className="btn btn-primary" onClick={addItem}>
            <Plus size={16} /> Nuevo Ítem
          </button>
          <button className="btn" onClick={() => exportInventoryCSV(inventory)} title="Exportar a CSV">
            <Download size={16} /> Excel (CSV)
          </button>
        </div>
      </div>

      <div className="inventory-grid">
        {filteredInventory.map(item => {
          
          const isExpired = item.expDate && new Date(item.expDate) < new Date();
          const threshold = item.lowStockThreshold != null ? parseFloat(item.lowStockThreshold) : (item.initialStock ? parseFloat(item.initialStock) * 0.1 : 2);
          const isLowStock = parseFloat(item.quantity) <= threshold && parseFloat(item.quantity) > 0;

          return (
            <div key={item.id} className="inventory-card">
              <div className="inv-card-header">
                <input 
                  className="input-field inv-name-input"
                  value={item.name}
                  onChange={e => updateItem(item.id, 'name', e.target.value)}
                  placeholder="Nombre del Item"
                />
                <button className="btn-icon" onClick={() => removeItem(item.id)}><Trash2 size={16}/></button>
              </div>

              <div className="inv-card-body">
                <div className="inv-field-group">
                  <label>Tipo</label>
                  <select className="input-field" value={item.type} onChange={e => updateItem(item.id, 'type', e.target.value)}>
                    {ITEM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                
                <div className="inv-field-group">
                  <label>Ubicación</label>
                  <input className="input-field" value={item.location || ''} onChange={e => updateItem(item.id, 'location', e.target.value)} placeholder="Ej. -80°C Cajón 3" />
                </div>

                {renderDynamicFields(item, updateItem, isExpired, isLowStock)}

                <div className="inv-field-group" style={{gridColumn: '1 / -1'}}>
                  <label>Observaciones</label>
                  <input className="input-field" value={item.notes} onChange={e => updateItem(item.id, 'notes', e.target.value)} placeholder="Notas adicionales..." />
                </div>

                {/* Dynamic threshold */}
                <div className="inv-field-group" style={{gridColumn: '1 / -1'}}>
                  <label style={{fontSize: '0.75rem', color: 'var(--text-secondary)'}}>Umbral de Stock Bajo (alertar debajo de)</label>
                  <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
                    <input type="number" className="input-field" style={{flex: '1 1 auto', minWidth: '80px', fontSize: '0.85rem'}} value={item.lowStockThreshold ?? ''} onChange={e => updateItem(item.id, 'lowStockThreshold', e.target.value)} placeholder={`Auto: ${item.initialStock ? (parseFloat(item.initialStock)*0.1).toFixed(1) : '2'}`} />
                    <span style={{fontSize: '0.8rem', color: 'var(--text-secondary)'}}>{item.unit || 'uds'}</span>
                    {!item.initialStock && <button className="btn" style={{fontSize: '0.7rem', padding: '2px 6px', whiteSpace: 'nowrap'}} onClick={() => updateItem(item.id, 'initialStock', item.quantity)} title="Fijar stock actual como referencia del 10%">📌 Fijar</button>}
                  </div>
                </div>

                {/* Aliquot grid button */}
                {item.unit === 'Alícuotas' && (
                  <div className="inv-field-group" style={{gridColumn: '1 / -1'}}>
                    <button className="btn" style={{width: '100%', justifyContent: 'center', fontSize: '0.8rem', gap: '6px'}} onClick={() => setAliquotModalId(item.id)}>
                      <Grid size={14}/> 🧊 Mapa de Caja {item.boxName ? `(${item.boxName})` : ''}
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {filteredInventory.length === 0 && (
          <div className="empty-state" style={{gridColumn: '1 / -1', padding: '40px', textAlign: 'center'}}>
            <Droplet size={48} style={{opacity: 0.2, marginBottom: '16px'}} />
            <p>No hay ítems en tu inventario que coincidan con la búsqueda.</p>
          </div>
        )}
      </div>

      {/* Aliquot Grid Modal */}
      {aliquotModalId && (() => {
        const item = inventory.find(i => i.id === aliquotModalId);
        if (!item) return null;
        return <AliquotGridModal item={item} updateItemMulti={updateItemMulti} onClose={() => setAliquotModalId(null)} />;
      })()}
    </div>
  );
}
