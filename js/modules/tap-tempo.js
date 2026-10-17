// Tap tempo: tap along with the beat, get the BPM.

export const TAP_RESET_MS = 2000;
const MAX_TAPS = 12;

/** Returns the new list of tap timestamps (a long pause starts a new series). */
export function addTap(taps, now) {
  const last = taps.at(-1);
  const kept = last !== undefined && now - last < TAP_RESET_MS ? taps : [];
  return [...kept, now].slice(-MAX_TAPS);
}

/** Average tempo of the taps, rounded to 0.1 BPM (null with fewer than 2 taps). */
export function bpmFromTaps(taps) {
  if (taps.length < 2) return null;
  const span = taps.at(-1) - taps[0];
  if (span <= 0) return null;
  return Math.round(((60000 * (taps.length - 1)) / span) * 10) / 10;
}
