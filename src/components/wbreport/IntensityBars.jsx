import { normalizedRatio } from '../../utils/westernBlotAnalysis';

export default function IntensityBars({ strip, globalColumns, normStrip }) {
  const sortedCols = [...globalColumns].sort((a, b) => a.x - b.x);
  const values = sortedCols.map((col) => {
    const li = strip.laneIntensities?.[col.id];
    return li?.net ?? (typeof li === 'number' ? li : 0);
  });
  const maxVal = Math.max(...values, 1);

  return (
    <div className="wb-intensity-bars">
      {sortedCols.map((col, i) => {
        const val = values[i];
        const heightPct = (val / maxVal) * 100;
        const ratio = normalizedRatio(strip, col, normStrip);
        const li = strip.laneIntensities?.[col.id];
        const sat = (li?.saturatedFraction ?? 0) > 0.01;
        return (
          <div key={col.id} className="wb-intensity-bar-col">
            <div className="wb-intensity-bar-value" style={{ color: sat ? '#ff4d4f' : undefined }}>
              {val > 0 ? (val / 1000).toFixed(0) + 'k' : '—'}
            </div>
            <div className="wb-intensity-bar-track">
              <div className="wb-intensity-bar-fill" style={{ height: `${heightPct}%`, backgroundColor: sat ? '#ff4d4f' : undefined }} />
            </div>
            {ratio !== null && <div className="wb-intensity-bar-ratio">{ratio}</div>}
            <div className="wb-intensity-bar-label">{col.value}</div>
            {sat && <div style={{ fontSize: '0.55rem', color: '#ff4d4f', fontWeight: 'bold' }}>⚠ Sat</div>}
          </div>
        );
      })}
    </div>
  );
}