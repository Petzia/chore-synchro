// Side view, as seen from the judges: who is at the surface, who is under water,
// legs raised, oyster sinking, somersault rolling.

import { toRadians } from './angles.js';
import { drawLabel, fitCanvas } from './canvas-utils.js';
import { armDirection, armSpecs, canShowArms, drawingOrder, floorDepth } from './figure-geometry.js';

const DECK_MARGIN = 2.5;
const HEIGHT_ABOVE = 3.4; // metres shown above the surface (room for a lift)
const SINK_DEPTH = 1.6; // how deep "depth: 1" goes, if the pool is deep enough
// Hips height of a sitting swimmer: on the deck, or (with `elevation`) on someone's shoulders.
const DECK_HEIGHT = 0.3;

export function createProfileView(canvas) {
  const ctx = canvas.getContext('2d');

  return {
    /** xRange: the horizontal range shown by the top view, so both views line up. */
    render({ pool, swimmers, focus, palette, xRange, beat }) {
      const { width, height, dpr } = fitCanvas(canvas);
      const minX = xRange?.minX ?? -pool.length / 2 - DECK_MARGIN;
      const maxX = xRange?.maxX ?? pool.length / 2 + DECK_MARGIN;
      const scaleX = width / (maxX - minX);
      const depthBelow = Math.max(pool.depthLeft, pool.depthRight) + 0.3;
      const scaleZ = height / (HEIGHT_ABOVE + depthBelow);
      const toScreen = (x, z) => ({ x: (x - minX) * scaleX, y: (HEIGHT_ABOVE - z) * scaleZ });

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      drawBackground(ctx, pool, toScreen, width, height, palette);

      for (const swimmer of drawingOrder(swimmers)) {
        const dimmed = focus !== '' && focus !== swimmer.id;
        const floor = -floorDepth(pool, swimmer.pose.x);
        drawSwimmer(ctx, swimmer, { toScreen, scaleX, palette, dimmed, beat, floor });
      }
    },
  };
}

function drawBackground(ctx, pool, toScreen, width, height, palette) {
  const surfaceLeft = toScreen(-pool.length / 2, 0);
  const surfaceRight = toScreen(pool.length / 2, 0);
  const floorLeft = toScreen(-pool.length / 2, -pool.depthLeft);
  const floorRight = toScreen(pool.length / 2, -pool.depthRight);
  ctx.fillStyle = palette.deck;
  ctx.fillRect(0, 0, width, height);

  const gradient = ctx.createLinearGradient(0, surfaceLeft.y, 0, Math.max(floorLeft.y, floorRight.y));
  gradient.addColorStop(0, palette.water);
  gradient.addColorStop(1, palette.waterDeep);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(surfaceLeft.x, surfaceLeft.y);
  ctx.lineTo(surfaceRight.x, surfaceRight.y);
  ctx.lineTo(floorRight.x, floorRight.y);
  ctx.lineTo(floorLeft.x, floorLeft.y);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = palette.text;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.moveTo(surfaceLeft.x, surfaceLeft.y);
  ctx.lineTo(surfaceRight.x, surfaceRight.y);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = palette.muted;
  ctx.font = '11px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText('surface', surfaceLeft.x + 4, surfaceLeft.y - 2);
  ctx.textBaseline = 'top';
  ctx.fillText(`${pool.depthLeft} m`, floorLeft.x + 4, floorLeft.y + 2);
  ctx.textAlign = 'right';
  ctx.fillText(`${pool.depthRight} m`, floorRight.x - 4, floorRight.y + 2);
}

/** Body outline in local metres: u along the swimmer's heading (projected), v upwards. */
function figure(pose) {
  // Seen from the judges, a body pointing towards them looks shorter.
  const cosine = Math.cos(toRadians(pose.heading));
  const u = Math.sign(cosine || 1) * Math.max(0.3, Math.abs(cosine));
  const sink = -pose.depth * SINK_DEPTH;

  switch (pose.body) {
    case 'standing':
      return { hips: DECK_HEIGHT + 0.9, segments: [[[0, 0], [0, 0.6]], [[0, 0], [0, -0.9]]], head: [0, 0.85], shoulders: [0, 0.55] };
    case 'sitting':
      return { hips: DECK_HEIGHT, segments: [[[0, 0], [0, 0.6]], [[0, 0], [0.2 * u, -0.6]]], head: [0, 0.85], shoulders: [0, 0.55] };
    case 'vertical':
      // Eggbeater: shoulders at the surface, knees out, feet well above a 1.4 m floor.
      return {
        hips: -0.65 + sink,
        segments: [
          [[0, 0], [0, 0.65]],
          [[0, 0], [0.3, -0.3]], [[0.3, -0.3], [0.15, -0.55]],
          [[0, 0], [-0.3, -0.3]], [[-0.3, -0.3], [-0.15, -0.55]],
        ],
        head: [0, 0.9],
        shoulders: [0, 0.6],
      };
    case 'tuck':
      return { hips: -0.15 + sink, ball: 0.35, head: [0.45 * u, 0.1], rotate: true };
    case 'pike':
      return { hips: -0.45 + sink, segments: [[[0, 0], [0.3 * u, 0.55]], [[0, 0], [-0.1 * u, 1]]], head: [0.4 * u, 0.7] };
    default:
      return { hips: 0.05 + sink, segments: lyingSegments(pose, u), head: [0.8 * u, 0.02], shoulders: [0.5 * u, 0] };
  }
}

