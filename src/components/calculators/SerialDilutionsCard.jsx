import { useState } from 'react';
import { TestTubes } from 'lucide-react';
import { parseCalcFloat, formatConcentration } from '../../utils/calculations';

export default function SerialDilutionsCard() {
  const [serial, setSerial] = useState({ stockConc: '', dilFactor: '2', steps: '7', tubeVol: '200' });

  return (
    <div className="glass-panel calc-card">
      <h4><TestTubes size={18}/> Diluciones Seriadas</h4>
      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '12px', marginTop: '-8px' }}>Calcula volúmenes para curvas estándar (Bradford, ELISA, etc.)</p>
      <div className="calc-row">
        <div className="input-group">
          <label className="input-label">Conc. Stock Inicial</label>
          <input className="input-field" type="text" inputMode="decimal" placeholder="ej. 2000" value={serial.stockConc} onChange={e => setSerial({...serial, stockConc: e.target.value})} />
        </div>
        <div className="input-group">
          <label className="input-label">Factor de Dilución</label>
          <input className="input-field" type="text" inputMode="decimal" placeholder="ej. 2 (1:2)" value={serial.dilFactor} onChange={e => setSerial({...serial, dilFactor: e.target.value})} />
        </div>
      </div>
      <div className="calc-row" style={{ marginTop: '8px' }}>
        <div className="input-group">
          <label className="input-label">Nº de Tubos</label>
          <input className="input-field" type="text" inputMode="decimal" min="2" max="20" value={serial.steps} onChange={e => setSerial({...serial, steps: e.target.value})} />
        </div>
        <div className="input-group">
          <label className="input-label">Vol. Final / Tubo (µL)</label>
          <input className="input-field" type="text" inputMode="decimal" placeholder="200" value={serial.tubeVol} onChange={e => setSerial({...serial, tubeVol: e.target.value})} />
        </div>
      </div>
      {(() => {
        const stock = parseCalcFloat(serial.stockConc);
        const factor = parseCalcFloat(serial.dilFactor);
        const steps = parseInt(serial.steps);
        const vol = parseCalcFloat(serial.tubeVol);
        if (!stock || !factor || !steps || !vol || factor <= 1 || steps < 2) return null;

        const tubes = [];
        for (let i = 0; i < steps; i++) {
          const conc = stock / Math.pow(factor, i);
          const transferVol = vol / factor;
          const bufferVol = vol - transferVol;
          tubes.push({
            num: i + 1,
            conc: conc,
            transferFrom: i === 0 ? `Stock (${vol} µL)` : `${transferVol.toFixed(1)} µL del Tubo ${i}`,
            bufferAdd: i === 0 ? '—' : `${bufferVol.toFixed(1)} µL`,
          });
        }
        return (
          <div className="calc-result" style={{ marginTop: '12px' }}>
            <div className="calc-result-value" style={{ fontSize: '1rem', marginBottom: '8px' }}>Curva de {steps} puntos (1:{factor})</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                  <th style={{ padding: '5px 6px', color: 'var(--text-secondary)' }}>Tubo</th>
                  <th style={{ padding: '5px 6px', color: 'var(--text-secondary)' }}>Conc.</th>
                  <th style={{ padding: '5px 6px', color: 'var(--text-secondary)' }}>Pasar de</th>
                  <th style={{ padding: '5px 6px', color: 'var(--text-secondary)' }}>+ Buffer</th>
                </tr>
              </thead>
              <tbody>
                {tubes.map(t => (
                  <tr key={t.num} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '5px 6px', fontWeight: 'bold' }}>{t.num}</td>
                    <td style={{ padding: '5px 6px', color: 'var(--accent)', fontWeight: '600' }}>{formatConcentration(t.conc)}</td>
                    <td style={{ padding: '5px 6px', fontSize: '0.75rem' }}>{t.transferFrom}</td>
                    <td style={{ padding: '5px 6px', fontSize: '0.75rem' }}>{t.bufferAdd}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })()}
    </div>
  );
}