# Validación Científica y Roadmap de Mejoras — Motor de Densitometría `WBReport`

**Preparado para:** Antonio A. Velázquez G.
**Alcance:** Validación con literatura revisada por pares + roadmap de mejoras al código React, con rigor de publicación.
**Modalidad objetivo:** genérica (quimioluminiscencia / fluorescencia / colorimétrico-transmitancia).
**Fecha:** 2026-07-27

> **Cómo usar este documento.** La Sección 1 es el veredicto ejecutivo. La Sección 2 es la tabla de auditoría de afirmaciones (lo que un revisor aceptará, matizará o rechazará). La Sección 3 fundamenta cada punto con literatura. La Sección 4 es el roadmap de código, con funciones JavaScript/React listas para integrar sobre tu `WBReport.jsx` real. La Sección 5 reemplaza el párrafo de Métodos de tu auditoría por una versión defendible (español + inglés). Las citas `[N]` remiten a artículos reales; la lista completa la arma la interfaz.

---

## 1. Resumen ejecutivo (veredicto)

Tu aplicación implementa correctamente **la operación núcleo de la densitometría digital**: la integración del área bajo el perfil de intensidad invertida por carril, que es matemáticamente equivalente al *Plot Profile / Gel Analyzer* de ImageJ, el estándar de facto en el campo [12, 14, 35, 38]. Tres decisiones de diseño de tu app son genuinamente sólidas y defendibles ante un revisor:

1. **Delimitación automática y determinista de carriles** por punto medio ecuatorial entre centroides — reduce el sesgo del operador, un problema real y bien documentado [14].
2. **Aislamiento del búfer crudo** — los controles de brillo/contraste solo modifican el render CSS y **nunca** el arreglo de píxeles que alimenta la cuantificación (verificado en tu código: `laneIntensities` se calcula desde `getImageData()` sobre el canvas intacto, mientras `brightness`/`contrast` se aplican como `filter` CSS en la vista y en el PNG exportado). Esto se alinea con las guías de integridad de imagen [27, 31].
3. **Estimación de peso molecular por regresión log-lineal OLS** sobre el ladder — método estándar correcto.

**Sin embargo, el documento de auditoría, tal como está redactado, NO sobreviviría revisión por pares en una revista cuantitativa**, por tres carencias que la literatura considera esenciales y que un revisor marcaría como fatales:

| # | Carencia | Por qué es fatal para publicar | Evidencia |
|---|----------|-------------------------------|-----------|
| **1** | **No hay sustracción de fondo (background subtraction).** El motor suma `255 − gris` sobre **toda la altura del carril**, incluyendo membrana vacía. | El fondo escala con el área del carril y se suma al "volumen crudo". Sin sustraerlo, la señal reportada es *banda + fondo*, no señal específica. Todos los protocolos cuantitativos lo consideran obligatorio. | [12, 13, 14, 38] |
| **2** | **No hay verificación de linealidad ni de saturación.** Se leen valores de 8 bits (0–255) y se suman directamente. | La señal quimioluminiscente e incluso la de fluorescencia infrarroja se desvían de la proporcionalidad y **saturan**; cuantificar fuera del rango lineal invalida los *fold-changes*. En el MISMO blot, distintos procedimientos densitométricos produjeron p-values de 0.000013 a 0.76 [14]. | [7, 13, 14, 16, 24] |
| **3** | **Normalización solo por proteína de referencia (housekeeping).** La app calcula `Ratio_vs_Referencia` dividiendo por una única tira marcada como "Ref" (β-actina/GAPDH), y no ofrece normalización por proteína total. | El consenso metodológico actual favorece la **normalización por proteína total** (stain-free/REVERT/Ponceau) porque los housekeeping varían con la condición experimental. Presentarlo como "el estándar" es incorrecto. | [1, 3, 7, 8, 10, 11] |

**Además hay dos imprecisiones conceptuales** que debes corregir en el texto (no en el resultado numérico): la etiqueta *"Ley de Beer-Lambert"* es incorrecta para quimioluminiscencia/fluorescencia (miden **emisión**, no absorbancia), y `Y = (R+G+B)/3` es un **promedio simple**, no la "luminancia estándar" (que es ponderada, ITU-R Rec. 601/709).

