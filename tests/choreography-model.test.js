import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findStepIndex, resolveChoreography, resolveGaze } from '../js/modules/choreography-model.js';
import { makeChoreography } from './helpers.js';

const POOL = { length: 25, width: 12.5 };

test('findStepIndex returns the step active at a beat', () => {
  const steps = [{ startBeat: -8 }, { startBeat: 0 }, { startBeat: 16 }];
  assert.equal(findStepIndex(steps, -20), -1);
  assert.equal(findStepIndex(steps, -8), 0);
  assert.equal(findStepIndex(steps, -0.1), 0);
  assert.equal(findStepIndex(steps, 0), 1);
  assert.equal(findStepIndex(steps, 15.9), 1);
  assert.equal(findStepIndex(steps, 400), 2);
});

test('poses carry over from one step to the next', () => {
  const model = resolveChoreography(makeChoreography(), POOL);
  const last = model.steps.at(-1).poses.C;
  assert.equal(last.x, 2.4);
  assert.equal(last.body, 'back');
  assert.equal(last.legs, 1);
});

test('"deck" is placed outside the pool, on the far side', () => {
  const model = resolveChoreography(makeChoreography(), POOL);
  assert.ok(model.steps[0].poses.A.y < -POOL.width / 2);
});

test('gaze keywords become directions', () => {
  const back = { body: 'back', heading: 270, x: 0, y: 0 };
  const upright = { body: 'vertical', heading: 0, x: 0, y: 0 };
  assert.equal(resolveGaze({ ...back, gazeTarget: 'judges' }, {}), 90);
  assert.equal(resolveGaze({ ...back, gazeTarget: 'up' }, {}), 'up');
  assert.equal(resolveGaze({ ...upright, gazeTarget: 'right' }, {}), 90, 'facing right → right hand towards the judges');
  assert.equal(resolveGaze({ ...back, gazeTarget: 'right' }, {}), 180, 'lying on the back mirrors sides');
  assert.equal(resolveGaze({ ...upright, gazeTarget: 'B' }, { B: { x: 0, y: -3 } }), 270);
});

test('a step that only turns heads does not stop a swimmer who is travelling', () => {
  const choreography = makeChoreography();
  choreography.steps[2].place = { A: { x: -6, y: 0, heading: 90 } };
  choreography.steps[2].transition = 16;
  choreography.steps.splice(3, 0, { ...choreography.steps[3], at: '4.1', imposed: undefined, pose: { gaze: 'left' } });
  const model = resolveChoreography(choreography, POOL);
  const segments = model.tracks.A.x.segments;
  assert.equal(segments.length, 1, 'x has a single uninterrupted movement');
});
