import { MINUS, fmtFrac, fmtLinear, fmtNum, gcd } from '../../format.js';
import { makeChoices, pickDistractors } from '../../choices.js';
import { answerText } from '../../schema.js';

const KINDS = ['slope', 'equation', 'intercept'];

const point = (x, y) => `(${fmtNum(x)}, ${fmtNum(y)})`;

const through = (x1, y1, x2, y2) =>
  `In the xy-plane, a line passes through the points ${point(x1, y1)} and ${point(x2, y2)}.`;

// A negative number in parentheses where it follows an operator: 5 − (−3).
const wrap = (n) => (n < 0 ? `(${fmtNum(n)})` : fmtNum(n));
const difference = (a, b) => `${fmtNum(a)} ${MINUS} ${wrap(b)}`;

// The product of a slope p/q and an x-coordinate as it is written out: 3(5), −2(−4),
// (3/2)(4), and plainly 5 or −(−4) when the slope is ±1.
function times(p, q, x) {
  if (q !== 1) return `(${fmtFrac(p, q)})(${fmtNum(x)})`;
  if (p === 1) return fmtNum(x);
  if (p === -1) return MINUS + wrap(x);
  return `${fmtNum(p)}(${fmtNum(x)})`;
}

// Finding b from a point on y = mx + b: "7 = 3(4) + b = 12 + b, so b = −5", with
// the middle step dropped when the product is already a plain number.
function findB(p, q, x1, y1, b) {
  const product = times(p, q, x1);
  const value = fmtNum((p * x1) / q);
  const middle = product === value ? '' : ` = ${value} + b`;
  return `${fmtNum(y1)} = ${product} + b${middle}, so b = ${fmtNum(b)}`;
}

// y = (p/q)x + b, with a fractional slope in parentheses.
function lineText(p, q, b) {
  if (q === 1) return fmtLinear(p, b);
  const slope = `(${fmtFrac(p, q)})x`;
  if (b === 0) return slope;
  return `${slope} ${b < 0 ? MINUS : '+'} ${fmtNum(Math.abs(b))}`;
}

// A positive integer slope is 1; a negative integer or a positive fraction is 2;
// a negative fraction is 3.
const level = (p, q) => (q === 1 ? (p > 0 ? 1 : 2) : p > 0 ? 2 : 3);

// A slope p/q in lowest terms with q > 0.
function reducedSlope(rng, pMax, qMax) {
  let p;
  let q;
  do {
    p = rng.nonzero(-pMax, pMax);
    q = rng.int(1, qMax);
  } while (gcd(p, q) !== 1);
  return [p, q];
}

// Three distinct texts other than `correct`: the candidates in order (realistic
// slips), then fallback(1), fallback(-1), fallback(2), ... until there are three.
function pickTexts(correct, candidates, fallback) {
  const out = [];
  const take = (text) => {
    if (text !== correct && !out.includes(text)) out.push(text);
  };
  for (const text of candidates) if (out.length < 3) take(text);
  for (let k = 1; out.length < 3; k++) {
    take(fallback(k));
    if (out.length < 3) take(fallback(-k));
    if (k > 1000) throw new Error('pickTexts: fallback never produced new texts');
  }
  return out;
}

// The slope of the line through two points. The x-coordinates are multiples of q,
// so both points have integer coordinates whatever the slope.
function slope(rng) {
  const [p, q] = reducedSlope(rng, 9, 5);
  const b = rng.int(-9, 9);
  const k1 = rng.int(-6, 6);
  let k2 = rng.int(-6, 6);
  while (k2 === k1) k2 = rng.int(-6, 6); // two different points
  const [x1, y1, x2, y2] = [q * k1, p * k1 + b, q * k2, p * k2 + b];
  const dy = y2 - y1;
  const dx = x2 - x1;

  // The distractors are fractions, so each candidate value remembers its text.
  const texts = new Map();
  const frac = (n, d) => {
    texts.set(n / d, fmtFrac(n, d));
    return n / d;
  };
  // Run over rise, a sign slip, both at once, adding coordinates instead of subtracting.
  const slips = [frac(dx, dy), frac(-dy, dx), frac(-dx, dy), x1 + x2 === 0 ? NaN : frac(y1 + y2, x1 + x2)];
  const distractors = pickDistractors(p / q, slips, 3, (k) => frac(p + k * q, q));

  // The raw ratio is shown only when it still has to be reduced or its signs fixed.
  const reduced = fmtFrac(dy, dx);
  const raw = dx > 0 && gcd(dy, dx) === 1 ? '' : `${wrap(dy)}/${wrap(dx)} = `;
  return {
    stem: `${through(x1, y1, x2, y2)} What is the slope of the line?`,
    correct: fmtFrac(p, q),
    distractors: distractors.map((v) => texts.get(v)),
    explanation:
      'The slope of a line through two points is the change in y divided by the change in x: ' +
      `(${difference(y2, y1)})/(${difference(x2, x1)}) = ${raw}${reduced}.`,
    difficulty: level(p, q),
    params: { p, q, b, x1, y1, x2, y2 },
  };
}

