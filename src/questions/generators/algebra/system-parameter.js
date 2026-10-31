import { fmtNum, fmtTerm, sprNum } from '../../format.js';
import { parseSpr } from '../../spr.js';

export default {
  id: 'algebra.system-parameter',
  domain: 'algebra',
  skill: 'Parameters in linear systems with no solution',
  space: 9 * 24 * 61 * 7 * 30,
  generate(rng) {
    const a = rng.int(2, 10);
    const b = rng.nonzero(-12, 12);
    const c = rng.int(-30, 30);
    const multiplier = rng.int(2, 8);
    const d = multiplier * a;
    const e = multiplier * c + rng.nonzero(-15, 15);
    const k = multiplier * b;
    const first = `${a}x ${b < 0 ? '−' : '+'} ${fmtTerm(Math.abs(b), 'y')} = ${fmtNum(c)}`;
    return {
      item: {
        type: 'spr',
        difficulty: 3,
        stem: `The system of equations ${first} and ${d}x + ky = ${fmtNum(e)} has no solution. What is the value of the constant k?`,
        answer: sprNum(k),
        explanation: `For two linear equations to have no solution, their variable coefficients must be proportional while their constants are not proportional by the same factor. The x-coefficients give the multiplier ${d}/${a} = ${multiplier}. Therefore k must be ${multiplier}(${fmtNum(b)}) = ${fmtNum(k)}. Multiplying the first equation by ${multiplier} would give the constant ${fmtNum(multiplier * c)}, which differs from ${fmtNum(e)}. The equations then describe distinct parallel lines, confirming that there is no solution.`,
      },
      params: { a, b, c, d, e },
    };
  },
  verify({ item, params: { a, b, c, d, e } }) {
    const k = parseSpr(item.answer);
    return a * k - b * d === 0 && a * e - c * d !== 0;
  },
};
