import { test } from 'node:test';
import assert from 'node:assert/strict';
import { easeInOut, poseAt, valueAt } from '../js/modules/interpolation.js';
import { resolveChoreography } from '../js/modules/choreography-model.js';
import { makeChoreography } from './helpers.js';

test('easing starts at 0, ends at 1 and passes through the middle', () => {
  assert.equal(easeInOut(0), 0);
  assert.equal(easeInOut(0.5), 0.5);
  assert.equal(easeInOut(1), 1);
});

test('a numeric track holds, moves, then holds again', () => {
  const track = { initial: 0, segments: [{ from: 0, to: 4, start: 8, end: 12, kind: 'number' }] };
  assert.equal(valueAt(track, 0), 0);
  assert.equal(valueAt(track, 8), 0);
  assert.equal(valueAt(track, 10), 2);
  assert.equal(valueAt(track, 12), 4);
  assert.equal(valueAt(track, 50), 4);
});

test('angles take the shortest way round', () => {
  const track = { initial: 350, segments: [{ from: 350, to: 10, start: 0, end: 2, kind: 'angle' }] };
  assert.equal(valueAt(track, 1), 0);
});

test('"up" / "down" gaze switches half way through the transition', () => {
  const track = { initial: 'up', segments: [{ from: 'up', to: 90, start: 0, end: 2, kind: 'angle' }] };
  assert.equal(valueAt(track, 0.9), 'up');
  assert.equal(valueAt(track, 1.1), 90);
});

test('positions are interpolated between keyframes, with per-swimmer delays', () => {
  const choreography = makeChoreography();
  choreography.steps[1].place = { A: { x: 4, y: 0, heading: 90 } };
  choreography.steps[1].transition = 4;
  choreography.steps[1].delays = { A: 2 };
  const model = resolveChoreography(choreography, { length: 25, width: 12.5 });
  const start = model.steps[1].startBeat;

  assert.equal(poseAt(model, 'A', start + 1).x, 0, 'A has not started yet (delay)');
  assert.equal(poseAt(model, 'A', start + 4).x, 2, 'half way');
  assert.equal(poseAt(model, 'A', start + 6).x, 4, 'arrived');
  assert.equal(poseAt(model, 'B', start + 4).x, 1.2, 'B does not move');
});

test('the wheel turns a full circle instead of staying still', () => {
  const choreography = makeChoreography();
  choreography.steps[1].spin = 1;
  choreography.steps[1].transition = 8;
  const model = resolveChoreography(choreography, { length: 25, width: 12.5 });
  const start = model.steps[1].startBeat;
  assert.equal(poseAt(model, 'A', start + 4).heading, 90 + 180);
  assert.equal(poseAt(model, 'A', start + 8).heading, 90 + 360);
});