**Conclusión:** el *método computacional núcleo* es válido y publicable; las *afirmaciones* de la auditoría están sobredimensionadas y omiten pasos que la comunidad exige. Con las tres correcciones críticas de la Sección 4 (fondo, saturación, normalización por proteína total), la herramienta pasa de "semicuantitativa sin controles" a "densitómetro defendible en un paper".

---

## 2. Tabla de auditoría de afirmaciones

Cada afirmación de tu documento original clasificada como **DEFENDIBLE** (se mantiene), **MATIZAR** (correcta con reservas) o **CORREGIR** (errónea o incompleta como está).

| # | Afirmación en tu auditoría | Veredicto | Evidencia | Acción recomendada |
|---|---------------------------|-----------|-----------|--------------------|
| 1 | Densitometría = integración AUC del perfil de intensidad invertida | **DEFENDIBLE** | [12, 14, 35, 38] | Mantener. Es la operación estándar (equivalente a ImageJ Gel Analyzer). |
| 2 | Delimitación automática por punto medio ecuatorial reduce el sesgo del operador | **DEFENDIBLE** | [14] | Mantener. Documentar que el usuario aún fija los centroides (no es 100% libre de operador). |
| 3 | El cálculo cubre el 100% de la membrana sin solapamiento (∑ancho = ancho membrana) | **MATIZAR** | [12, 13] | Es cierto geométricamente, pero incluir el 100% del ancho **también incluye todo el fondo**. Reencuadrar: cobertura total ≠ señal específica; requiere sustracción de fondo. |
| 4 | Inversión densitométrica lineal `I = 255 − Y` | **DEFENDIBLE** | [12, 14] | Mantener para escaneos en escala de grises. Ver #7 sobre la definición de `Y`. |
| 5 | "Ley de Beer-Lambert aproximada" (comentario en el código y FAQ) | **CORREGIR** | [24, 23] | Beer-Lambert (absorbancia/transmitancia) aplica **solo** a colorimétrico/film escaneado. En ECL y fluorescencia la señal es **emisión** de fotones; la relación intensidad↔proteína la fija la respuesta del sensor y el rango dinámico, no Beer-Lambert. Eliminar la etiqueta o condicionarla a la modalidad. |
| 6 | Los ajustes de brillo/contraste no invalidan la cuantificación (aislamiento del búfer crudo) | **DEFENDIBLE** (con nota) | [27, 30, 31, 32] | **Verificado en tu código:** correcto. Añadir la salvedad de las guías: los ajustes lineales son aceptables **solo para visualización y si no ocultan/inventan señal**; deben aplicarse a toda la imagen por igual y declararse. |
| 7 | `Y = (R+G+B)/3` es "luminancia en escala de grises estándar" | **CORREGIR (terminología)** | ITU-R BT.601/709 (convención de procesamiento de imagen) | Es un **promedio simple**, no luminancia perceptual estándar (que pondera G > R > B). Para escaneos grises (R≈G≈B) el resultado es idéntico; para imágenes en color difiere. Renombrar a "promedio de canales" u ofrecer luminancia ponderada. |
| 8 | Estimación de kDa por regresión log-lineal OLS sobre el ladder | **DEFENDIBLE** | [33] | Mantener. Recomendado: reportar R² del ajuste y advertir extrapolación fuera del rango de marcadores. |
| 9 | Normalización intra-carril dividiendo por el control de carga (β-actina/GAPDH) como estándar | **CORREGIR / AMPLIAR** | [1, 3, 7, 8, 10, 11] | Housekeeping es **aceptable pero no el estándar preferente**. Añadir normalización por proteína total (stain-free/REVERT/Ponceau) y, si se usa housekeeping, exigir su validación en la condición experimental. |
| 10 | "Volumen bruto / AUC" como intensidad cruda del carril | **MATIZAR** | [12, 13, 14] | El término "volumen" es correcto (∑∑ sobre x,y). Pero "crudo" sin sustracción de fondo no es interpretable; renombrar a "volumen sin corregir" y añadir "volumen corregido por fondo" como la métrica reportable. |
| 11 | Determinismo (mismo resultado numérico para la misma configuración) | **DEFENDIBLE** | — | Mantener. Es una ventaja real frente al trazado manual de ROIs. |
| 12 | "Estándar abierto, sin cajas negras, verificable línea por línea" | **DEFENDIBLE** | — | Mantener. La transparencia algorítmica es un punto fuerte legítimo. |

