// Top view of the pool: position, body orientation, legs, head and gaze of each swimmer.
// Drawing happens in metres (the canvas transform converts to pixels).

import { toRadians } from './angles.js';
import { drawLabel, fitCanvas } from './canvas-utils.js';
import { armDirection, armSpecs, canShowArms, drawingOrder } from './figure-geometry.js';

const DECK_MARGIN = 2.5;
const JUDGES_MARGIN = 2.2;
const MIN_ASPECT = 0.45;
const MAX_ASPECT = 0.85;

export function createPoolView(canvas) {
  const ctx = canvas.getContext('2d');

  return {
    /**
     * @param {object} frame
     * @param {{length: number, width: number}} frame.pool
     * @param {Array<{id, initials, color, pose}>} frame.swimmers
     * @param {string} frame.focus id of the highlighted swimmer, or ''
     * @param {object|null} frame.zoomBox {minX, maxX, minY, maxY} in metres; null = whole pool
     * @param {object} frame.palette
     * @param {number} frame.beat current beat, to animate waving hands
     * @returns {{minX: number, maxX: number}} the horizontal range shown, in metres
     */
    render(frame) {
      const box = viewBox(frame.pool, frame.zoomBox);
      const aspect = (box.maxY - box.minY) / (box.maxX - box.minX);
      const { width, height, dpr } = fitCanvas(canvas, canvas.clientWidth * aspect);
      const scale = width / (box.maxX - box.minX);
      const px = 1 / scale; // one CSS pixel, in metres

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, width * dpr, height * dpr);
      ctx.setTransform(dpr * scale, 0, 0, dpr * scale, -box.minX * dpr * scale, -box.minY * dpr * scale);

      drawPool(ctx, frame.pool, px, frame.palette);
      for (const swimmer of drawingOrder(frame.swimmers)) {
        const dimmed = frame.focus !== '' && frame.focus !== swimmer.id;
        drawSwimmer(ctx, swimmer, px, frame.palette, dimmed, frame.beat);
      }
      if (box.maxY < frame.pool.width / 2 + 1) drawJudgesBand(ctx, box, px, frame.palette);
      return { minX: box.minX, maxX: box.maxX };
    },
  };
}

/** Smallest area that contains every in-water position of the routine, plus a margin. */
export function computeZoomBox(model, margin = 1.8) {
  const points = model.steps
    .filter((step) => step.phase === 'water')
    .flatMap((step) => Object.values(step.poses));
  return {
    minX: Math.min(...points.map((p) => p.x)) - margin,
    maxX: Math.max(...points.map((p) => p.x)) + margin,
    minY: Math.min(...points.map((p) => p.y)) - margin,
    maxY: Math.max(...points.map((p) => p.y)) + margin,
  };
}

/** Area to show, in metres, with an aspect ratio that fits a screen. */
function viewBox(pool, zoomBox) {
  const full = {
    minX: -pool.length / 2 - DECK_MARGIN,
    maxX: pool.length / 2 + DECK_MARGIN,
    minY: -pool.width / 2 - DECK_MARGIN,
    maxY: pool.width / 2 + JUDGES_MARGIN,
  };
  const box = zoomBox ?? full;
  const boxWidth = box.maxX - box.minX;
  const boxHeight = box.maxY - box.minY;
  const aspect = Math.min(MAX_ASPECT, Math.max(MIN_ASPECT, boxHeight / boxWidth));
  if (boxHeight / boxWidth > aspect) {
    const extra = (boxHeight / aspect - boxWidth) / 2;
    return { ...box, minX: box.minX - extra, maxX: box.maxX + extra };
  }
  // Too wide: add height above (the judges must stay visible at the bottom).
  return { ...box, minY: box.maxY - boxWidth * aspect };
}

