// User settings (tempo, T0, pool size, swimmers' initials and colours…),
// remembered in localStorage. Everything read back is validated.

const STORAGE_KEY = 'chore-synchro.settings.v1';

export const SPEEDS = [0.5, 0.75, 1];
export const LIMITS = {
  bpm: [40, 240],
  t0: [0, 600],
  poolLength: [10, 60],
  poolWidth: [5, 30],
};
const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const INITIALS = /^[\p{L}\p{N}]{1,3}$/u;

export function defaultSettings(choreography) {
  return {
    bpm: choreography.music.bpm,
    t0: choreography.music.t0,
    poolLength: choreography.pool.length,
    poolWidth: choreography.pool.width,
    speed: 1,
    focus: '',
    swimmers: Object.fromEntries(
      choreography.team.map(({ id, initials, color }) => [id, { initials, color }]),
    ),
  };
}

/** Keeps only valid values from `raw`, falling back to `defaults`. */
export function sanitizeSettings(raw, defaults) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const settings = { ...defaults, swimmers: { ...defaults.swimmers } };
  for (const [key, [min, max]] of Object.entries(LIMITS)) {
    const value = Number(source[key]);
    if (source[key] !== undefined && source[key] !== '' && Number.isFinite(value) && value >= min && value <= max) {
      settings[key] = value;
    }
  }
  if (SPEEDS.includes(source.speed)) settings.speed = source.speed;
  if (typeof source.focus === 'string' && (source.focus === '' || Object.hasOwn(defaults.swimmers, source.focus))) {
    settings.focus = source.focus;
  }
  for (const id of Object.keys(defaults.swimmers)) {
    const swimmer = source.swimmers?.[id];
    if (!swimmer || typeof swimmer !== 'object') continue;
    settings.swimmers[id] = {
      initials: INITIALS.test(swimmer.initials ?? '') ? swimmer.initials : defaults.swimmers[id].initials,
      color: HEX_COLOR.test(swimmer.color ?? '') ? swimmer.color : defaults.swimmers[id].color,
    };
  }
  return settings;
}

export function isValidInitials(text) {
  return INITIALS.test(text);
}

export function loadSettings(defaults) {
  try {
    const stored = globalThis.localStorage?.getItem(STORAGE_KEY);
    return sanitizeSettings(stored ? JSON.parse(stored) : null, defaults);
  } catch {
    return sanitizeSettings(null, defaults);
  }
}

export function saveSettings(settings) {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage may be unavailable (private mode): settings simply won't persist.
  }
}

export function clearSettings() {
  try {
    globalThis.localStorage?.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clear.
  }
}
