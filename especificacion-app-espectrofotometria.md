# Especificación funcional y técnica: Calculadora de Curvas de Espectrofotometría

## 1. Objetivo

Aplicación web (React) para gestionar **protocolos de espectrofotometría**. Cada protocolo agrupa **3 curvas de calibración**. Cada curva se construye con **puntos de concentración** definidos manualmente por el usuario, y cada punto se mide **por triplicado** (Abs 1, Abs 2, Abs 3). La app debe calcular automáticamente:

- Absorbancia promedio por concentración
- Regresión lineal de cada curva (pendiente, intercepto, R²)
- Factor de corrección de cada curva

La carga de datos es manual, con una interfaz tipo hoja de cálculo (Excel-like), y con opción de importar los datos desde un archivo CSV.

---

## 2. Glosario

| Término | Significado |
|---|---|
| **Protocolo** | Unidad de trabajo completa. Contiene 3 curvas. |
| **Curva** | Serie de puntos (concentración, absorbancia) que se usa para calibrar. Un protocolo tiene siempre 3. |
| **Punto de concentración** | Una concentración específica dentro de una curva (ej. 0, 5, 10, 20 µg/mL). |
| **Triplicado** | Las 3 mediciones de absorbancia (Abs1, Abs2, Abs3) tomadas para un mismo punto de concentración. |
| **Absorbancia promedio** | Promedio de Abs1, Abs2 y Abs3 para un punto de concentración. |
| **Regresión lineal** | Ajuste de tipo `y = m·x + b` sobre los puntos (concentración, abs promedio) de una curva. |
| **R²** | Coeficiente de determinación; qué tan bien se ajustan los puntos a la recta. |
| **Factor de corrección** | `Σ(concentraciones) / Σ(absorbancias promedio)` de una curva. |

---

## 3. Jerarquía de datos

```
Protocolo
 ├─ Curva 1
 │   ├─ Punto de concentración 1 (valor: X1)
 │   │   ├─ Abs 1
 │   │   ├─ Abs 2
 │   │   ├─ Abs 3
 │   │   └─ Abs promedio  (calculado)
 │   ├─ Punto de concentración 2
 │   └─ Punto de concentración N
 │   → Resultados de Curva 1: pendiente, intercepto, R², factor de corrección
 │
 ├─ Curva 2   (misma estructura; sus concentraciones pueden ser distintas a las de Curva 1)
 │
 └─ Curva 3   (ídem)
```

Importante: las concentraciones **no** tienen que coincidir entre curvas. Cada curva es independiente en cuanto a cuántos puntos tiene y qué valores usa.

---

## 4. Modelo de datos propuesto (TypeScript)

```ts
interface Absorbancia {
  abs1: number | null;
  abs2: number | null;
  abs3: number | null;
}

interface PuntoConcentracion {
  id: string;
  concentracion: number;
  absorbancias: Absorbancia;
  absPromedio: number | null; // calculado
}

interface ResultadosCurva {
  pendiente: number | null;
  intercepto: number | null;
  r2: number | null;
  factorCorreccion: number | null;
}

interface Curva {
  id: string;
  nombre: string; // "Curva 1", "Curva 2", "Curva 3"
  puntos: PuntoConcentracion[];
  resultados: ResultadosCurva;
}

interface Muestra {
  id: string;
  nombre: string;                 // identificador de la muestra (ej. "Paciente 1", "Réplica A")
  absorbancia: number | null;
  concentracionCalculada: number | null; // = absorbancia × factorCorreccionPromedio del protocolo
}

interface Protocolo {
  id: string;
  nombre: string;          // texto libre creado por el usuario (ej. "Lowry", "MDA", "Bradford lote 3"...)
  fecha: string;
  curvas: [Curva, Curva, Curva]; // siempre exactamente 3
  factorCorreccionPromedio: number | null; // calculado: promedio de los 3 factores de curva
  muestras: Muestra[];      // muestras problema del protocolo
  notas?: string;
}
```

