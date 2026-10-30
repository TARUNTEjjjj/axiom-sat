import { MINUS, TIMES, fmtLinear, fmtNum, fmtPoly, fmtTerm, gcd, sup } from '../../format.js';
import { makeChoices, pickDistractors } from '../../choices.js';
import { answerText } from '../../schema.js';

// A monomial: 4x⁶, x, 10x⁷.
const mono = (coef, power) => (power === 1 ? fmtTerm(coef) : fmtTerm(coef) + sup(power));

const sign = (n) => (n < 0 ? MINUS : '+');

// Expand (ax + b)(cx + d) and ask for the whole product or just its x-coefficient.
// The factors are chosen first, so the expansion is exact and every distractor is
// the result of one definite slip. Each binomial is primitive: (6x + 6) would just be
// 6(x + 1) in disguise.
function expand(rng, kind) {
  const a = rng.int(1, 6);
  const c = rng.int(1, 6);
  let b = rng.nonzero(-9, 9);
  while (gcd(a, b) > 1) b = rng.nonzero(-9, 9);
  let d = rng.nonzero(-9, 9);
  // ad + bc ≠ 0 keeps an x-term in the product; ad ≠ bc keeps the two cross-term
  // distractors apart from each other.
  while (gcd(c, d) > 1 || a * d + b * c === 0 || a * d === b * c) d = rng.nonzero(-9, 9);

  const p = a * c;
  const q = a * d + b * c;
  const r = b * d;
  const factors = `(${fmtLinear(a, b)})(${fmtLinear(c, d)})`;
  const product = fmtPoly([p, q, r]);

  let stem;
  let choices;
  let answer;
  if (kind === 'expand') {
    stem = `Which of the following is equivalent to ${factors}?`;
    // Dropping the cross terms, a sign slip on one cross term, a sign slip on the constant.
    ({ choices, answer } = makeChoices(rng, product, [
      fmtPoly([p, 0, r]),
      fmtPoly([p, a * d - b * c, r]),
      fmtPoly([p, q, -r]),
    ]));
  } else {
    stem =
      `The expression ${factors} is equivalent to px${sup(2)} + qx + r, ` +
      'where p, q, and r are constants. What is the value of q?';
    // A sign slip on a cross term, keeping only one cross term, reading off the constant.
    const distractors = pickDistractors(q, [a * d - b * c, a * d, b * c, r]);
    ({ choices, answer } = makeChoices(rng, fmtNum(q), distractors.map(fmtNum)));
  }

  const terms =
    `${fmtPoly([p, a * d, 0])} ${sign(b * c)} ${fmtTerm(Math.abs(b * c))} ` +
    `${sign(r)} ${fmtNum(Math.abs(r))}`;
  const explanation =
    `Use the distributive property: ${factors} = ${terms}. ` +
    `Combine the like terms ${fmtTerm(a * d)} and ${fmtTerm(b * c)} to get ${product}.` +
    (kind === 'expand' ? '' : ` The coefficient of x is ${fmtNum(q)}.`);

  // One point for each leading coefficient above 1 and one for a negative constant;
  // a single point is still an expansion done in one's head.
  const difficulty = Math.max(1, (a > 1) + (c > 1) + (b < 0 || d < 0));

  return {
    item: { type: 'mc', difficulty, stem, choices, answer, explanation },
    params: { kind, a, b, c, d },
  };
}

