// Geometry shared by the two views: arms out of the water, pool floor, drawing order.

import { sideDirection } from './choreography-model.js';

/**
 * @returns {Array<{side: 'right'|'left', kind: 'up'|'side'|'point'|'claw', sway: number}>}
 *   sway: -1…1, used to animate a waving hand (a full left-right wave every two beats).
 */
export function armSpecs(pose, beat) {
  const arm = (side, kind, sway = 0) => ({ side, kind, sway });
  switch (pose.arms) {
    case 'rightUp':
      return [arm('right', 'up')];
    case 'leftUp':
      return [arm('left', 'up')];
    case 'bothUp':
      return [arm('right', 'up'), arm('left', 'up')];
    case 'rightSide':
      return [arm('right', 'side')];
    case 'leftSide':
      return [arm('left', 'side')];
    case 'point':
      return [arm('right', 'point')];
    case 'wave':
      return [arm('right', 'up', Math.sin(beat * Math.PI))];
    case 'claw':
      return [arm('right', 'claw')];
    default:
      return [];
  }
}

/** Absolute direction (degrees) of an arm that is held out sideways or pointing. */
export function armDirection(pose, spec) {
  if (spec.kind === 'point') return typeof pose.gaze === 'number' ? pose.gaze : pose.heading;
  return sideDirection(pose, spec.side);
}

/** Arms are hidden under water and in figures where they hold the legs (tuck, pike). */
export function canShowArms(pose) {
  return pose.body !== 'tuck' && pose.body !== 'pike' && pose.depth < 0.5;
}

/** Depth of the pool floor at x (the floor slopes from the left end to the right end). */
export function floorDepth(pool, x) {
  const t = Math.min(1, Math.max(0, (x + pool.length / 2) / pool.length));
  return pool.depthLeft + (pool.depthRight - pool.depthLeft) * t;
}

/** Deepest first, lifted swimmers (on someone's shoulders) last. */
export function drawingOrder(swimmers) {
  const level = (pose) => pose.elevation - pose.depth;
  return [...swimmers].sort((a, b) => level(a.pose) - level(b.pose));
}