**Nota sobre independencia entre protocolos:** cada `Protocolo` es una entidad totalmente autónoma. La app puede (y debe) manejar varios protocolos en simultáneo — por ejemplo, un protocolo "Lowry" con sus 3 curvas y su factor promedio, y por separado un protocolo "MDA" con sus propias 3 curvas y su propio factor promedio. No hay ningún cálculo ni dato que se comparta entre protocolos distintos; cada uno vive de forma independiente dentro de una colección de protocolos.

```ts
interface AppState {
  protocolos: Protocolo[]; // colección de protocolos independientes (Lowry, MDA, etc.)
}
```

---

## 5. Cálculos

### 5.1 Absorbancia promedio por concentración

```
absPromedio = (abs1 + abs2 + abs3) / 3
```

**Pendiente a definir:** si falta alguna de las 3 mediciones, ¿se promedia igual con las disponibles, o el punto se marca como incompleto y se excluye de la curva?

### 5.2 Regresión lineal (mínimos cuadrados)

Para cada curva, usando los pares `(concentración_i, absPromedio_i)` con `i = 1..n`:

```
pendiente (m) = [ n·Σ(xi·yi) − Σxi·Σyi ] / [ n·Σ(xi²) − (Σxi)² ]

intercepto (b) = [ Σyi − m·Σxi ] / n

R² = 1 − (SSres / SStot)
   SSres = Σ(yi − ŷi)²      donde ŷi = m·xi + b
   SStot = Σ(yi − ȳ)²       donde ȳ = promedio de yi
```

### 5.3 Factor de corrección

```
factor = Σ(concentraciones) / Σ(absorbancias promedio)
```

Se calcula **por curva**, usando los mismos puntos que la regresión (las concentraciones y sus abs promedio correspondientes). El R² se mantiene **independiente por curva** (no se promedia).

### 5.3.1 Factor de corrección del protocolo

Además del factor por curva, el protocolo debe mostrar el **promedio de los 3 factores de corrección** de sus curvas:

```
factorPromedioProtocolo = (factorCurva1 + factorCurva2 + factorCurva3) / 3
```

Este valor es el que representa al protocolo en su conjunto (ej. "factor de Lowry", "factor de MDA").

### 5.4 Cálculo de muestra problema

Sí forma parte del alcance. Las muestras "problema" (concentración desconocida) se cargan con su absorbancia, y su concentración se calcula **exclusivamente usando el factor de corrección promedio del protocolo** (no se usa la regresión para esto):

```
concentraciónMuestra = absorbanciaMuestra × factorCorreccionPromedio
```

Esto significa que las muestras problema pertenecen al **protocolo**, no a una curva individual — se calculan una vez que las 3 curvas están completas y el `factorCorreccionPromedio` está disponible.

---

## 6. Flujo de uso

1. El usuario ve un **listado/historial de protocolos** que ya creó (ej. "Lowry", "MDA", "Bradford lote 3"...) y puede crear uno nuevo o abrir uno existente. Cada protocolo es completamente independiente de los demás: sus curvas, cálculos y factor de corrección no se mezclan entre protocolos.
2. Al crear un nuevo **Protocolo**, el usuario escribe libremente su nombre (fecha, y opcionalmente elige un nombre sugerido si un administrador cargó un catálogo — ver sección 14). La app genera automáticamente 3 curvas vacías (Curva 1, 2, 3).
3. Para cada curva, el usuario:
   - Define cuántos puntos de concentración tiene (agrega/quita filas, tipo Excel).
   - Ingresa el valor de concentración de cada fila.
   - Ingresa las 3 absorbancias (Abs1, Abs2, Abs3) de cada fila.
   - La app calcula al vuelo el promedio por fila.
4. Al tener datos suficientes, la app calcula automáticamente: pendiente, intercepto, R² y factor de corrección de esa curva.
5. Se repite para las 3 curvas del protocolo.
6. La app calcula el **factor de corrección promedio del protocolo** (promedio de los 3 factores de curva).
7. Se muestra un resumen del protocolo: las 3 curvas (con su R² individual y su factor), más el factor promedio del protocolo (tabla + gráfico).
8. El usuario carga las **muestras problema** (nombre + absorbancia); la app calcula automáticamente su concentración usando el factor promedio del protocolo.
9. El usuario puede exportar los resultados y volver al listado para trabajar otro protocolo (Lowry, MDA, etc.) sin que se afecten entre sí.

