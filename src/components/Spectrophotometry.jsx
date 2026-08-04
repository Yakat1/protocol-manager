import { useState, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Calculator, FlaskConical, Settings } from 'lucide-react';
import { linearRegression, calculateFactor, computeAverageAbs, processSpectroSamples, generateSpectroXLSX } from './AssayAnalysisEngine';
import { softDelete } from '../utils/softDelete';
import { downloadFile } from '../utils/downloadFile';
import { useLab } from '../context/LabContext';
import './Spectrophotometry.css';
import ProtocolBar from './spectro/ProtocolBar';
import CalibrationPanel from './spectro/CalibrationPanel';
import SamplesPanel from './spectro/SamplesPanel';
import TemplatesPanel from './spectro/TemplatesPanel';
import { DEFAULT_CURVES } from '../utils/spectroDefaults';

export default function Spectrophotometry() {
  const { state, updateState, user, userRole } = useLab();
  const [activeTab, setActiveTab] = useState('calibration'); // 'calibration' | 'samples' | 'templates'

  // Cloud data
  const savedProtocols = state?.spectroProtocols || [];
  const spectroTemplates = (state?.spectroTemplates || []).filter(t => !t.deletedAt);

  const [activeProtocolId, setActiveProtocolId] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');

  // Current Working Session State
  const [protocolName, setProtocolName] = useState('Nuevo Protocolo');
  const [protocolNotes, setProtocolNotes] = useState('');
  const [isFromTemplate, setIsFromTemplate] = useState(false);

  const [curves, setCurves] = useState(DEFAULT_CURVES());
  const [activeCurveIdx, setActiveCurveIdx] = useState(0);

  const [samples, setSamples] = useState([{ id: uuidv4(), name: 'Muestra 1', value: '', dilution: '', time: '' }]);
  const [globalDilution, setGlobalDilution] = useState(1);
  const [globalTime, setGlobalTime] = useState(1);

  const [factorSource, setFactorSource] = useState('protocol'); // 'protocol' | 'manual'
  const [manualFactorInput, setManualFactorInput] = useState('');

  // Template Admin State
  const [adminTemplateName, setAdminTemplateName] = useState('');
  const [adminCurves, setAdminCurves] = useState(DEFAULT_CURVES());
  const [adminActiveCurveIdx, setAdminActiveCurveIdx] = useState(0);

  // Handle Loading a Protocol Session
  const handleLoadProtocol = (e) => {
    const pid = e.target.value;
    setActiveProtocolId(pid);
    setSelectedTemplateId('');

    if (!pid) {
      setProtocolName('Nuevo Protocolo');
      setProtocolNotes('');
      setCurves(DEFAULT_CURVES());
      setSamples([{ id: uuidv4(), name: 'Muestra 1', value: '', dilution: '', time: '' }]);
      setIsFromTemplate(false);
      return;
    }

    const proto = savedProtocols.find(p => p.id === pid);
    if (proto) {
      setProtocolName(proto.nombre || 'Protocolo Cargado');
      setProtocolNotes(proto.notas || '');
      setCurves(proto.curvas || DEFAULT_CURVES());
      setSamples(proto.muestras && proto.muestras.length > 0 ? proto.muestras : [{ id: uuidv4(), name: 'Muestra 1', value: '', dilution: '', time: '' }]);
      setGlobalDilution(proto.globalDilution || 1);
      setGlobalTime(proto.globalTime || 1);
      setIsFromTemplate(!!proto.isFromTemplate);
    }
  };

  // Handle Loading a Template
  const handleLoadTemplate = (e) => {
    const tid = e.target.value;
    setSelectedTemplateId(tid);
    setActiveProtocolId(''); // Deselect saved protocol

    if (!tid) {
      setProtocolName('Nuevo Protocolo');
      setCurves(DEFAULT_CURVES());
      setIsFromTemplate(false);
      return;
    }

    const template = spectroTemplates.find(t => t.id === tid);
    if (template) {
      setProtocolName(`${template.nombre} - ${new Date().toLocaleDateString()}`);
      setIsFromTemplate(true);

      // Load curves from template, initializing absorbances as empty
      const initializedCurves = template.curvas.map(c => ({
        ...c,
        points: c.points.map(p => ({
          ...p,
          id: uuidv4(), // Regenerate IDs to prevent state collision
          abs1: '',
          abs2: '',
          abs3: ''
        }))
      }));
      setCurves(initializedCurves);
    }
  };

  // Live Math Calculations
  const processedCurves = useMemo(() => {
    return curves.map(curve => {
      const pointsWithAvg = curve.points.map(p => {
        const absPromedio = computeAverageAbs(p.abs1, p.abs2, p.abs3);
        return { ...p, absPromedio };
      });

      const validMathPts = pointsWithAvg
        .map(p => ({ x: parseFloat(p.concentration), y: p.absPromedio }))
        .filter(p => !isNaN(p.x) && p.y !== null);

      let results = { m: null, b: null, r2: null, factor: null };
      if (validMathPts.length > 0) {
        const lr = linearRegression(validMathPts);
        results = {
          m: lr.m,
          b: lr.b,
          r2: lr.r2,
          factor: calculateFactor(validMathPts)
        };
      }

      return { ...curve, points: pointsWithAvg, validMathPts, results };
    });
  }, [curves]);

  const activeCurve = processedCurves[activeCurveIdx];

  const protocolFactor = useMemo(() => {
    const validFactors = processedCurves.map(c => c.results.factor).filter(f => f !== null && f !== 0);
    if (validFactors.length === 0) return 0;
    const sum = validFactors.reduce((a, b) => a + b, 0);
    return sum / validFactors.length;
  }, [processedCurves]);

  const finalFactor = useMemo(() => {
    if (factorSource === 'manual') {
      const val = parseFloat(manualFactorInput);
      return isNaN(val) ? 0 : val;
    }
    return protocolFactor;
  }, [factorSource, manualFactorInput, protocolFactor]);

  const processedSamples = useMemo(() => {
    return processSpectroSamples(samples, finalFactor, globalDilution, globalTime);
  }, [samples, finalFactor, globalDilution, globalTime]);

  // Chart Data for Active Curve
  const chartData = useMemo(() => {
    const pts = activeCurve.validMathPts;
    if (!pts || pts.length === 0) return [];

    let data = pts.map(s => ({
      concentration: s.x,
      absorbance: s.y,
      isStandard: true
    }));

    if (activeCurve.results && activeCurve.results.m !== null && activeCurve.results.m !== 0) {
      const minX = 0;
      const maxX = Math.max(...pts.map(s => s.x)) * 1.1 || 100;

      // Assign trendAbs to all existing points so the Line is continuous
      data = data.map(d => ({
        ...d,
        trendAbs: activeCurve.results.m * d.concentration + activeCurve.results.b
      }));

      // Add boundary points to extend the line beautifully
      if (!data.some(d => d.concentration === minX)) {
        data.push({ concentration: minX, trendAbs: activeCurve.results.m * minX + activeCurve.results.b });
      }
      data.push({ concentration: maxX, trendAbs: activeCurve.results.m * maxX + activeCurve.results.b });
    }

    data.sort((a, b) => a.concentration - b.concentration);
    return data;
  }, [activeCurve]);

  // Operations
  const handleSaveToCloud = () => {
    if (!protocolName.trim()) return alert("Debes ingresar un nombre para el protocolo.");

    const newProtocol = {
      id: activeProtocolId || uuidv4(),
      nombre: protocolName,
      fecha: new Date().toISOString(),
      autor: user?.displayName || user?.email || 'Usuario',
      autorUid: user?.uid,
      notas: protocolNotes,
      curvas: curves,
      muestras: samples,
      factorCorreccionPromedio: protocolFactor,
      globalDilution,
      globalTime,
      isFromTemplate
    };

    let updatedProtocols = [...savedProtocols];
    if (activeProtocolId) {
      updatedProtocols = updatedProtocols.map(p => p.id === activeProtocolId ? newProtocol : p);
    } else {
      updatedProtocols.push(newProtocol);
      setActiveProtocolId(newProtocol.id);
    }

    updateState({ spectroProtocols: updatedProtocols });
    alert("Protocolo guardado exitosamente.");
  };

  const handleExport = () => {
    const blob = generateSpectroXLSX(
      protocolName,
      processedCurves,
      processedSamples,
      finalFactor,
      globalDilution,
      globalTime
    );
    downloadFile(blob, `Reporte_${protocolName.replace(/\s+/g, '_')}.xlsx`);
  };

  const handlePasteCurve = async () => {
    if (isFromTemplate) return alert("Las concentraciones están fijadas por la plantilla. Escribe las absorbancias manualmente.");
    try {
      const text = await navigator.clipboard.readText();
      const rows = text.trim().split('\n').map(r => r.split('\t'));

      const newPoints = rows.map(r => {
        return {
          id: uuidv4(),
          concentration: r[0] ? r[0].replace(',','.') : '',
          abs1: r[1] ? r[1].replace(',','.') : '',
          abs2: r[2] ? r[2].replace(',','.') : '',
          abs3: r[3] ? r[3].replace(',','.') : ''
        };
      });

      const newCurves = [...curves];
      newCurves[activeCurveIdx] = { ...newCurves[activeCurveIdx], points: newPoints };
      setCurves(newCurves);
    } catch(e) {
      alert("Error al pegar. Verifica que los datos vengan desde Excel.");
    }
  };

  const handlePasteSamples = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const rows = text.trim().split('\n').map(r => r.split('\t'));
      const newSamps = rows.map(r => ({
        id: uuidv4(),
        name: r[0] || '',
        value: r[1] ? r[1].replace(',','.') : '',
        dilution: '',
        time: ''
      }));
      setSamples(newSamps);
    } catch(e) {
      alert("Error al pegar.");
    }
  };

  // Admin Templates Operations
  const handleSaveAdminTemplate = () => {
    if (!adminTemplateName.trim()) return alert("Ingresa un nombre para la plantilla oficial.");
    const newTemplate = {
      id: uuidv4(),
      nombre: adminTemplateName,
      curvas: adminCurves
    };
    updateState({ spectroTemplates: [...(state?.spectroTemplates || []), newTemplate] });
    setAdminTemplateName('');
    setAdminCurves(DEFAULT_CURVES());
    alert("Plantilla guardada. Los usuarios ahora pueden cargarla para prellenar concentraciones.");
  };

  const handleDeleteTemplate = (id) => {
    if(confirm('¿Seguro que deseas eliminar esta plantilla oficial del laboratorio?')) {
      updateState({
        spectroTemplates: softDelete(state?.spectroTemplates || [], id, user)
      }, { immediate: true });
    }
  };

  const isReadOnly = activeProtocolId && savedProtocols.find(p => p.id === activeProtocolId)?.autorUid !== user?.uid;
  const isConcentrationLocked = isReadOnly || isFromTemplate;

  return (
    <div className="spectro-container">
      <div className="spectro-header">
        <h2>🔬 Espectrofotometría Multiparamétrica</h2>
        <p>Crea sesiones de trabajo con 3 curvas por triplicado o carga plantillas oficiales para estandarizar tus cálculos.</p>
      </div>

      <ProtocolBar
        selectedTemplateId={selectedTemplateId}
        spectroTemplates={spectroTemplates}
        activeProtocolId={activeProtocolId}
        savedProtocols={savedProtocols}
        onLoadTemplate={handleLoadTemplate}
        onLoadProtocol={handleLoadProtocol}
        protocolName={protocolName}
        setProtocolName={setProtocolName}
        protocolNotes={protocolNotes}
        setProtocolNotes={setProtocolNotes}
        isReadOnly={isReadOnly}
        onSaveToCloud={handleSaveToCloud}
      />

      {isReadOnly && (
        <div className="locked-alert">
          <strong>🔒 Modo Lectura</strong>: Esta sesión fue creada por otro usuario. No puedes sobreescribirla, pero puedes usar su factor para calcular tus muestras.
        </div>
      )}

      {isFromTemplate && !isReadOnly && (
        <div className="template-alert">
          <strong>✅ Plantilla Oficial Activa</strong>: Las concentraciones han sido bloqueadas por el administrador. Solo ingresa tus absorbancias.
        </div>
      )}

      {/* TABS */}
      <div className="spectro-tabs">
        <button className={`spectro-tab-btn ${activeTab === 'calibration' ? 'active' : ''}`} onClick={() => setActiveTab('calibration')}>
          <FlaskConical size={18}/> 1. Calibración (3 Curvas)
        </button>
        <button className={`spectro-tab-btn ${activeTab === 'samples' ? 'active' : ''}`} onClick={() => setActiveTab('samples')}>
          <Calculator size={18}/> 2. Análisis de Muestras
        </button>
        {userRole === 'admin' && (
          <button className={`spectro-tab-btn ${activeTab === 'templates' ? 'active' : ''}`} onClick={() => setActiveTab('templates')} style={{marginLeft: 'auto'}}>
            <Settings size={18}/> 3. Plantillas (Admin)
          </button>
        )}
      </div>

      {activeTab === 'calibration' && (
        <CalibrationPanel
          processedCurves={processedCurves}
          activeCurveIdx={activeCurveIdx}
          onCurveSelect={setActiveCurveIdx}
          curves={curves}
          onCurvesChange={setCurves}
          isConcentrationLocked={isConcentrationLocked}
          isReadOnly={isReadOnly}
          isFromTemplate={isFromTemplate}
          onPasteCurve={handlePasteCurve}
          chartData={chartData}
          protocolFactor={protocolFactor}
        />
      )}

      {activeTab === 'samples' && (
        <SamplesPanel
          protocolFactor={protocolFactor}
          finalFactor={finalFactor}
          factorSource={factorSource}
          setFactorSource={setFactorSource}
          manualFactorInput={manualFactorInput}
          setManualFactorInput={setManualFactorInput}
          globalDilution={globalDilution}
          setGlobalDilution={setGlobalDilution}
          globalTime={globalTime}
          setGlobalTime={setGlobalTime}
          samples={samples}
          setSamples={setSamples}
          isReadOnly={isReadOnly}
          processedSamples={processedSamples}
          onPasteSamples={handlePasteSamples}
          onExport={handleExport}
        />
      )}

      {activeTab === 'templates' && userRole === 'admin' && (
        <TemplatesPanel
          adminTemplateName={adminTemplateName}
          setAdminTemplateName={setAdminTemplateName}
          adminCurves={adminCurves}
          setAdminCurves={setAdminCurves}
          adminActiveCurveIdx={adminActiveCurveIdx}
          setAdminActiveCurveIdx={setAdminActiveCurveIdx}
          spectroTemplates={spectroTemplates}
          onSaveTemplate={handleSaveAdminTemplate}
          onDeleteTemplate={handleDeleteTemplate}
        />
      )}

    </div>
  );
}