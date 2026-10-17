// The choreography table: one row per step, synced with the music.
// All text goes through textContent (never innerHTML).

import { beatToCount, beatToSongTime, formatTime, secondsPerBeat } from './counts.js';
import { BODY_LABELS, IMPOSED_FIGURES, INTENSITIES, PHASES } from './choreography-model.js';

const COLUMNS = [
  'Chanson',
  'Chrono',
  'Huit · temps',
  'Phase',
  'Élément',
  'Formation / déplacement',
  'Tête et regard',
  'Effort',
  'Fil rouge',
  'Remarques',
];

const GAZE_LABELS = {
  up: 'plafond',
  down: 'visage dans l\'eau',
  judges: 'jury',
  ahead: 'devant soi',
  left: 'tête à gauche',
  right: 'tête à droite',
  center: 'centre',
};

/**
 * @param {HTMLTableElement} table
 * @param {(songTime: number) => void} onSeek
 */
export function createTableView(table, scrollContainer, onSeek) {
  const thead = table.tHead;
  const tbody = table.tBodies[0];
  let rows = [];
  let currentIndex = -1;

  tbody.addEventListener('click', (event) => {
    const row = event.target.closest('tr[data-time]');
    if (row) onSeek(Number(row.dataset.time));
  });

  return {
    /** Rebuilds the table (tempo, T0, initials or focus changed). */
    render({ model, timing, poolsideEights, team, focus }) {
      const focusSwimmer = team.find((swimmer) => swimmer.id === focus);
      thead.replaceChildren(headerRow(focusSwimmer));
      rows = model.steps.map((step) => stepRow(step, { timing, poolsideEights, team, focusSwimmer }));
      tbody.replaceChildren(...rows);
      currentIndex = -1;
    },

    /** Highlights the current step; scrolls the table (not the page) to keep it visible. */
    highlight(index, follow) {
      if (index === currentIndex) return;
      rows[currentIndex]?.removeAttribute('aria-current');
      currentIndex = index;
      const row = rows[index];
      if (!row) return;
      row.setAttribute('aria-current', 'step');
      if (follow) {
        const header = thead.offsetHeight;
        const top = row.offsetTop - header;
        const bottom = row.offsetTop + row.offsetHeight;
        const view = scrollContainer;
        if (top < view.scrollTop || bottom > view.scrollTop + view.clientHeight) {
          view.scrollTop = Math.max(0, top - view.clientHeight / 3);
        }
      }
    },
  };
}

function headerRow(focusSwimmer) {
  const row = document.createElement('tr');
  const titles = focusSwimmer ? [...COLUMNS, `Pour ${focusSwimmer.initials}`] : COLUMNS;
  for (const title of titles) {
    const th = document.createElement('th');
    th.scope = 'col';
    th.textContent = title;
    row.append(th);
  }
  return row;
}

function stepRow(step, { timing, poolsideEights, team, focusSwimmer }) {
  const songTime = beatToSongTime(step.startBeat, timing);
  const examTime = step.startBeat * secondsPerBeat(timing.bpm);
  const count = beatToCount(step.startBeat, poolsideEights);
  const row = document.createElement('tr');
  row.dataset.time = String(songTime);
  row.className = `phase-${step.phase}`;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'time-button';
  button.textContent = formatTime(songTime, { tenths: true });
  button.setAttribute('aria-label', `Aller à ${formatTime(songTime)} : ${step.element}`);

  const element = document.createElement('td');
  element.append(text('strong', step.element));
  if (step.imposed) element.append(document.createElement('br'), badge(`Imposée : ${IMPOSED_FIGURES[step.imposed]}`));
  if (step.final) element.append(document.createElement('br'), badge('Pose finale', 'final-badge'));

  const intensity = cell(INTENSITIES[step.intensity]);
  intensity.firstChild.className = `intensity intensity-${step.intensity}`;

  row.append(
    cell(button, 'nowrap'),
    cell(step.phase === 'water' ? formatTime(examTime, { tenths: true }) : '—', 'nowrap'),
    cell(`${count.poolside ? 'P' : ''}${count.eight} · ${count.count}`, 'nowrap'),
    cell(PHASES[step.phase]),
    element,
    cell(step.formation ?? ''),
    cell(step.head ?? ''),
    intensity,
    cell(step.story ?? ''),
    cell(step.notes ?? ''),
  );
  if (focusSwimmer) row.append(cell(personalNote(step, focusSwimmer, team), 'focus-col'));
  return row;
}

/** What this step means for one swimmer: body, gaze and their own delay. */
export function personalNote(step, swimmer, team) {
  const pose = step.poses[swimmer.id];
  const parts = [BODY_LABELS[pose.body]];
  const target = pose.gazeTarget;
  const lookedAt = team.find((member) => member.id === target);
  if (lookedAt) parts.push(`regard vers ${lookedAt.initials}`);
  else if (typeof target === 'number') parts.push(`regard ${Math.round(target)}°`);
  else parts.push(`regard : ${GAZE_LABELS[target]}`);
  const delay = step.delays[swimmer.id];
  if (delay > 0) parts.push(`départ +${delay} temps`);
  const note = step.swimmers?.[swimmer.id]?.note;
  if (note) parts.push(note);
  return parts.join(' · ');
}

function cell(content, className) {
  const td = document.createElement('td');
  if (className) td.className = className;
  if (typeof content === 'string') td.append(text('span', content));
  else td.append(content);
  return td;
}

function text(tag, content) {
  const element = document.createElement(tag);
  element.textContent = content;
  return element;
}

function badge(label, extraClass = '') {
  const span = text('span', label);
  span.className = `badge ${extraClass}`.trim();
  return span;
}
