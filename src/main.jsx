import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { registerGlobalErrorHandlers } from './utils/diagnostics.js'

// Diagnóstico temporal: captura errores globales (fuera de React) y genera un
// .txt para depurar. Eliminar esta línea para quitar la opción.
registerGlobalErrorHandlers();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
)
