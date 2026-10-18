import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateChoreography } from '../js/modules/validation.js';
import { choreography } from '../js/data/choreography.js';
import { makeChoreography } from './helpers.js';

const OPTIONS = { pool: { length: 25, width: 12.5 }, bpm: 100 };

test('the team choreography is valid, without warnings', () => {
  const result = validateChoreography(choreography, { pool: choreography.pool, bpm: choreography.music.bpm });
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(result.summary.missing, []);
});

test('the team choreography lasts at least 2:00 in the water, final pose included', () => {
  const { summary } = validateChoreography(choreography, { pool: choreography.pool, bpm: choreography.music.bpm });
  assert.ok(summary.waterSeconds >= 120);
  assert.ok(summary.finalPoseSeconds >= 120);
});

test('every step of the team choreography has a pose for each of the 5 swimmers', () => {
  const { model } = validateChoreography(choreography, { pool: choreography.pool, bpm: choreography.music.bpm });
  for (const step of model.steps) {
    assert.deepEqual(Object.keys(step.poses).sort(), ['A', 'B', 'C', 'D', 'E']);
  }
});

test('the test fixture is valid', () => {
  assert.deepEqual(validateChoreography(makeChoreography(), OPTIONS).errors, []);
});

test('less than 2:00 in the water is an error', () => {
  const short = makeChoreography();
  short.end = '20.1';
  short.steps.at(-1).at = '19.1';
  const { errors } = validateChoreography(short, OPTIONS);
  assert.ok(errors.some((e) => e.includes('minimum')), errors.join('\n'));
});

test('a faster tempo can make the routine too short', () => {
  const { errors } = validateChoreography(makeChoreography(), { ...OPTIONS, bpm: 140 });
  assert.ok(errors.some((e) => e.includes('minimum')));
});

test('the team must have exactly 5 swimmers', () => {
  const four = makeChoreography();
  four.team.pop();
  assert.match(validateChoreography(four, OPTIONS).errors[0], /5 nageurs/);
});

test('the first step must place all 5 swimmers', () => {
  const choreo = makeChoreography();
  delete choreo.steps[0].place.E;
  assert.ok(validateChoreography(choreo, OPTIONS).errors.some((e) => e.includes('nageur E')));
});

test('unknown swimmers in a step are reported', () => {
  const choreo = makeChoreography();
  choreo.steps[2].swimmers = { Z: { gaze: 'up' } };
  assert.ok(validateChoreography(choreo, OPTIONS).errors.some((e) => e.includes('"Z"')));
});

test('missing imposed figures are reported', () => {
  const choreo = makeChoreography();
  delete choreo.steps[4].imposed;
  assert.ok(validateChoreography(choreo, OPTIONS).errors.some((e) => e.includes('Huître')));
});

test('steps out of order and bad counts are reported', () => {
  const choreo = makeChoreography();
  choreo.steps[3].at = '2.1';
  choreo.steps[4].at = '7.9';
  const { errors } = validateChoreography(choreo, OPTIONS);
  assert.ok(errors.some((e) => e.includes('ordre')));
  assert.ok(errors.some((e) => e.includes('Invalid count')));
});

test('a movement that starts before the previous one ends is reported', () => {
  const choreo = makeChoreography();
  choreo.steps[2].pose = { body: 'back', legs: 1 };
  choreo.steps[2].transition = 20;
  choreo.steps[3].pose = { legs: 0 };
  assert.ok(validateChoreography(choreo, OPTIONS).errors.some((e) => e.includes('"legs"')));
});

test('long or close apneas produce breathing warnings', () => {
  const choreo = makeChoreography();
  choreo.steps[4].pose = { depth: 1 };
  choreo.steps[4].transition = 1;
  choreo.steps[5].pose = { depth: 0 };
  choreo.steps[5].transition = 1;
  choreo.steps[6].pose = { depth: 1 };
  choreo.steps[6].transition = 1;
  choreo.steps[7].pose = { depth: 0 };
  const { warnings } = validateChoreography(choreo, OPTIONS);
  assert.ok(warnings.some((w) => w.includes("d'affilée")), warnings.join('\n'));
});

test('positions and rotations must be numbers', () => {
  const choreo = makeChoreography();
  choreo.steps[2].place = { A: { x: '1.2', y: 'roof', heading: 90 } };
  choreo.steps[3].spin = 'once';
  const { errors } = validateChoreography(choreo, OPTIONS);
  assert.ok(errors.some((e) => e.includes('"x"')), errors.join('\n'));
  assert.ok(errors.some((e) => e.includes('"y"')));
  assert.ok(errors.some((e) => e.includes('"spin"')));
});

test('travelling too fast for beginners is a warning', () => {
  const choreo = makeChoreography();
  choreo.steps[2].place = { A: { x: -6, y: 0, heading: 90 } };
  choreo.steps[2].transition = 4;
  const { warnings } = validateChoreography(choreo, OPTIONS);
  assert.ok(warnings.some((w) => w.includes('3.1') && w.includes('A doit parcourir')), warnings.join('\n'));
});

test('unknown arm positions are reported', () => {
  const choreo = makeChoreography();
  choreo.steps[2].pose.arms = 'jazzHands';
  assert.ok(validateChoreography(choreo, OPTIONS).errors.some((e) => e.includes('bras')));
});

test('lifts and jumps are not counted as swimming speed', () => {
  const choreo = makeChoreography();
  choreo.steps[2].place = { E: { x: 0, y: 0, heading: 90 } };
  choreo.steps[2].swimmers = { E: { elevation: 1 } };
  choreo.steps[2].transition = 1;
  const { errors, warnings } = validateChoreography(choreo, OPTIONS);
  assert.deepEqual(errors, []);
  assert.ok(!warnings.some((w) => w.includes('E doit parcourir')), warnings.join('\n'));
});

test('an instant move is reported clearly', () => {
  const choreo = makeChoreography();
  choreo.steps[2].place = { A: { x: -2, y: 0, heading: 90 } };
  choreo.steps[2].transition = 0;
  assert.ok(validateChoreography(choreo, OPTIONS).warnings.some((w) => w.includes('instantanément')));
});

test('elevation and pool depths are checked', () => {
  const high = makeChoreography();
  high.steps[2].pose.elevation = 5;
  assert.ok(validateChoreography(high, OPTIONS).errors.some((e) => e.includes('"elevation"')));
  const noDepth = makeChoreography();
  delete noDepth.pool.depthRight;
  assert.ok(validateChoreography(noDepth, OPTIONS).errors.some((e) => e.includes('pool.depthRight')));
});
