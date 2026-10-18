# Chorégraphie synchro – Bloody Mary

A web page to learn and rehearse an artistic swimming routine (team of 5,
University of Fribourg exam). It plays your music file and shows, in sync:

- the pool seen from above (positions, body orientation, legs, arms, **head and gaze**);
- a side view (who is at the surface, who is under water, the sloping pool floor, lifts);
- the exam timer (starts at the water entry, warns until 2:00 is reached);
- the 8-counts;
- the full choreography table (click a row to jump there; printable).

No music and no exam PDF are stored in this repository. Everyone loads their own
audio file; it never leaves their device.

## Run it

It is a static site with no build step and no dependencies.

```sh
npm start            # = python3 -m http.server 8000
# then open http://localhost:8000
```

(Any static server works. Opening `index.html` directly with `file://` does not,
because browsers block ES modules there.)

Run the tests (Node 20+):

```sh
npm test             # = node --test
```

### Publish on GitHub Pages

Settings → Pages → "Deploy from a branch" → `main` / root. Nothing else to configure.

## Use it

1. **Charger la musique…**: pick the WAV or MP3 of the song.
2. **Réglages**:
   - **T0**: the song time (seconds) of the water entry. Default 19.46 s on the
     album version (4 eights of intro on the poolside). If you use a cut version,
     play it, pause on the water entry beat and click **T0 = position actuelle**.
   - **Tempo**: 100 BPM (measured). **Tap tempo** to check by ear; **×2 / ÷2** fixes
     a tempo read at half or double speed.
   - Pool size and depth at each end (left / right as seen from the public),
     swimmers' colours and initials. Settings are remembered in the browser.
3. Play, pause (Space), slow down (0.5×, 0.75×), jump one eight back/forward (← →).
4. **A / B / Boucle**: loop a passage. **Boucler l'étape** loops the current row.
5. **Mes mouvements**: pick a swimmer to dim the others and add a "Pour …" column
   to the table (also printed).
6. **Imprimer**: an A4 landscape sheet with only the table.
7. Share a moment: add `#t=95.5` to the address to open the page at 1:35.5 in the song.

Without a music file, the slider and the table still move the animation.

## Modifier la chorégraphie (edit the routine)

The whole routine is data in [`js/data/choreography.js`](js/data/choreography.js).
The player never needs to change. After editing, reload the page: the
**Vérification** panel (and `npm test`) lists any problem.

### Timing: 8-counts, not seconds

- `"1.1"` = first beat in the water (T0). `"12.5"` = 12th eight, beat 5.
- `"P1.1"` … `"P4.8"` = the poolside part (`poolsideEights: 4`).
- `end` = when the routine is over (here `"29.1"` = 2:14.4 at 100 BPM).

Because everything is in counts, changing the tempo or the music cut only means
changing the T0 / BPM settings, not the file.

### A step

```js
{
  at: '18.1',                 // when the step starts
  phase: 'water',             // 'poolside' or 'water'
  intensity: 'high',          // physical effort: 'low' | 'medium' | 'high'
  imposed: 'oyster',          // optional: wheel | flamingo | oyster | balletLeg | backSomersault
  final: true,                // exactly one step: the final pose
  element: 'Huître en cascade',
  formation: 'Carré, chacun sur place',
  head: 'Visage vers les genoux',
  hands: 'Mains aux chevilles',  // "Bras / mains" column
  story: 'Un à un, ils tombent sous son charme.',
  notes: 'A sur 1, D sur 3…',
  transition: 1,              // beats to reach the new pose (default 4)
  delays: { A: 0, D: 2, C: 4, B: 6, E: 8 },   // canon: each swimmer starts later
  place: { A: { x: -1.6, y: -1.1, heading: 225 }, … },  // new positions (optional)
  pose: { body: 'pike', gaze: 'down' },        // applied to everyone
  swimmers: { E: { body: 'back', transition: 4, note: 'texte perso' } },  // per-swimmer overrides
  spin: 1,                    // full turns on the surface (wheel); -1 = other way
  flip: 0.5,                  // backward rolls (somersault), fractions allowed
}
```

Required in every step: `at`, `phase`, `intensity`, `element`.
Anything not given keeps its previous value, so most steps are short.

At the top of the file, `pool: { length, width, depthLeft, depthRight }` gives the
default pool (metres; left / right as seen from the public).

Pose fields (below), `spin` and `flip` can be given in `pose` (everyone),
`place` (positions per swimmer) or `swimmers` (per-swimmer overrides; the most
specific wins). Inside `swimmers`, `transition` and `note` (shown in the
"Pour …" column) are also accepted.

### Pose fields

| Field | Values |
|---|---|
| `x`, `y` | metres from the pool centre. x → right, y → towards the judges. `y` can also be `'deck'`, `'edge'` (sitting on the edge), `'wall'` (in the water near the far wall) |
| `heading` | where the head points: 0 = right, 90 = judges, 180 = left, 270 = away from judges |
| `body` | `standing`, `sitting`, `vertical`, `back`, `front`, `tuck`, `pike` |
| `legs` | 0 = closed … 1 = wide open (star) |
| `lift` | 0 = flat, 0.5 = knee up (sailboat / cuvette), 1 = leg vertical |
| `depth` | 0 = surface … 1 = sunk (stops at the pool floor in the side view) |
| `elevation` | 0–2 m above the normal position: someone on shoulders (0.2), a jump in the air (1.8) |
| `arms` | (hidden under water and in a tuck or pike)  `'down'` (in the water, not drawn), `'rightUp'`, `'leftUp'`, `'bothUp'`, `'rightSide'`, `'leftSide'`, `'point'` (in the gaze direction), `'wave'` (one hand waving on the beat), `'claw'` (Halloween claw near the face). Hidden under water and in a tuck or pike |
| `pitch` | internal (somersault rotation), set only through `flip` |
| `gaze` | `'up'` (ceiling), `'down'` (face in water), `'judges'`, `'ahead'`, `'left'`, `'right'`, `'center'`, a swimmer id (`'E'`), or an angle |

The **Vérification** panel also warns when a swimmer must travel faster than a
beginner can (0.55 m/s swimming on the front, 0.35 m/s upright, 0.3 m/s on the
back, almost nothing in a tuck or pike), or stays too long under water.

`js/data/formations.js` has helpers to place the 5 swimmers: `line`, `circle`
(the star), `wedge` (arrow / V) and `dice` (4 corners + centre).

## Project layout

```
index.html, css/style.css, css/print.css
js/main.js                      entry point (wiring)
js/data/choreography.js         the routine (data)
js/data/formations.js           formation helpers
js/modules/counts.js            time ↔ beats ↔ 8-counts
js/modules/choreography-model.js  data → poses and animation tracks
js/modules/interpolation.js     pose at any moment
js/modules/validation.js        checks (5 swimmers, ≥ 2:00, imposed figures, breathing…)
js/modules/pool-view.js, profile-view.js   canvas drawings
js/modules/table-view.js, readouts.js, settings*.js, player.js, tap-tempo.js
tests/                          node --test
DECISIONS.md                    decisions and their reasons
```
