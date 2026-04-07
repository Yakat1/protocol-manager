import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

// Helper to remove data URI prefix safely handling legacy object structures
const asString = (img) => {
  if (!img) return '';
  if (typeof img === 'string') return img;
  if (img.src) return img.src;
  if (img.url) return img.url;
  if (img.data) return img.data;
  return String(img);
};

const getBase64Data = (imageStr) => {
  const str = asString(imageStr);
  if (!str) return null;
  const parts = str.split(',');
  return parts.length > 1 ? parts[1] : parts[0];
};

const getExtension = (imageStr) => {
  const str = asString(imageStr);
  if (!str || typeof str.match !== 'function') return 'jpg';
  const match = str.match(/data:image\/(png|jpeg|jpg|gif);base64/);
  return match ? match[1] : 'jpg';
};

const buildDocHtml = (title, sectionsHtml) => `
  <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
  <head><meta charset='utf-8'><title>${title}</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 11pt; }
    h1 { color: #2c3e50; text-align: center; border-bottom: 2px solid #3498db; padding-bottom: 10px; }
    .entry { margin-bottom: 15px; padding: 10px; border: 1px solid #e0e0e0; background-color: #f9f9f9; }
    .bold { font-weight: bold; }
  </style>
  </head>
  <body>
    <h1>${title}</h1>
    ${sectionsHtml}
  </body>
  </html>
`;

