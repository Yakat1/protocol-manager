import { getCssFilter } from '../../utils/westernBlotAnalysis';

export default function FigurePreview({ strips, sortedColumns }) {
  return (
    <div id="wb-figure-export" className="wb-preview-container">
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '2px' }}>
        <div style={{ width: '40px', flexShrink: 0 }} />
        <div style={{ flex: 1, position: 'relative', height: '14px' }}>
          {sortedColumns.map((col) => (
            <span key={col.id} className="wb-preview-lane-item" style={{ left: `${col.x}%` }}>{col.value}</span>
          ))}
        </div>
        <div style={{ width: '65px', flexShrink: 0 }} />
      </div>
      {strips.map((strip) => {
        const cssFilter = getCssFilter(strip.brightness, strip.contrast);
        return (
          <div key={strip.id} className="wb-preview-strip">
            <div className="wb-preview-protein">{strip.protein}</div>
            <div className="wb-preview-img-wrapper">
              <img src={strip.imageData} alt={strip.protein} className="wb-preview-img" style={{ filter: cssFilter }} />
              <div style={{ position: 'absolute', top: 0, right: '-65px', width: '60px', height: '100%' }}>
                {strip.kdaMarkers.map((kda) => (
                  <div key={kda.id} className="wb-preview-kda-item-abs" style={{ top: `${kda.y}%` }}>
                    <div className="wb-preview-kda-dash" />{kda.value}
                  </div>
                ))}
              </div>
            </div>
            <div style={{ width: '65px', flexShrink: 0 }} />
          </div>
        );
      })}
    </div>
  );
}