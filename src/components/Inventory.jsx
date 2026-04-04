import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Plus, Trash2, Box, Droplet, Search, Download } from 'lucide-react';
import { exportInventoryCSV } from '../utils/export';
import './Inventory.css';

const ITEM_TYPES = ['Reactivo', 'Solución Stock', 'Anticuerpo 1°', 'Anticuerpo 2°', 'Medio de Cultivo', 'Material'];
const UNITS = ['mL', 'L', 'µL', 'Alícuotas', 'g', 'mg', 'Unidades', 'Cajas', 'Paquetes'];

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
    setInventory(inventory.map(item => item.id === id ? { ...item, [field]: value } : item));
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
          
          // Check if it's expired
          const isExpired = item.expDate && new Date(item.expDate) < new Date();
          const isLowStock = parseFloat(item.quantity) <= 2; // Arbritary low stock rule

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
    </div>
  );
}