export async function exportLocalBackup(labName, state, personalLogs) {
  const zip = new JSZip();

  const safeLabName = (labName || 'Laboratorio').replace(/[^a-zA-Z0-9]/g, '_');
  const dateStr = new Date().toISOString().split('T')[0];
  
  // 1. Inventario (Excel)
  if (state.inventory && state.inventory.length > 0) {
    const wsData = state.inventory.map(item => ({
      ID: item.id,
      Nombre: item.name,
      Categoría: item.type,
      Cantidad: item.quantity,
      Unidad: item.unit,
      Ubicación: item.location,
      Umbral_Min: item.minThreshold || '',
      Preparación: item.prepDate || '',
      Expiración: item.expDate || '',
      Componentes: item.components || '',
      Concentración: item.concentration || '',
      Notas: item.notes || ''
    }));
    const worksheet = XLSX.utils.json_to_sheet(wsData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Inventario");
    // Generate as array buffer to place inside ZIP
    const xlsxBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    zip.file("Inventario.xlsx", xlsxBuffer);
  }

  // 2. Bitácora Personal (doc)
  if (personalLogs && personalLogs.length > 0) {
    let logsHtml = personalLogs.map(l => `
      <div class="entry">
        <div><span class="bold">Fecha:</span> ${l.date} ${l.time}</div>
        <div><span class="bold">Usuario:</span> ${l.userName} (${l.mood})</div>
        <div><span class="bold">Tags:</span> ${(l.tags || []).join(', ')}</div>
        <div style="margin-top:10px;"><span class="bold">Actividad:</span><br/>${(l.activity || '').replace(/\\n/g, '<br/>')}</div>
        <div style="margin-top:10px;"><span class="bold">Observaciones:</span><br/>${(l.observations || '').replace(/\\n/g, '<br/>')}</div>
        <div style="margin-top:10px;"><span class="bold">Equipos:</span> ${(l.equipment || []).join(', ')}</div>
        ${l.incidents ? `<div style="margin-top:10px; color:#c0392b;"><span class="bold">Incidentes:</span><br/>${l.incidents.replace(/\\n/g, '<br/>')}</div>` : ''}
        ${l.adminNote ? `<div style="margin-top:10px; color:#2980b9; font-style:italic;"><span class="bold">Nota Admin:</span> ${l.adminNote}</div>` : ''}
      </div>
    `).join('');
    zip.file("Bitacora_Personal.doc", buildDocHtml("Bitacora Personal", logsHtml));
  }

  // 3. Sujetos (doc + Imágenes)
  if (state.subjects && state.subjects.length > 0) {
    const subjectsFolder = zip.folder("Sujetos");
    const imgFolder = subjectsFolder.folder("Imagenes");
    
    let subjectsHtml = '';
    state.subjects.forEach((subj, idx) => {
      let imageTags = '';
      if (subj.images && subj.images.length > 0) {
        subj.images.forEach((img, i) => {
          const ext = getExtension(img);
          const base64 = getBase64Data(img);
          const fileName = `Sujeto_${idx+1}_${subj.name.replace(/[^a-zA-Z0-9]/g, '_')}_Img${i+1}.${ext}`;
          if (base64) {
            imgFolder.file(fileName, base64, { base64: true });
            imageTags += `<div><i>Referencia imagen descargada: ${fileName}</i></div>`;
          }
        });
      }

      subjectsHtml += `
        <div class="entry">
          <div><span class="bold">Identificador:</span> ${subj.id}</div>
          <div><span class="bold">Nombre:</span> ${subj.name}</div>
          <div><span class="bold">Grupo Experimento:</span> ${subj.group}</div>
          <div><span class="bold">Notas Clínicas:</span> ${(subj.clinicalNotes || '').replace(/\\n/g, '<br/>')}</div>
          <div style="margin-top:10px;"><span class="bold">Imágenes adjuntas:</span> ${subj.images?.length || 0} fotos</div>
          ${imageTags}
        </div>
      `;
    });
    
    subjectsFolder.file("Reporte_Sujetos.doc", buildDocHtml("Reporte de Sujetos Experimentales", subjectsHtml));
  }

  // 4. Cultivos Celulares (doc + Imágenes)
  if (state.cultureLogs && state.cultureLogs.length > 0) {
    const culturesFolder = zip.folder("Cultivos");
    const imgFolder = culturesFolder.folder("Imagenes");
    
    let culturesHtml = '';
    state.cultureLogs.forEach((log, idx) => {
      let imageTags = '';
      if (log.images && log.images.length > 0) {
        log.images.forEach((img, i) => {
          const ext = getExtension(img);
          const base64 = getBase64Data(img);
          const fileName = `Cultivo_${idx+1}_Log_${log.cultureId}_Img${i+1}.${ext}`;
          if (base64) {
            imgFolder.file(fileName, base64, { base64: true });
            imageTags += `<div><i>Referencia imagen descargada: ${fileName}</i></div>`;
          }
        });
      }

      culturesHtml += `
        <div class="entry">
          <div><span class="bold">Fecha:</span> ${log.date}</div>
          <div><span class="bold">Registro ID:</span> ${log.id} (Cultivo: ${log.cultureId})</div>
          <div><span class="bold">Acción:</span> ${log.action}</div>
          <div><span class="bold">Pasaje:</span> ${log.passage}</div>
          <div><span class="bold">Confluencia:</span> ${log.confluence}%</div>
          <div style="margin-top:10px;"><span class="bold">Observaciones:</span><br/>${(log.observations || '').replace(/\\n/g, '<br/>')}</div>
          ${imageTags}
        </div>
      `;
    });
    
    culturesFolder.file("Reporte_Cultivos.doc", buildDocHtml("Bitácora de Cultivos Celulares", culturesHtml));
  }

  // 5. Jaulas / Bioterio (Excel)
  if (state.cages && state.cages.length > 0) {
    const wsData = state.cages.map(cage => ({
      ID: cage.id,
      Nombre: cage.name,
      'Cant. Animales': cage.headcount || 0,
      Tratamiento: cage.treatment || '',
      'Últ. Tratamiento': cage.lastTreatmentDate || '',
      'Fecha Inicio': cage.startDate || ''
    }));
    const worksheet = XLSX.utils.json_to_sheet(wsData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Jaulas");
    const xlsxBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    zip.file("Jaulas.xlsx", xlsxBuffer);
  }

  // 6. Build ZIP and Download
  const content = await zip.generateAsync({ type: 'blob' });
  saveAs(content, `Backup_${safeLabName}_${dateStr}.zip`);
}
