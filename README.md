# Protocol Manager LIMS

Sistema de Gestión de Información de Laboratorio (LIMS) híbrido, diseñado como una aplicación web progresiva (PWA) instalable en móviles y como un programa de escritorio independiente (`.exe`) para Windows.

## Características
1. **Modo Híbrido:** Aplicación de navegador (PWA) sincronizada en tiempo real con la nube (Firebase Firestore) y aplicación de escritorio sincronizada localmente (IndexedDB).
2. **Modo Offline/Invitado:** Los investigadores pueden usar la aplicación sin necesidad de conexión o autenticación. En este modo los datos no salen de la computadora local.
3. **Múltiples Módulos Especializados:**
   - Gestor de sujetos (ratones/modelos)
   - Cultivos Celulares y Línea de Tiempo interactiva
   - Planificador de Microplacas con exportación 
   - Analizador / Calculadora / Reporte de Western Blot

---

## 📱 Cómo usar la PWA (Navegador/Celular)

Visita el enlace oficial publicado en Github Pages (por ejemplo: `https://yakat1.github.io/protocol-manager`), inicia sesión o entra al menú de "Invitado", y en tu menú lateral encontrarás el botón **Instalar App** para guardarla como una app nativa en tu teléfono Android o iOS.

---

## 💻 Instalar y lanzar la versión de Escritorio (.exe)

Si usas Windows, puedes generar y lanzar tu propio ejecutable independiente (`.exe`) siguiendo estos pasos:

1. Clona el repositorio y abre una terminal.
2. Descarga todas las dependencias del proyecto ejecutando:
   ```bash
   npm install
   ```
3. Ejecuta el compilador de Electron (esto creará los binarios del .exe empaquetados en un instalador en la carpeta `release`):
   ```bash
   npm run electron:build
   ```
4. Navega a tu carpeta local en la ruta `release/` y abre el instalador `.exe`. La aplicación de escritorio se instalará y abrirá inmediatamente.

*(Nota: Opcionalmente puedes lanzar la aplicación de escritorio en modo desarrollo sin compilar el instalador con el comando `npm run electron:dev`)*