---

## 3. Fundamentación con literatura (por tema)

### 3.1 Densitometría como integración del perfil de intensidad (AUC)
La cuantificación por integración del perfil de intensidad de un carril es la operación implementada por el *Gel Analyzer* de ImageJ y es el método semicuantitativo dominante en la literatura [12, 14]. Existen múltiples flujos publicados que extraen el perfil por carril y exportan la señal integrada para análisis cuantitativo [35, 38], e incluso protocolos que usan los marcadores de peso molecular como estándares de cantidad [33]. Tu implementación (`calculateIntensityProfile` y `calculateLaneIntensitiesFromCanvas`) reproduce fielmente esta operación núcleo. **Este fundamento es correcto.**

### 3.2 Sesgo del operador y ROIs automáticas
La crítica central de tu auditoría —que el trazado manual de ROIs introduce sesgo— está respaldada: Gassmann et al. mostraron que, en ausencia de definiciones densitométricas explícitas, distintos procedimientos aplicados al **mismo** Western blot produjeron correlaciones con p-values entre 0.000013 y 0.76, es decir, "la puerta abierta a la adquisición incontrolada de cualquier p-value deseado" [14]. Una delimitación **automática y determinista** como la tuya mitiga precisamente esta fuente de variabilidad. **Punto fuerte legítimo de tu app.**

### 3.3 Sustracción de fondo — el hueco más grave
Ningún protocolo cuantitativo moderno acepta el volumen sin corrección de fondo. Gallo-Oller et al. dedican un artículo completo a un método de sustracción de fondo para densitometría de Western blot con ImageJ, justamente porque el fondo determina la exactitud y reproducibilidad [12]. Los protocolos de cuantificación por perfil recomiendan estimar el fondo (p. ej., por valles del perfil, o por valores de gris de zonas sin banda) y restarlo antes de integrar [38]. Butler et al. muestran que ignorar el fondo y la no-linealidad conduce a interpretaciones erróneas y baja reproducibilidad [13]. **Tu motor actual integra sobre toda la altura del carril sin restar fondo → sobreestima y confunde señal con membrana.** Es la corrección #1.

Métodos de fondo habituales, de menor a mayor sofisticación:
- **Valle-a-valle (rolling baseline 1D):** línea base entre los mínimos que flanquean cada pico del perfil. Simple, robusto, y el más natural para tu arquitectura 1D.
- **Rolling-ball / rolling-disk (2D):** el clásico de ImageJ (`Subtract Background`), estima un fondo suave por morfología.
- **Local por-carril (bandas de referencia sobre/bajo la banda):** promedia el gris de una franja sin señal dentro del mismo carril y lo resta por columna.

### 3.4 Linealidad y saturación del rango dinámico
La señal densitométrica solo es interpretable dentro del **rango dinámico lineal** de la modalidad de detección. Butler et al. documentan explícitamente que la densitometría de Western blots detectados por **quimioluminiscencia e incluso por fluorescencia infrarroja** se desvía de la proporcionalidad, puede ajustar modelos no-lineales o hiperbólicos, y **satura** [13]. Ghosh et al. y Taylor et al. hacen de la determinación del rango lineal y la prevención de la saturación un requisito para tener confianza en los datos [7, 16]. La comparación de sistemas de imagen muestra que la detección infrarroja/fluorescente ofrece un **rango dinámico lineal más amplio y evita la saturación** frente a la quimioluminiscencia, cuya reacción enzimática es dinámica y dependiente del tiempo [24]; la detección fluorescente multiplex llega a ofrecer ~10× más rango dinámico cuantitativo que la quimioluminiscencia (a costa de 2–4× menor sensibilidad) [23]. **Implicación para tu app:** debe (a) detectar píxeles saturados (valor 255 o 0 en 8 bits) y advertir, y (b) documentar/asumir que el usuario trabaja dentro del rango lineal (idealmente validado por una serie de diluciones). Es la corrección #2.

