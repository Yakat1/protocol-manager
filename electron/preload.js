const { contextBridge, ipcRenderer } = require('electron');

// Exponemos de forma segura un puente de red entre el Frontend de React y el Backend OS Nativo C++
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  selectFolder: () => ipcRenderer.invoke('dialog:selectFolder'),
  saveBackup: (path, data) => ipcRenderer.invoke('fs:saveBackup', path, data)
});
