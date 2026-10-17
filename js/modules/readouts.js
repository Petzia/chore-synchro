// Exam timer, 8-count display and current step, updated on every frame.

import { BEATS_PER_EIGHT, beatToCount, formatTime } from './counts.js';
import { MIN_WATER_SECONDS } from './validation.js';
import { BODY_LABELS } from './choreography-model.js';

const WARNING_FROM_SECONDS = MIN_WATER_SECONDS - 15;

/** Short description of a pose: "dos · jambe ↑ · sous l'eau". */
export function poseLabel(pose) {
  const parts = [BODY_LABELS[pose.body]];
  if (pose.lift > 0.75) parts.push('jambe ↑');
  else if (pose.lift > 0.2) parts.push('genou ↑');
  if (pose.depth >= 0.5) parts.push('sous l\'eau');
  return parts.join(' · ');
}

/** State of the exam timer: on the deck, running, near 2:00, 2:00 reached, routine over. */
export function chronoState(examSeconds, waterSeconds) {
  if (examSeconds < 0) return { state: 'poolside', status: 'Au bord du bassin' };
  if (examSeconds >= waterSeconds) return { state: 'finished', status: 'Chorégraphie terminée' };
  if (examSeconds >= MIN_WATER_SECONDS) return { state: 'ok', status: '2:00 atteint ✓ – on peut finir' };
  if (examSeconds >= WARNING_FROM_SECONDS) return { state: 'warning', status: 'Pas encore 2:00 : ne pas finir !' };
  return { state: 'running', status: 'Dans l\'eau' };
}

export function createReadouts(doc) {
  const chrono = doc.getElementById('chrono');
  const chronoTime = doc.getElementById('chrono-time');
  const chronoStatus = doc.getElementById('chrono-status');
  const countValue = doc.getElementById('count-value');
  const currentElement = doc.getElementById('current-element');
  const currentHead = doc.getElementById('current-head');
  const songTime = doc.getElementById('song-time');
  const dotsContainer = doc.getElementById('beat-dots');
  const statusList = doc.getElementById('swimmer-status');
  let statusText = '';
  const dots = Array.from({ length: BEATS_PER_EIGHT }, () => doc.createElement('span'));
  dotsContainer.replaceChildren(...dots);

  return {
    update({ time, beat, examSeconds, waterSeconds, poolsideEights, step, swimmers }) {
      songTime.value = formatTime(time, { tenths: true });

      const { state, status } = chronoState(examSeconds, waterSeconds);
      chrono.dataset.state = state;
      chronoTime.textContent = examSeconds < 0 ? formatTime(examSeconds) : formatTime(examSeconds, { tenths: true });
      chronoStatus.textContent = status;

      const count = beatToCount(beat, poolsideEights);
      const started = count.eight >= 1;
      countValue.textContent = started ? `${count.poolside ? 'P' : ''}${count.eight} · ${count.count}` : '—';
      dots.forEach((dot, index) => dot.classList.toggle('on', started && index < count.count));

      currentElement.textContent = step ? step.element : 'Avant le début';
      currentHead.textContent = step?.head ? `Tête : ${step.head}` : '';

      const text = swimmers.map((swimmer) => `${swimmer.initials}:${swimmer.color}:${poseLabel(swimmer.pose)}`).join('|');
      if (text !== statusText) {
        statusText = text;
        statusList.replaceChildren(...swimmers.map((swimmer) => statusChip(doc, swimmer)));
      }
    },
  };
}

function statusChip(doc, swimmer) {
  const chip = doc.createElement('li');
  chip.style.setProperty('--swatch', swimmer.color);
  const name = doc.createElement('strong');
  name.textContent = swimmer.initials;
  chip.append(name, ` ${poseLabel(swimmer.pose)}`);
  if (swimmer.pose.depth >= 0.5) chip.className = 'underwater';
  return chip;
}