---

## 7. Interfaz (tipo hoja de cálculo)

- **Pantalla de listado de protocolos:** muestra todos los protocolos creados (Lowry, MDA, etc.) como tarjetas o filas, cada uno con su nombre, fecha y factor de corrección promedio. Permite crear uno nuevo o abrir uno existente.
- **Pantalla de protocolo (detalle):**
  - Grilla editable por curva, columnas: `Concentración | Abs1 | Abs2 | Abs3 | Abs Promedio (solo lectura)`
  - Botón/atajo para agregar o eliminar filas (puntos de concentración)
  - Navegación con teclado entre celdas (Tab / Enter / flechas, como en Excel)
  - Soporte para **pegar un bloque de datos copiado desde Excel** directamente en la grilla
  - Panel fijo de resultados por curva: pendiente, intercepto, R², factor de corrección
  - Gráfico de dispersión (concentración vs abs promedio) con la línea de regresión superpuesta
  - Selector/tabs para moverse entre Curva 1 / Curva 2 / Curva 3 dentro de un mismo protocolo
  - Bloque destacado con el **factor de corrección promedio del protocolo** (los 3 factores + el promedio, bien visible, ya que es el dato "final" del protocolo)
  - **Sección de muestras problema:** tabla simple `Nombre | Absorbancia | Concentración calculada (solo lectura)`, habilitada una vez que el protocolo tiene su factor promedio calculado

---

## 8. Importación / Exportación CSV

Formato sugerido para importar una curva:

```csv
concentracion,abs1,abs2,abs3
0,0.001,0.002,0.001
5,0.045,0.048,0.044
10,0.089,0.091,0.087
20,0.176,0.180,0.174
```

- Exportación: descargar tabla de resultados (por curva y resumen del protocolo) en CSV.

---

## 9. Validaciones y reglas de negocio

- No permitir concentraciones vacías o negativas
- Alertar (no necesariamente bloquear) ante absorbancias negativas
- Mínimo de puntos para calcular regresión (típicamente n ≥ 3)
- Alertar si dos puntos de una misma curva tienen la misma concentración
- **Absorbancia:** hasta 5 decimales; recortar ceros finales al mostrar (ej. `0.04500` se muestra como `0.045`)
- **Concentración:** cantidad de decimales pendiente de definir (ver sección 13)

---

## 10. Arquitectura técnica sugerida

- **React + TypeScript**
- **Backend/Persistencia:** Firebase (ya semiconfigurado) — Firestore como base de datos, y Firebase Auth para manejar usuarios/roles (ver sección 14)
- **Grilla tipo Excel:** tabla editable con inputs controlados, con soporte de pegado desde portapapeles (a evaluar si conviene una librería de grid o construirla a medida)
- **Gráficos:** librería de charting para el scatter plot + línea de regresión
- **Cálculos:** funciones puras en TS (la regresión lineal simple no necesita librerías externas)
- **Estado:** Context API o estado local por componente (no hace falta algo como Redux para este alcance)

---

## 11. Persistencia de datos: Firebase

Se usará **Firebase** (ya semiconfigurado del lado del usuario) como backend:

- **Firestore** como base de datos para guardar protocolos, curvas, puntos y muestras. Estructura sugerida (a ajustar según cómo esté semiconfigurado el proyecto):
  ```
  /protocolos/{protocoloId}
      nombre, fecha, factorCorreccionPromedio, creadoPor, ...
      /curvas/{curvaId}
          nombre, resultados: { pendiente, intercepto, r2, factorCorreccion }
          /puntos/{puntoId}
              concentracion, abs1, abs2, abs3, absPromedio
      /muestras/{muestraId}
          nombre, absorbancia, concentracionCalculada
  ```
  (Alternativa más simple: guardar el protocolo completo, con sus curvas y puntos anidados, como un solo documento JSON si no se espera que crezca demasiado — a decidir según cómo esté armado el backend actual.)
- **Firebase Auth** para el login de usuarios y para distinguir roles (Administrador / Usuario estándar — ver sección 14).
- Autoguardado: los cambios en la grilla se sincronizan con Firestore (ya sea al vuelo o con un botón de guardar — a definir según preferencia de UX).
- El listado/historial de protocolos (sección 6, paso 1) se arma consultando la colección de protocolos del usuario en Firestore.

