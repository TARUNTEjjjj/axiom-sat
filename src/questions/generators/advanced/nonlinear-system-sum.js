import { fmtLinear, fmtNum, fmtPoly, sprNum } from '../../format.js';
import { parseSpr } from '../../spr.js';

export default {
  id: 'advanced.nonlinear-system-sum',
  domain: 'advanced',
  skill: 'Combining nonlinear systems with root relationships',
  space: 4 * 24 * 41 * 64,
  generate(rng) {
    const a = rng.int(2, 5);
    const r = -rng.int(1, 8);
    const s = rng.int(1, 8);
    let b = rng.int(-12, 12);
    while (a * (r + s) + b === 0) b = rng.int(-12, 12);
    const c = rng.int(-20, 20);
    const m = a * (r + s) + b;
    const n = c - a * r * s;
    const value = m * (r + s) + 2 * n;
    return {
      item: {
        type: 'spr',
        difficulty: 3,
        stem: `The graphs of y = ${fmtPoly([a, b, c])} and y = ${fmtLinear(m, n)} intersect at two points. What is the sum of the y-coordinates of these two points?`,
        answer: sprNum(value),
        explanation: `Set the expressions for y equal and move all terms to one side: ${fmtPoly([a, b - m, c - n])} = 0. The sum of its roots (the two x-coordinates) is −(${fmtNum(b - m)}) / ${a} = ${fmtNum(r + s)}. Each point also satisfies y = ${fmtLinear(m, n)}, so y₁ + y₂ = (${fmtNum(m)})(x₁ + x₂) + 2(${fmtNum(n)}) = ${fmtNum(value)}. The question asks for the sum of y-coordinates, not the sum of the roots.`,
      },
      params: { a, b, c, m, n },
    };
  },
  verify({ item, params: { a, b, c, m, n } }) {
    const disc = (b - m) ** 2 - 4 * a * (c - n);
    if (disc <= 0) return false;
    const xs = [(m - b + Math.sqrt(disc)) / (2 * a), (m - b - Math.sqrt(disc)) / (2 * a)];
    return (
      xs.every((x) => a * x * x + b * x + c === m * x + n) &&
      parseSpr(item.answer) === xs.reduce((sum, x) => sum + a * x * x + b * x + c, 0)
    );
  },
};
