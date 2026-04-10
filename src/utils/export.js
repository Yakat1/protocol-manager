export function exportCSV(state) {
  // Crear las cabeceras
  const headers = ['#', 'Nombre Sujeto', 'Grupo'];
  state.variables.forEach(v => {
    headers.push(`${v.name}${v.unit ? ` (${v.unit})` : ''}`);
  });

  // Filas por cada sujeto (número secuencial en vez del UUID interno)
  const rows = state.subjects.map((subject, index) => {
    const row = [index + 1, `"${subject.name}"`, `"${(subject.group || '').replace(/"/g, '""')}"`];
    state.variables.forEach(v => {
      let val = subject.measurements?.[v.id];
      if (val === undefined || val === null) val = '';
      // Escapar comillas dobles y comas envolviendo en comillas dobles
      if (typeof val === 'string') {
        val = `"${val.replace(/"/g, '""')}"`;
      }
      row.push(val);
    });
    return row.join(',');
  });

  const csvContent = [headers.join(','), ...rows].join('\n');
  const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  triggerDownload(url, `${formatName(state.protocolName)}_datos.csv`);
}

export function exportInventoryCSV(inventory) {
  const headers = ['Nombre', 'Tipo', 'Conc./Lote', 'Cantidad', 'Unidad', 'Ubicación', 'Caducidad', 'Observaciones'];
  
  const rows = inventory.map(item => {
    const row = [
      `"${(item.name || '').replace(/"/g, '""')}"`,
      `"${(item.type || '').replace(/"/g, '""')}"`,
      `"${(item.concentration || '').replace(/"/g, '""')}"`,
      `${item.quantity || 0}`,
      `"${(item.unit || '').replace(/"/g, '""')}"`,
      `"${(item.location || '').replace(/"/g, '""')}"`,
      `"${(item.expDate || '').replace(/"/g, '""')}"`,
      `"${(item.notes || '').replace(/"/g, '""')}"`
    ];
    return row.join(',');
  });

  const csvContent = [headers.join(','), ...rows].join('\n');
  const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  triggerDownload(url, `Inventario_Laboratorio.csv`);
}

export function exportBackup(state) {
  const json = JSON.stringify(state, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  triggerDownload(url, `${formatName(state.protocolName)}_backup.json`);
}

function triggerDownload(url, filename) {
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function formatName(name) {
  return name.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'protocolo';
}
