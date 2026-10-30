import { fmtLinear, fmtNum, fmtTerm } from '../../format.js';
import { makeChoices, pickDistractors } from '../../choices.js';
import { answerText } from '../../schema.js';

// Solve ax + b = cx + d. The solution x is chosen first and d is derived from it,
// so the answer is always an integer and the equation always has exactly one.
export default {
  id: 'algebra.linear-one-var',
  domain: 'algebra',
  skill: 'Linear equations in one variable',
  space: 25 * 18 * 16 * 41, // x · a · c · b ranges below; d is determined by them

  generate(rng) {
    const x = rng.int(-12, 12);
    const a = rng.nonzero(-9, 9);
    let c = rng.int(-8, 8);
    while (c === a) c = rng.int(-8, 8); // a ≠ c keeps exactly one solution
    const b = rng.int(-20, 20);
    const d = a * x + b - c * x;

    const stem = `If ${fmtLinear(a, b)} = ${fmtLinear(c, d)}, what is the value of x?`;

    // Common slips: a sign error on the answer, adding the x-coefficients instead
    // of subtracting, and losing the sign of the constant term.
    const distractors = pickDistractors(x, [
      -x,
      a + c === 0 ? NaN : Math.round((d - b) / (a + c)),
      Math.round((d + b) / (a - c)),
    ]);
    const { choices, answer } = makeChoices(rng, fmtNum(x), distractors.map(fmtNum));

    const k = a - c;
    const collected = `${fmtTerm(k)} = ${fmtNum(d - b)}`;
    const explanation =
      k === 1
        ? `Collect the x-terms on one side and the constants on the other: ${collected}.`
        : `Collect the x-terms on one side and the constants on the other: ${collected}. ` +
          `Divide both sides by ${fmtNum(k)}: x = ${fmtNum(x)}.`;

    const difficulty = c === 0 ? 1 : Math.max(Math.abs(a), Math.abs(c)) <= 5 ? 2 : 3;

    return {
      item: { type: 'mc', difficulty, stem, choices, answer, explanation },
      params: { a, b, c, d, x },
    };
  },

  // Substitute the answer back into both sides of the original equation.
  verify({ item, params: { a, b, c, d, x } }) {
    return a * x + b === c * x + d && answerText(item) === fmtNum(x);
  },
};
