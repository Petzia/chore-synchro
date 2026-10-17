// Checks the choreography data file and reports problems in plain French,
// so the team can edit js/data/choreography.js safely.

import { countToBeat, secondsPerBeat } from './counts.js';
import {
  BODIES,
  GAZE_KEYWORDS,
  IMPOSED_FIGURES,
  INTENSITIES,
  PHASES,
  POSE_FIELDS,
  resolveChoreography,
} from './choreography-model.js';
import { valueAt } from './interpolation.js';

export const TEAM_SIZE = 5;
export const MIN_WATER_SECONDS = 120;
export const MAX_APNEA_SECONDS = 8;
export const MIN_BREATH_GAP_SECONDS = 8;
const UNDERWATER_DEPTH = 0.5;
const SAMPLES_PER_BEAT = 4;
const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const Y_KEYWORDS = ['deck', 'edge', 'wall'];

/**
 * @param {object} choreography
 * @param {{pool: {length: number, width: number}, bpm: number}} options
 * @returns {{errors: string[], warnings: string[], model: object|null, summary: object|null}}
 */
export function validateChoreography(choreography, { pool, bpm }) {
  const errors = checkStructure(choreography);
  if (errors.length > 0) return { errors, warnings: [], model: null, summary: null };

  let model;
  try {
    model = resolveChoreography(choreography, pool);
  } catch (error) {
    return { errors: [error.message], warnings: [], model: null, summary: null };
  }

  const warnings = [];
  const seconds = (beats) => beats * secondsPerBeat(bpm);
  const waterSeconds = seconds(model.endBeat);
  const finalSteps = model.steps.filter((step) => step.final);
  const finalPoseSeconds = finalSteps.length === 1 ? seconds(finalSteps[0].startBeat) : null;
  const imposedFound = new Set(model.steps.map((step) => step.imposed).filter(Boolean));
  const missing = Object.keys(IMPOSED_FIGURES).filter((key) => !imposedFound.has(key));

  errors.push(...checkOverlaps(model));
  if (waterSeconds < MIN_WATER_SECONDS) {
    errors.push(`Durée dans l'eau ${waterSeconds.toFixed(1)} s : le minimum est ${MIN_WATER_SECONDS} s.`);
  }
  if (finalSteps.length !== 1) {
    errors.push(`Il faut exactement une étape marquée "final: true" (trouvé : ${finalSteps.length}).`);
  } else if (finalPoseSeconds < MIN_WATER_SECONDS) {
    errors.push(`La pose finale tombe à ${finalPoseSeconds.toFixed(1)} s, avant le minimum de ${MIN_WATER_SECONDS} s.`);
  }
  if (missing.length > 0) {
    errors.push(`Figures imposées manquantes : ${missing.map((key) => IMPOSED_FIGURES[key]).join(', ')}.`);
  }
  warnings.push(...checkPoolBounds(model, pool), ...checkBreathing(model, seconds));

  return {
    errors,
    warnings,
    model,
    summary: { waterSeconds, finalPoseSeconds, imposedFound: [...imposedFound], missing },
  };
}

