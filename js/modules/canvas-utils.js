// Shared helpers for the two canvas views.

const PALETTE_KEYS = [
  'deck',
  'water',
  'water-deep',
  'lane',
  'judges',
  'figure-outline',
  'figure-text',
  'tag-text',
  'tag-bg',
  'text',
  'muted',
];

/** Reads the canvas colours from the CSS custom properties (follows dark mode). */
export function readPalette() {
  const style = getComputedStyle(document.documentElement);
  return Object.fromEntries(
    PALETTE_KEYS.map((key) => [toCamelCase(key), style.getPropertyValue(`--${key}`).trim()]),
  );
}

/** Sizes the canvas backing store for sharp drawing on high-density screens. */
export function fitCanvas(canvas, cssHeight) {
  const dpr = window.devicePixelRatio || 1;
  const width = canvas.clientWidth;
  const wanted = cssHeight === undefined ? null : `${Math.round(cssHeight)}px`;
  if (wanted !== null && canvas.style.height !== wanted) canvas.style.height = wanted;
  const height = canvas.clientHeight;
  const pixelWidth = Math.round(width * dpr);
  const pixelHeight = Math.round(height * dpr);
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
  return { width, height, dpr };
}

/** Text that stays readable on any background: dark outline, light fill. */
export function drawLabel(ctx, text, x, y, { size, fill, outline }) {
  ctx.font = `600 ${size}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = size / 4;
  ctx.strokeStyle = outline;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}

function toCamelCase(key) {
  return key.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}