### 3.5 Modelo de señal por modalidad (Beer-Lambert vs emisión)
La **Ley de Beer-Lambert** describe la atenuación de luz **transmitida** a través de un medio absorbente: aplica a densitometría de **film escaneado en transmitancia** y a **tinciones colorimétricas** (Ponceau, Coomassie), donde una banda más oscura absorbe más luz. **No aplica** a quimioluminiscencia ni a fluorescencia, donde la banda **emite** fotones (por reacción enzimática o por excitación fluorescente) capturados por una cámara CCD [24]. Como tu app es multi-modalidad, la etiqueta "Ley de Beer-Lambert aproximada" del código es incorrecta en el caso general y debe eliminarse o condicionarse explícitamente a la modalidad de transmitancia. La operación `255 − gris` sigue siendo válida como *inversión de intensidad* (para que "más señal = valor mayor"); lo que es incorrecto es **atribuirle** el fundamento físico de Beer-Lambert cuando la imagen es de emisión. Es la corrección conceptual clave del texto.

### 3.6 Normalización: housekeeping vs proteína total
Existe amplia evidencia de que las proteínas housekeeping (β-actina, GAPDH, tubulina) **varían** entre tejidos, estados de desarrollo, edad y condiciones patológicas, y por tanto son controles de carga poco fiables en muchos contextos [1, 2, 3, 4, 6, 7, 9, 10, 11]. La normalización por **proteína total** (tecnología stain-free, REVERT, Ponceau) ofrece un rango dinámico amplio y mayor robustez, y es hoy la recomendación preferente de la literatura metodológica [3, 5, 7, 8, 10, 11]. Ghosh et al. lo resumen: la normalización por proteína total es en general más fiable que los controles housekeeping tradicionales [7]. **Tu app solo implementa el ratio contra una tira de referencia (housekeeping).** Debe (a) permitir designar un carril/tira de proteína total como normalizador, y (b) dejar de presentar el housekeeping como "el estándar". Es la corrección #3.

### 3.7 Integridad de imagen (qué ajustes son admisibles)
El artículo canónico de Rossner & Yamada (JCB, 2004) establece el principio rector: los ajustes lineales de brillo/contraste son aceptables **siempre que se apliquen a toda la imagen y no oculten ni inventen información**; ajustes no lineales o selectivos constituyen manipulación [31]. Cromey formaliza 12 guías éticas para imagen científica digital [27], y trabajos posteriores advierten que incluso ajustes "menores" de brillo/contraste pueden constituir falsificación si alteran la interpretación [30, 32]. **Tu diseño cumple el principio:** el ajuste es global (CSS a toda la tira), no destruye el búfer crudo, y la cuantificación se hace sobre los píxeles originales — verificado en tu código. La recomendación es **declararlo explícitamente** en la figura/exportación ("brillo/contraste ajustados solo para visualización; cuantificación sobre datos crudos") y registrar los valores aplicados (ver metadatos de auditoría, Sección 4, Nivel 2).

---

## 4. Roadmap de mejoras al código (priorizado, con snippets integrables)

Las recomendaciones se refieren a tu `WBReport.jsx` real. Snippets en JavaScript compatibles con tu stack (Canvas 2D nativo, sin dependencias nuevas). **Regla de oro:** todas las métricas nuevas se derivan del búfer crudo `getImageData()`, nunca del render con filtros CSS — preserva tu principio de inmutabilidad.

### NIVEL 1 — Crítico para publicar

