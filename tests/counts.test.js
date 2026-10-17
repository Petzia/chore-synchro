import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  beatToCount,
  beatToSongTime,
  countToBeat,
  formatTime,
  songTimeToBeat,
} from '../js/modules/counts.js';

const POOLSIDE_EIGHTS = 4;

test('water counts start at beat 0 on "1.1"', () => {
  assert.equal(countToBeat('1.1', POOLSIDE_EIGHTS), 0);
  assert.equal(countToBeat('1.8', POOLSIDE_EIGHTS), 7);
  assert.equal(countToBeat('2.1', POOLSIDE_EIGHTS), 8);
  assert.equal(countToBeat('12.5', POOLSIDE_EIGHTS), 92);
});

test('poolside counts are negative and end right before the water entry', () => {
  assert.equal(countToBeat('P1.1', POOLSIDE_EIGHTS), -32);
  assert.equal(countToBeat('P4.8', POOLSIDE_EIGHTS), -1);
});

test('invalid counts are rejected', () => {
  for (const label of ['0.1', '1.9', '1.0', 'P5.1', 'abc', '']) {
    assert.throws(() => countToBeat(label, POOLSIDE_EIGHTS), /Invalid count/);
  }
});

test('beatToCount is the inverse of countToBeat', () => {
  for (const label of ['P1.1', 'P2.5', 'P4.8', '1.1', '7.3', '28.8']) {
    assert.equal(beatToCount(countToBeat(label, POOLSIDE_EIGHTS), POOLSIDE_EIGHTS).label, label);
  }
  assert.equal(beatToCount(9.7, POOLSIDE_EIGHTS).label, '2.2');
  assert.equal(beatToCount(-0.5, POOLSIDE_EIGHTS).label, 'P4.8');
});

test('song time and beats convert both ways with the tempo and T0', () => {
  const timing = { bpm: 100, t0: 19.46 };
  assert.equal(beatToSongTime(0, timing), 19.46);
  assert.ok(Math.abs(beatToSongTime(200, timing) - 139.46) < 1e-9);
  assert.ok(Math.abs(beatToSongTime(-32, timing) - 0.26) < 1e-9);
  assert.ok(Math.abs(songTimeToBeat(139.46, timing) - 200) < 1e-9);
});

test('formatTime shows minutes and seconds', () => {
  assert.equal(formatTime(0), '0:00');
  assert.equal(formatTime(129.6), '2:09');
  assert.equal(formatTime(129.6, { tenths: true }), '2:09.6');
  assert.equal(formatTime(-4.2), '-0:04');
});
