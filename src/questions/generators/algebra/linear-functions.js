import { fmtComma, fmtLinear, fmtMoney, fmtNum, fmtPct, plural } from '../../format.js';
import { makeChoices, pickDistractors } from '../../choices.js';
import { answerText } from '../../schema.js';

const KINDS = ['slope', 'intercept', 'evaluate'];

const gallons = (v) => plural(v, 'gallon');

// Every context is a quantity f(x) = mx + b: a starting value b that changes by m
// for each unit of x. Ranges are [lo, hi, step], drawn as step · int(lo, hi) so the
// numbers stay realistic; `sign` is −1 for quantities that run down, and `cap` is
// the largest value the quantity can ever take. `each` reads both after "for each"
// and after "1", so one phrase serves the rate and f(1); `end` reads a number as the
// quantity's final value, a misreading of the starting value.
const CONTEXTS = [
  {
    m: [4, 19, 5],
    b: [6, 24, 5],
    x: [2, 9],
    sign: 1,
    setup: (eq) =>
      'A plumber charges a fixed service fee plus an hourly rate. ' +
      `The function f(x) = ${eq} gives the total charge, in dollars, for a job that takes x hours.`,
    words: (m, b) =>
      `A plumber charges a service fee of ${fmtMoney(b)} plus ${fmtMoney(m)} for each hour of work. ` +
      'The function f gives the total charge, in dollars, for a job that takes x hours.',
    quantity: 'the total charge',
    fmt: fmtMoney,
    each: 'hour of work',
    wrongEach: 'minute of work',
    start: (v) => `The plumber charges a service fee of ${fmtMoney(v)} before any work is done.`,
    end: (v) => `The total charge for the job is ${fmtMoney(v)}.`,
  },
  {
    m: [15, 60, 1],
    b: [4, 30, 5],
    x: [3, 12],
    sign: 1,
    setup: (eq) =>
      'A gym charges a one-time enrollment fee plus a monthly membership fee. ' +
      `The function f(x) = ${eq} gives the total amount, in dollars, that a member has paid after x months.`,
    words: (m, b) =>
      `A gym charges a one-time enrollment fee of ${fmtMoney(b)} plus ${fmtMoney(m)} for each month of membership. ` +
      'The function f gives the total amount, in dollars, that a member has paid after x months.',
    quantity: 'the total amount paid',
    fmt: fmtMoney,
    each: 'month of membership',
    wrongEach: 'week of membership',
    start: (v) => `The enrollment fee is ${fmtMoney(v)}.`,
    end: (v) => `The member pays a total of ${fmtMoney(v)}.`,
  },
  {
    m: [8, 30, 1],
    b: [5, 40, 10],
    x: [5, 30],
    sign: 1,
    setup: (eq) =>
      'Water is added to a swimming pool at a constant rate. ' +
      `The function f(x) = ${eq} gives the number of gallons of water in the pool x minutes after the hose is turned on.`,
    words: (m, b) =>
      `A swimming pool contains ${fmtNum(b)} gallons of water when a hose is turned on, and the hose adds ` +
      `${fmtNum(m)} gallons of water to the pool each minute. The function f gives the number of gallons of water ` +
      'in the pool x minutes after the hose is turned on.',
    quantity: 'the amount of water in the pool',
    fmt: gallons,
    each: 'minute',
    wrongEach: 'hour',
    start: (v) => `The pool contains ${gallons(v)} of water when the hose is turned on.`,
    end: (v) => `The pool contains ${gallons(v)} of water when the hose is turned off.`,
  },
  {
    m: [5, 30, 1],
    b: [10, 60, 10],
    x: [2, 10],
    sign: 1,
    setup: (eq) =>
      'A hot-air balloon rises at a constant rate. ' +
      `The function f(x) = ${eq} gives the altitude of the balloon, in feet, x minutes after it begins to rise.`,
    words: (m, b) =>
      `A hot-air balloon is at an altitude of ${fmtNum(b)} feet when it begins to rise at a constant rate of ` +
      `${fmtNum(m)} feet per minute. The function f gives the altitude of the balloon, in feet, x minutes after it begins to rise.`,
    quantity: 'the altitude of the balloon',
    fmt: (v) => plural(v, 'foot', 'feet'),
    each: 'minute',
    wrongEach: 'second',
    start: (v) => `The balloon is at an altitude of ${plural(v, 'foot', 'feet')} when it begins to rise.`,
    end: (v) => `The balloon stops rising at an altitude of ${plural(v, 'foot', 'feet')}.`,
  },
  {
    m: [2, 20, 5],
    b: [5, 60, 10],
    x: [4, 20],
    sign: 1,
    setup: (eq) =>
      'A student opens a savings account with an initial deposit and then deposits the same amount each week. ' +
      `The function f(x) = ${eq} gives the balance of the account, in dollars, x weeks after it is opened.`,
    words: (m, b) =>
      `A student opens a savings account with a deposit of ${fmtMoney(b)} and then deposits ${fmtMoney(m)} into ` +
      'the account each week. The function f gives the balance of the account, in dollars, x weeks after it is opened.',
    quantity: 'the balance of the account',
    fmt: fmtMoney,
    each: 'week',
    wrongEach: 'month',
    start: (v) => `The initial deposit is ${fmtMoney(v)}.`,
    end: (v) => `The balance of the account after the last deposit is ${fmtMoney(v)}.`,
  },
  {
    m: [5, 25, 1],
    b: [20, 90, 10],
    x: [2, 8],
    sign: -1,
    setup: (eq) =>
      'Water drains from a storage tank at a constant rate. ' +
      `The function f(x) = ${eq} gives the number of gallons of water remaining in the tank x minutes after the drain is opened.`,
    words: (m, b) =>
      `A storage tank contains ${fmtNum(b)} gallons of water when its drain is opened, and water leaves the tank at a ` +
      `constant rate of ${fmtNum(m)} gallons per minute. The function f gives the number of gallons of water remaining ` +
      'in the tank x minutes after the drain is opened.',
    quantity: 'the amount of water in the tank',
    fmt: gallons,
    each: 'minute',
    wrongEach: 'hour',
    start: (v) => `The tank contains ${gallons(v)} of water when the drain is opened.`,
    end: (v) => `The tank contains ${gallons(v)} of water when the drain is closed.`,
  },
  {
    m: [2, 9, 1],
    b: [60, 100, 1],
    x: [2, 6],
    sign: -1,
    cap: 100,
    setup: (eq) =>
      'The battery of a tablet loses charge at a constant rate while a video plays. ' +
      `The function f(x) = ${eq} gives the battery charge, as a percent, after the video has played for x hours.`,
    words: (m, b) =>
      `The battery of a tablet is at ${fmtPct(b)} when a video starts to play, and the charge decreases by ` +
      `${fmtPct(m)} for each hour of play. The function f gives the battery charge, as a percent, after the video ` +
      'has played for x hours.',
    quantity: 'the battery charge',
    fmt: fmtPct,
    each: 'hour of play',
    wrongEach: 'minute of play',
    start: (v) => `The battery charge is ${fmtPct(v)} when the video starts to play.`,
    end: (v) => `The battery charge is ${fmtPct(v)} when the video ends.`,
  },
  {
    m: [6, 20, 1],
    b: [20, 50, 10],
    x: [2, 10],
    sign: -1,
    setup: (eq) =>
      'A printer uses paper from its tray at a constant rate while printing a long document. ' +
      `The function f(x) = ${eq} gives the number of sheets of paper remaining in the tray x minutes after printing begins.`,
    words: (m, b) =>
      `A printer has ${fmtNum(b)} sheets of paper in its tray when it begins printing a long document, and it uses ` +
      `${fmtNum(m)} sheets of paper each minute. The function f gives the number of sheets of paper remaining in the ` +
      'tray x minutes after printing begins.',
    quantity: 'the amount of paper in the tray',
    fmt: (v) => plural(v, 'sheet'),
    each: 'minute',
    wrongEach: 'hour',
    start: (v) => `The tray holds ${plural(v, 'sheet')} of paper when printing begins.`,
    end: (v) => `The tray holds ${plural(v, 'sheet')} of paper when printing ends.`,
  },
];

