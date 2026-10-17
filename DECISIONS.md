# Decisions

## Exam requirements (from the two PDFs, validated with the user)

Source: `NatationIII_choré_synchro.pdf` and `Nat_III_figures_synchro.pdf`
(kept locally, ignored by Git).

- Synchronized swimming routine, music played out of the water.
- **In-water duration: at least 2:00** (a minimum, not a maximum).
- Content: start on the pool edge, tell a story / common thread, clear and precise ending.
- **Imposed figures** (all start from the back layout position):

| Figure | Key points | In the routine |
|---|---|---|
| Roue / Wasserrad (wheel) | legs apart, right foot on left knee, 360° around the hips, knees and feet at the surface; can be done to the left | 14.1–15.5 (E turns the other way) |
| Flamant / Flamingo | cuvette → one leg vertical → cuvette → layout; slow, on the spot | 11.1–12.4, wave from the centre |
| Huître / Auster (oyster) | legs to the hands above the head, energetic; sink vertically | 18.1–19.1, cascade A, D, C, B, then E |
| Jambe de ballet simple / Balletbein | sailboat → shin up → sailboat → layout; slow, continuous | 7.1–8.6, in the star circle |
| Salto arrière groupé / Salto rückwärts | tuck, backward roll to the surface, extend; slow, on the spot | 22.1–23.3, wave from the tip of the V |

- **No scoring grid** in the PDFs. "Tight formations score more" comes from the teachers (oral).

## Product decisions (agreed after the idea challenge)

- **Target duration: final pose at ~2:10, end at 2:14.4** (pose at 2:09.6, held one eight)
  to stay safely above the 2:00 minimum. The timer turns orange from 1:45
  ("not 2:00 yet, don't finish") and green from 2:00.
- **"Intensité" = physical effort** (helps place recovery moments for beginners).
- **Music cut: not decided yet.** The app works on the full song with a T0 setting.
  Suggested cut for the exam: from the start of the song to about **2:34**
  (end of the final pose), with a 2–3 s fade.
- **Timing written in 8-counts**, not seconds: changing the tempo or the music cut
  only means changing T0/BPM, not the choreography. Agent's suggestion, adopted.
- **Extras accepted for v1:** A–B loop, "my moves" filter (screen and print),
  story column ("fil rouge"), breathing check (apnea > 8 s or < 8 s between two
  underwater passages → warning).
- **Kept against the challenger's advice:** side view and gaze cone. The user asked for
  them, and the side view is what makes the oyster cascade understandable.
- Imposed figures are performed **by all 5 swimmers** (assumption; to confirm with the teachers).
- Swimmer ids A–D = the 4 men, E = the woman ("Mary"). Initials are editable in the app.
- Story: "the summoning of Bloody Mary": the four call her, she leads them, they fall
  under her spell one by one (oyster cascade), she appears last in the centre,
  final "blood star".
- The poolside part uses the 4 eights of the song intro; the water entry is on the
  first beat of the verse (19.46 s).

## Measured on the user's audio file

- Album version, 4:05, **100 BPM**, first beat at 0.26 s (onset-envelope autocorrelation,
  done once offline; no audio analysis code in the app).
- Quieter passages at 1:17–1:26 and 2:24–2:33 in the song: used for the wheel
  (calm, on the spot) and for the final pose.

## Technical decisions

- **Vanilla HTML/CSS/JS (ES modules), no build, no runtime dependency.** Nothing in
  the project needed a library: Canvas 2D, `<audio>` and `node --test` cover everything.
- **Canvas 2D rather than SVG**: 5 figures redrawn on every frame (~60 fps) with
  transparency and dashed lines; canvas is simpler and faster for this than updating
  dozens of SVG nodes. The text alternative is the table and the per-swimmer status list
  (HTML), which screen readers can read.
- **Animation driven by `audio.currentTime`** on each `requestAnimationFrame`, never by a
  separate timer. Interpolation is per field (position, heading, legs, depth, gaze…),
  so a step that only turns the heads doesn't interrupt a swimmer who is still travelling.
- **Audio is loaded with `URL.createObjectURL`**: the file stays on the device.
- **Strict CSP** (`default-src 'none'`, `script-src 'self'`, `media-src blob:`), all
  text inserted with `textContent`, settings from `localStorage` validated before use.
- `package.json` only sets `"type": "module"` and two scripts; **no dependencies**.
  `npm start` uses Python's built-in static server.
- Exam PDFs and audio files are listed in `.gitignore` (`*.pdf`, `*.wav`, `*.mp3`, …).
