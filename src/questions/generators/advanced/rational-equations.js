import { fmtLinear, fmtNum, fmtPoly, sprNum } from '../../format.js';
import { parseSpr } from '../../spr.js';

export default {
  id: 'advanced.rational-equations',
  domain: 'advanced',
  skill: 'Rational equations and excluded values',
  space: 6 * 30 * 49,
  generate(rng) {
    const a = rng.int(2, 7);
    const r = rng.nonzero(-15, 15);
    let t = rng.int(-25, 25);
    while (t === 2 * r) t = rng.int(-25, 25);
    const rhs = a * t;
    const root = t - r;
    const denominator = fmtLinear(1, -r);
    return {
      item: {
        type: 'spr',
        difficulty: 3,
        stem: `What is the solution to (${fmtPoly([a, 0, -a * r * r])}) / (${denominator}) = ${fmtNum(rhs)}?`,
        answer: sprNum(root),
        explanation: `First exclude x = ${fmtNum(r)}, because the original denominator would be zero. Factor the numerator as ${a}(${denominator})(${fmtLinear(1, r)}). For x ≠ ${fmtNum(r)}, cancel the common factor to get ${a}(${fmtLinear(1, r)}) = ${fmtNum(rhs)}. Divide by ${a}: ${fmtLinear(1, r)} = ${fmtNum(t)}, so x = ${fmtNum(root)}. This value is not excluded and gives ${fmtNum(rhs)} when substituted into the original expression.`,
      },
      params: { a, r, rhs },
    };
  },
  verify({ item, params: { a, r, rhs } }) {
    const x = parseSpr(item.answer);
    return Number.isFinite(x) && x !== r && (a * x * x - a * r * r) / (x - r) === rhs;
  },
};
