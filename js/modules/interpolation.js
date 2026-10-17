// Computes where each swimmer is at any (fractional) beat, from the tracks
// built by choreography-model.js.

import { normalizeAngle, shortestDelta } from './angles.js';
import { POSE_FIELDS } from './choreography-model.js';

/** Smooth start and stop, so movements don't look robotic. */
export function easeInOut(t) {
  return t * t * (3 - 2 * t);
}

export function lerp(from, to, t) {
  return from + (to - from) * t;
}

function blend(segment, beat) {
  const progress = easeInOut((beat - segment.start) / (segment.end - segment.start));
  const { from, to } = segment;
  if (segment.kind === 'number') return lerp(from, to, progress);
  if (typeof from === 'number' && typeof to === 'number') {
    return normalizeAngle(from + shortestDelta(from, to) * progress);
  }
  // 'up' / 'down' gaze cannot be blended with a direction: switch half way.
  return progress < 0.5 ? from : to;
}

/** Value of one field track at `beat`. */
export function valueAt(track, beat) {
  let value = track.initial;
  for (const segment of track.segments) {
    if (segment.start > beat) break;
    if (beat >= segment.end) {
      value = segment.to;
    } else {
      return blend(segment, beat);
    }
  }
  return value;
}

/** Full pose of one swimmer at `beat`. */
export function poseAt(model, id, beat) {
  const tracks = model.tracks[id];
  return Object.fromEntries(POSE_FIELDS.map((field) => [field, valueAt(tracks[field], beat)]));
}
