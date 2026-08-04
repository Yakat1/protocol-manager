// ── Utilidades de cálculo cuantitativo y auditoría (Western Blot) ────────────

export const GRAY_MODES = {
  average: (r, g, b) => (r + g + b) / 3,
  rec709: (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b,
  green: (r, g) => g,
};

export const estimateBaseline1D = (profile1D) => {
  const n = profile1D.length;
  if (n === 0) return [];
  const sorted = [...profile1D].sort((a, b) => a - b);
  const floor = sorted[Math.floor(n * 0.10)] || 0;
  const left = Math.min(profile1D[0], floor);
  const right = Math.min(profile1D[n - 1], floor);
  const baseline = new Array(n);
  for (let i = 0; i < n; i++) {
    const interp = left + (right - left) * (i / (n - 1));
    baseline[i] = Math.min(profile1D[i], Math.max(interp, floor));
  }
  return baseline;
};

export const calculateLaneIntensitiesWithBackground = (canvas, columns, grayMode = 'average') => {
  const width = canvas.width;
  const height = canvas.height;
  const ctx = canvas.getContext('2d');
  const data = ctx.getImageData(0, 0, width, height).data;

  const sortedCols = [...columns].sort((a, b) => a.x - b.x);
  const boundaries = [0];
  for (let i = 0; i < sortedCols.length - 1; i++) {
    boundaries.push(((sortedCols[i].x + sortedCols[i + 1].x) / 2) * width / 100);
  }
  boundaries.push(width);

  const toGrayFn = GRAY_MODES[grayMode] || GRAY_MODES.average;
  const result = {};

  sortedCols.forEach((col, idx) => {
    const startX = Math.floor(boundaries[idx]);
    const endX = Math.floor(boundaries[idx + 1]);
    const profile = [];
    let satPixels = 0, totalPixels = 0;

    for (let x = startX; x < endX; x++) {
      let colSum = 0;
      for (let y = 0; y < height; y++) {
        const p = (y * width + x) * 4;
        const gray = toGrayFn(data[p], data[p + 1], data[p + 2]);
        if (gray >= 254 || gray <= 1) satPixels++;
        totalPixels++;
        colSum += (255 - gray);
      }
      profile.push(colSum);
    }

    const baseline = estimateBaseline1D(profile);
    let raw = 0, net = 0, bg = 0;
    for (let i = 0; i < profile.length; i++) {
      raw += profile[i];
      bg += baseline[i];
      net += Math.max(0, profile[i] - baseline[i]);
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

export const calculateIntensityProfile = (imageDataUrl, grayMode = 'average') => {
  const img = new Image();
  img.src = imageDataUrl;
  if (!img.complete && !img.width) return [];
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || 100;
  canvas.height = img.naturalHeight || 30;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const profile = [];
  const toGrayFn = GRAY_MODES[grayMode] || GRAY_MODES.average;
  for (let x = 0; x < canvas.width; x++) {
    let colSum = 0;
    for (let y = 0; y < canvas.height; y++) {
      const idx = (y * canvas.width + x) * 4;
      const gray = toGrayFn(data[idx], data[idx + 1], data[idx + 2]);
      colSum += (255 - gray);
    }
    profile.push(colSum);
  }
  return profile;
};

export const estimateKda = (markers, targetY) => {
  const valid = markers
    .map((m) => { const match = m.value.match(/(\d+(\.\d+)?)/); return match ? { y: m.y, kda: parseFloat(match[0]) } : null; })
    .filter((m) => m && m.kda > 0);
  if (valid.length < 2) return null;
  let sx = 0, sy = 0, sxy = 0, sx2 = 0;
  const n = valid.length;
  valid.forEach(({ y, kda }) => { const lk = Math.log10(kda); sx += y; sy += lk; sxy += y * lk; sx2 += y * y; });
  const den = n * sx2 - sx * sx;
  if (!den) return null;
  return Math.round(Math.pow(10, ((n * sxy - sx * sy) / den) * targetY + (sy - ((n * sxy - sx * sy) / den) * sx) / n));
};

export const recalcAllStrips = (strips, columns, grayMode = 'average') => strips.map((strip) => {
  const el = document.querySelector(`#strip-img-${strip.id} .wb-strip-image`);
  if (!el || !el.naturalWidth) return strip;
  const canvas = document.createElement('canvas');
  canvas.width = el.naturalWidth; canvas.height = el.naturalHeight;
  const ctx = canvas.getContext('2d'); ctx.drawImage(el, 0, 0);
  return { ...strip, laneIntensities: calculateLaneIntensitiesWithBackground(canvas, columns, grayMode) };
});

export const normalizedRatio = (strip, col, normStrip) => {
  if (!normStrip || strip.id === normStrip.id) return null;
  const t = strip.laneIntensities?.[col.id]?.net ?? (typeof strip.laneIntensities?.[col.id] === 'number' ? strip.laneIntensities[col.id] : null);
  const r = normStrip?.laneIntensities?.[col.id]?.net ?? (typeof normStrip?.laneIntensities?.[col.id] === 'number' ? normStrip.laneIntensities[col.id] : null);
  if (t === null || r === null || r === 0) return null;
  return +(t / r).toFixed(2);
};

export const getCssFilter = (brightness, contrast) => `brightness(${1 + (brightness ?? 0) / 100}) contrast(${1 + (contrast ?? 0) / 100})`;