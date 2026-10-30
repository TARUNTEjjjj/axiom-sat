import { MINUS, fmtComma, fmtLinear, fmtMoney, fmtNum, fmtPoly, sup, supVar } from '../../format.js';
import { makeChoices, pickDistractors } from '../../choices.js';
import { answerText } from '../../schema.js';

// Quantities that compound: the first six grow, the last six shrink. The starting
// amount is a multiple of 500 drawn from `amounts`, 1,000–30,000 unless a context
// needs its own range (a club has hundreds of members, a vehicle costs thousands).
const AMOUNTS = [2, 60];
const CONTEXTS = [
  {
    intro: 'The population of a town',
    short: 'the population',
    period: 'year',
    start: 'in 2015',
    after: '2015',
  },
  {
    intro: 'The number of members of a hiking club',
    short: 'the number of members',
    period: 'year',
    start: 'in 2018',
    after: '2018',
    amounts: [1, 6],
  },
  {
    intro: 'The number of bacteria in a culture',
    short: 'the number of bacteria',
    period: 'hour',
    start: 'at the start of an experiment',
    after: 'the experiment began',
  },
  {
    intro: 'The value of a painting',
    short: 'the value of the painting',
    period: 'year',
    start: 'when it was appraised',
    after: 'the appraisal',
    money: true,
  },
  {
    intro: 'The number of subscribers to a newsletter',
    short: 'the number of subscribers',
    period: 'month',
    start: 'when the newsletter launched',
    after: 'the launch',
  },
  {
    intro: 'The amount of money in a savings account',
    short: 'the amount in the account',
    period: 'year',
    start: 'when the account was opened',
    after: 'the account was opened',
    money: true,
  },
  {
    intro: 'The value of a car',
    short: 'the value of the car',
    period: 'year',
    start: 'when it was purchased',
    after: 'the purchase',
    money: true,
    amounts: [10, 60],
  },
  {
    intro: 'The number of fish in a lake',
    short: 'the number of fish',
    period: 'year',
    start: 'at the start of a study',
    after: 'the study began',
  },
  {
    intro: 'The value of a delivery van',
    short: 'the value of the van',
    period: 'year',
    start: 'when it was bought',
    after: 'it was bought',
    money: true,
    amounts: [10, 60],
  },
  {
    intro: 'The number of trees in a forest',
    short: 'the number of trees',
    period: 'year',
    start: 'at the start of a survey',
    after: 'the survey began',
  },
  {
    intro: 'The number of daily visitors to a website',
    short: 'the number of daily visitors',
    period: 'month',
    start: 'when the site was redesigned',
    after: 'the redesign',
  },
  {
    intro: 'The value of a boat',
    short: 'the value of the boat',
    period: 'year',
    start: 'when it was purchased',
    after: 'the purchase',
    money: true,
    amounts: [10, 60],
  },
];
const GROWTH_RATES = [2, 3, 4, 5, 6, 7, 8, 9, 10, 12];
const DECAY_RATES = [5, 8, 10, 12, 15, 20, 25, 30];

const lead = (a) => (a === 1 ? '' : a === -1 ? MINUS : fmtNum(a));
const point = (x, y) => `(${fmtNum(x)}, ${fmtNum(y)})`;
const intercepts = (x1, x2) => `(${fmtNum(x1)}, 0) and (${fmtNum(x2)}, 0)`;
// An exponential model with the variable as a true superscript: P(t) = 2,000(1.05)ᵗ.
const model = (a, base) => `P(t) = ${fmtComma(a)}(${fmtNum(base)})${supVar('t')}`;

// f(x) = a(x − h)² + k shown in standard form; ask for the vertex, the extreme value
// or the x-intercepts. The vertex is chosen first, and for the intercepts k = −ad² so
// that the roots h ± d are integers.
function quadratic(rng) {
  const ask = rng.pick(['vertex', 'extreme', 'intercepts']);
  const a = rng.pick([-3, -2, -1, 1, 2, 3]);
  const h = rng.nonzero(-8, 8); // h ≠ 0 keeps the sign-slip distractors distinct
  const d = ask === 'intercepts' ? rng.int(2, 5) : 0; // d ≥ 2 keeps h ± d² apart from h ± d
  const k = ask === 'intercepts' ? -a * d * d : rng.int(-12, 12);
  const c = a * h * h + k;
  const f = (x) => a * (x - h) * (x - h) + k;

  const standard = fmtPoly([a, -2 * a * h, c]);
  const defined = `The function f is defined by f(x) = ${standard}.`;
  const stem =
    ask === 'vertex'
      ? `${defined} In the xy-plane, which of the following is the vertex of the graph of y = f(x)?`
      : ask === 'extreme'
        ? `${defined} What is the ${a > 0 ? 'minimum' : 'maximum'} value of f(x)?`
        : `${defined} In the xy-plane, which of the following are the x-intercepts of the graph of y = f(x)?`;

  let choices;
  let answer;
  if (ask === 'vertex') {
    // A sign slip on −b/(2a), that slip carried into the y-coordinate, and the constant term read as k.
    ({ choices, answer } = makeChoices(rng, point(h, k), [point(-h, k), point(-h, f(-h)), point(h, c)]));
  } else if (ask === 'extreme') {
    // The x-coordinate instead of the value, the constant term and a sign slip; any
    // gap is filled a unit away rather than with a value far from the answer.
    const distractors = pickDistractors(k, [h, c, -k]);
    ({ choices, answer } = makeChoices(rng, fmtNum(k), distractors.map(fmtNum)));
  } else {
    // A sign slip on h, forgetting to shift by h, and forgetting the square root.
    ({ choices, answer } = makeChoices(rng, intercepts(h - d, h + d), [
      intercepts(-h - d, -h + d),
      intercepts(-d, d),
      intercepts(h - d * d, h + d * d),
    ]));
  }

  const shifted = fmtLinear(1, -h);
  const vertexForm =
    `${lead(a)}(${shifted})${sup(2)}` + (k === 0 ? '' : ` ${k < 0 ? MINUS : '+'} ${fmtNum(Math.abs(k))}`);
  const square =
    `Completing the square gives f(x) = ${vertexForm}, ` +
    `so the graph is a parabola with vertex ${point(h, k)}.`;
  const opens = a > 0 ? 'positive, the parabola opens upward' : 'negative, the parabola opens downward';
  const explanation =
    ask === 'vertex'
      ? square
      : ask === 'extreme'
        ? `${square} Because a = ${fmtNum(a)} is ${opens}, ` +
          `so its ${a > 0 ? 'minimum' : 'maximum'} value is the y-coordinate of the vertex, ${fmtNum(k)}.`
        : `${square} Set f(x) = 0: ${lead(a)}(${shifted})${sup(2)} = ${fmtNum(-k)}, so (${shifted})${sup(2)} = ${fmtNum(d * d)} ` +
          `and ${shifted} = ${fmtNum(d)} or ${shifted} = ${fmtNum(-d)}, giving x = ${fmtNum(h + d)} or x = ${fmtNum(h - d)}. ` +
          `The x-intercepts are ${intercepts(h - d, h + d)}.`;

  // Intercepts take the most steps; otherwise a leading coefficient of ±1 is the easy case.
  const difficulty = ask === 'intercepts' ? 3 : Math.abs(a) === 1 ? 1 : 2;

  return {
    item: { type: 'mc', difficulty, stem, choices, answer, explanation },
    params: { kind: 'quadratic', ask, a, h, k, d },
  };
}

