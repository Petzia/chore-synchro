import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addTap, bpmFromTaps, TAP_RESET_MS } from '../js/modules/tap-tempo.js';
import { defaultSettings, sanitizeSettings } from '../js/modules/settings.js';
import { choreography } from '../js/data/choreography.js';

test('tapping every 600 ms gives 100 BPM', () => {
  let taps = [];
  for (let i = 0; i < 5; i += 1) taps = addTap(taps, 1000 + i * 600);
  assert.equal(bpmFromTaps(taps), 100);
});

test('a long pause starts a new tap series', () => {
  const taps = addTap([0, 600, 1200], 1200 + TAP_RESET_MS + 1);
  assert.equal(taps.length, 1);
  assert.equal(bpmFromTaps(taps), null);
});

test('stored settings are validated', () => {
  const defaults = defaultSettings(choreography);
  const settings = sanitizeSettings(
    {
      bpm: 'abc',
      t0: 25,
      poolLength: 1000,
      speed: 0.75,
      focus: 'Z',
      swimmers: { A: { initials: '<b>', color: 'red' }, B: { initials: 'Jul', color: '#00ff00' } },
    },
    defaults,
  );
  assert.equal(settings.bpm, defaults.bpm);
  assert.equal(settings.t0, 25);
  assert.equal(settings.poolLength, defaults.poolLength);
  assert.equal(settings.speed, 0.75);
  assert.equal(settings.focus, '');
  assert.deepEqual(settings.swimmers.A, defaults.swimmers.A);
  assert.deepEqual(settings.swimmers.B, { initials: 'Jul', color: '#00ff00' });
});

test('garbage in storage falls back to defaults', () => {
  const defaults = defaultSettings(choreography);
  assert.deepEqual(sanitizeSettings(null, defaults), defaults);
  assert.deepEqual(sanitizeSettings('oops', defaults), defaults);
});

test('old stored settings without pool depths keep the default depths', () => {
  const defaults = defaultSettings(choreography);
  const settings = sanitizeSettings({ bpm: 98, depthLeft: 99 }, defaults);
  assert.equal(settings.bpm, 98);
  assert.equal(settings.depthLeft, defaults.depthLeft);
  assert.equal(settings.depthRight, defaults.depthRight);
});