#### (1a) Sustracción de fondo por carril
Reemplaza la integración "cruda" por una que reste una línea base de fondo. La forma más natural para tu arquitectura 1D es **valle-a-valle** sobre el perfil de columnas de cada carril, con respaldo de un método de "borde de carril" (promedio del gris en franjas sin banda). Se reporta **volumen sin corregir** y **volumen corregido**, para trazabilidad.

```javascript
/**
 * Devuelve, por columna x del carril, el fondo estimado como la línea base
 * entre los mínimos locales del perfil (rolling baseline 1D "valle-a-valle").
 * profile1D: intensidad invertida sumada por columna dentro del carril.
 */
const estimateBaseline1D = (profile1D) => {
  const n = profile1D.length;
  if (n === 0) return [];
  // 1) Percentil bajo global como piso de fondo (robusto a bandas anchas)
  const sorted = [...profile1D].sort((a, b) => a - b);
  const floor = sorted[Math.floor(n * 0.10)]; // percentil 10
  // 2) Línea base = interpolación lineal entre extremos "limpios" del carril,
  //    acotada por el piso. Aproxima el fondo membrana bajo la banda.
  const left = Math.min(profile1D[0], floor);
  const right = Math.min(profile1D[n - 1], floor);
  const baseline = new Array(n);
  for (let i = 0; i < n; i++) {
    const interp = left + (right - left) * (i / (n - 1));
    baseline[i] = Math.min(profile1D[i], Math.max(interp, floor));
  }
  return baseline;
};

/**
 * Cálculo de intensidades por carril CON sustracción de fondo.
 * Sustituye a calculateLaneIntensitiesFromCanvas. Devuelve, por carril:
 *  - raw:        volumen sin corregir (compatibilidad con tu métrica actual)
 *  - net:        volumen corregido por fondo (métrica reportable)
 *  - background: fondo integrado sustraído
 *  - saturatedFraction: fracción de píxeles saturados (ver 1b)
 */
const calculateLaneIntensitiesWithBackground = (canvas, columns, opts = {}) => {
  const { weighted = false } = opts; // luminancia ponderada opcional (ver 2d)
  const width = canvas.width, height = canvas.height;
  const ctx = canvas.getContext('2d');
  const data = ctx.getImageData(0, 0, width, height).data; // búfer CRUDO

  const sortedCols = [...columns].sort((a, b) => a.x - b.x);
  const boundaries = [0];
  for (let i = 0; i < sortedCols.length - 1; i++) {
    boundaries.push(((sortedCols[i].x + sortedCols[i + 1].x) / 2) * width / 100);
  }
  boundaries.push(width);

  const toGray = (r, g, b) => weighted
    ? 0.2126 * r + 0.7152 * g + 0.0722 * b   // Rec. 709
    : (r + g + b) / 3;                        // promedio simple (tu método actual)

  const result = {};
  sortedCols.forEach((col, idx) => {
    const startX = Math.floor(boundaries[idx]);
    const endX = Math.floor(boundaries[idx + 1]);
    // Perfil invertido por columna dentro del carril + conteo de saturación
    const profile = [];
    let satPixels = 0, totalPixels = 0;
    for (let x = startX; x < endX; x++) {
      let colSum = 0;
      for (let y = 0; y < height; y++) {
        const p = (y * width + x) * 4;
        const r = data[p], g = data[p + 1], b = data[p + 2];
        const gray = toGray(r, g, b);
        if (gray >= 254 || gray <= 1) satPixels++; // saturado (blanco o negro puro)
        totalPixels++;
        colSum += (255 - gray);
      }
      profile.push(colSum);
    }
    const baseline = estimateBaseline1D(profile);
    let raw = 0, net = 0, bg = 0;
    for (let i = 0; i < profile.length; i++) {
      raw += profile[i];
      bg  += baseline[i];
      net += Math.max(0, profile[i] - baseline[i]); // recorta negativos
    }
    result[col.id] = {
      raw: Math.round(raw),
      net: Math.round(net),
      background: Math.round(bg),
      saturatedFraction: totalPixels ? +(satPixels / totalPixels).toFixed(4) : 0,
    };
  });
  return result;
};
```

