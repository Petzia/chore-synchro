// Conversions between song time (seconds), beats and dance "8-counts".
//
// Beat 0 is the water entry (T0). Poolside beats are negative.
// A count label is "<eight>.<count>": "1.1" is the first beat in the water,
// "P1.1" is the first beat of the poolside part.

export const BEATS_PER_EIGHT = 8;

const COUNT_PATTERN = /^(P?)(\d{1,3})\.([1-8])$/;

/**
 * Converts a count label to a beat index relative to T0.
 * @param {string} label e.g. "12.5" or "P2.1"
 * @param {number} poolsideEights number of 8-counts before the water entry
 * @returns {number}
 */
export function countToBeat(label, poolsideEights) {
  const match = COUNT_PATTERN.exec(String(label).trim());
  if (!match) {
    throw new Error(`Invalid count "${label}" (expected e.g. "12.5" or "P2.1")`);
  }
  const [, poolside, eightText, countText] = match;
  const eight = Number(eightText);
  const count = Number(countText);
  if (eight < 1) throw new Error(`Invalid count "${label}": eights start at 1`);
  if (poolside && eight > poolsideEights) {
    throw new Error(`Invalid count "${label}": only ${poolsideEights} poolside eights`);
  }
  const eightIndex = poolside ? eight - 1 - poolsideEights : eight - 1;
  return eightIndex * BEATS_PER_EIGHT + (count - 1);
}

/**
 * Converts a (possibly fractional) beat index to its 8-count position.
 * @returns {{poolside: boolean, eight: number, count: number, label: string}}
 */
export function beatToCount(beat, poolsideEights) {
  const whole = Math.floor(beat);
  const eightIndex = Math.floor(whole / BEATS_PER_EIGHT);
  const count = whole - eightIndex * BEATS_PER_EIGHT + 1;
  const poolside = eightIndex < 0;
  const eight = poolside ? eightIndex + poolsideEights + 1 : eightIndex + 1;
  const prefix = poolside ? 'P' : '';
  return { poolside, eight, count, label: `${prefix}${eight}.${count}` };
}

export function secondsPerBeat(bpm) {
  return 60 / bpm;
}

/** Song time (seconds) of a beat, given the tempo and the T0 song time. */
export function beatToSongTime(beat, { bpm, t0 }) {
  return t0 + beat * secondsPerBeat(bpm);
}

/**
 * Beat index (fractional) at a given song time.
 * Rounded to a millionth of a beat so that seeking to a step's start time
 * lands exactly on that step (and not on 15.9999999 instead of 16).
 */
export function songTimeToBeat(songTime, { bpm, t0 }) {
  return Math.round(((songTime - t0) / secondsPerBeat(bpm)) * 1e6) / 1e6;
}

/** Formats seconds as m:ss (or -m:ss), with optional tenths. */
export function formatTime(seconds, { tenths = false } = {}) {
  const sign = seconds < 0 ? '-' : '';
  const abs = Math.abs(seconds);
  const precision = tenths ? 10 : 1;
  const rounded = Math.floor(abs * precision + 1e-6) / precision;
  const minutes = Math.floor(rounded / 60);
  const rest = rounded - minutes * 60;
  const secondsText = tenths ? rest.toFixed(1).padStart(4, '0') : String(Math.floor(rest)).padStart(2, '0');
  return `${sign}${minutes}:${secondsText}`;
}
