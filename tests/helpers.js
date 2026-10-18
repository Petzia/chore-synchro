// A tiny but valid choreography for tests: 1 poolside step, 5 water steps.
export function makeChoreography() {
  const ids = ['A', 'B', 'C', 'D', 'E'];
  const lineAt = (y) => Object.fromEntries(ids.map((id, i) => [id, { x: i * 1.2, y, heading: 90 }]));
  const step = (at, extra = {}) => ({
    at,
    phase: 'water',
    intensity: 'medium',
    element: `Step ${at}`,
    ...extra,
  });
  return {
    music: { bpm: 100, t0: 10 },
    pool: { length: 25, width: 12.5, depthLeft: 2, depthRight: 2 },
    poolsideEights: 1,
    end: '27.1',
    team: ids.map((id) => ({ id, initials: id, color: '#123456' })),
    steps: [
      step('P1.1', { phase: 'poolside', intensity: 'low', place: lineAt('deck'), pose: { body: 'standing' } }),
      step('1.1', { place: lineAt(0), pose: { body: 'vertical' }, transition: 2 }),
      step('3.1', { imposed: 'wheel', pose: { body: 'back' } }),
      step('5.1', { imposed: 'flamingo' }),
      step('7.1', { imposed: 'oyster' }),
      step('9.1', { imposed: 'balletLeg' }),
      step('11.1', { imposed: 'backSomersault' }),
      step('26.1', { final: true, pose: { legs: 1 } }),
    ],
  };
}