// Combine (k1·x^m)(k2·x^n) or (k1·x^m)/(k2·x^n). The quotient is built from its
// answer so the coefficients always divide and the exponent never drops to zero.
function powers(rng, kind) {
  let k1;
  let k2;
  let m;
  let n;
  if (kind === 'product') {
    k1 = rng.int(2, 9);
    k2 = rng.int(2, 9);
    while (k1 + k2 === k1 * k2) k2 = rng.int(2, 9); // 2 + 2 = 2 · 2 would merge two choices
    m = rng.int(2, 9);
    n = rng.int(2, 9);
    while (m + n === m * n) n = rng.int(2, 9);
  } else {
    const k = rng.int(2, 9);
    k2 = rng.int(2, 9);
    while (k * k2 - k2 === k) k2 = rng.int(2, 9); // 4 − 2 = 2 would merge two choices
    k1 = k * k2;
    n = rng.int(2, 6);
    m = n + rng.int(1, 8);
  }

  const coef = kind === 'product' ? k1 * k2 : k1 / k2;
  const power = kind === 'product' ? m + n : m - n;
  const correct = mono(coef, power);
  // Adding the coefficients instead of multiplying (or subtracting instead of
  // dividing), and doing to the exponents what should be done to the coefficients.
  const wrongCoef = kind === 'product' ? k1 + k2 : k1 - k2;
  const wrongPower = kind === 'product' ? m * n : m + n;
  const { choices, answer } = makeChoices(rng, correct, [
    mono(wrongCoef, power),
    mono(coef, wrongPower),
    mono(wrongCoef, wrongPower),
  ]);

  const given =
    kind === 'product' ? `(${mono(k1, m)})(${mono(k2, n)})` : `(${mono(k1, m)})/(${mono(k2, n)})`;
  const stem =
    kind === 'product'
      ? `Which of the following is equivalent to ${given}?`
      : `Which of the following is equivalent to ${given}, where x > 0?`;

  const explanation =
    kind === 'product'
      ? `Multiply the coefficients and add the exponents of the like bases: ` +
        `${fmtNum(k1)} ${TIMES} ${fmtNum(k2)} = ${fmtNum(coef)} and ` +
        `x${sup(m)} ${TIMES} x${sup(n)} = x${sup(power)}. So ${given} = ${correct}.`
      : `Divide the coefficients and subtract the exponents of the like bases: ` +
        `${fmtNum(k1)}/${fmtNum(k2)} = ${fmtNum(coef)} and ` +
        `x${sup(m)}/x${sup(n)} = ${mono(1, power)}. So ${given} = ${correct}.`;

  return {
    item: { type: 'mc', difficulty: 1, stem, choices, answer, explanation },
    params: { kind, k1, m, k2, n },
  };
}

export default {
  id: 'advanced.expressions',
  domain: 'advanced',
  skill: 'Equivalent expressions',
  // expand and coefficient: 72 primitive (a, b) pairs · at least 60 primitive (c, d) pairs
  // surviving the loop, asked two ways; product: 63 coefficient pairs · 63 exponent pairs;
  // quotient: 63 coefficient pairs · n · (m − n)
  space: 2 * 72 * 60 + 63 * 63 + 63 * 5 * 8,

  generate(rng) {
    const kind = rng.pick(['expand', 'coefficient', 'product', 'quotient']);
    return kind === 'product' || kind === 'quotient' ? powers(rng, kind) : expand(rng, kind);
  },

  // Evaluate both sides numerically rather than re-expanding: a quadratic identity
  // that holds at three points holds everywhere, and a monomial identity at two.
  verify({ item, params }) {
    const { kind } = params;
    if (kind === 'expand' || kind === 'coefficient') {
      const { a, b, c, d } = params;
      const p = a * c;
      const q = a * d + b * c;
      const r = b * d;
      const same = [-1, 2, 3].every((x) => (a * x + b) * (c * x + d) === p * x * x + q * x + r);
      return same && answerText(item) === (kind === 'expand' ? fmtPoly([p, q, r]) : fmtNum(q));
    }
    const { k1, m, k2, n } = params;
    const coef = kind === 'product' ? k1 * k2 : k1 / k2;
    const power = kind === 'product' ? m + n : m - n;
    if (!Number.isInteger(coef) || power < 1) return false;
    const same = [2, 3].every((x) =>
      kind === 'product'
        ? k1 * x ** m * (k2 * x ** n) === coef * x ** power
        : (k1 * x ** m) / (k2 * x ** n) === coef * x ** power,
    );
    return same && answerText(item) === mono(coef, power);
  },
};
