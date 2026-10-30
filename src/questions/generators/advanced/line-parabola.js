import { MINUS, fmtLinear, fmtNum, fmtPoly, sup } from '../../format.js';
import { makeChoices, pickDistractors } from '../../choices.js';
import { answerText } from '../../schema.js';

const COUNTS = ['Zero', 'Exactly one', 'Exactly two', 'Infinitely many'];

// Leading coefficient in front of a factored form: 2(x − 1)(x + 3), −(x − 1)(x + 3).
const lead = (a) => (a === 1 ? '' : a === -1 ? MINUS : fmtNum(a));

// a(x − r₁)(x − r₂) with a zero root written as a bare x: 2x(x + 5), −x(x − 4).
const factored = (a, roots) =>
  lead(a) + (roots.includes(0) ? 'x' : '') + roots.filter((x) => x !== 0).map((x) => `(${fmtLinear(1, -x)})`).join('');

// A line meets the parabola y = ax² + bx + c where ax² + (b − m)x + (c − n) = 0. The
// intersection x-values are chosen first and the line drawn through those points of
// the parabola, so the slope and intercept are integers and the roots are the chosen
// values; for no intersection the tangent line is slid away from the curve.
export default {
  id: 'advanced.line-parabola',
  domain: 'advanced',
  skill: 'Nonlinear equations in one variable and systems of equations in two variables',
  // the two-point question alone: a · b · c · unordered pairs of distinct x-values in [−5, 5],
  // at least 50 of the 55 giving a line that is not horizontal
  space: 4 * 13 * 19 * 50,

  generate(rng) {
    const variant = rng.pick(['count', 'greater', 'tangent']);
    const a = rng.pick([-2, -1, 1, 2]);
    const b = rng.int(-6, 6);
    const c = rng.int(-9, 9);
    const p = (x) => a * x * x + b * x + c;

    const count = variant === 'count' ? rng.int(0, 2) : variant === 'greater' ? 2 : 1;
    let xs;
    let m;
    let n;
    do {
      if (count === 2) {
        const x1 = rng.int(-5, 5);
        let x2 = rng.int(-5, 5);
        while (x2 === x1) x2 = rng.int(-5, 5);
        xs = [Math.min(x1, x2), Math.max(x1, x2)];
        m = a * (x1 + x2) + b;
        n = c - a * x1 * x2;
      } else {
        const t = rng.nonzero(-5, 5); // at t = 0 the line would simply repeat bx + c
        xs = count === 1 ? [t] : [];
        m = 2 * a * t + b;
        // The tangent at t, slid away from the parabola by s when there is to be no contact.
        n = c - a * t * t - (count === 0 ? Math.sign(a) * rng.int(1, 9) : 0);
      }
    } while (m === 0); // a horizontal line y = n would not be set up as a line meeting a parabola

    const parabola = fmtPoly([a, b, c]);
    const line = fmtLinear(m, n);
    const graphs = `the graphs of y = ${parabola} and y = ${line}`;
    const stem =
      variant === 'count'
        ? `In the xy-plane, at how many points do ${graphs} intersect?`
        : variant === 'greater'
          ? `In the xy-plane, ${graphs} intersect at two points. ` +
            'What is the x-coordinate of the point of intersection with the greater x-coordinate?'
          : `In the xy-plane, ${graphs} intersect at exactly one point. What is the x-coordinate of that point?`;

    let choices;
    let answer;
    if (variant === 'count') {
      ({ choices, answer } = makeChoices(rng, COUNTS[count], COUNTS.filter((text) => text !== COUNTS[count])));
    } else {
      const x = xs[xs.length - 1];
      // The other root, a sign slip, the y-coordinate of the point, and 2a·x from
      // forgetting to divide by the leading coefficient.
      const slips = variant === 'greater' ? [xs[0], -x, -xs[0], p(x)] : [-x, p(x), 2 * a * x];
      const distractors = pickDistractors(x, slips);
      ({ choices, answer } = makeChoices(rng, fmtNum(x), distractors.map(fmtNum)));
    }

    const disc = (b - m) ** 2 - 4 * a * (c - n);
    const setEqual =
      `Set the two expressions for y equal: ${parabola} = ${line}, ` +
      `which rearranges to ${fmtPoly([a, b - m, c - n])} = 0. `;
    let explanation;
    if (variant === 'count') {
      const sign = disc < 0 ? 'negative' : disc === 0 ? 'zero' : 'positive';
      const meet = ['do not intersect', 'intersect at exactly one point', 'intersect at exactly two points'][count];
      explanation =
        setEqual +
        `The discriminant is (${fmtNum(b - m)})${sup(2)} ${MINUS} 4(${fmtNum(a)})(${fmtNum(c - n)}) = ` +
        `${fmtNum(disc)}, which is ${sign}, so the graphs ${meet}.`;
    } else if (variant === 'greater') {
      explanation =
        setEqual +
        `Factor: ${factored(a, xs)} = 0, ` +
        `so x = ${fmtNum(xs[0])} or x = ${fmtNum(xs[1])}. The greater x-coordinate is ${fmtNum(xs[1])}.`;
    } else {
      explanation =
        setEqual +
        `The left side factors as ${lead(a)}(${fmtLinear(1, -xs[0])})${sup(2)} = 0, ` +
        `so x = ${fmtNum(xs[0])} is the only solution and the graphs touch at that one point.`;
    }

    // a = 1 factors directly; a negative leading coefficient or a discriminant decision
    // adds a step; |a| = 2 needs factoring with a leading coefficient.
    const difficulty = Math.abs(a) === 2 ? 3 : a === -1 || variant === 'count' ? 2 : 1;

    return {
      item: { type: 'mc', difficulty, stem, choices, answer, explanation },
      params: { variant, a, b, c, m, n, xs },
    };
  },

  // Recompute the discriminant from the displayed coefficients, check that every
  // claimed intersection lies on both graphs, and confirm the displayed answer.
  verify({ item, params: { variant, a, b, c, m, n, xs } }) {
    const disc = (b - m) ** 2 - 4 * a * (c - n);
    const expected = disc < 0 ? 0 : disc === 0 ? 1 : 2;
    if (expected !== xs.length) return false;
    if (!xs.every((x) => a * x * x + b * x + c === m * x + n)) return false;
    if (variant === 'count') return answerText(item) === COUNTS[expected];
    if (variant === 'greater' && !(xs[0] < xs[1] && xs[0] + xs[1] === -(b - m) / a)) return false;
    return answerText(item) === fmtNum(xs[xs.length - 1]);
  },
};
