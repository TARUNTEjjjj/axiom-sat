import { fmtLinear, fmtNum, fmtPoly, sprNum } from '../../format.js';
import { parseSpr } from '../../spr.js';

export default {
  id: 'advanced.discriminant-parameter',
  domain: 'advanced',
  skill: 'Parameters and the number of real solutions',
  space: 5 * 20 * 51,
  generate(rng) {
    const a = rng.int(2, 6);
    const h = rng.nonzero(-10, 10);
    const b = -2 * a * h;
    const shift = rng.int(-25, 25);
    const k = a * h * h - shift;
    return {
      item: {
        type: 'spr',
        difficulty: 3,
        stem: `The equation ${fmtPoly([a, b, 0])} + ${fmtLinear(1, shift, 'k')} = 0 has exactly one real solution. What is the value of the constant k?`,
        answer: sprNum(k),
        explanation: `A quadratic has exactly one real solution when its discriminant b² − 4ac is zero. Here the constant term is ${fmtLinear(1, shift, 'k')}, so (${fmtNum(b)})² − 4(${a})(${fmtLinear(1, shift, 'k')}) = 0. Therefore ${fmtLinear(1, shift, 'k')} = ${fmtNum(b * b)} / ${4 * a} = ${a * h * h}, giving k = ${fmtNum(k)}. Substitution makes the quadratic ${a}(${fmtLinear(1, -h)})² = 0, with the single solution x = ${fmtNum(h)}.`,
      },
      params: { a, b, shift },
    };
  },
  verify({ item, params: { a, b, shift } }) {
    const k = parseSpr(item.answer);
    if (!Number.isFinite(k)) return false;
    const c = k + shift;
    const root = -b / (2 * a);
    return b * b - 4 * a * c === 0 && a * root * root + b * root + c === 0;
  },
};
