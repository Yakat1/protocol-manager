import React, { useState, useRef } from 'react';
import { UploadCloud, X } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { compressImage } from '../utils/imageCompressor';

export default function ImageGallery({ subject, onUpdateImages }) {
  const [modalImage, setModalImage] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    try {
      const processedImages = await Promise.all(
        files.map(async file => {
          const compressedData = await compressImage(file, 1280, 0.82);
          return {
            id: uuidv4(),
            name: file.name,
            data: compressedData,
            notes: ''
          };
        })
      );
      
      onUpdateImages([...subject.images, ...processedImages]);
    } catch (err) {
      console.error("Error comprimiendo lote:", err);
      alert("Error optimizando imágenes. Archivos no válidos o corruptos.");
    }
    
    e.target.value = '';
  };

  const removeImage = (e, id) => {
    e.stopPropagation();
    onUpdateImages(subject.images.filter(img => img.id !== id));
  };

  return (
    <div className="glass-panel" style={{padding: '24px'}}>
      <div className="gallery-grid">
        {subject.images.map(img => (
          <div key={img.id} className="image-card" onClick={() => setModalImage(img)}>
            <img src={img.data} alt={img.name} />
            <div className="image-card-overlay">
              <span style={{color: 'white', fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
                {img.name}
              </span>
              <button className="btn-icon" style={{color: 'var(--danger)'}} onClick={(e) => removeImage(e, img.id)}>
                <X size={16} />
              </button>
            </div>
          </div>
        ))}

        <div className="dropzone" onClick={() => fileInputRef.current?.click()}>
          <UploadCloud size={32} style={{marginBottom: '12px'}} />
          <span style={{fontSize: '0.9rem', textAlign: 'center'}}>Click o arrastra imágenes<br/>(PNG, JPG, TIF)</span>
          <input 
            type="file" 
            ref={fileInputRef} 
            multiple 
            accept="image/*" 
            style={{display: 'none'}} 
            onChange={handleFileUpload} 
          />
        </div>
      </div>

      {modalImage && (
        <div className="modal-overlay" onClick={() => setModalImage(null)}>
          <div className="modal-content large" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{color: 'var(--text-primary)'}}>{modalImage.name}</h3>
              <button className="btn-icon" onClick={() => setModalImage(null)}><X size={20}/></button>
            </div>
            <img className="modal-image" src={modalImage.data} alt={modalImage.name} />
            <div className="input-group">
              <label className="input-label">Notas sobre la imagen (ej. Bandas visibles a 50kDa)</label>
              <textarea 
                className="input-field" 
                rows="3"
                value={modalImage.notes}
                onChange={(e) => {
                  const newImages = subject.images.map(i => i.id === modalImage.id ? {...i, notes: e.target.value} : i);
                  onUpdateImages(newImages);
                  setModalImage({...modalImage, notes: e.target.value});
                }}
                placeholder="Escribe observaciones aquí..."
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
