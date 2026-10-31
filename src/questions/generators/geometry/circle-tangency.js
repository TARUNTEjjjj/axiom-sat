import { fmtNum, fmtTerm, sprNum } from '../../format.js';
import { parseSpr } from '../../spr.js';

const signedTerm = (coefficient, variable) =>
  `${coefficient < 0 ? '−' : '+'} ${fmtTerm(Math.abs(coefficient), variable)}`;

export default {
  id: 'geometry.circle-tangency',
  domain: 'geometry',
  skill: 'Circle equations and tangency',
  space: 24 * 24 * 17 * 2 * 2,
  generate(rng) {
    const h = rng.nonzero(-12, 12);
    const k = rng.nonzero(-12, 12);
    const radius = rng.int(2, 18);
    const axis = rng.pick(['x', 'y']);
    const t = (axis === 'x' ? h : k) + rng.pick([-1, 1]) * radius;
    const constant = h * h + k * k - radius * radius;
    const equation = `x² + y² ${signedTerm(-2 * h, 'x')} ${signedTerm(-2 * k, 'y')} + c = 0`;
    return {
      item: {
        type: 'spr',
        difficulty: 3,
        stem: `In the xy-plane, a circle has equation ${equation}, where c is a constant. The line ${axis} = ${fmtNum(t)} is tangent to the circle. What is c?`,
        answer: sprNum(constant),
        explanation: `Complete the square in x and y. The circle has center (${fmtNum(h)}, ${fmtNum(k)}) and squared radius ${h * h + k * k} − c. A tangent line is exactly one radius from the center. The distance from the center to ${axis} = ${fmtNum(t)} is |${fmtNum(t)} − (${fmtNum(axis === 'x' ? h : k)})| = ${radius}. Thus ${h * h + k * k} − c = ${radius}² = ${radius * radius}, giving c = ${fmtNum(constant)}.`,
      },
      params: { xCoefficient: -2 * h, yCoefficient: -2 * k, axis, t },
    };
  },
  verify({ item, params: { xCoefficient, yCoefficient, axis, t } }) {
    const c = parseSpr(item.answer);
    if (!Number.isFinite(c)) return false;
    const b = axis === 'x' ? yCoefficient : xCoefficient;
    const d = t * t + (axis === 'x' ? xCoefficient : yCoefficient) * t + c;
    // Substitution of the tangent line must leave a repeated real root.
    const radiusSquared = (xCoefficient * xCoefficient + yCoefficient * yCoefficient) / 4 - c;
    return b * b - 4 * d === 0 && radiusSquared > 0;
  },
};
