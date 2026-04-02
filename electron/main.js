import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Previene error de Garbage Collection
let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: "LIMS: Protocol Manager",
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true, // Seguridad obligatoria
      webSecurity: false // Para permitir acceso local a archivos IndexedDB en caso de migraciones
    },
    show: false // previene flashes blancos
  });

  // Si estamos en entorno DEV (usando vite url localhost)
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    // mainWindow.webContents.openDevTools(); // Activable si queremos hacer debug
  } else {
    // Si estamos en entorno de PRODUCCIÓN (leyendo el index.html tras el build)
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Animación suave de apertura
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Iniciar app cuando motor esté listo
app.whenReady().then(() => {
  // --- INICIO DE TÚNELES IPC PARA G-DRIVE ---
  ipcMain.handle('dialog:selectFolder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle('fs:saveBackup', async (event, folderPath, jsonData) => {
    try {
      const fullPath = path.join(folderPath, 'LIMS_Backup.json');
      fs.writeFileSync(fullPath, jsonData, 'utf-8');
      return { success: true, path: fullPath };
    } catch (err) {
      console.error(err);
      return { success: false, error: err.message };
    }
  });
  // --- FIN DE TÚNELES ---

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Cerrar toda persistencia si el user da X en la ventana (Excepto macOS que conserva memoria de la app)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