> **Integración:** cambia `laneIntensities[col.id]` de un número a `{raw, net, background, saturatedFraction}`. En las barras (`IntensityBars`), la vista de ratios (`getRatioDisplay`) y el CSV, usa `.net` como métrica por defecto y expón `.raw` como columna secundaria. El ratio pasa a `net_target / net_ref`.

#### (1b) Advertencia de saturación / fuera de rango lineal
Ya calculado arriba como `saturatedFraction`. Añade un umbral y una advertencia visible en la UI y en el CSV.

```javascript
const SATURATION_WARN = 0.01; // >1% de píxeles saturados en el ROI => advertir

const saturationFlag = (li) =>
  (li?.saturatedFraction ?? 0) > SATURATION_WARN
    ? `⚠ ${(li.saturatedFraction * 100).toFixed(1)}% px saturados`
    : 'OK';
```

> En la figura y el CSV, marca cualquier banda con `saturationFlag ≠ 'OK'`. Un revisor valora que la herramienta **avise** cuando la cuantificación no es fiable en lugar de reportar un número saturado como si fuera válido [13, 24].

#### (1c) Normalización por proteína total (además de housekeeping)
Permite designar una tira/carril como **normalizador de proteína total** (stain-free, REVERT o Ponceau), no solo un housekeeping. Generaliza tu `isHousekeeping` a un tipo de normalizador.

```javascript
// En el estado de cada strip, reemplaza el booleano isHousekeeping por:
//   normRole: 'none' | 'housekeeping' | 'totalProtein'
// y guarda el modo global de normalización elegido por el usuario:
//   normMode: 'totalProtein' (recomendado) | 'housekeeping' | 'none'

const getNormalizer = (strips, normMode) => {
  if (normMode === 'totalProtein') return strips.find(s => s.normRole === 'totalProtein') ?? null;
  if (normMode === 'housekeeping') return strips.find(s => s.normRole === 'housekeeping') ?? null;
  return null;
};

// Ratio normalizado usando la señal NETA (corregida por fondo)
const normalizedRatio = (strip, col, normStrip) => {
  const t = strip.laneIntensities?.[col.id]?.net;
  const r = normStrip?.laneIntensities?.[col.id]?.net;
  if (!t || !r) return null;
  return +(t / r).toFixed(3);
};
```

> **UI:** un selector "Método de normalización" con *Proteína total (recomendado)* como opción por defecto y una nota corta citando la evidencia [3, 7, 8, 10, 11]. Mantén housekeeping disponible pero **no** como predeterminado, y muestra una advertencia suave ("validar que el housekeeping no cambia con la condición").

### NIVEL 2 — Recomendado (calidad y robustez)

#### (2d) Luminancia ponderada (Rec. 709) con opción de canal único
Tu `(R+G+B)/3` es un promedio simple; para imágenes en color no es la luminancia perceptual estándar. Ofrece tres modos y documenta cuál se usó:

```javascript
const GRAY_MODES = {
  average:   (r, g, b) => (r + g + b) / 3,               // tu método actual
  rec709:    (r, g, b) => 0.2126*r + 0.7152*g + 0.0722*b, // luminancia ponderada
  green:     (r, g, b) => g,                              // canal único (útil en fluor. de 1 color)
};
```

> Para escaneos en escala de grises reales (R≈G≈B) los tres coinciden; la diferencia importa en imágenes en color o de fluorescencia por canal. Reporta el modo en los metadatos de exportación.

#### (2e) Detección de límites verticales de banda (integrar la banda, no todo el carril)
Hoy integras toda la altura `y ∈ [0, H)`. Detecta la ventana vertical de la banda alrededor de `targetY` y limita la integración a esa banda + línea base local. Reduce el fondo acumulado y afina la señal.

