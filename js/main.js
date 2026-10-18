// Entry point: wires the music player, the views, the table and the settings.
// Everything on screen is computed from audio.currentTime on each animation frame.

import { choreography } from './data/choreography.js';
import { BEATS_PER_EIGHT, beatToSongTime, formatTime, secondsPerBeat, songTimeToBeat } from './modules/counts.js';
import { findStepIndex } from './modules/choreography-model.js';
import { poseAt } from './modules/interpolation.js';
import { validateChoreography } from './modules/validation.js';
import { createPlayer } from './modules/player.js';
import { computeZoomBox, createPoolView } from './modules/pool-view.js';
import { createProfileView } from './modules/profile-view.js';
import { createTableView } from './modules/table-view.js';
import { createReadouts } from './modules/readouts.js';
import { renderValidation } from './modules/validation-panel.js';
import { createSettingsForm } from './modules/settings-form.js';
import { readPalette } from './modules/canvas-utils.js';
import { addTap, bpmFromTaps } from './modules/tap-tempo.js';
import { LIMITS, clearSettings, defaultSettings, loadSettings, saveSettings } from './modules/settings.js';

const $ = (id) => document.getElementById(id);
// Keys typed in these elements are text, not shortcuts.
const TEXT_ENTRY = 'input:not([type=range]):not([type=checkbox]):not([type=color]), select, textarea, [contenteditable]';
const MIN_TAPS = 4;

