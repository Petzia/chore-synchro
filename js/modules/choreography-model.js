// Turns the choreography data file into something the player can animate:
// - every step gets a start beat and the full pose of each swimmer;
// - every swimmer gets one "track" per pose field, made of timed segments
//   (from value → to value between two beats).
// A field only moves when a step changes it, so a step that only turns the
// heads does not interrupt a swimmer who is still travelling.

import { countToBeat } from './counts.js';
import { angleBetween, normalizeAngle, shortestDelta } from './angles.js';

export const BODY_LABELS = {
  standing: 'debout',
  sitting: 'assis',
  vertical: 'vertical',
  back: 'dos',
  front: 'ventre',
  tuck: 'groupé',
  pike: 'carpé',
};

export const BODIES = Object.keys(BODY_LABELS);

export const IMPOSED_FIGURES = {
  wheel: 'Roue',
  flamingo: 'Flamant',
  oyster: 'Huître',
  balletLeg: 'Jambe de ballet',
  backSomersault: 'Salto arrière groupé',
};

export const INTENSITIES = { low: 'Faible', medium: 'Moyen', high: 'Fort' };

export const PHASES = { poolside: 'Bord', water: 'Eau' };

// Arm positions. 'down' = both arms in the water (sculling), nothing to show.
// Left / right are the swimmer's own sides. 'point' points in the gaze direction.
export const ARM_LABELS = {
  down: 'bras dans l\'eau',
  rightUp: 'bras droit levé',
  leftUp: 'bras gauche levé',
  bothUp: 'deux bras levés',
  rightSide: 'bras droit sur le côté',
  leftSide: 'bras gauche sur le côté',
  point: 'bras tendu (pointe)',
  wave: 'main qui ondule',
  claw: 'main griffe',
};

export const GAZE_KEYWORDS = ['up', 'down', 'judges', 'ahead', 'left', 'right', 'center'];

export const DEFAULT_TRANSITION = 4;

const DEFAULT_POSE = { body: 'back', legs: 0, depth: 0, lift: 0, pitch: 0, elevation: 0, arms: 'down', gazeTarget: 'up' };

// How each field is interpolated.
const FIELD_KINDS = {
  x: 'number',
  y: 'number',
  heading: 'number',
  legs: 'number',
  depth: 'number',
  lift: 'number',
  pitch: 'number',
  elevation: 'number',
  gaze: 'angle',
  body: 'discrete',
  arms: 'discrete',
};

export const POSE_FIELDS = Object.keys(FIELD_KINDS);

/** Converts 'deck' / 'edge' / 'wall' to metres for the given pool width. */
export function resolveY(y, pool) {
  const half = pool.width / 2;
  if (typeof y === 'number') return y;
  if (y === 'deck') return -half - 1.4;
  if (y === 'edge') return -half - 0.35;
  if (y === 'wall') return -half + 0.8;
  throw new Error(`Unknown y position "${y}"`);
}

/**
 * @param {object} choreography the data from js/data/choreography.js
 * @param {{length: number, width: number}} pool
 */
export function resolveChoreography(choreography, pool) {
  const ids = choreography.team.map((swimmer) => swimmer.id);
  const toBeat = (label) => countToBeat(label, choreography.poolsideEights);
  const tracks = Object.fromEntries(ids.map((id) => [id, {}]));
  let previous = null;

  const steps = choreography.steps.map((step, index) => {
    const startBeat = toBeat(step.at);
    const poses = resolvePoses(step, previous, ids, pool);
    const delays = Object.fromEntries(ids.map((id) => [id, step.delays?.[id] ?? 0]));

    for (const id of ids) {
      const start = startBeat + delays[id];
      const transition = step.swimmers?.[id]?.transition ?? step.transition ?? DEFAULT_TRANSITION;
      for (const field of POSE_FIELDS) {
        const to = poses[id][field];
        if (!previous) {
          tracks[id][field] = { initial: to, segments: [] };
          continue;
        }
        const from = previous[id][field];
        if (from === to) continue;
        const end = FIELD_KINDS[field] === 'discrete' ? start : start + transition;
        tracks[id][field].segments.push({ from, to, start, end, kind: FIELD_KINDS[field], stepIndex: index });
      }
    }

    previous = poses;
    return { ...step, index, startBeat, poses, delays };
  });

  for (const fields of Object.values(tracks)) {
    for (const track of Object.values(fields)) track.segments.sort((a, b) => a.start - b.start);
  }

  steps.forEach((step, index) => {
    step.endBeat = index + 1 < steps.length ? steps[index + 1].startBeat : toBeat(choreography.end);
  });

  return { ids, steps, tracks, endBeat: toBeat(choreography.end) };
}

function resolvePoses(step, previous, ids, pool) {
  const poses = {};
  for (const id of ids) {
    const before = previous?.[id] ?? DEFAULT_POSE;
    const wanted = { ...step.pose, ...step.place?.[id], ...step.swimmers?.[id] };
    const pose = { ...before };

    for (const field of ['x', 'body', 'legs', 'depth', 'lift', 'elevation', 'arms']) {
      if (wanted[field] !== undefined) pose[field] = wanted[field];
    }
    if (wanted.y !== undefined) pose.y = resolveY(wanted.y, pool);
    if (wanted.heading !== undefined) {
      pose.heading = before.heading === undefined
        ? wanted.heading
        : before.heading + shortestDelta(before.heading, wanted.heading);
    }
    // spin = full turns in the water plane (the wheel), flip = backward rolls (somersault).
    pose.heading += 360 * (wanted.spin ?? step.spin ?? 0);
    pose.pitch += 360 * (wanted.flip ?? step.flip ?? 0);
    if (wanted.gaze !== undefined) pose.gazeTarget = wanted.gaze;
    poses[id] = pose;
  }
  // Gaze needs everybody's final position (e.g. "look at E", "look at the centre").
  for (const id of ids) {
    poses[id].gaze = resolveGaze(poses[id], poses);
  }
  return poses;
}

/** Absolute direction of the swimmer's own right or left side. */
export function sideDirection(pose, side) {
  // Lying on the back mirrors left and right compared to standing or lying face down.
  const rightTurn = pose.body === 'back' ? -90 : 90;
  return normalizeAngle(pose.heading + (side === 'right' ? rightTurn : -rightTurn));
}

/**
 * Turns a gaze keyword into an absolute direction, or keeps 'up' / 'down'.
 * 'up' = looking at the ceiling, 'down' = face in the water.
 */
export function resolveGaze(pose, poses) {
  const target = pose.gazeTarget;
  if (typeof target === 'number') return normalizeAngle(target);
  if (target === 'up' || target === 'down') return target;
  if (target === 'judges') return 90;
  if (target === 'ahead') return normalizeAngle(pose.heading);
  if (target === 'left' || target === 'right') return sideDirection(pose, target);
  if (target === 'center') {
    const all = Object.values(poses);
    const centre = {
      x: all.reduce((sum, p) => sum + p.x, 0) / all.length,
      y: all.reduce((sum, p) => sum + p.y, 0) / all.length,
    };
    return angleBetween(pose, centre);
  }
  if (poses[target]) return angleBetween(pose, poses[target]);
  throw new Error(`Unknown gaze "${target}"`);
}

/** Index of the step that is active at `beat` (-1 before the first step). */
export function findStepIndex(steps, beat) {
  let low = 0;
  let high = steps.length - 1;
  let found = -1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    if (steps[middle].startBeat <= beat) {
      found = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return found;
}