function checkStructure(choreography) {
  const errors = [];
  const team = choreography?.team;
  if (!Array.isArray(team) || team.length !== TEAM_SIZE) {
    return [`L'équipe doit compter exactement ${TEAM_SIZE} nageurs.`];
  }
  const ids = team.map((swimmer) => swimmer?.id);
  if (ids.some((id) => typeof id !== 'string' || id === '') || new Set(ids).size !== ids.length) {
    return ['Chaque nageur doit avoir un identifiant unique (par ex. "A").'];
  }
  for (const swimmer of team) {
    if (typeof swimmer.initials !== 'string' || swimmer.initials.length === 0) {
      errors.push(`Nageur ${swimmer.id} : initiales manquantes.`);
    }
    if (!HEX_COLOR.test(swimmer.color ?? '')) errors.push(`Nageur ${swimmer.id} : couleur invalide.`);
  }
  if (!Number.isInteger(choreography.poolsideEights) || choreography.poolsideEights < 0) {
    errors.push('"poolsideEights" doit être un nombre entier positif.');
  }
  if (!Array.isArray(choreography.steps) || choreography.steps.length === 0) {
    errors.push('La chorégraphie ne contient aucune étape.');
  }
  if (errors.length > 0) return errors;

  const toBeat = (label) => countToBeat(label, choreography.poolsideEights);
  let previousBeat = -Infinity;
  choreography.steps.forEach((step, index) => {
    const name = `Étape ${index + 1} (${step?.at ?? '?'})`;
    let beat;
    try {
      beat = toBeat(step.at);
    } catch (error) {
      errors.push(`${name} : ${error.message}.`);
      return;
    }
    if (step.spin !== undefined && !Number.isFinite(step.spin)) errors.push(`${name} : "spin" doit être un nombre.`);
    if (step.flip !== undefined && !Number.isFinite(step.flip)) errors.push(`${name} : "flip" doit être un nombre.`);
    if (beat <= previousBeat) errors.push(`${name} : les étapes doivent être dans l'ordre chronologique.`);
    previousBeat = beat;
    errors.push(...checkStep(step, name, beat, ids));
  });

  const first = choreography.steps[0];
  for (const id of ids) {
    const place = first?.place?.[id];
    if (!place || place.x === undefined || place.y === undefined || place.heading === undefined) {
      errors.push(`La première étape doit placer le nageur ${id} (x, y et heading).`);
    }
  }
  const waterStart = choreography.steps.find((step) => step.phase === 'water');
  if (!waterStart || waterStart.at !== '1.1') {
    errors.push('La première étape dans l\'eau doit commencer à "1.1" (entrée dans l\'eau = T0).');
  }
  try {
    if (toBeat(choreography.end) <= previousBeat) errors.push('"end" doit être après la dernière étape.');
  } catch (error) {
    errors.push(`"end" : ${error.message}.`);
  }
  return errors;
}

function checkStep(step, name, beat, ids) {
  const errors = [];
  if (!PHASES[step.phase]) errors.push(`${name} : phase inconnue "${step.phase}".`);
  if (step.phase === 'poolside' && beat >= 0) errors.push(`${name} : une étape au bord doit être avant "1.1".`);
  if (step.phase === 'water' && beat < 0) errors.push(`${name} : une étape dans l'eau ne peut pas être au bord (P).`);
  if (!INTENSITIES[step.intensity]) errors.push(`${name} : intensité inconnue "${step.intensity}".`);
  if (step.imposed !== undefined && !IMPOSED_FIGURES[step.imposed]) {
    errors.push(`${name} : figure imposée inconnue "${step.imposed}".`);
  }
  if (typeof step.element !== 'string' || step.element === '') errors.push(`${name} : "element" manquant.`);
  if (step.transition !== undefined && !isNonNegative(step.transition)) {
    errors.push(`${name} : "transition" doit être un nombre de temps ≥ 0.`);
  }
  for (const [group, entries] of Object.entries({ place: step.place, swimmers: step.swimmers, delays: step.delays })) {
    for (const id of Object.keys(entries ?? {})) {
      if (!ids.includes(id)) errors.push(`${name} : nageur inconnu "${id}" dans "${group}".`);
    }
  }
  for (const [id, delay] of Object.entries(step.delays ?? {})) {
    if (!isNonNegative(delay)) errors.push(`${name} : décalage invalide pour ${id}.`);
  }
  const poses = [
    ['pose', step.pose],
    ...Object.entries(step.place ?? {}).map(([id, place]) => [`place ${id}`, place]),
    ...Object.entries(step.swimmers ?? {}),
  ];
  for (const [label, pose] of poses) {
    errors.push(...checkPose(pose ?? {}, `${name} [${label}]`, ids));
  }
  return errors;
}

