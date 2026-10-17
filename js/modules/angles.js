// Angle helpers. Angles are in degrees, measured clockwise on screen:
// 0 = right (east), 90 = down (towards the judges), 180 = left, 270 = up.

export function normalizeAngle(degrees) {
  return ((degrees % 360) + 360) % 360;
}

/** Signed smallest rotation (in ]-180, 180]) that goes from `from` to `to`. */
export function shortestDelta(from, to) {
  const delta = normalizeAngle(to - from);
  return delta > 180 ? delta - 360 : delta;
}

/** Direction from point a to point b. */
export function angleBetween(a, b) {
  return normalizeAngle((Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI);
}

export function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}