function drawPool(ctx, pool, px, palette) {
  const halfL = pool.length / 2;
  const halfW = pool.width / 2;

  ctx.fillStyle = palette.deck;
  ctx.fillRect(-halfL - 50, -halfW - 50, pool.length + 100, pool.width + 100);

  ctx.fillStyle = palette.water;
  ctx.fillRect(-halfL, -halfW, pool.length, pool.width);

  ctx.strokeStyle = palette.lane;
  ctx.lineWidth = px;
  for (let x = -halfL + 5; x < halfL; x += 5) line(ctx, x, -halfW, x, halfW);
  for (let y = -halfW + 2.5; y < halfW; y += 2.5) line(ctx, -halfL, y, halfL, y);

  ctx.strokeStyle = palette.figureOutline;
  ctx.lineWidth = 2 * px;
  ctx.strokeRect(-halfL, -halfW, pool.length, pool.width);

  ctx.fillStyle = palette.judges;
  ctx.font = `700 ${13 * px}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('▲  JURY ET PUBLIC  ▲', 0, halfW + 1.1);
  ctx.font = `${11 * px}px system-ui, sans-serif`;
  ctx.fillStyle = palette.muted;
  ctx.fillText('Bord de départ', 0, -halfW - 2.1);
}

/** When zoomed in, the judges' side is off screen: remind where it is. */
function drawJudgesBand(ctx, box, px, palette) {
  const height = 18 * px;
  ctx.fillStyle = palette.tagBg;
  ctx.fillRect(box.minX, box.maxY - height, box.maxX - box.minX, height);
  ctx.fillStyle = palette.tagText;
  ctx.font = `700 ${11 * px}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('▼  côté JURY ET PUBLIC  ▼', (box.minX + box.maxX) / 2, box.maxY - height / 2);
}

function drawSwimmer(ctx, swimmer, px, palette, dimmed, beat) {
  const { pose, color, initials } = swimmer;
  const heading = toRadians(pose.heading);
  const dir = { x: Math.cos(heading), y: Math.sin(heading) };
  const hips = { x: pose.x, y: pose.y };
  const at = (forward, sideways = 0) => ({
    x: hips.x + dir.x * forward - dir.y * sideways,
    y: hips.y + dir.y * forward + dir.x * sideways,
  });
  const underwater = pose.depth >= 0.5;
  const limb = Math.max(0.16, 5 * px);
  const headRadius = Math.max(0.24, 10 * px);

  ctx.save();
  ctx.globalAlpha = (dimmed ? 0.3 : 1) * (1 - 0.5 * pose.depth);
  ctx.setLineDash(underwater ? [4 * px, 3 * px] : []);
  ctx.lineCap = 'round';

  let head;
  switch (pose.body) {
    case 'back':
    case 'front':
      head = drawLyingBody(ctx, pose, at, heading, limb, color, palette);
      break;
    case 'pike':
      stroke(ctx, at(0), at(0.5), limb * 1.8, color, palette);
      stroke(ctx, at(0, -0.08), at(0.75, -0.08), limb, color, palette);
      stroke(ctx, at(0, 0.08), at(0.75, 0.08), limb, color, palette);
      head = at(0.7);
      break;
    case 'tuck':
      disc(ctx, hips, 0.38, color, palette, px);
      head = at(0.45);
      break;
    default: // standing, sitting, vertical: seen from above, shoulders across the heading
      if (pose.body === 'sitting') {
        stroke(ctx, at(0, -0.12), at(0.55, -0.12), limb, color, palette);
        stroke(ctx, at(0, 0.12), at(0.55, 0.12), limb, color, palette);
      }
      stroke(ctx, at(0, -0.3), at(0, 0.3), limb * 1.8, color, palette);
      head = hips;
  }

  if (canShowArms(pose)) {
    const shoulders = pose.body === 'back' || pose.body === 'front' ? at(0.5) : hips;
    drawArms(ctx, pose, beat, { shoulders, head, dir }, limb, px, color, palette);
  }
  drawGaze(ctx, head, pose.gaze, headRadius, px, color, palette);
  disc(ctx, head, headRadius, color, palette, px);
  ctx.setLineDash([]);
  if (pose.gaze === 'down') {
    ctx.strokeStyle = palette.figureOutline;
    ctx.lineWidth = 2 * px;
    line(ctx, head.x - headRadius * 0.7, head.y + headRadius * 0.7, head.x + headRadius * 0.7, head.y - headRadius * 0.7);
  }
  drawLabel(ctx, initials, head.x, head.y + px, {
    size: headRadius * 1.05,
    fill: palette.tagText,
    outline: palette.figureOutline,
  });

  ctx.restore();
}

