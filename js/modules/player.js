// Wraps the <audio> element: load a local file, play/pause, speed, seek and A–B loop.
// The animation always reads `currentTime()` from here, so it stays in sync with the music.
// Without a music file, the time can still be moved with the slider or the table.

const ACCEPTED = /\.(wav|mp3|m4a|aac|ogg|flac)$/i;

export function createPlayer() {
  const audio = new Audio();
  audio.preload = 'auto';
  let objectUrl = null;
  let manualTime = 0;
  const loop = { a: null, b: null, enabled: false };

  const hasAudio = () => objectUrl !== null;

  return {
    audio,
    loop,
    hasAudio,

    /** Loads a File chosen by the user. Rejects anything that isn't audio. */
    async load(file) {
      if (!file || !(file.type.startsWith('audio/') || ACCEPTED.test(file.name))) {
        throw new Error('Ce fichier n\'est pas un fichier audio (WAV ou MP3).');
      }
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = URL.createObjectURL(file);
      audio.src = objectUrl;
      await new Promise((resolve, reject) => {
        audio.addEventListener('loadedmetadata', resolve, { once: true });
        audio.addEventListener('error', () => reject(new Error('Impossible de lire ce fichier audio.')), { once: true });
      });
      audio.currentTime = Math.min(manualTime, audio.duration);
    },

    currentTime() {
      return hasAudio() ? audio.currentTime : manualTime;
    },

    duration() {
      return hasAudio() && Number.isFinite(audio.duration) ? audio.duration : null;
    },

    isPlaying() {
      return hasAudio() && !audio.paused;
    },

    async togglePlay() {
      if (!hasAudio()) return;
      if (audio.paused) {
        await audio.play();
      } else {
        audio.pause();
      }
    },

    setSpeed(rate) {
      audio.playbackRate = rate;
    },

    seek(time) {
      const max = this.duration() ?? Infinity;
      const clamped = Math.max(0, Math.min(time, max));
      manualTime = clamped;
      if (hasAudio()) audio.currentTime = clamped;
    },

    /** Call on every frame: jumps back to A when the loop reaches B. */
    applyLoop() {
      if (!loop.enabled || loop.a === null || loop.b === null || loop.b <= loop.a) return;
      if (this.currentTime() >= loop.b) this.seek(loop.a);
    },
  };
}