```javascript
/**
 * Encuentra [yStart, yEnd] de la banda alrededor de centerY buscando el ancho
 * a media altura (FWHM) del perfil vertical del carril. Devuelve también la
 * línea base local (mediana del gris fuera de la banda) para sustracción.
 */
const detectBandWindow = (canvas, x0, x1, centerY, data) => {
  const width = canvas.width, height = canvas.height;
  const prof = new Array(height).fill(0);
  for (let y = 0; y < height; y++) {
    let s = 0;
    for (let x = x0; x < x1; x++) {
      const p = (y * width + x) * 4;
      s += 255 - (data[p] + data[p+1] + data[p+2]) / 3;
    }
    prof[y] = s;
  }
  const cY = Math.round(centerY);
  const peak = prof[cY] ?? Math.max(...prof);
  const base = [...prof].sort((a,b)=>a-b)[Math.floor(height*0.1)]; // fondo local
  const half = base + (peak - base) / 2;                          // media altura
  let yStart = cY, yEnd = cY;
  while (yStart > 0 && prof[yStart] > half) yStart--;
  while (yEnd < height - 1 && prof[yEnd] > half) yEnd++;
  return { yStart, yEnd, localBackground: base };
};
```

> Úsalo para acotar la integración de `calculateLaneIntensitiesWithBackground` a `[yStart, yEnd]` y restar `localBackground × altura` por columna. Es la forma más limpia de separar señal de membrana.

#### (2f) Exportación con metadatos de auditoría
Un revisor querrá saber **cómo** se calculó cada número. Añade un bloque de metadatos al CSV (o un JSON adjunto) con: versión del software, modalidad declarada, modo de gris, método de fondo, umbral de saturación, método de normalización y el flag de saturación por banda.