function checkPose(pose, name, ids) {
  const errors = [];
  for (const field of ['x', 'heading', 'spin', 'flip']) {
    if (pose[field] !== undefined && !Number.isFinite(pose[field])) errors.push(`${name} : "${field}" doit être un nombre.`);
  }
  if (pose.y !== undefined && !Number.isFinite(pose.y) && !Y_KEYWORDS.includes(pose.y)) {
    errors.push(`${name} : "y" doit être un nombre ou ${Y_KEYWORDS.join(' / ')}.`);
  }
  if (pose.body !== undefined && !BODIES.includes(pose.body)) errors.push(`${name} : position du corps inconnue "${pose.body}".`);
  for (const field of ['legs', 'depth', 'lift']) {
    if (pose[field] !== undefined && !(pose[field] >= 0 && pose[field] <= 1)) {
      errors.push(`${name} : "${field}" doit être entre 0 et 1.`);
    }
  }
  const gaze = pose.gaze;
  if (gaze !== undefined && typeof gaze !== 'number' && !GAZE_KEYWORDS.includes(gaze) && !ids.includes(gaze)) {
    errors.push(`${name} : regard inconnu "${gaze}".`);
  }
  if (pose.transition !== undefined && !isNonNegative(pose.transition)) {
    errors.push(`${name} : "transition" doit être un nombre de temps ≥ 0.`);
  }
  return errors;
}

/** A field must finish moving before the next change of that same field starts. */
function checkOverlaps(model) {
  const errors = [];
  for (const id of model.ids) {
    for (const field of POSE_FIELDS) {
      const segments = model.tracks[id][field].segments;
      for (let i = 1; i < segments.length; i += 1) {
        if (segments[i].start < segments[i - 1].end) {
          const earlier = model.steps[segments[i - 1].stepIndex];
          const later = model.steps[segments[i].stepIndex];
          errors.push(
            `Nageur ${id} : "${field}" change à l'étape ${later.at} avant la fin du mouvement commencé à ${earlier.at}.`,
          );
        }
      }
    }
  }
  return errors;
}

function checkPoolBounds(model, pool) {
  const warnings = [];
  const maxX = pool.length / 2 - 0.5;
  const maxY = pool.width / 2 - 0.3;
  for (const step of model.steps.filter((s) => s.phase === 'water')) {
    for (const id of model.ids) {
      const { x, y } = step.poses[id];
      if (Math.abs(x) > maxX || Math.abs(y) > maxY) {
        warnings.push(`Étape ${step.at} : ${id} est hors du bassin (${x.toFixed(1)} m ; ${y.toFixed(1)} m).`);
      }
    }
  }
  return warnings;
}

/** Underwater intervals (in beats) of one swimmer, sampled along the depth track. */
export function underwaterIntervals(model, id) {
  const track = model.tracks[id].depth;
  const intervals = [];
  let start = null;
  const firstBeat = model.steps[0].startBeat;
  for (let i = firstBeat * SAMPLES_PER_BEAT; i <= model.endBeat * SAMPLES_PER_BEAT; i += 1) {
    const beat = i / SAMPLES_PER_BEAT;
    const under = valueAt(track, beat) >= UNDERWATER_DEPTH;
    if (under && start === null) start = beat;
    if (!under && start !== null) {
      intervals.push({ start, end: beat });
      start = null;
    }
  }
  if (start !== null) intervals.push({ start, end: model.endBeat });
  return intervals;
}

function checkBreathing(model, seconds) {
  const warnings = [];
  for (const id of model.ids) {
    const intervals = underwaterIntervals(model, id);
    intervals.forEach((interval, index) => {
      const apnea = seconds(interval.end - interval.start);
      if (apnea > MAX_APNEA_SECONDS) {
        warnings.push(`Nageur ${id} : ${apnea.toFixed(1)} s sous l'eau d'affilée (max conseillé ${MAX_APNEA_SECONDS} s).`);
      }
      const next = intervals[index + 1];
      if (next && seconds(next.start - interval.end) < MIN_BREATH_GAP_SECONDS) {
        warnings.push(`Nageur ${id} : moins de ${MIN_BREATH_GAP_SECONDS} s pour respirer entre deux passages sous l'eau.`);
      }
    });
  }
  return warnings;
}

function isNonNegative(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}
