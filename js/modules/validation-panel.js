// Shows the result of the choreography check (errors, warnings, summary).

import { formatTime } from './counts.js';
import { IMPOSED_FIGURES } from './choreography-model.js';
import { MIN_WATER_SECONDS } from './validation.js';

export function renderValidation(container, result) {
  const doc = container.ownerDocument;
  const parts = [];

  if (result.summary) {
    const { waterSeconds, finalPoseSeconds, imposedFound } = result.summary;
    const total = Object.keys(IMPOSED_FIGURES).length;
    parts.push(
      paragraph(doc, `Dans l'eau : ${formatTime(waterSeconds, { tenths: true })} (minimum ${formatTime(MIN_WATER_SECONDS)})`),
      paragraph(doc, `Pose finale à ${finalPoseSeconds === null ? '?' : formatTime(finalPoseSeconds, { tenths: true })} au chrono`),
      paragraph(doc, `Figures imposées : ${imposedFound.length}/${total}`),
    );
  }
  if (result.errors.length === 0 && result.warnings.length === 0) {
    parts.push(paragraph(doc, '✓ Aucun problème détecté.', 'validation-ok'));
  }
  if (result.errors.length > 0) parts.push(list(doc, 'Erreurs', result.errors, 'validation-error'));
  if (result.warnings.length > 0) parts.push(list(doc, 'Avertissements', result.warnings, 'validation-warning'));

  container.replaceChildren(...parts);
}

function paragraph(doc, text, className) {
  const p = doc.createElement('p');
  p.textContent = text;
  if (className) p.className = className;
  return p;
}

function list(doc, title, items, className) {
  const wrapper = doc.createElement('div');
  wrapper.className = className;
  const heading = doc.createElement('strong');
  heading.textContent = `${title} (${items.length})`;
  const ul = doc.createElement('ul');
  for (const item of items) {
    const li = doc.createElement('li');
    li.textContent = item;
    ul.append(li);
  }
  wrapper.append(heading, ul);
  return wrapper;
}
