import { useRef, useEffect } from 'react';
import { calculateIntensityProfile, estimateBaseline1D } from '../../utils/westernBlotAnalysis';

export default function PeaksChart({ strip, globalColumns, grayMode = 'average' }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !strip.imageData) return;
    const profile = calculateIntensityProfile(strip.imageData, grayMode);
    if (!profile.length) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const maxVal = Math.max(...profile, 1);
    ctx.clearRect(0, 0, W, H);
    // Fondo
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(0, 0, W, H);

    // Líneas divisorias de carril (punto medio ecuatorial) y sombreado
    const sortedCols = [...globalColumns].sort((a, b) => a.x - b.x);
    const boundaries = [0];
    for (let i = 0; i < sortedCols.length - 1; i++) {
      boundaries.push(((sortedCols[i].x + sortedCols[i + 1].x) / 2) * W / 100);
    }
    boundaries.push(W);

    // Sombreado alterno de carriles para identificar cada ROI visualmente
    for (let i = 0; i < sortedCols.length; i++) {
      if (i % 2 === 1) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
        ctx.fillRect(boundaries[i], 0, boundaries[i + 1] - boundaries[i], H);
      }
    }

    // Relleno bajo la curva
    const gradient = ctx.createLinearGradient(0, 0, 0, H);
    gradient.addColorStop(0, 'rgba(99,102,241,0.7)');
    gradient.addColorStop(1, 'rgba(99,102,241,0.05)');
    ctx.beginPath();
    ctx.moveTo(0, H);
    profile.forEach((val, x) => {
      const px = (x / profile.length) * W;
      const py = H - (val / maxVal) * (H - 4);
      x === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    });
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Línea de fondo estimado (Valle a valle 1D)
    const baseline = estimateBaseline1D(profile);
    ctx.beginPath();
    ctx.setLineDash([2, 2]);
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.85)';
    ctx.lineWidth = 1.2;
    baseline.forEach((val, x) => {
      const px = (x / baseline.length) * W;
      const py = H - (val / maxVal) * (H - 4);
      x === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    });
    ctx.stroke();
    ctx.setLineDash([]);

    // Línea de la curva de señal
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(129,140,248,1)';
    ctx.lineWidth = 1.5;
    profile.forEach((val, x) => {
      const px = (x / profile.length) * W;
      const py = H - (val / maxVal) * (H - 4);
      x === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    });
    ctx.stroke();

    // Líneas guía de columnas globales (centroides)
    sortedCols.forEach((col) => {
      const px = (col.x / 100) * W;
      ctx.beginPath();
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 1;
      ctx.moveTo(px, 0); ctx.lineTo(px, H);
      ctx.stroke();
      ctx.setLineDash([]);
    });

    // Líneas divisorias entre carriles (amarillo punteado)
    for (let i = 1; i < boundaries.length - 1; i++) {
      ctx.beginPath();
      ctx.setLineDash([2, 2]);
      ctx.strokeStyle = 'rgba(255, 193, 7, 0.75)';
      ctx.lineWidth = 1;
      ctx.moveTo(boundaries[i], 0); ctx.lineTo(boundaries[i], H);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }, [strip.imageData, globalColumns, grayMode]);

  return (
    <canvas
      ref={canvasRef}
      width={400}
      height={72}
      style={{ width: '100%', height: '72px', borderRadius: '6px', display: 'block' }}
    />
  );
}