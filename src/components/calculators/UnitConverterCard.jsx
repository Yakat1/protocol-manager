import { useState } from 'react';
import { ArrowRightLeft } from 'lucide-react';
import { UNIT_GROUPS, convertUnit, formatSmart } from '../../utils/calculations';

export default function UnitConverterCard() {
  const [converter, setConverter] = useState({ value: '', fromUnit: 'g', toUnit: 'mg', type: 'mass' });

  const cRes = () => {
    const group = UNIT_GROUPS[converter.type];
    if (!group) return null;
    return convertUnit(converter.value, converter.fromUnit, converter.toUnit, group.factors);
  };

  const result = cRes();

  return (
    <div className="glass-panel calc-card">
      <h4><ArrowRightLeft size={18}/> Conversor de Unidades</h4>
      <div className="input-group" style={{ marginBottom: '12px' }}>
        <label className="input-label">Tipo de Unidad</label>
        <select className="input-field" value={converter.type} onChange={e => {
          const newType = e.target.value;
          const units = UNIT_GROUPS[newType].units;
          setConverter({ value: converter.value, fromUnit: units[0], toUnit: units[1], type: newType });
        }}>
          {Object.entries(UNIT_GROUPS).map(([key, g]) => <option key={key} value={key}>{g.label}</option>)}
        </select>
      </div>
      <div className="input-group">
        <label className="input-label">Valor</label>
        <input className="input-field" type="text" inputMode="decimal" placeholder="Ingresa un valor" value={converter.value} onChange={e => setConverter({...converter, value: e.target.value})} />
      </div>
      <div className="calc-row" style={{ marginTop: '12px' }}>
        <div className="input-group">
          <label className="input-label">De</label>
          <select className="input-field" value={converter.fromUnit} onChange={e => setConverter({...converter, fromUnit: e.target.value})}>
            {UNIT_GROUPS[converter.type].units.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <div className="input-group">
          <label className="input-label">A</label>
          <select className="input-field" value={converter.toUnit} onChange={e => setConverter({...converter, toUnit: e.target.value})}>
            {UNIT_GROUPS[converter.type].units.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
      </div>
      {result !== null && converter.value && (
        <div className="calc-result">
          <div className="calc-result-value">{formatSmart(result)} {converter.toUnit}</div>
          <div className="calc-result-label">
            {converter.value} {converter.fromUnit} = {formatSmart(result)} {converter.toUnit}
          </div>
        </div>
      )}
    </div>
  );
}