function lyingSegments(pose, u) {
  const segments = [[[0, 0], [0.55 * u, 0]], [[0, 0], [-0.95 * u, 0]]];
  if (pose.lift > 0.05) {
    // Up to 0.5: the knee rises (sailboat). Above: the shin extends to vertical.
    const bend = Math.min(pose.lift, 0.5) * 2;
    const extend = Math.max(0, pose.lift - 0.5) * 2;
    const knee = [-0.25 * u * (1 - extend), 0.45 * bend];
    const foot = [-0.5 * u * (1 - extend), 0.9 * extend];
    segments.push([[0, 0], knee], [knee, foot]);
  }
  return segments;
}

/** Lowest point of a figure, relative to its hips (≤ 0). */
function lowestPoint(shape) {
  const points = (shape.segments ?? []).flat().map(([, v]) => v);
  return Math.min(0, ...points, -(shape.ball ?? 0));
}

/** Arm segments in local metres (u along x, v upwards). */
function armSegments(pose, shoulders, beat) {
  if (!canShowArms(pose) || !shoulders) return [];
  const [su, sv] = shoulders;
  return armSpecs(pose, beat).map((spec) => {
    const across = Math.cos(toRadians(armDirection(pose, spec)));
    if (spec.kind === 'up') return [shoulders, [su + across * 0.1 + spec.sway * 0.2, sv + 0.7]];
    if (spec.kind === 'claw') return [shoulders, [su + across * 0.15, sv + 0.35]];
    const reach = spec.kind === 'point' ? 0.75 : 0.6;
    return [shoulders, [su + across * reach, sv + 0.1]];
  });
}

function drawSwimmer(ctx, swimmer, { toScreen, scaleX, palette, dimmed, beat, floor }) {
  const { pose, color, initials } = swimmer;
  const base = figure(pose);
  // Lifted swimmers go up; nobody goes through the (sloping) floor: in the
  // shallow end, a vertical swimmer simply stands on it.
  const shape = { ...base, hips: Math.max(base.hips, floor - lowestPoint(base)) + pose.elevation };
  const pitch = shape.rotate ? toRadians(pose.pitch) * -Math.sign(Math.cos(toRadians(pose.heading)) || 1) : 0;
  const local = ([u, v]) => {
    const ru = u * Math.cos(pitch) - v * Math.sin(pitch);
    const rv = u * Math.sin(pitch) + v * Math.cos(pitch);
    return toScreen(pose.x + ru, shape.hips + rv);
  };
  const lineWidth = Math.max(3, 0.16 * scaleX);
  const headRadius = Math.max(7, 0.22 * scaleX);

  ctx.save();
  ctx.globalAlpha = dimmed ? 0.3 : 1;
  // Dashed when the head is under the surface (the floor may have pushed a figure up).
  ctx.setLineDash(shape.hips + shape.head[1] < 0 ? [4, 3] : []);
  ctx.lineCap = 'round';

  for (const [from, to] of [...(shape.segments ?? []), ...armSegments(pose, shape.shoulders, beat)]) {
    const a = local(from);
    const b = local(to);
    for (const [style, width] of [[palette.figureOutline, lineWidth + 2], [color, lineWidth]]) {
      ctx.strokeStyle = style;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }
  if (shape.ball) {
    const centre = local([0, 0]);
    circle(ctx, centre, shape.ball * scaleX, color, palette);
  }
  const head = local(shape.head);
  circle(ctx, head, headRadius, color, palette);
  ctx.setLineDash([]);
  drawLabel(ctx, initials, head.x, head.y, { size: headRadius * 1.1, fill: palette.tagText, outline: palette.figureOutline });
  ctx.restore();
}

function circle(ctx, centre, radius, color, palette) {
  ctx.beginPath();
  ctx.arc(centre.x, centre.y, radius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = palette.figureOutline;
  ctx.stroke();
}
