// Small helpers to place the 5 swimmers in common formations.
// They only return plain data: { A: { x, y, heading }, B: … }.
//
// Coordinates are in metres, relative to the centre of the pool:
//   x grows to the right (as seen by the judges), y grows towards the judges.
// `y` may also be a keyword resolved with the real pool size:
//   'deck' = standing on the far deck, 'edge' = sitting on the far edge,
//   'wall' = in the water, close to the far wall.
// heading = direction the head points (degrees, see js/modules/angles.js):
//   0 = right, 90 = towards the judges, 180 = left, 270 = away from the judges.

const JUDGES = 90;

/** Side by side, left to right as seen by the judges. */
export function line(order, { y, spacing = 1.2, cx = 0, heading = JUDGES }) {
  const first = cx - ((order.length - 1) * spacing) / 2;
  return place(order, (index) => ({ x: first + index * spacing, y, heading }));
}

/**
 * Circle, listed clockwise starting at `firstAngle` (90 = closest to the judges).
 * headsOut: true → heads outward and feet in the centre (the "star").
 */
export function circle(order, { cx = 0, cy = 0, radius = 1.4, firstAngle = JUDGES, headsOut = true }) {
  return place(order, (index) => {
    const angle = firstAngle + (index * 360) / order.length;
    const radians = (angle * Math.PI) / 180;
    return {
      x: round(cx + radius * Math.cos(radians)),
      y: round(cy + radius * Math.sin(radians)),
      heading: headsOut ? angle % 360 : (angle + 180) % 360,
    };
  });
}

/**
 * V shape (arrow). Order is left to right; the middle swimmer is the tip.
 * The tip points towards the judges when tipY is larger than the wings.
 */
export function wedge(order, { tipX = 0, tipY = 0, spacing = 1.2, rowGap = 1.2, heading = JUDGES }) {
  const middle = (order.length - 1) / 2;
  return place(order, (index) => {
    const offset = index - middle;
    return { x: tipX + offset * spacing, y: tipY - Math.abs(offset) * rowGap, heading };
  });
}

/**
 * Four corners and a centre, like the five on a dice.
 * Order: top-left, top-right, centre, bottom-left, bottom-right.
 * cornersOut: true → corner swimmers point their head away from the centre.
 */
export function dice(order, { cx = 0, cy = 0, spacing = 1.6, heading = JUDGES, cornersOut = false }) {
  const corners = [
    { x: -1, y: -1 },
    { x: 1, y: -1 },
    null,
    { x: -1, y: 1 },
    { x: 1, y: 1 },
  ];
  return place(order, (index) => {
    const corner = corners[index];
    if (!corner) return { x: cx, y: cy, heading };
    const outward = (Math.atan2(corner.y, corner.x) * 180) / Math.PI;
    return {
      x: cx + corner.x * spacing,
      y: cy + corner.y * spacing,
      heading: cornersOut ? (outward + 360) % 360 : heading,
    };
  });
}

function place(order, positionOf) {
  return Object.fromEntries(order.map((id, index) => [id, positionOf(index)]));
}

function round(value) {
  return Math.round(value * 100) / 100;
}
