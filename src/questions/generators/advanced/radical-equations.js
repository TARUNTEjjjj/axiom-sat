import { fmtLinear, fmtNum, fmtPoly, sprNum } from '../../format.js';
import { parseSpr } from '../../spr.js';

export default {
  id: 'advanced.radical-equations',
  domain: 'advanced',
  skill: 'Radical equations and extraneous solutions',
  space: 24 * 120,
  generate(rng) {
    const k = rng.nonzero(-12, 12);
    const d = rng.int(2, 14);
    let p = rng.int(1, 10);
    while (p === d) p = rng.int(1, 10);
    const m = d - p;
    const n = k * (p - d) + d * p;
    const valid = k + d;
    const extraneous = k - p;
    return {
      item: {
        type: 'spr',
        difficulty: 3,
        stem: `What is the real solution to √(${fmtLinear(m, n)}) = ${fmtLinear(1, -k)}?`,
        answer: sprNum(valid),
        explanation: `A principal square root is nonnegative, so the right side requires x ≥ ${fmtNum(k)}. Squaring both sides gives ${fmtLinear(m, n)} = (${fmtLinear(1, -k)})², or ${fmtPoly([1, -2 * k - m, k * k - n])} = 0. Factor to obtain (${fmtLinear(1, -valid)})(${fmtLinear(1, -extraneous)}) = 0. The candidates are ${fmtNum(valid)} and ${fmtNum(extraneous)}. Reject ${fmtNum(extraneous)}: its right side is ${fmtNum(-p)}, whereas a square root cannot be negative. At x = ${fmtNum(valid)}, both sides equal ${d}, so the only solution is ${fmtNum(valid)}.`,
      },
      params: { m, n, k },
    };
  },
  verify({ item, params: { m, n, k } }) {
    const b = -2 * k - m;
    const c = k * k - n;
    const disc = b * b - 4 * c;
    const candidates = [(-b + Math.sqrt(disc)) / 2, (-b - Math.sqrt(disc)) / 2];
    const valid = candidates.filter((x) => m * x + n >= 0 && Math.sqrt(m * x + n) === x - k);
    return valid.length === 1 && valid[0] === parseSpr(item.answer);
  },
};