function start() {
  const defaults = defaultSettings(choreography);
  const elements = { zoom: $('zoom'), follow: $('follow'), seek: $('seek') };
  const app = {
    seeking: false,
    settings: loadSettings(defaults),
    result: null,
    zoomBox: null,
    palette: readPalette(),
    taps: [],
  };

  const player = createPlayer();
  const poolView = createPoolView($('pool-view'));
  const profileView = createProfileView($('profile-view'));
  const readouts = createReadouts(document);
  const table = createTableView($('choreo-table'), $('table-scroll'), (time) => player.seek(time));
  const form = createSettingsForm(document, choreography.team, (changes) => updateSettings(changes));

  $('title').textContent = `Chorégraphie synchro – ${choreography.title}`;
  $('zoom').checked = true;
  fillFocusOptions();
  form.fill(app.settings);
  $('speed').value = String(app.settings.speed);
  player.setSpeed(app.settings.speed);
  $('focus').value = app.settings.focus;
  rebuild();
  seekFromHash();
  bindControls();
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    app.palette = readPalette();
  });
  requestAnimationFrame(frame);

  // ───────── Derived data ─────────

  function timing() {
    return { bpm: app.settings.bpm, t0: app.settings.t0 };
  }

  function pool() {
    return {
      length: app.settings.poolLength,
      width: app.settings.poolWidth,
      depthLeft: app.settings.depthLeft,
      depthRight: app.settings.depthRight,
    };
  }

  function team() {
    return choreography.team.map((swimmer) => ({ ...swimmer, ...app.settings.swimmers[swimmer.id] }));
  }

  /** Re-validates and rebuilds everything that depends on the settings. */
  function rebuild() {
    app.result = validateChoreography(choreography, { pool: pool(), bpm: app.settings.bpm });
    renderValidation($('validation'), app.result);
    if (!app.result.model) return;
    app.zoomBox = computeZoomBox(app.result.model);
    table.render({
      model: app.result.model,
      timing: timing(),
      poolsideEights: choreography.poolsideEights,
      team: team(),
      focus: app.settings.focus,
    });
    renderTeamLegend();
    updateSeekRange();
  }

  function updateSettings(changes) {
    const { swimmer, ...values } = changes;
    Object.assign(app.settings, values);
    if (swimmer) {
      const { id, ...fields } = swimmer;
      app.settings.swimmers[id] = { ...app.settings.swimmers[id], ...fields };
      fillFocusOptions();
    }
    saveSettings(app.settings);
    rebuild();
  }

  function routineEndTime() {
    return beatToSongTime(app.result.model.endBeat, timing());
  }

  function updateSeekRange() {
    const seek = $('seek');
    seek.max = String(player.duration() ?? Math.ceil(routineEndTime() + 5));
  }

  // ───────── Animation loop ─────────

  function frame() {
    player.applyLoop();
    const model = app.result.model;
    if (model) {
      const time = player.currentTime();
      const beat = songTimeToBeat(time, timing());
      const stepIndex = findStepIndex(model.steps, beat);
      const swimmers = team().map((swimmer) => ({ ...swimmer, pose: poseAt(model, swimmer.id, beat) }));
      const view = { pool: pool(), swimmers, focus: app.settings.focus, palette: app.palette, beat };

      // On the deck, show the whole pool; in the water, zoom on the area used by the routine.
      const zoomed = elements.zoom.checked && beat >= 0;
      const xRange = poolView.render({ ...view, zoomBox: zoomed ? app.zoomBox : null });
      profileView.render({ ...view, xRange });
      readouts.update({
        time,
        beat,
        examSeconds: time - app.settings.t0,
        waterSeconds: app.result.summary.waterSeconds,
        poolsideEights: choreography.poolsideEights,
        step: model.steps[stepIndex],
        swimmers,
      });
      table.highlight(stepIndex, elements.follow.checked);
      if (!app.seeking) elements.seek.value = String(time);
    }
    requestAnimationFrame(frame);
  }

  // ───────── Controls ─────────

  function bindControls() {
    $('audio-file').addEventListener('change', loadAudio);
    $('play').addEventListener('click', togglePlay);
    player.audio.addEventListener('play', updatePlayButton);
    player.audio.addEventListener('pause', updatePlayButton);
    $('speed').addEventListener('change', () => {
      const speed = Number($('speed').value);
      player.setSpeed(speed);
      app.settings.speed = speed;
      saveSettings(app.settings);
    });
    elements.seek.addEventListener('input', () => player.seek(Number(elements.seek.value)));
    // While the slider is being dragged, the animation must not move it back.
    elements.seek.addEventListener('pointerdown', () => { app.seeking = true; });
    window.addEventListener('pointerup', () => { app.seeking = false; });
    $('prev-eight').addEventListener('click', () => jumpEights(-1));
    $('next-eight').addEventListener('click', () => jumpEights(1));

    $('loop-a').addEventListener('click', () => setLoop({ a: player.currentTime() }));
    $('loop-b').addEventListener('click', () => setLoop({ b: player.currentTime() }));
    $('loop-step').addEventListener('click', loopCurrentStep);
    $('loop-toggle').addEventListener('click', () => setLoop({ enabled: !player.loop.enabled }));

    $('t0-now').addEventListener('click', () => {
      const [min, max] = LIMITS.t0;
      const t0 = Math.min(max, Math.max(min, Math.round(player.currentTime() * 100) / 100));
      updateSettings({ t0 });
      form.fill(app.settings);
    });
    $('tap').addEventListener('click', tapTempo);
    $('bpm-double').addEventListener('click', () => scaleTempo(2));
    $('bpm-half').addEventListener('click', () => scaleTempo(0.5));
    $('reset-settings').addEventListener('click', () => {
      clearSettings();
      app.settings = defaultSettings(choreography);
      form.fill(app.settings);
      $('speed').value = String(app.settings.speed);
      player.setSpeed(app.settings.speed);
      fillFocusOptions();
      rebuild();
    });

    $('focus').addEventListener('change', () => updateSettings({ focus: $('focus').value }));
    $('print').addEventListener('click', () => window.print());
    document.addEventListener('keydown', handleShortcut);
  }

  async function loadAudio(event) {
    const [file] = event.target.files;
    if (!file) return;
    try {
      await player.load(file);
      player.setSpeed(app.settings.speed);
      $('audio-name').textContent = `${file.name} (${formatTime(player.duration())})`;
      $('play').disabled = false;
      updateSeekRange();
    } catch (error) {
      $('audio-name').textContent = error.message;
      $('play').disabled = true;
    }
  }

  async function togglePlay() {
    try {
      await player.togglePlay();
    } catch {
      $('audio-name').textContent = 'La lecture a été bloquée par le navigateur. Réessaie.';
    }
  }

  function updatePlayButton() {
    $('play').textContent = player.isPlaying() ? '❚❚ Pause' : '▶ Lecture';
  }

  function jumpEights(direction) {
    player.seek(player.currentTime() + direction * BEATS_PER_EIGHT * secondsPerBeat(app.settings.bpm));
  }

  function setLoop(changes) {
    Object.assign(player.loop, changes);
    const { a, b, enabled } = player.loop;
    if (a !== null && b !== null && b < a) Object.assign(player.loop, { a: b, b: a });
    $('loop-toggle').setAttribute('aria-pressed', String(enabled));
    $('loop-toggle').textContent = `Boucle : ${enabled ? 'on' : 'off'}`;
    const show = (value) => (value === null ? '?' : formatTime(value, { tenths: true }));
    $('loop-info').textContent = `A ${show(player.loop.a)} → B ${show(player.loop.b)}`;
  }

  function loopCurrentStep() {
    const model = app.result.model;
    if (!model) return;
    const beat = songTimeToBeat(player.currentTime(), timing());
    const step = model.steps[Math.max(0, findStepIndex(model.steps, beat))];
    const a = beatToSongTime(step.startBeat, timing());
    setLoop({ a, b: beatToSongTime(step.endBeat, timing()), enabled: true });
    player.seek(a);
  }

  function tapTempo() {
    app.taps = addTap(app.taps, performance.now());
    const bpm = bpmFromTaps(app.taps);
    $('tap').textContent = bpm ? `Tap (${app.taps.length}) : ${bpm}` : 'Tap… continue';
    // A couple of taps are too imprecise: wait for a few before changing the tempo.
    if (bpm && app.taps.length >= MIN_TAPS && bpm >= 40 && bpm <= 240) {
      updateSettings({ bpm });
      form.fill(app.settings);
    }
  }

  function scaleTempo(factor) {
    const bpm = Math.round(app.settings.bpm * factor * 10) / 10;
    if (bpm < 40 || bpm > 240) return;
    updateSettings({ bpm });
    form.fill(app.settings);
  }

  function handleShortcut(event) {
    if (event.target.closest?.(TEXT_ENTRY) || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === ' ') {
      // preventDefault also stops a focused button from being "clicked" by Space.
      event.preventDefault();
      togglePlay();
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      jumpEights(-1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      jumpEights(1);
    }
  }

  /** A link ending in #t=95.5 opens the page at 1:35.5 in the song. */
  function seekFromHash() {
    const match = /^#t=(\d{1,3}(?:\.\d{1,2})?)$/.exec(window.location.hash);
    if (match && app.result.model) player.seek(Math.min(Number(match[1]), routineEndTime() + 5));
  }

  // ───────── Small renders ─────────

  function fillFocusOptions() {
    const select = $('focus');
    const options = [new Option('Toute l\'équipe', '')];
    for (const swimmer of team()) {
      options.push(new Option(`${swimmer.initials} (${swimmer.role})`, swimmer.id));
    }
    select.replaceChildren(...options);
    select.value = app.settings.focus;
  }

  function renderTeamLegend() {
    const items = team().map((swimmer) => {
      const span = document.createElement('span');
      span.textContent = `${swimmer.id} = ${swimmer.initials} (${swimmer.role})`;
      span.style.setProperty('--swatch', swimmer.color);
      return span;
    });
    $('team-legend').replaceChildren(...items);
    const focus = team().find((swimmer) => swimmer.id === app.settings.focus);
    $('print-info').textContent = [
      `Tempo ${app.settings.bpm} BPM`,
      `entrée dans l'eau (T0) à ${formatTime(app.settings.t0, { tenths: true })} dans la chanson`,
      focus ? `fiche de ${focus.initials}` : 'toute l\'équipe',
    ].join(' · ');
  }
}

start();
