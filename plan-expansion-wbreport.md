# Plan de expansión: WBReport.jsx → funcionalidad tipo Sciugo

## Contexto
Tengo un componente en **React** llamado `WBReport.jsx`, parte de un proyecto
escolar (sin fines comerciales) inspirado conceptualmente en la herramienta
Sciugo (sciugo.com), para crear figuras de western blot a partir de imágenes
crudas.

## Estado actual del componente
Ya están implementadas las siguientes funcionalidades, todas en React con
Hooks (`useState`), sin conexión a backend todavía:

- Carga de imagen base y herramienta de recorte (crop) para extraer bandas
- Soporte de múltiples bandas por figura, cada una en un panel independiente
- Nombre de proteína editable por banda
- Etiquetas de carril ("Lane Labels") arrastrables horizontalmente (drag & drop
  manual con eventos globales `mousemove`/`mouseup`)
- Marcadores de peso molecular (kDa) arrastrables verticalmente
- Vista previa que ensambla bandas y anotaciones
- Exportación a PNG usando la librería `html-to-image`

**No reescribas esta base.** Trabaja siempre sobre el código existente que te
voy a compartir en cada fase.

## Limitaciones conocidas (importante tenerlas en cuenta)
- El recorte es destructivo: una vez hecho, si el usuario se equivoca debe
  eliminar la banda completa y recortar de nuevo desde la imagen base
- No hay persistencia: todo se pierde al recargar la página
- El drag & drop usa eventos globales de mouse, lo cual puede volverse frágil
  si el DOM crece en complejidad

## Plan de trabajo (una fase por sesión — no avances a la siguiente sin mi confirmación)

---

### Fase 1: Recorte no destructivo
**Objetivo:** permitir reajustar el área de recorte de una banda sin perder
las anotaciones ya hechas (nombre, etiquetas, marcadores).

Requisitos:
- Cambia el modelo de datos: en vez de guardar solo la imagen ya recortada,
  guarda la imagen original de referencia + las coordenadas del rectángulo
  de recorte (x, y, ancho, alto) en el estado de cada banda
- El recorte visual se debe generar dinámicamente a partir de esas coordenadas
  (por ejemplo, con `background-position`/`clip-path` sobre la imagen original,
  o recalculando un canvas)
- Agrega un modo "Reajustar recorte" por banda que muestre de nuevo el
  rectángulo editable sobre la imagen original, sin borrar nombre, etiquetas
  ni marcadores ya puestos
- Explícame qué estructura de estado usarías y por qué es compatible con lo
  que ya existe

---

### Fase 2: Densitometría básica
**Objetivo:** calcular una intensidad relativa de cada banda a partir de los
valores de gris de los píxeles dentro del recorte.

Requisitos:
- Usa un `<canvas>` oculto para leer los píxeles de la región recortada con
  `getImageData`
- Calcula un valor de intensidad (por ejemplo, promedio o suma del canal de
  gris, invertido si el fondo es claro y la banda oscura)
- Muestra ese valor numérico junto a cada banda en la interfaz
- Explícame las limitaciones de este método simple (saturación, ruido de
  fondo) en un párrafo, para poder mencionarlo en mi reporte

---

### Fase 3: Normalización con proteína de referencia (housekeeping)
**Objetivo:** permitir marcar una banda como referencia y calcular la
intensidad relativa de las demás respecto a ella.

Requisitos:
- Agrega un checkbox o selector "Usar como referencia (housekeeping)" en el
  panel de cada banda
- Calcula automáticamente el ratio: `intensidad_banda / intensidad_referencia`
  para todas las demás bandas del mismo carril
- Muestra el ratio junto al valor de intensidad bruta, no en vez de él

---

### Fase 4: Persistencia de sesión (Firebase)
**Objetivo:** guardar y recuperar el estado completo (imagen, recortes,
anotaciones) para no perder el progreso al recargar.

Requisitos:
- Indícame qué estructura de documento usarías en Firestore para representar
  una "sesión" de WBReport
- Implementa guardado manual (botón "Guardar sesión") y carga desde una lista
  de sesiones guardadas
- Ten en cuenta que las imágenes no deben guardarse como base64 gigante en
  Firestore; sugiéreme cómo manejarlas (por ejemplo, Firebase Storage) y por qué

---

### Fase 5: Curva de calibración de peso molecular
**Objetivo:** en vez de que los marcadores de kDa sean solo etiquetas fijas,
usar sus posiciones para estimar el peso molecular de cualquier banda por
interpolación.

Requisitos:
- A partir de la posición vertical de cada marcador y su valor en kDa conocido,
  ajusta una regresión (típicamente log-lineal, ya que la migración en el gel
  es aproximadamente logarítmica respecto al peso molecular)
- Usa esa función para estimar el kDa de cualquier banda según su posición
  vertical, y muéstralo como valor calculado (distinto del nombre manual de
  la proteína)
- Explícame la fórmula de regresión que uses y por qué es razonable para
  este caso, para poder justificarlo en mi entrega

---

## Formato de respuesta que necesito en cada fase
- Un párrafo breve de estrategia antes del código
- Código completo y comentado, compatible con lo ya existente
- Una explicación corta al final de cómo funciona lo nuevo, para poder
  sustentarlo en mi proyecto escolar

## Importante
- Trabaja **una fase a la vez**. Termina la Fase 1, espera mi confirmación,
  y solo entonces continúa con la Fase 2.
- Si algo del código actual entra en conflicto con lo que pido en una fase,
  dime qué cambiarías y por qué antes de modificarlo.