function drawLyingBody(ctx, pose, at, heading, limb, color, palette) {
  const spread = 0.08 + pose.legs * 0.6; // radians each side
  for (const sign of [-1, 1]) {
    const angle = heading + Math.PI + sign * spread;
    const foot = { x: at(0).x + Math.cos(angle) * 0.95, y: at(0).y + Math.sin(angle) * 0.95 };
    stroke(ctx, at(0), foot, limb, color, palette);
  }
  stroke(ctx, at(0), at(0.55), limb * 1.8, color, palette);
  if (pose.body === 'front') {
    // Spine stripe: the swimmer shows their back to the ceiling.
    ctx.strokeStyle = palette.figureOutline;
    ctx.lineWidth = limb * 0.4;
    line(ctx, at(0.05).x, at(0.05).y, at(0.5).x, at(0.5).y);
  }
  if (pose.lift > 0.05) {
    // Raised knee / leg, seen from above: a ring that grows with the lift.
    const knee = at(-0.35, 0.12);
    ctx.beginPath();
    ctx.arc(knee.x, knee.y, 0.12 + 0.16 * pose.lift, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = limb * 0.5;
    ctx.strokeStyle = palette.figureOutline;
    ctx.stroke();
  }
  return at(0.8);
}

/** Arms out of the water. Seen from above, a raised arm is just a hand. */
function drawArms(ctx, pose, beat, { shoulders, head, dir }, limb, px, color, palette) {
  const handRadius = Math.max(0.12, 4.5 * px);
  for (const spec of armSpecs(pose, beat)) {
    const side = toRadians(armDirection(pose, { ...spec, kind: 'side' }));
    const sideVec = { x: Math.cos(side), y: Math.sin(side) };
    const shoulder = { x: shoulders.x + sideVec.x * 0.25, y: shoulders.y + sideVec.y * 0.25 };
    let hand;
    if (spec.kind === 'up') {
      hand = {
        x: shoulder.x + sideVec.x * 0.1 + dir.x * spec.sway * 0.25,
        y: shoulder.y + sideVec.y * 0.1 + dir.y * spec.sway * 0.25,
      };
    } else if (spec.kind === 'claw') {
      hand = { x: head.x + dir.x * 0.35 + sideVec.x * 0.15, y: head.y + dir.y * 0.35 + sideVec.y * 0.15 };
    } else {
      const angle = toRadians(armDirection(pose, spec));
      const reach = spec.kind === 'point' ? 0.8 : 0.65;
      hand = { x: shoulder.x + Math.cos(angle) * reach, y: shoulder.y + Math.sin(angle) * reach };
      stroke(ctx, shoulder, hand, limb * 0.8, color, palette);
    }
    ctx.setLineDash([]);
    disc(ctx, hand, handRadius, color, palette, px);
    ctx.beginPath();
    ctx.arc(hand.x, hand.y, handRadius * 0.4, 0, Math.PI * 2);
    ctx.fillStyle = palette.tagText;
    ctx.fill();
  }
}

function drawGaze(ctx, head, gaze, headRadius, px, color, palette) {
  if (gaze === 'up') {
    ctx.strokeStyle = palette.figureOutline;
    ctx.lineWidth = 2 * px;
    for (let i = 0; i < 8; i += 1) {
      const angle = (i * Math.PI) / 4;
      line(
        ctx,
        head.x + Math.cos(angle) * headRadius * 1.2,
        head.y + Math.sin(angle) * headRadius * 1.2,
        head.x + Math.cos(angle) * headRadius * 1.55,
        head.y + Math.sin(angle) * headRadius * 1.55,
      );
    }
    return;
  }
  if (typeof gaze !== 'number') return;
  const angle = toRadians(gaze);
  const length = Math.max(0.8, 30 * px) + headRadius;
  const half = toRadians(24);
  ctx.beginPath();
  ctx.moveTo(head.x, head.y);
  ctx.lineTo(head.x + Math.cos(angle - half) * length, head.y + Math.sin(angle - half) * length);
  ctx.lineTo(head.x + Math.cos(angle + half) * length, head.y + Math.sin(angle + half) * length);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.globalAlpha *= 0.6;
  ctx.fill();
  ctx.globalAlpha /= 0.6;
  ctx.strokeStyle = palette.figureOutline;
  ctx.lineWidth = 1.5 * px;
  ctx.stroke();
}

function stroke(ctx, from, to, width, color, palette) {
  ctx.strokeStyle = palette.figureOutline;
  ctx.lineWidth = width + width * 0.6;
  line(ctx, from.x, from.y, to.x, to.y);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  line(ctx, from.x, from.y, to.x, to.y);
}

function disc(ctx, centre, radius, color, palette, px) {
  ctx.beginPath();
  ctx.arc(centre.x, centre.y, radius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 2 * px;
  ctx.strokeStyle = palette.figureOutline;
  ctx.stroke();
}

function line(ctx, x1, y1, x2, y2) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}
