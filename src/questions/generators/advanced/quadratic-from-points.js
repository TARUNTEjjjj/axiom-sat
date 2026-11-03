import { fmtLinear, fmtNum, sprNum } from '../../format.js';
import { parseSpr } from '../../spr.js';

export default {
  id: 'advanced.quadratic-from-points',
  domain: 'advanced',
  skill: 'Reconstructing quadratic functions',
  space: 10 * 41 * (20 * 8 - 8), // a · k · (h, d) pairs, less the 8 that put the point on the y-axis
  generate(rng) {
    const a = rng.pick([-6, -5, -4, -3, -2, 2, 3, 4, 5, 6]);
    const h = rng.nonzero(-10, 10);
    const k = rng.int(-20, 20);
    let d = rng.int(1, 8);
    while (h + d === 0) d = rng.int(1, 8); // a point at x = 0 would be the y-intercept itself
    const x = h + d;
    const y = a * d * d + k;
    const value = a * h * h + k;
    return {
      item: {
        type: 'spr',
        difficulty: 3,
        stem: `In the xy-plane, the graph of the quadratic function f has vertex (${fmtNum(h)}, ${fmtNum(k)}) and passes through (${fmtNum(x)}, ${fmtNum(y)}). What is the y-intercept of this graph? Give only its y-coordinate.`,
        answer: sprNum(value),
        explanation: `Use vertex form: f(x) = a(${fmtLinear(1, -h)})² ${k < 0 ? '−' : '+'} ${Math.abs(k)}. Substitute the other point: ${fmtNum(y)} = a(${d})² ${k < 0 ? '−' : '+'} ${Math.abs(k)}, so a = (${fmtNum(y)} − (${fmtNum(k)})) / ${d * d} = ${fmtNum(a)}. A y-intercept has x = 0. Therefore f(0) = (${fmtNum(a)})(${fmtNum(-h)})² ${k < 0 ? '−' : '+'} ${Math.abs(k)} = ${fmtNum(value)}.`,
      },
      params: { h, k, x, y },
    };
  },
  verify({ item, params: { h, k, x, y } }) {
    const c = parseSpr(item.answer);
    if (!Number.isFinite(c)) return false;
    const a = (c - k) / (h * h);
    const b = -2 * a * h;
    return a !== 0 && a * h * h + b * h + c === k && a * x * x + b * x + c === y;
  },
};