---

## 12. Fases de desarrollo sugeridas

1. **MVP:** login con Firebase Auth (roles admin/usuario), múltiples protocolos independientes con nombre libre, carga manual de las 3 curvas por protocolo, cálculo de promedio + regresión + R² + factor de corrección por curva, factor de corrección promedio por protocolo, y carga de muestras problema con cálculo de concentración vía factor promedio. Persistencia en Firestore.
2. **Fase 2:** gráfico de curvas, importación CSV, listado/historial de protocolos con filtros/búsqueda.
3. **Fase 3:** catálogo de tipos de protocolo administrado por administradores (autocompletado al nombrar), exportar resultados.
4. **Fase 4 (opcional):** mejoras de UX en la grilla (deshacer, atajos avanzados), reportes en PDF.

---

## 14. Roles de usuario y catálogos

Dos tipos de usuario (gestionados vía Firebase Auth):

- **Usuario estándar:** puede crear protocolos con el nombre que quiera, libremente, sin restricciones (ej. escribir "Lowry", "MDA", "prueba jueves", etc.). No administra catálogos.
- **Administrador:** además de todo lo anterior, puede gestionar un **catálogo de tipos de protocolo** (ej. una lista sugerida: "Lowry", "MDA", "Bradford"...). Este catálogo es opcional para el usuario estándar — puede usarlo como sugerencia/autocompletado al nombrar un protocolo nuevo, pero **no está obligado a elegir de la lista**, ya que el nombre siempre es de texto libre.

```ts
type Rol = "admin" | "usuario";

interface UsuarioApp {
  id: string; // uid de Firebase Auth
  email: string;
  rol: Rol;
}

interface TipoProtocoloCatalogo {
  id: string;
  nombre: string; // ej. "Lowry", "MDA"
  creadoPorAdminId: string;
}
```

**Nota:** el catálogo es una ayuda de UX (autocompletar / sugerencias), no una restricción — el campo `nombre` del protocolo siempre queda como texto libre, según lo que definiste.

---

## 15. Preguntas abiertas antes de programar

~~1. ¿Qué se hace con las 3 curvas juntas?~~ **Resuelto:** se promedian los 3 factores de corrección; el R² queda independiente por curva.

~~2. ¿El factor "final" del protocolo es el promedio de los 3?~~ **Resuelto:** sí, `factorCorreccionPromedio`.

~~3. ¿Los protocolos son independientes entre sí?~~ **Resuelto:** sí, cada protocolo es autónomo, sin datos compartidos entre ellos.

~~4. ¿Muestras problema?~~ **Resuelto:** sí, se calculan exclusivamente con el factor de corrección promedio del protocolo.

~~5. ¿Historial de protocolos en el MVP?~~ **Resuelto:** el listado/historial se agrega en una fase posterior, no en el MVP.

~~6. ¿Backend/persistencia?~~ **Resuelto:** Firebase (Firestore + Auth), ya semiconfigurado.

~~7. ¿Decimales de absorbancia?~~ **Resuelto:** hasta 5 decimales, recortando ceros finales.

~~8. ¿Nombre de protocolo libre o catálogo fijo?~~ **Resuelto:** el usuario escribe el nombre libremente; solo los administradores gestionan catálogos (opcionales, como sugerencia).

Preguntas que siguen pendientes:

1. ¿Cuántos decimales usás para la **concentración** (a diferencia de la absorbancia, que ya quedó definida)?
2. Sobre el catálogo de tipos de protocolo (sección 14): cuando un administrador lo carga, ¿debería autocompletar el nombre exacto al escribir, o simplemente aparecer como una lista de accesos rápidos al crear un protocolo nuevo?
3. Sobre Firestore: ¿ya tenés alguna estructura/colecciones definidas en tu proyecto semiconfigurado que debamos respetar, o partimos de la estructura sugerida en la sección 11?
4. Para las muestras problema: ¿necesitás cargarlas por triplicado (como los puntos de concentración), o siempre es una sola absorbancia por muestra?