// A quantity that changes by r% each period: which P(t) = a(1 ± r/100)ᵗ models it?
function exponential(rng) {
  const index = rng.int(0, CONTEXTS.length - 1);
  const context = CONTEXTS[index];
  const growth = index < 6;
  const r = rng.pick(growth ? GROWTH_RATES : DECAY_RATES);
  const [lo, hi] = context.amounts || AMOUNTS;
  const a = rng.int(lo, hi) * 500; // a multiple of 500, so r% of it is a whole number
  const factor = (100 + (growth ? r : -r)) / 100;

  const amount = context.money ? fmtMoney(a) : fmtComma(a);
  const stem =
    `${context.intro} was ${amount} ${context.start}. Each ${context.period} after that, ` +
    `${context.short} ${growth ? 'increases' : 'decreases'} by ${fmtNum(r)}%. ` +
    `Which of the following functions P models ${context.short} t ${context.period}s after ${context.after}?`;

  // The wrong direction, the rate used alone as the base, and a linear model.
  const { choices, answer } = makeChoices(rng, model(a, factor), [
    model(a, (100 - (growth ? r : -r)) / 100),
    model(a, r / 100),
    `P(t) = ${fmtComma(a)} ${growth ? '+' : MINUS} ${fmtComma((a * r) / 100)}t`,
  ]);

  const percent = growth ? `100% + ${fmtNum(r)}% = ${fmtNum(100 + r)}%` : `100% ${MINUS} ${fmtNum(r)}% = ${fmtNum(100 - r)}%`;
  const explanation =
    `${growth ? 'An increase' : 'A decrease'} of ${fmtNum(r)}% each ${context.period} leaves ${percent} of the previous ` +
    `value, so each ${context.period} ${context.short} is multiplied by ${fmtNum(factor)}. After t ${context.period}s the ` +
    `initial ${fmtComma(a)} has been multiplied by ${fmtNum(factor)} a total of t times, which is ${model(a, factor)}.`;

  return {
    item: { type: 'mc', difficulty: growth ? 1 : 2, stem, choices, answer, explanation },
    params: { kind: 'exponential', index, a, r, growth },
  };
}

export default {
  id: 'advanced.nonlinear-models',
  domain: 'advanced',
  skill: 'Nonlinear functions',
  // vertex and extreme: a · h · k, asked two ways; intercepts: a · h · d;
  // exponential: 301 growth (context, amount) pairs · 10 rates + 330 decay pairs · 8 rates
  space: 2 * 6 * 16 * 25 + 6 * 16 * 4 + 301 * 10 + 330 * 8,

  generate(rng) {
    return rng.chance(0.5) ? quadratic(rng) : exponential(rng);
  },

  // Quadratic: read a, b, c back off the standard form and locate the vertex with
  // x = −b/(2a) rather than by completing the square. Exponential: check the model's
  // first step against plain percentage arithmetic.
  verify({ item, params }) {
    if (params.kind === 'quadratic') {
      const { ask, a, h, k, d } = params;
      const b = -2 * a * h;
      const c = a * h * h + k;
      const standard = (x) => a * x * x + b * x + c;
      if (-b / (2 * a) !== h || standard(h) !== k) return false;
      if (ask === 'vertex') return answerText(item) === point(h, k);
      if (ask === 'extreme') {
        return item.stem.includes(a > 0 ? 'minimum' : 'maximum') && answerText(item) === fmtNum(k);
      }
      return standard(h - d) === 0 && standard(h + d) === 0 && answerText(item) === intercepts(h - d, h + d);
    }
    const { a, r, growth } = params;
    const factor = (100 + (growth ? r : -r)) / 100;
    const next = growth ? a + (a * r) / 100 : a - (a * r) / 100;
    return Math.round(a * factor) === next && answerText(item) === model(a, factor);
  },
};
