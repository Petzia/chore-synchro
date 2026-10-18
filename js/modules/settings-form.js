// The "Réglages" form: tempo, T0, pool size and each swimmer's initials and colour.
// Invalid values are flagged and never applied.

import { LIMITS, isValidInitials } from './settings.js';

const NUMBER_FIELDS = {
  t0: 't0',
  bpm: 'bpm',
  'pool-length': 'poolLength',
  'pool-width': 'poolWidth',
  'depth-left': 'depthLeft',
  'depth-right': 'depthRight',
};

/**
 * @param {Document} doc
 * @param {Array<{id: string, role: string}>} team
 * @param {(changes: object) => void} onChange
 */
export function createSettingsForm(doc, team, onChange) {
  const swimmerContainer = doc.getElementById('swimmer-fields');
  swimmerContainer.replaceChildren(...team.map(swimmerRow));

  for (const [elementId, key] of Object.entries(NUMBER_FIELDS)) {
    const input = doc.getElementById(elementId);
    input.addEventListener('change', () => {
      const value = Number(input.value);
      const [min, max] = LIMITS[key];
      const valid = input.value !== '' && Number.isFinite(value) && value >= min && value <= max;
      input.setAttribute('aria-invalid', String(!valid));
      if (valid) onChange({ [key]: value });
    });
  }

  swimmerContainer.addEventListener('change', (event) => {
    const input = event.target;
    const id = input.dataset.swimmer;
    if (!id) return;
    if (input.type === 'color') {
      onChange({ swimmer: { id, color: input.value } });
      return;
    }
    const initials = input.value.trim().toUpperCase();
    const valid = isValidInitials(initials);
    input.setAttribute('aria-invalid', String(!valid));
    if (valid) onChange({ swimmer: { id, initials } });
  });

  return {
    /** Shows the current settings in the form. */
    fill(settings) {
      doc.getElementById('t0').value = settings.t0.toFixed(2);
      doc.getElementById('bpm').value = String(settings.bpm);
      doc.getElementById('pool-length').value = String(settings.poolLength);
      doc.getElementById('pool-width').value = String(settings.poolWidth);
      doc.getElementById('depth-left').value = String(settings.depthLeft);
      doc.getElementById('depth-right').value = String(settings.depthRight);
      for (const input of swimmerContainer.querySelectorAll('input')) {
        const swimmer = settings.swimmers[input.dataset.swimmer];
        input.value = input.type === 'color' ? swimmer.color : swimmer.initials;
        input.removeAttribute('aria-invalid');
      }
      for (const elementId of Object.keys(NUMBER_FIELDS)) {
        doc.getElementById(elementId).removeAttribute('aria-invalid');
      }
    },
  };

  function swimmerRow({ id, role }) {
    const row = doc.createElement('div');
    row.className = 'swimmer-field';

    const color = doc.createElement('input');
    color.type = 'color';
    color.dataset.swimmer = id;
    color.setAttribute('aria-label', `Couleur du nageur ${id}`);

    const initials = doc.createElement('input');
    initials.type = 'text';
    initials.maxLength = 3;
    initials.autocomplete = 'off';
    initials.dataset.swimmer = id;
    initials.setAttribute('aria-label', `Initiales du nageur ${id} (1 à 3 lettres)`);

    const label = doc.createElement('span');
    label.textContent = `${id} – ${role}`;

    row.append(color, initials, label);
    return row;
  }
}
