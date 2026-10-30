import { TIMES, fmtLinear, fmtNum, fmtPoly, sprNum } from '../../format.js';
import { parseSpr } from '../../spr.js';

// Negative numbers get parentheses when they follow an operator: 5 + (−2).
const operand = (n) => (n < 0 ? `(${fmtNum(n)})` : fmtNum(n));

// Solve x² + bx + c + k = k for its positive solution, or the sum or product of its
// solutions. The two distinct nonzero integer roots are chosen first and b and c derived
// from them, so the quadratic always factors; the constant k on the right side has to
// be moved across before it does.
export default {
  id: 'advanced.quadratic-roots',
  domain: 'advanced',
  skill: 'Nonlinear equations in one variable and systems of equations in two variables',
  // positive: 12 · 12 positive–negative root pairs; sum and product: the 264 unordered
  // pairs of distinct nonzero roots in [−12, 12] whose sum is not zero, each; times 41 values of k
  space: (12 * 12 + 2 * 264) * 41,

  generate(rng) {
    const ask = rng.pick(['positive', 'sum', 'product']);
    let r1;
    let r2;
    if (ask === 'positive') {
      r1 = rng.int(1, 12);
      r2 = -rng.int(1, 12);
    } else {
      r1 = rng.nonzero(-12, 12);
      r2 = rng.nonzero(-12, 12);
      while (r2 === r1 || r2 === -r1) r2 = rng.nonzero(-12, 12); // distinct roots, an x-term kept
    }
    const b = -(r1 + r2);
    const c = r1 * r2;
    const k = rng.chance(0.25) ? 0 : rng.nonzero(-20, 20); // a quarter arrive in standard form

    const equation = `${fmtPoly([1, b, c + k])} = ${fmtNum(k)}`;
    const stem =
      ask === 'positive'
        ? `What is the positive solution to the equation ${equation}?`
        : `What is the ${ask} of the solutions to the equation ${equation}?`;

    const value = ask === 'positive' ? r1 : ask === 'sum' ? r1 + r2 : c;
    const answer = sprNum(value);

    const moved =
      k === 0
        ? ''
        : `${k > 0 ? 'Subtract' : 'Add'} ${fmtNum(Math.abs(k))} ${k > 0 ? 'from' : 'to'} both sides ` +
          `to get ${fmtPoly([1, b, c])} = 0. `;
    const factored = `(${fmtLinear(1, -r1)})(${fmtLinear(1, -r2)}) = 0`;
    const result =
      ask === 'positive'
        ? `The positive solution is ${fmtNum(r1)}.`
        : ask === 'sum'
          ? `Their sum is ${fmtNum(r1)} + ${operand(r2)} = ${fmtNum(r1 + r2)}.`
          : `Their product is ${fmtNum(r1)} ${TIMES} ${operand(r2)} = ${fmtNum(c)}.`;
    const explanation =
      `${moved}Factor the left side: ${factored}, so x = ${fmtNum(r1)} or x = ${fmtNum(r2)}. ${result}`;

    // Standard form factors directly and a constant to move across adds a step. The
    // sum is −b whatever that constant, so only the product then hinges on moving it
    // correctly before reading both roots.
    const difficulty = k === 0 ? 1 : ask === 'product' ? 3 : 2;

    return {
      item: { type: 'spr', difficulty, stem, answer, explanation },
      params: { ask, r1, r2, b, c, k },
    };
  },

  // Substitute both roots into the equation as written, check that they are distinct
  // and sit on the right sides of zero, and compare the typed answer with the exact value.
  verify({ item, params: { ask, r1, r2, b, c, k } }) {
    const holds = (x) => x * x + b * x + (c + k) === k;
    if (!holds(r1) || !holds(r2) || r1 === r2) return false;
    if (ask === 'positive' && !(r1 > 0 && r2 < 0)) return false;
    const expected = ask === 'positive' ? r1 : ask === 'sum' ? r1 + r2 : r1 * r2;
    return parseSpr(item.answer) === expected;
  },
};