const draw = (rng, [lo, hi, step]) => step * rng.int(lo, hi);
const capitalize = (text) => text[0].toUpperCase() + text.slice(1);
const lowerFirst = (text) => text[0].toLowerCase() + text.slice(1);

// "The total charge increases by $25 for each hour of work."
const rateText = (ctx, v, up, each) =>
  `${capitalize(ctx.quantity)} ${up ? 'increases' : 'decreases'} by ${ctx.fmt(v)} for each ${each}.`;

// The value after one unit of x, a common misreading of the constant term.
const afterOneText = (ctx, v) => `${capitalize(ctx.quantity)} after 1 ${ctx.each} is ${ctx.fmt(v)}.`;

// Interpret the rate or the starting value of f(x) = mx + b in context, or evaluate
// f at a point when the function is given in words. The rate and the starting value
// are drawn first, so every evaluation is an integer and f never goes negative.
export default {
  id: 'algebra.linear-functions',
  domain: 'algebra',
  skill: 'Linear functions',
  // 8 contexts · the smallest (m, b) grid among them (the plumber's 16 · 19, less
  // the at most 16 pairs where b equals the rate) · three asks (rate, starting
  // value, evaluate) that each give a different stem.
  space: 8 * (16 * 19 - 16) * 3,

  generate(rng) {
    const context = rng.int(0, CONTEXTS.length - 1);
    const ctx = CONTEXTS[context];
    const kind = rng.pick(KINDS);
    const rate = draw(rng, ctx.m);
    let b = draw(rng, ctx.b);
    while (b === rate) b = draw(rng, ctx.b); // the number asked about must appear in f only once
    const m = ctx.sign * rate;
    const up = m > 0;
    const eq = fmtLinear(m, b);

    // Evaluating is 1, or 2 when the rate is negative; interpreting a coefficient is
    // 2, or 3 when the rate is negative and its sign has to be read into words.
    if (kind === 'evaluate') {
      let x = rng.int(ctx.x[0], ctx.x[1]);
      while (m * x + b <= 0) x = rng.int(ctx.x[0], ctx.x[1]); // a quantity that has run out leaves nothing to ask about
      const value = m * x + b;
      const stem = `${ctx.words(rate, b)} What is the value of f(${x})?`;
      // Slips a student makes in context: misreading x by one (in one direction
      // only, so the key is never the middle of three evenly spaced values), the
      // rate applied the wrong way, the starting value dropped, forgetting to
      // multiply the rate by x, and multiplying the starting value by x too. Each
      // must still make sense in the story: positive, no more than about three
      // times the key, and never above the starting value of a quantity that runs
      // down or above the cap of a percent. Whole numbers near the key fill any gap.
      const ceiling = Math.min(3 * value, ctx.sign < 0 ? b : Infinity, ctx.cap || Infinity);
      const plausible = (v) => v > 0 && v <= ceiling;
      const slips = rng.shuffle([m * (x + rng.pick([-1, 1])) + b, b - m * x, rate * x, m + b, (m + b) * x]);
      const distractors = pickDistractors(value, slips.filter(plausible), 3, (k) => (plausible(value + k) ? value + k : NaN));
      const { choices, answer } = makeChoices(rng, fmtComma(value), distractors.map(fmtComma));
      const explanation =
        `The starting value is ${fmtNum(b)} and the rate of change is ${fmtNum(m)} per ${ctx.each}, ` +
        `so f(x) = ${eq}. Substituting x = ${x} gives f(${x}) = ${fmtNum(m)}(${x}) + ${fmtNum(b)} = ${fmtComma(value)}.`;
      return {
        item: { type: 'mc', difficulty: up ? 1 : 2, stem, choices, answer, explanation },
        params: { context, kind, m, b, x, value },
      };
    }

    const asked = kind === 'slope' ? m : b;
    const stem =
      `${ctx.setup(eq)} Which of the following is the best interpretation of ${fmtNum(asked)} in this context?`;
    const correct = kind === 'slope' ? rateText(ctx, rate, up, ctx.each) : ctx.start(b);
    // Rate: the wrong direction, the wrong unit, and reading the rate as the starting
    // value. Starting value: reading it as the rate, as the value after one unit, or
    // as the final value.
    const distractors =
      kind === 'slope'
        ? [rateText(ctx, rate, !up, ctx.each), rateText(ctx, rate, up, ctx.wrongEach), ctx.start(rate)]
        : [rateText(ctx, b, up, ctx.each), afterOneText(ctx, b), ctx.end(b)];
    const { choices, answer } = makeChoices(rng, correct, distractors);
    const explanation =
      kind === 'slope'
        ? `The coefficient of x, ${fmtNum(m)}, is the rate of change of f: each time x increases by 1, ` +
          `f(x) changes by ${fmtNum(m)}. The constant ${fmtNum(b)} is f(0), the starting value, not the rate. ` +
          `So ${lowerFirst(correct)}`
        : `The constant term ${fmtNum(b)} is f(0), the value of the function when x = 0. ` +
          `The coefficient ${fmtNum(m)} tells how f(x) changes for each ${ctx.each}, not where it starts. ` +
          `So ${lowerFirst(correct)}`;

    return {
      item: { type: 'mc', difficulty: up ? 2 : 3, stem, choices, answer, explanation },
      params: { context, kind, m, b },
    };
  },

  // An evaluated value is recomputed as mx + b from the parameters, and the stem
  // must show the rate, the starting value and the point asked about. For an
  // interpretation, the stem must show f(x) = mx + b and the chosen sentence must
  // carry the right magnitude, direction and unit (rate) or be the starting-value
  // sentence for b, so no distractor can pass.
  verify({ item, params: { context, kind, m, b, x, value } }) {
    const ctx = CONTEXTS[context];
    const text = answerText(item);
    if (kind === 'evaluate') {
      const expected = m * x + b;
      return (
        expected === value &&
        item.stem.includes(ctx.fmt(Math.abs(m))) &&
        item.stem.includes(ctx.fmt(b)) &&
        item.stem.includes(`f(${x})`) &&
        text === fmtComma(expected)
      );
    }
    if (!item.stem.includes(`f(x) = ${fmtLinear(m, b)}`)) return false;
    if (kind === 'intercept') return text === ctx.start(b) && text.includes(ctx.fmt(b));
    return (
      text.includes(`by ${ctx.fmt(Math.abs(m))} for each ${ctx.each}.`) &&
      text.includes(m > 0 ? 'increases' : 'decreases')
    );
  },
};
