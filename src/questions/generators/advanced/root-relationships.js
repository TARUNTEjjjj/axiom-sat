import { fmtNum, fmtPoly, sprNum } from '../../format.js';
import { parseSpr } from '../../spr.js';

export default {
  id: 'advanced.root-relationships',
  domain: 'advanced',
  skill: 'Relationships between roots and coefficients',
  space: 5 * 15 * 15 * 21,
  generate(rng) {
    const r = -rng.int(1, 15);
    const s = rng.int(1, 15);
    const a = rng.int(2, 6);
    const b = -a * (r + s);
    const c = a * r * s;
    const offset = rng.int(-10, 10);
    const value = r * r + s * s;
    return {
      item: {
        type: 'spr',
        difficulty: 3,
        stem: `The two solutions of ${fmtPoly([a, b, c + offset])} = ${fmtNum(offset)} are r and s. What is the value of r² + s²?`,
        answer: sprNum(value),
        explanation: `Move the right side to the left to obtain ${fmtPoly([a, b, c])} = 0. For ax² + bx + c = 0, the sum of the roots is −b/a and their product is c/a. Thus r + s = ${fmtNum(r + s)} and rs = ${fmtNum(r * s)}. Since (r + s)² = r² + 2rs + s², we have r² + s² = (${fmtNum(r + s)})² − 2(${fmtNum(r * s)}) = ${value}. There is no need to find either root individually.`,
      },
      params: { a, b, constant: c + offset, offset },
    };
  },
  verify({ item, params: { a, b, constant, offset } }) {
    const disc = b * b - 4 * a * (constant - offset);
    if (disc <= 0) return false;
    const roots = [(-b + Math.sqrt(disc)) / (2 * a), (-b - Math.sqrt(disc)) / (2 * a)];
    return (
      roots.every(Number.isInteger) && parseSpr(item.answer) === roots.reduce((sum, x) => sum + x * x, 0)
    );
  },
};
