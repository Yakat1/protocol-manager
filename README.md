# 🔬 Protocol Manager LIMS

![LIMS Banner](https://img.shields.io/badge/LIMS-Protocol_Manager-blue?style=for-the-badge&logo=react)
![Version](https://img.shields.io/badge/version-1.2.0-success?style=for-the-badge)
![Platform](https://img.shields.io/badge/platform-PWA_|_Web_|_Desktop-purple?style=for-the-badge)
![Status](https://img.shields.io/badge/status-Production-green?style=for-the-badge)

**Protocol Manager LIMS** (Laboratory Information Management System) es una plataforma híbrida e integral diseñada para facilitar el trabajo diario en laboratorios de investigación biológica y biomédica. Proporciona herramientas para la organización de inventarios, gestión de sujetos experimentales, seguimiento de cultivos celulares, diseño de placas y libretas de laboratorio digitales.

Puede utilizarse como **Aplicación Web Progresiva (PWA)** totalmente sincronizada en la nube o como **aplicación offline** para garantizar la privacidad total de los datos.

---

## 🌟 Características Principales

### 🏢 Gestión Avanzada de Laboratorios (Multi-Tenant)
* **Múltiples Laboratorios:** Un usuario puede pertenecer o crear múltiples laboratorios independientes.
* **Roles y Permisos:** Sistema de roles seguros (Administrador y Estudiante). Los administradores pueden gestionar miembros, alterar el inventario y auditar libretas.
* **Invitaciones:** Bandeja de entrada integrada (`Inbox`) para recibir y aceptar invitaciones a otros laboratorios de la institución.

### 📦 Inventario Inteligente
Gestor de reactivos, muestras y consumibles:
* Clasificación por tipo (Equipos, Consumibles, Reactivos, Muestras).
* Alertas de stock mínimo.
* Fechas de preparación y caducidad.
* Registro de ubicaciones exactas (Caja, Refrigerador -80°C, Estante).

### 🐁 Sujetos Experimentales
Base de datos visual para modelos animales o sujetos humanos:
* Seguimiento de grupos experimentales.
* Historia clínica detallada y notas evolutivas.
* **Galería de Imágenes:** Subida de imágenes con compresión automática para ahorrar memoria.
* Registro de mediciones a lo largo del tiempo.

### 🧫 Seguimiento de Cultivos Celulares
* **Líneas de Tiempo:** Registro interactivo de pasajes, revisiones y congelamientos histológicos.
* **Microscopía Activa:** Adjunta fotos directamente desde el microscopio a cada entrada del registro.
* Seguimiento de niveles de confluencia y protocolos aplicados.

### 🔬 Planificador de Microplacas (Plate Mapper)
* Diagramado interactivo para placas de 96 pocillos.
* Asignación visual por colores: Estándares, Blancos, Muestras, Controles y Reservado.
* Soporte para replicados y metadatos de usuario por pocillo.
* Preparación para exportación y conexión con el sistema de análisis ELISA/WB.

### 🧮 Herramientas de Mesada
* **Calculadora Científica:** Adaptada para biólogos. Soporta notación científica con exponentes fraccionarios (ej. `1e-4.5`) ideal para diluciones en escalas de medios logaritmos.
* **Temporizadores Múltiples:** Corre múltiples cronómetros en paralelo durante tus protocolos de inmunohistoquímica o tinción.

### 📓 Bitácora Personal (Logbook)
Diario de laboratorio seguro e inmutable por usuario:
* Etiquetas inteligentes (PCR, WB, Extracción, etc.).
* Registro de estado de ánimo / fatiga, equipo crítico utilizado y declaración de incidentes.
* Privacidad controlada: Los administradores pueden visualizar todos los logs y agregar notas.

### 💾 Backup Local Avanzado (Zip Automático)
No dependas exclusivamente de la nube. Con un solo clic se compila toda la información de tu laboratorio en formato portátil:
* Exporta **Inventario** como un archivo `.xlsx` estructurado (Microsoft Excel).
* Exporta **Bitácoras y Registros** como documentos `.doc` (Microsoft Word).
* Separa inteligentemente bases de datos de imágenes de sujetos y microscopía en subcarpetas de extracción pura.

---

## 🛠️ Tecnologías Utilizadas

- **Frontend:** React.js 19 + Vite
- **Estilos:** CSS Vanilla (Glassmorphism UX Enterprise, Modo Claro y Oscuro)
- **Base de Datos & Auth:** Firebase Firestore + Firebase Authentication (Google Auth / Email)
- **Compresión Local:** JSZip, SheetJS (XLSX), File-Saver, algoritmos de renderizado por Canvas para peso de imágenes.
- **Empaquetado (Desktop):** Electron + NSIS
- **PWA:** Service Workers (Workbox) manifest integration.

---

## 🚀 Cómo utilizar la Plataforma

### Modo 1: Aplicación Web en la Nube (Online)
La forma más sencilla de empezar a colaborar con tu equipo.
1. Visita la URL de despliegue oficial.
2. Inicia sesión con `Google` o usa un `Correo Electrónico`.
3. Crea un laboratorio (desde el Perfil abajo a la izquierda) e invita a otros miembros con sus correos electrónicos.
4. **Instalación:** Si usas Chrome o Safari, busca el ícono de *"Instalar Aplicación / Añadir a Pantalla de Inicio"* y el LIMS actuará como software nativo en tu PC o Teléfono.

### Modo 2: Invitado Confidencial (Offline Seguro)
Ideal para investigaciones sensibles que no deben conectarse a firewalls externos o al internet público.
1. Haz clic en **"Continuar como Invitado (Offline)"**.
2. Todas tus inserciones irán directamente a bases temporales locales del navegador, encriptadas de red.
3. *Aviso: Si vacías la memoria caché del navegador, los datos de invitado se purgarán. Recomendamos usar la herramienta de Backup `.zip` con rigor en este modo.*

### Modo 3: Ejecutable `.exe` Autónomo (PC Local)
Si deseas un programa empaquetado para instalar sin depender de Chrome.
1. Clona el repositorio y asegúrate de tener `Node.js` instalado.
2. Descarga dependencias: 
   ```bash
   npm install
   ```
3. Ejecuta el empaquetador (genera instalador de Windows):
   ```bash
   npm run electron:build
   ```
4. Busca el instalador en la carpeta `release/` e instálalo.

---

## 📸 Estética Visual & UI

Este LIMS deja atrás las interfaces aburridas de Windows XP comunes en el área médica, con un diseño UX vibrante, animaciones finas, selectores translúcidos (efectos glassmorphism) y alertas visuales. Diseñado para mantener la agilidad mental del investigador, priorizando espacios dinámicos y previniendo los abrumadores recuadros de la vieja escuela experimental.

---

**Licencia y Privacidad:** Al utilizar el modo de usuario registrado, los correos son manejados de forma segura mediante los estándares internacionales de Google y Firebase. Para requerimientos de HIPAA o normativas ISO médicas, utilice las funciones en modo de desconexión o instancie su porción de Firebase utilizando cuentas institucionales con BAA (Business Associate Agreement).
