import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chronoState } from '../js/modules/readouts.js';
import { personalNote } from '../js/modules/table-view.js';
import { findStepIndex, resolveChoreography } from '../js/modules/choreography-model.js';
import { poseAt } from '../js/modules/interpolation.js';
import { beatToSongTime, songTimeToBeat } from '../js/modules/counts.js';
import { choreography } from '../js/data/choreography.js';
import { makeChoreography } from './helpers.js';

test('exam timer states around 2:00', () => {
  assert.equal(chronoState(-1, 134.4).state, 'poolside');
  assert.equal(chronoState(104.9, 134.4).state, 'running');
  assert.equal(chronoState(105, 134.4).state, 'warning');
  assert.equal(chronoState(120, 134.4).state, 'ok');
  assert.equal(chronoState(134.4, 134.4).state, 'finished');
});

test('seeking to a step start lands on that step, whatever the tempo', () => {
  const model = resolveChoreography(choreography, choreography.pool);
  for (const timing of [{ bpm: 100, t0: 19.46 }, { bpm: 100.3, t0: 19.46 }, { bpm: 97, t0: 3.21 }]) {
    model.steps.forEach((step, index) => {
      const beat = songTimeToBeat(beatToSongTime(step.startBeat, timing), timing);
      assert.equal(findStepIndex(model.steps, beat), index, `step ${step.at} at ${timing.bpm} BPM`);
    });
  }
});

test('personal note shows body, gaze target and delay', () => {
  const model = resolveChoreography(choreography, choreography.pool);
  const team = choreography.team.map((swimmer) => ({ ...swimmer, initials: `${swimmer.id}x` }));
  const lookAtMary = model.steps.find((step) => step.at === 'P3.1');
  assert.equal(personalNote(lookAtMary, team[0], team), 'debout · regard vers Ex · bras tendu (pointe)');
  const cascade = model.steps.find((step) => step.at === '17.1');
  assert.match(personalNote(cascade, team[4], team), /carpé · regard : visage dans l'eau · départ \+8 temps/);
});

test('a per-swimmer spin override turns the other way', () => {
  const choreo = makeChoreography();
  choreo.steps[2].spin = 1;
  choreo.steps[2].swimmers = { E: { spin: -1 } };
  const model = resolveChoreography(choreo, { length: 25, width: 12.5 });
  const end = model.steps[2].startBeat + 4;
  assert.equal(poseAt(model, 'A', end).heading, 90 + 360);
  assert.equal(poseAt(model, 'E', end).heading, 90 - 360);
});

test('everyone waves a hand on each "hands" of the chorus', () => {
  const model = resolveChoreography(choreography, choreography.pool);
  for (const label of ['5.5', '7.5', '19.5', '21.5']) {
    const step = model.steps.find((candidate) => candidate.at === label);
    assert.ok(step, `step ${label} exists`);
    for (const id of model.ids) assert.equal(step.poses[id].arms, 'wave', `${id} at ${label}`);
  }
});
