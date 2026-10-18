import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  armDirection,
  armSpecs,
  canShowArms,
  drawingOrder,
  floorDepth,
} from '../js/modules/figure-geometry.js';

test('arm keywords give the arms to draw', () => {
  assert.deepEqual(armSpecs({ arms: 'down' }, 0), []);
  assert.equal(armSpecs({ arms: 'bothUp' }, 0).length, 2);
  assert.equal(armSpecs({ arms: 'leftSide' }, 0)[0].side, 'left');
});

test('a waving hand reaches one side every two beats', () => {
  assert.ok(Math.abs(armSpecs({ arms: 'wave' }, 0)[0].sway) < 1e-9);
  assert.equal(armSpecs({ arms: 'wave' }, 0.5)[0].sway, 1);
});

test('pointing follows the gaze, side arms follow the body', () => {
  const upright = { body: 'vertical', heading: 0, gaze: 90 };
  assert.equal(armDirection(upright, { kind: 'point', side: 'right' }), 90);
  assert.equal(armDirection(upright, { kind: 'side', side: 'left' }), 270);
  assert.equal(canShowArms({ body: 'pike', depth: 0 }), false);
  assert.equal(canShowArms({ body: 'vertical', depth: 1 }), false);
});

test('on the back, the right arm is mirrored', () => {
  const lying = { body: 'back', heading: 270, gaze: 'up' };
  assert.equal(armDirection(lying, { kind: 'side', side: 'right' }), 180);
});

test('the pool floor slopes from the left depth to the right depth', () => {
  const pool = { length: 25, depthLeft: 2, depthRight: 1.4 };
  assert.equal(floorDepth(pool, -12.5), 2);
  assert.equal(floorDepth(pool, 12.5), 1.4);
  assert.ok(Math.abs(floorDepth(pool, 0) - 1.7) < 1e-9);
  assert.equal(floorDepth(pool, 40), 1.4);
});

test('lifted swimmers are drawn last, sunk swimmers first', () => {
  const pose = (depth, elevation) => ({ depth, elevation });
  const order = drawingOrder([
    { id: 'lifted', pose: pose(0, 1) },
    { id: 'surface', pose: pose(0, 0) },
    { id: 'sunk', pose: pose(1, 0) },
  ]).map((swimmer) => swimmer.id);
  assert.deepEqual(order, ['sunk', 'surface', 'lifted']);
});