```javascript
const buildAuditCsv = (strips, cols, normStrip, cfg) => {
  const meta = [
    `# WBReport v${cfg.version}`,
    `# fecha,${new Date().toISOString()}`,
    `# modalidad,${cfg.modality}`,          // 'chemiluminescence' | 'fluorescence' | 'colorimetric'
    `# modo_gris,${cfg.grayMode}`,          // 'average' | 'rec709' | 'green'
    `# metodo_fondo,${cfg.bgMethod}`,       // 'valley1D' | 'localBand' | 'none'
    `# umbral_saturacion,${cfg.satWarn}`,
    `# normalizacion,${cfg.normMode}`,      // 'totalProtein' | 'housekeeping' | 'none'
    `# nota,ajustes brillo/contraste solo para visualizacion; cuantificacion sobre pixeles crudos`,
  ].join('\n');
  const header = 'Banda,Carril,Vol_neto,Vol_crudo,Fondo,Frac_saturada,Ratio_norm,Saturacion';
  const rows = [];
  const sorted = [...cols].sort((a,b)=>a.x-b.x);
  strips.forEach((s) => sorted.forEach((c) => {
    const li = s.laneIntensities?.[c.id] ?? {};
    const ratio = normStrip ? normalizedRatio(s, c, normStrip) : 'N/A';
    rows.push(`"${s.protein}","${c.value}",${li.net ?? 0},${li.raw ?? 0},${li.background ?? 0},${li.saturatedFraction ?? 0},${ratio},${saturationFlag(li)}`);
  }));
  return `${meta}\n${header}\n${rows.join('\n')}`;
};
```

> Esto sustituye tu `exportCSV` actual (que exporta solo `Intensidad` cruda y `Ratio_vs_Referencia`). La trazabilidad de parámetros es exactamente lo que exige la crítica de [14] sobre densitometría no documentada.

### NIVEL 3 — Avanzado (diferenciadores y validación formal)

- **(3g) Métodos de fondo seleccionables.** Ofrece *valle-a-valle 1D*, *banda local* y una aproximación *rolling-ball* (implementable con una apertura morfológica de escala de grises sobre el perfil o la imagen). Deja que el usuario elija y **registra** cuál se usó [12].
- **(3h) Réplicas biológicas y estadística.** Añade agrupación de tiras por réplica y normalización de réplicas antes de comparar; la estrategia de normalización entre réplicas afecta directamente los resultados de las pruebas de hipótesis [15]. Ofrece resumen media ± EEM y una prueba adecuada (t o no paramétrica) con n explícito.
- **(3i) Modo de validación de linealidad.** Un asistente para cargar una **serie de diluciones** y calcular el R² del rango lineal por proteína/anticuerpo; solo cuantificar dentro de ese rango [7, 13, 16]. Convierte "asumimos linealidad" en "demostramos linealidad".
- **(3j) Concordancia con ImageJ.** Un protocolo de validación cabeza-a-cabeza: procesar el mismo set de blots en tu app y en ImageJ Gel Analyzer, y reportar correlación (Pearson/CCC) y Bland-Altman. Es la evidencia más contundente para un revisor de que tu herramienta es equivalente al estándar [12, 14, 35, 38].

---

## 5. Redacción corregida para Materiales y Métodos

Reemplaza el párrafo de tu auditoría por esta versión, que incorpora fondo, saturación/linealidad, modalidad y normalización por proteína total. Ajusta los corchetes a tu configuración real.

### Español
> La cuantificación densitométrica de las imágenes digitales de Western blot se realizó mediante análisis del perfil de intensidad lineal e integración del área bajo la curva (AUC), de forma equivalente al *Gel Analyzer* de ImageJ. Para evitar el sesgo de selección manual del operador, la delimitación horizontal de cada región de interés (ROI) se determinó de forma automática y determinista mediante partición por punto medio ecuatorial entre centroides de carril contiguos. La intensidad de cada banda se calculó a partir de la inversión de intensidad (255 − valor de gris) integrada sobre la ventana de la banda, restando una línea base de fondo estimada [valle-a-valle / banda local] para obtener el volumen neto. Antes de la cuantificación se verificó que las imágenes se adquirieran dentro del rango dinámico lineal de la modalidad de detección [quimioluminiscente / fluorescente] y se descartaron o marcaron las bandas con píxeles saturados (>1 % del ROI). La señal neta se normalizó [por la señal de proteína total mediante tinción stain-free/REVERT/Ponceau (recomendado) / por la proteína de control de carga, validada previamente en la condición experimental], expresándose como intensidad relativa. Los ajustes de brillo y contraste se aplicaron únicamente para la visualización de las figuras, de forma lineal a la totalidad de la imagen, sin afectar los valores de píxel usados en la cuantificación.

### English
> Densitometric quantification of digital Western blot images was performed by lane intensity-profile analysis and area-under-the-curve (AUC) integration, equivalent to the ImageJ Gel Analyzer. To avoid manual operator-selection bias, the horizontal boundary of each region of interest (ROI) was defined automatically and deterministically by equatorial-midpoint partitioning between adjacent lane centroids. Band intensity was computed from intensity inversion (255 − grey value) integrated over the band window, subtracting an estimated background baseline [valley-to-valley / local-band] to yield net volume. Prior to quantification, images were confirmed to lie within the linear dynamic range of the detection modality [chemiluminescent / fluorescent], and bands containing saturated pixels (>1 % of the ROI) were flagged or excluded. Net signal was normalized [to total protein by stain-free/REVERT/Ponceau staining (recommended) / to a loading-control protein previously validated for the experimental condition] and expressed as relative intensity. Brightness and contrast were adjusted for figure display only, applied linearly to the entire image, without altering the pixel values used for quantification.

---

## 6. Próximos pasos sugeridos
1. **Implementar Nivel 1** (fondo, saturación, normalización por proteína total) — es el mínimo para defensibilidad de publicación.
2. **Validación empírica** (Nivel 3j): correr una serie de diluciones y una comparación cabeza-a-cabeza contra ImageJ sobre tus blots reales, y reportar R², Pearson/CCC y Bland-Altman. Esto convierte el argumento teórico de este documento en evidencia cuantitativa propia — puedo ayudarte a diseñar y analizar ese experimento si subes las imágenes.
3. **Actualizar el FAQ/auditoría** con las correcciones conceptuales (Beer-Lambert por modalidad, luminancia vs promedio, housekeeping vs proteína total).

*Nota de alcance: este documento valida la metodología con literatura y audita el código; no ejecuta la app ni analiza blots reales. La validación empírica del punto 2 es un seguimiento separado.*
