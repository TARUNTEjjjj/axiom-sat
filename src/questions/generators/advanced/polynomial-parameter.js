import { fmtLinear, fmtNum, fmtPoly, sprNum } from '../../format.js';
import { parseSpr } from '../../spr.js';

export default {
  id: 'advanced.polynomial-parameter',
  domain: 'advanced',
  skill: 'Polynomial identities and unknown coefficients',
  space: 18 * 6 * 24 * 30,
  generate(rng) {
    const p = rng.nonzero(-9, 9);
    const a = rng.int(2, 7);
    const b = rng.nonzero(-12, 12);
    const c = rng.nonzero(-15, 15);
    const d = a * p + b;
    const constant = c * p;
    const k = c + b * p;
    const right = `${fmtPoly([a, d, 0, 0])} + kx ${constant < 0 ? '−' : '+'} ${Math.abs(constant)}`;
    return {
      item: {
        type: 'spr',
        difficulty: 3,
        stem: `The identity (${fmtLinear(1, p)})(${a}x² + bx + c) = ${right} is true for every real number x, where b, c, and k are constants. What is k?`,
        answer: sprNum(k),
        explanation: `Match coefficients after expansion. The coefficient of x² is b + (${fmtNum(p)})(${a}) = ${fmtNum(d)}, so b = ${fmtNum(b)}. The constant term is (${fmtNum(p)})c = ${fmtNum(constant)}, so c = ${fmtNum(c)}. The coefficient of x is c + pb; therefore k = ${fmtNum(c)} + (${fmtNum(p)})(${fmtNum(b)}) = ${fmtNum(k)}. Matching the constant term first avoids expanding an expression with three unknowns.`,
      },
      params: { p, a, d, constant },
    };
  },
  verify({ item, params: { p, a, d, constant } }) {
    const b = d - a * p;
    const c = constant / p;
    const k = parseSpr(item.answer);
    if (!Number.isFinite(k)) return false;
    return [-3, -1, 0, 2, 5].every(
      (x) => (x + p) * (a * x * x + b * x + c) === a * x ** 3 + d * x * x + k * x + constant,
    );
  },
};
