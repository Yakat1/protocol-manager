import React, { useState } from 'react';
import { HelpCircle, X, BookOpen, CheckCircle, AlertCircle, Award, Sliders, Layers } from 'lucide-react';
import './WBReport.css';

export default function WBReportFAQ({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState('lanes');

  if (!isOpen) return null;

  return (
    <div className="wb-modal-overlay" onMouseDown={onClose} style={{ zIndex: 1000 }}>
      <div 
        className="wb-modal-content" 
        onMouseDown={(e) => e.stopPropagation()}
        style={{ maxWidth: '820px', width: '95%', maxHeight: '85vh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}
      >
        {/* Cabecera del Modal */}
        <div style={{ padding: '20px 24px', background: 'rgba(99, 102, 241, 0.15)', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <BookOpen size={24} color="#818cf8" />
            <div>
              <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#fff' }}>Fundamentos Científicos y Validación del Método</h3>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Respuestas técnicas para tesis, revisores y protocolos de investigación</span>
            </div>
          </div>
          <button className="btn-icon" onClick={onClose} style={{ padding: '4px' }}>
            <X size={20} />
          </button>
        </div>

        {/* Navegación por pestañas */}
        <div style={{ display: 'flex', background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '0 16px', overflowX: 'auto' }}>
          <button 
            className={`wb-faq-tab ${activeTab === 'lanes' ? 'active' : ''}`}
            onClick={() => setActiveTab('lanes')}
            style={{ padding: '12px 16px', background: 'none', border: 'none', borderBottom: activeTab === 'lanes' ? '2px solid #818cf8' : '2px solid transparent', color: activeTab === 'lanes' ? '#818cf8' : 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' }}
          >
            <Layers size={16} /> Delimitación de Carriles (Sin cajas)
          </button>
          <button 
            className={`wb-faq-tab ${activeTab === 'math' ? 'active' : ''}`}
            onClick={() => setActiveTab('math')}
            style={{ padding: '12px 16px', background: 'none', border: 'none', borderBottom: activeTab === 'math' ? '2px solid #818cf8' : '2px solid transparent', color: activeTab === 'math' ? '#818cf8' : 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' }}
          >
            <HelpCircle size={16} /> Fundamento Densitométrico
          </button>
          <button 
            className={`wb-faq-tab ${activeTab === 'ethics' ? 'active' : ''}`}
            onClick={() => setActiveTab('ethics')}
            style={{ padding: '12px 16px', background: 'none', border: 'none', borderBottom: activeTab === 'ethics' ? '2px solid #818cf8' : '2px solid transparent', color: activeTab === 'ethics' ? '#818cf8' : 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' }}
          >
            <Sliders size={16} /> Brillo/Contraste e Integridad
          </button>
          <button 
            className={`wb-faq-tab ${activeTab === 'citation' ? 'active' : ''}`}
            onClick={() => setActiveTab('citation')}
            style={{ padding: '12px 16px', background: 'none', border: 'none', borderBottom: activeTab === 'citation' ? '2px solid #818cf8' : '2px solid transparent', color: activeTab === 'citation' ? '#818cf8' : 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' }}
          >
            <Award size={16} /> Validez y Cómo Citar
          </button>
        </div>

        {/* Contenido de la pestaña */}
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1, color: 'var(--text-primary)', fontSize: '0.92rem', lineHeight: '1.6' }}>
          
          {activeTab === 'lanes' && (
            <div>
              <h4 style={{ color: '#818cf8', fontSize: '1.1rem', marginTop: 0, marginBottom: '12px' }}>
                ¿Cómo se distingue una banda de la otra si no hay un rectángulo visible rodeando cada carril?
              </h4>
              <p>
                En nuestro software, en lugar de obligar al investigador a dibujar rectángulos manuales independientes alrededor de cada banda (un método tradicional que introduce <strong>sesgo del operador</strong> al variar el tamaño de la caja o recortar las "alas" de señal difusa), empleamos un estándar algorítmico robusto denominado <strong>Delimitación por Punto Medio (Diagrama de Voronoi 1D)</strong>.
              </p>
              
              <div style={{ background: 'rgba(255,255,255,0.04)', borderLeft: '3px solid #ffc107', padding: '12px 16px', margin: '16px 0', borderRadius: '4px' }}>
                <strong style={{ color: '#ffc107', display: 'block', marginBottom: '4px' }}>📍 Límite Matemático Automático:</strong>
                Para cualquier par de carriles adyacentes cuyos centros (líneas guía blancas/violetas) están ubicados en las coordenadas <code style={{ color: '#fff' }}>x<sub>i</sub></code> y <code style={{ color: '#fff' }}>x<sub>i+1</sub></code>, el límite exacto de separación se calcula automáticamente en el punto medio exacto:
                <div style={{ textAlign: 'center', padding: '8px 0', fontWeight: 'bold', fontSize: '1.05rem', color: '#818cf8' }}>
                  X<sub>límite</sub> = ( X<sub>i</sub> + X<sub>i+1</sub> ) / 2
                </div>
              </div>

              <h5 style={{ color: '#fff', margin: '16px 0 8px 0' }}>¿Dónde puedo ver estos límites en la interfaz?</h5>
              <p>
                El sistema dibuja estas fronteras de forma visible en dos lugares clave para dar total certeza al operador:
              </p>
              <ul>
                <li><strong>En la imagen de la banda:</strong> Aparecen como <strong>líneas punteadas amarillas</strong> entre cada línea guía. Todo el espacio horizontal de la membrana queda particionado en rectángulos contiguos de arriba a abajo.</li>
                <li><strong>En la gráfica de Perfil de Intensidad (Peaks):</strong> Las líneas amarillas punteadas marcan la división exacta de los "bins" o áreas bajo la curva. Además, las zonas tienen un sombreado alterno para apreciar cómo cada pico se asigna matemáticamente al 100% a su carril correspondiente.</li>
              </ul>
            </div>
          )}

          {activeTab === 'math' && (
            <div>
              <h4 style={{ color: '#818cf8', fontSize: '1.1rem', marginTop: 0, marginBottom: '12px' }}>
                ¿Cuál es el fundamento físico, matemático y de sustracción de fondo?
              </h4>
              <p>
                La medición se fundamenta en la <strong>Densitometría Óptica Digital</strong> e <strong>Integración de Área Bajo la Curva (AUC) con sustracción de línea base</strong>, el estándar metodológico moderno de las revistas de impacto internacional (ej. <em>Journal of Biological Chemistry</em>, <em>Nature</em>).
              </p>

              <h5 style={{ color: '#fff', margin: '16px 0 6px 0' }}>1. Ley de Beer-Lambert y Emisión de Luminancia</h5>
              <p>
                En <strong>colorimetría / absorbancia</strong>, la transmisión luminosa sigue la Ley de Beer-Lambert ($A = -\log_{10}(I/I_0)$). Sin embargo, la gran mayoría de Western Blots modernos utilizan <strong>quimioluminiscencia (ECL)</strong> o <strong>fluorescencia directa (IR/RGB)</strong>. En estas modalidades de emisión de fotones, la intensidad luminosa capturada por el sensor o detector digital en escala lineal (o invertida $I(x, y) = 255 - Y$) es <strong>directamente proporcional</strong> a la concentración de la enzima reportera o el fluoróforo en el rango dinámico lineal, sin requerir transformaciones logarítmicas.
              </p>

              <h5 style={{ color: '#fff', margin: '16px 0 6px 0' }}>2. Sustracción de Fondo Automatizada (Valle-a-Valle 1D)</h5>
              <p>
                Una membrana real presenta ruido de fondo por unión inespecífica de anticuerpo secundario o bloqueo heterogéneo. Para no sobreestimar las bandas tenues, el algoritmo construye una línea base continua conectando los valles locales (percentil 10 inferior) a lo largo del perfil de carril 1D:
              </p>
              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '10px 16px', borderRadius: '6px', textAlign: 'center', fontFamily: 'monospace', color: '#ef4444', margin: '12px 0' }}>
                Volumen Neto (Net AUC) = &sum; [ I(x) - Fondo<sub>valle-a-valle</sub>(x) ]
              </div>
              <p>
                Este volumen neto (<code style={{ color: '#ef4444' }}>Volumen_Neto</code> en el CSV) elimina el ruido de la membrana y representa la verdadera abundancia molecular de la proteína. En el gráfico del perfil de picos, esta línea base se observa claramente como una <strong>línea roja punteada</strong> debajo de la curva morada.
              </p>

              <h5 style={{ color: '#fff', margin: '16px 0 6px 0' }}>3. Normalización: Proteína Total vs Housekeeping</h5>
              <p>
                Aunque el software permite normalizar por proteínas housekeeping tradicionales (&beta;-actina, GAPDH, Tubulina), las directrices editoriales contemporáneas recomiendan enfáticamente la <strong>Normalización por Proteína Total (Total Protein Normalization - TPN)</strong> mediante tinciones como Ponceau S o fluorescencia in situ:
              </p>
              <ul>
                <li><strong>Estabilidad del rango dinámico:</strong> Las proteínas housekeeping suelen expresarse en niveles masivos que se saturan fácilmente en el sensor, distorsionando el ratio normalizado. La proteína total no sufre de este artefacto.</li>
                <li><strong>Invarianza biológica:</strong> En tratamientos farmacológicos severos o noxas celulares, la expresión de actina o GAPDH puede fluctuar. La carga de proteína total intracelular permanece como el denominador más robusto e insesgado.</li>
              </ul>
              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '10px 16px', borderRadius: '6px', textAlign: 'center', fontFamily: 'monospace', color: '#ffcc00', margin: '12px 0' }}>
                Ratio Normalizado = Volumen Neto(Target) / Volumen Neto(Referencia TPN / Housekeeping)
              </div>
            </div>
          )}

          {activeTab === 'ethics' && (
            <div>
              <h4 style={{ color: '#818cf8', fontSize: '1.1rem', marginTop: 0, marginBottom: '12px' }}>
                ¿Por qué los ajustes de Brillo y Contraste no alteran ni invalidan los resultados?
              </h4>
              <p>
                Una de las mayores preocupaciones editoriales en revistas como <em>Nature</em>, <em>Cell</em> o <em>JBC</em> es la manipulación indebida de imágenes para exagerar o eliminar señales.
              </p>
              
              <div style={{ background: 'rgba(16, 185, 129, 0.1)', borderLeft: '3px solid #10b981', padding: '12px 16px', margin: '16px 0', borderRadius: '4px' }}>
                <strong style={{ color: '#10b981', display: 'block', marginBottom: 4 }}>🛡️ Inmutabilidad del Dato Crudo (Raw Data):</strong>
                En nuestro software, los deslizadores de Brillo y Contraste son transformaciones estrictamente visuales aplicadas en la tarjeta de renderizado mediante filtros CSS (<code style={{ color: '#fff' }}>filter: brightness() contrast()</code>). 
              </div>

              <p>
                El motor de cálculo densitométrico lee directamente la memoria del búfer original de la imagen cargada (<code style={{ color: '#fff' }}>ImageData</code> sin modificar en el canvas oculto). Esto significa que:
              </p>
              <ul>
                <li>Puedes aclarar una imagen para ver los límites de una banda tenue visualmente sin alterar absolutamente ningún valor numérico en el CSV.</li>
                <li>La cuantificación es 100% reproducible y auditable frente a la imagen original cruda, cumpliendo las directrices éticas de publicación científica.</li>
                <li>Si exportas la figura en PNG, se conserva tu preferencia estética visual para la presentación de la figura sin comprometer la legitimidad de las tablas de datos.</li>
              </ul>
            </div>
          )}

          {activeTab === 'citation' && (
            <div>
              <h4 style={{ color: '#818cf8', fontSize: '1.1rem', marginTop: 0, marginBottom: '12px' }}>
                Validez Académica y Cómo Citar en Metodología
              </h4>
              <p>
                Los algoritmos de integración 1D y normalización por control de carga utilizados aquí son el estándar de oro aceptado por la comunidad científica internacional. 
              </p>

              <h5 style={{ color: '#fff', margin: '16px 0 8px 0' }}>📝 Sugerencia de redacción para Tesis y Artículos (Sección Métodos):</h5>
              <div style={{ background: 'rgba(255,255,255,0.06)', padding: '14px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', fontStyle: 'italic', color: '#e2e8f0', margin: '10px 0' }}>
                "La cuantificación densitométrica de las bandas de Western Blot se realizó mediante análisis de perfil de intensidad lineal e integración del área bajo la curva (AUC). La delimitación horizontal de cada carril se determinó de forma automatizada mediante partición por punto medio ecuatorial entre centroides contiguos, eliminando el sesgo de selección de ROIs manuales. La intensidad óptica cruda de cada banda fue normalizada de forma intra-carril dividiendo su valor contra la señal del control de carga interno (e.g., β-actina/GAPDH)."
              </div>

              <h5 style={{ color: '#fff', margin: '20px 0 8px 0' }}>⚖️ Estimación de Peso Molecular (Regresión Log-Lineal):</h5>
              <p>
                Para el peso molecular (kDa), el software aplica una regresión lineal por mínimos cuadrados basándose en el principio físico de la electroforesis SDS-PAGE: la distancia de migración (<em>R<sub>f</sub></em>) es inversamente proporcional al logaritmo decimal de la masa molecular:
              </p>
              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '8px 16px', borderRadius: '6px', textAlign: 'center', fontFamily: 'monospace', color: '#818cf8', margin: '10px 0' }}>
                y = m &middot; log<sub>10</sub>(kDa) + b
              </div>
              <p>
                El algoritmo interpola con precisión matemática el peso en kDa de cualquier banda basándose en la calibración del marcador (ladder).
              </p>
            </div>
          )}

        </div>

        {/* Pie del Modal */}
        <div style={{ padding: '16px 24px', background: 'rgba(0,0,0,0.25)', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn btn-primary" onClick={onClose} style={{ padding: '8px 20px' }}>
            Entendido, volver al análisis
          </button>
        </div>
      </div>
    </div>
  );
}
