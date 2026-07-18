import React, { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { Plus, Trash2, Copy, FileText, Search, AlertCircle, Save, Download, Upload } from 'lucide-react';
import { writeAuditEntry } from '../utils/firebase';
import './ProtocolsManager.css';

const QUILL_MODULES = {
  toolbar: [
    [{ 'header': [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ 'color': [] }, { 'background': [] }],
    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
    [{ 'script': 'sub'}, { 'script': 'super' }],
    ['clean']
  ],
};

export default function ProtocolsManager({ protocols: protocolsProp, inventory: inventoryProp, bufferRecipes: bufferRecipesProp, setCultureProtocols, can, user, labId }) {
  const protocols = protocolsProp || [];
  const inventory = inventoryProp || [];
  const bufferRecipes = bufferRecipesProp || [];
  const [activeProtoId, setActiveProtoId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Auto-select first protocol
  useEffect(() => {
    if (!activeProtoId && protocols.length > 0) {
      setActiveProtoId(protocols[0].id);
    }
  }, [protocols.length, activeProtoId]);

  const addProtocol = () => {
    if (can && !can.createProtocol) return;
    const newP = {
      id: uuidv4(),
      name: 'Nuevo Protocolo de Cultivo',
      description: '<h3>Objetivo</h3><p><br></p><h3>Materiales Adicionales</h3><p><br></p><h3>Metodología</h3><ol><li>Escribe el primer paso...</li></ol>',
      materialsIds: [],
      recipeIds: []
    };
    setCultureProtocols([...protocols, newP]);
    if (user?.uid && labId) writeAuditEntry(labId, { userId: user.uid, displayName: user.displayName || user.email, action: 'protocol_created', target: newP.name || 'Protocolo', details: {} }).catch(console.error);
    setActiveProtoId(newP.id);
  };

  const removeProtocol = (id) => {
    if (can && !can.deleteProtocol) return;
    if (confirm('¿Eliminar protocolo? Esta acción no se puede deshacer.')) {
      const deletedName = protocols.find(p => p.id === id)?.name;
      setCultureProtocols(protocols.filter(p => p.id !== id));
      if (user?.uid && labId) writeAuditEntry(labId, { userId: user.uid, displayName: user.displayName || user.email, action: 'protocol_deleted', target: deletedName || 'Protocolo', details: {} }).catch(console.error);
      if (activeProtoId === id) setActiveProtoId(null);
    }
  };

  const duplicateProtocol = (p) => {
    const copy = { ...p, id: uuidv4(), name: p.name + ' (Copia)' };
    setCultureProtocols([...protocols, copy]);
  };

  const updateProtocol = (id, field, value) => {
    setCultureProtocols(protocols.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const toggleMaterial = (protoId, materialId) => {
    const p = protocols.find(pr => pr.id === protoId);
    let newMats = p.materialsIds || [];
    if (newMats.includes(materialId)) {
      newMats = newMats.filter(m => m !== materialId);
    } else {
      newMats = [...newMats, materialId];
    }
    updateProtocol(protoId, 'materialsIds', newMats);
  };

  const toggleRecipe = (protoId, recipeId) => {
    const p = protocols.find(pr => pr.id === protoId);
    let newRecs = p.recipeIds || [];
    if (newRecs.includes(recipeId)) {
      newRecs = newRecs.filter(r => r !== recipeId);
    } else {
      newRecs = [...newRecs, recipeId];
    }
    updateProtocol(protoId, 'recipeIds', newRecs);
  };

  const handleExportJson = (protocol) => {
    const exportData = {
      ...protocol,
      materialsExp: (protocol.materialsIds || []).map(id => {
        const item = inventory.find(i => i.id === id);
        return item ? { name: item.name, type: item.type } : null;
      }).filter(Boolean),
      recipesExp: (protocol.recipeIds || []).map(id => {
        const item = bufferRecipes.find(r => r.id === id);
        return item ? { name: item.name } : null;
      }).filter(Boolean)
    };
    
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `Protocolo_${protocol.name.replace(/\\s+/g, '_')}.json`);
    dlAnchorElem.click();
    if (user?.uid && labId) writeAuditEntry(labId, { userId: user.uid, displayName: user.displayName || user.email, action: 'protocol_exported', target: protocol.name, details: {} }).catch(console.error);
  };

  const handleImportJson = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target.result);
        if (!imported.name || !imported.description) throw new Error("Formato inválido");
        
        let newDesc = imported.description;
        const matchedMaterialsIds = [];
        const matchedRecipeIds = [];
        const missing = [];

        if (Array.isArray(imported.materialsExp)) {
          imported.materialsExp.forEach(m => {
            const found = inventory.find(i => i.name.toLowerCase() === m.name.toLowerCase());
            if (found) matchedMaterialsIds.push(found.id);
            else missing.push(`Reactivo: ${m.name}`);
          });
        }
        
        if (Array.isArray(imported.recipesExp)) {
          imported.recipesExp.forEach(r => {
            const found = bufferRecipes.find(i => i.name.toLowerCase() === r.name.toLowerCase());
            if (found) matchedRecipeIds.push(found.id);
            else missing.push(`Receta: ${r.name}`);
          });
        }

        if (missing.length > 0) {
          newDesc += `<br><p><strong style="color: #ef4444;">⚠️ Materiales no encontrados en tu inventario local:</strong></p><ul>${missing.map(m => `<li>${m}</li>`).join('')}</ul>`;
        }
        
        const newP = {
          id: uuidv4(),
          name: imported.name + ' (Importado)',
          description: newDesc,
          materialsIds: matchedMaterialsIds,
          recipeIds: matchedRecipeIds
        };
        setCultureProtocols([...protocols, newP]);
        setActiveProtoId(newP.id);
        if (user?.uid && labId) writeAuditEntry(labId, { userId: user.uid, displayName: user.displayName || user.email, action: 'protocol_imported', target: newP.name, details: {} }).catch(console.error);
      } catch (err) {
        alert("Error al importar el protocolo. Asegúrate de que sea un archivo JSON válido exportado desde esta app.");
      }
    };
    reader.readAsText(file);
    e.target.value = null; // reset input
  };

  const filteredInventory = inventory.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const filteredRecipes = bufferRecipes.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const activeProtocol = protocols.find(p => p.id === activeProtoId);

  return (
    <div className="protocols-container">
      <div className="protocols-header glass-panel">
        <div>
          <h2 style={{color: 'var(--text-primary)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px'}}>
            <FileText size={24} color="var(--accent)"/> Gestor de Protocolos (Metodologías)
          </h2>
          <p style={{color: 'var(--text-secondary)', fontSize: '0.9rem'}}>Diseña SOPs con texto enriquecido para usar como plantillas en tus bitácoras.</p>
        </div>
      </div>

      <div className="protocols-split-view">
        {/* Sidebar: Lista de Protocolos */}
        <div className="protocols-sidebar glass-panel">
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px'}}>
            <h4>Biblioteca</h4>
            <div style={{display: 'flex', gap: '4px'}}>
              <input type="file" id="json-upload" accept=".json" style={{display: 'none'}} onChange={handleImportJson} />
              <button className="btn-icon" onClick={() => document.getElementById('json-upload').click()} title="Importar JSON" style={{background: 'var(--primary)', color: 'white', borderRadius: '4px'}}><Upload size={16}/></button>
              <button className="btn-icon" onClick={addProtocol} title="Nuevo Protocolo" style={{background: 'var(--success)', color: 'white', borderRadius: '4px'}}><Plus size={16}/></button>
            </div>
          </div>
          
          <div className="protocols-list">
            {protocols.map(p => (
              <div 
                key={p.id} 
                className={`protocol-list-item ${activeProtoId === p.id ? 'active' : ''}`}
                onClick={() => setActiveProtoId(p.id)}
              >
                <FileText size={16} />
                <span className="proto-name">{p.name}</span>
              </div>
            ))}
            {protocols.length === 0 && <div className="empty-mini">No hay protocolos.</div>}
          </div>
        </div>

        {/* Editor Principal */}
        <div className="protocol-editor-view glass-panel">
          {activeProtocol ? (
            <div className="editor-inner">
              <div className="editor-topbar">
                <input 
                  className="proto-title-input" 
                  value={activeProtocol.name} 
                  onChange={e => updateProtocol(activeProtocol.id, 'name', e.target.value)}
                  placeholder="Nombre del Protocolo"
                />
                <div style={{display:'flex', gap:'8px'}}>
                  <button className="btn-icon" onClick={() => handleExportJson(activeProtocol)} title="Exportar JSON"><Download size={18}/></button>
                  <button className="btn-icon" onClick={() => duplicateProtocol(activeProtocol)} title="Duplicar"><Copy size={18}/></button>
                  <button className="btn-icon" onClick={() => removeProtocol(activeProtocol.id)} title="Eliminar" style={{color: 'var(--danger)'}}><Trash2 size={18}/></button>
                </div>
              </div>

              <div className="editor-body">
                {/* Text Editor */}
                <div className="quill-container">
                  <label>Instrucciones y Metodología</label>
                  <ReactQuill 
                    theme="snow" 
                    value={activeProtocol.description} 
                    onChange={(val) => updateProtocol(activeProtocol.id, 'description', val)}
                    modules={QUILL_MODULES}
                    className="custom-quill"
                  />
                </div>

                {/* Inventory Linking */}
                <div className="proto-materials-panel" style={{display: 'flex', flexDirection: 'column'}}>
                  <label><Search size={14}/> Materiales y Buffers (Opcional)</label>
                  <p style={{fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '8px'}}>Los ítems seleccionados aparecerán como un Check-list en la bitácora cada que uses este protocolo.</p>
                  
                  <input 
                    className="input-field" 
                    placeholder="Buscar reactivos o recetas..." 
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    style={{width: '100%', marginBottom: '12px', fontSize: '0.85rem', padding: '6px 10px'}}
                  />
                  
                  <div style={{flex: 1, display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto'}}>
                    <div>
                      <h5 style={{fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px'}}>🧪 Reactivos (Inventario)</h5>
                      <div className="proto-inventory-list" style={{flex: 'none', height: 'auto', maxHeight: '200px'}}>
                        {filteredInventory.map(item => {
                          const isSelected = (activeProtocol.materialsIds || []).includes(item.id);
                          return (
                            <div key={item.id} className={`proto-inv-item ${isSelected ? 'selected' : ''}`} onClick={() => toggleMaterial(activeProtocol.id, item.id)}>
                              <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                                <input type="checkbox" checked={isSelected} readOnly style={{cursor: 'pointer'}} />
                                <div>
                                  <div style={{fontWeight: 500, fontSize: '0.9rem'}}>{item.name}</div>
                                  <div style={{fontSize: '0.75rem', color: 'var(--text-secondary)'}}>{item.type} | {item.quantity} {item.unit}</div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        {filteredInventory.length === 0 && <span style={{fontSize: '0.85rem', color: 'var(--text-secondary)'}}>No se encontraron reactivos.</span>}
                      </div>
                    </div>

                    <div>
                      <h5 style={{fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px'}}>📚 Buffers y Recetas (Calculadora)</h5>
                      <div className="proto-inventory-list" style={{flex: 'none', height: 'auto', maxHeight: '200px'}}>
                        {filteredRecipes.map(item => {
                          const isSelected = (activeProtocol.recipeIds || []).includes(item.id);
                          return (
                            <div key={item.id} className={`proto-inv-item ${isSelected ? 'selected' : ''}`} onClick={() => toggleRecipe(activeProtocol.id, item.id)}>
                              <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                                <input type="checkbox" checked={isSelected} readOnly style={{cursor: 'pointer'}} />
                                <div>
                                  <div style={{fontWeight: 500, fontSize: '0.9rem'}}>{item.name}</div>
                                  <div style={{fontSize: '0.75rem', color: 'var(--text-secondary)'}}>{item.category} | {item.components?.length || 0} componentes</div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        {filteredRecipes.length === 0 && <span style={{fontSize: '0.85rem', color: 'var(--text-secondary)'}}>No se encontraron recetas.</span>}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="empty-state">
              <FileText size={48} style={{opacity: 0.2, marginBottom: '16px'}} />
              <p>Selecciona un protocolo de la biblioteca o crea uno nuevo.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