// An equation of the line through two points, in slope-intercept form. Integer
// slopes keep the choices to the shape y = 3x − 2.
function equation(rng) {
  const m = rng.nonzero(-6, 6);
  const b = rng.nonzero(-9, 9);
  const x1 = rng.nonzero(-6, 6);
  let x2 = rng.nonzero(-6, 6);
  while (x2 === x1) x2 = rng.nonzero(-6, 6); // two different points, neither on the y-axis
  const y1 = m * x1 + b;
  const y2 = m * x2 + b;
  const line = (slope, intercept) => `y = ${fmtLinear(slope, intercept)}`;
  const correct = line(m, b);
  return {
    stem: `${through(x1, y1, x2, y2)} Which of the following is an equation of the line?`,
    correct,
    // Swapping slope and intercept, a sign slip on either, and using a given
    // y-coordinate as the intercept.
    distractors: pickTexts(correct, [line(b, m), line(m, -b), line(-m, b), line(m, y1)], (k) => line(m, b + k)),
    explanation:
      `The slope is (${difference(y2, y1)})/(${difference(x2, x1)}) = ${fmtNum(m)}. ` +
      `Substituting the slope and the point ${point(x1, y1)} into y = mx + b gives ` +
      `${findB(m, 1, x1, y1, b)}. The line is ${correct}.`,
    difficulty: level(m, 1),
    params: { p: m, q: 1, b, x1, y1, x2, y2 },
  };
}

// An intercept of the line through two points, as an ordered pair. The x-intercept
// (qj, 0) is chosen first; the y-intercept −pj is then an integer as well.
function intercept(rng) {
  const [p, q] = reducedSlope(rng, 6, 4);
  const j = rng.nonzero(-5, 5);
  const x0 = q * j;
  const b = -p * j;
  const pickK = () => {
    let k = rng.int(-6, 6);
    while (k === 0 || k === j) k = rng.int(-6, 6); // neither given point is an intercept
    return k;
  };
  const k1 = pickK();
  let k2 = pickK();
  while (k2 === k1) k2 = pickK();
  const [x1, y1, x2, y2] = [q * k1, p * (k1 - j), q * k2, p * (k2 - j)];
  const axis = rng.pick(['x', 'y']);
  const correct = axis === 'x' ? point(x0, 0) : point(0, b);
  // Swapping the coordinates, a sign slip, the other intercept, and the other
  // intercept's value placed on this axis.
  const distractors =
    axis === 'x'
      ? pickTexts(correct, [point(0, x0), point(-x0, 0), point(0, b), point(b, 0)], (k) => point(x0 + k, 0))
      : pickTexts(correct, [point(b, 0), point(0, -b), point(x0, 0), point(0, x0)], (k) => point(0, b + k));

  const line = lineText(p, q, b);
  const found =
    axis === 'x'
      ? `The line crosses the x-axis where y = 0: solving 0 = ${line} gives x = ${fmtNum(x0)}, ` +
        `so the x-intercept is ${point(x0, 0)}.`
      : `The line crosses the y-axis where x = 0, so the y-intercept is ${point(0, b)}.`;
  return {
    stem: `${through(x1, y1, x2, y2)} What is the ${axis}-intercept of the line?`,
    correct,
    distractors,
    explanation:
      `The slope is (${difference(y2, y1)})/(${difference(x2, x1)}) = ${fmtFrac(p, q)}. ` +
      `Substituting the slope and the point ${point(x1, y1)} into y = mx + b gives ` +
      `${findB(p, q, x1, y1, b)}. An equation of the line is therefore y = ${line}. ${found}`,
    // Finding the x-intercept takes one more step than reading off b.
    difficulty: Math.min(3, level(p, q) + (axis === 'x' ? 1 : 0)),
    params: { p, q, b, x1, y1, x2, y2, axis },
  };
}

const VARIANTS = { slope, equation, intercept };

// The slope, an equation, or an intercept of the line through two points with
// integer coordinates. The line y = (p/q)x + b is chosen first and the points are
// read off it, so every answer is exact.
export default {
  id: 'algebra.line-two-points',
  domain: 'algebra',
  skill: 'Linear equations in two variables',
  // Slope ask: 66 reduced slopes (|p| ≤ 9, q ≤ 5) · 19 intercepts · 13 · 12 ordered
  // pairs of distinct x-values. Equation ask: 12 slopes · 18 intercepts · 12 · 11
  // nonzero x-values. Intercept ask: 32 reduced slopes (|p| ≤ 6, q ≤ 4) · 10
  // x-intercepts · 11 · 10 x-values · 2 axes. The two points pin down the line, so
  // different parameters always give different stems.
  space: 66 * 19 * 13 * 12 + 12 * 18 * 12 * 11 + 32 * 10 * 11 * 10 * 2,

  generate(rng) {
    const kind = rng.pick(KINDS);
    const { stem, correct, distractors, explanation, difficulty, params } = VARIANTS[kind](rng);
    const { choices, answer } = makeChoices(rng, correct, distractors);
    return {
      item: { type: 'mc', difficulty, stem, choices, answer, explanation },
      params: { kind, ...params },
    };
  },

  // Both given points must satisfy qy = px + qb; the displayed answer is then rebuilt
  // from the two points alone, in integers: slope as rise over run, the y-intercept
  // from b·dx = y1·dx − dy·x1 and the x-intercept from −b·dx/dy.
  verify({ item, params: { kind, p, q, b, x1, y1, x2, y2, axis } }) {
    if (x1 === x2 || q * y1 !== p * x1 + q * b || q * y2 !== p * x2 + q * b) return false;
    const dy = y2 - y1;
    const dx = x2 - x1;
    const text = answerText(item);
    if (kind === 'slope') return text === fmtFrac(dy, dx);
    const bdx = y1 * dx - dy * x1;
    if (bdx % dx !== 0) return false;
    const intercept = bdx / dx;
    if (kind === 'equation') return dy % dx === 0 && text === `y = ${fmtLinear(dy / dx, intercept)}`;
    if (axis === 'y') return text === point(0, intercept);
    return (intercept * dx) % dy === 0 && text === point((-intercept * dx) / dy, 0);
  },
};
