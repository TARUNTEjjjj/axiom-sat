import { MINUS, fmtComma, fmtMoney, fmtNum, plural } from '../../format.js';
import { makeChoices } from '../../choices.js';
import { answerText } from '../../schema.js';

// A line of best fit y = mx + b for two-variable data in a context, and the meaning
// of one of its two numbers. The four choices cross each number with each role
// (rate of change or value at x = 0), so the three distractors are the classic
// misreadings.

// Dollar amounts inside an equation keep two decimals: 2.25x + 3.50.
const fmtDollars = (v) => (Number.isInteger(v) ? fmtComma(v) : v.toFixed(2));

const degreesF = (v) => `${fmtNum(v)} degrees Fahrenheit`;

// Each context writes the setting, the meaning of a rate and the meaning of the
// value at x = 0, and draws its intercept from at least 61 values. No slope is ±1,
// so the number asked about always appears in the equation.
const CONTEXTS = [
  {
    fmt: fmtNum,
    intro: (eq) =>
      'A gardener measured the height of a plant each week after it was planted. ' +
      `The line of best fit for the data is y = ${eq}, where y is the height of the plant, in centimeters, ` +
      'x weeks after it was planted.',
    rate: (v, dir) => `The predicted height of the plant ${dir} by ${plural(v, 'centimeter')} each week.`,
    start: (v) => `The predicted height of the plant when it was planted is ${plural(v, 'centimeter')}.`,
    slopes: [0.5, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5],
    intercept: (rng) => rng.int(10, 120) / 2,
  },
  {
    fmt: fmtDollars,
    intro: (eq) =>
      'A ride-sharing company recorded the cost of trips of different lengths. ' +
      `The line of best fit for the data is y = ${eq}, where y is the cost, in dollars, of a trip of x miles.`,
    rate: (v, dir) => `The predicted cost of a trip ${dir} by ${fmtMoney(v)} for each additional mile.`,
    start: (v) => `The predicted cost of a trip before any distance is traveled is ${fmtMoney(v)}.`,
    slopes: [1.5, 1.75, 2, 2.25, 2.5, 2.75, 3, 3.25, 3.5],
    intercept: (rng) => rng.int(20, 80) / 10,
  },
  {
    fmt: fmtNum,
    intro: (eq) =>
      'The volume of water in a tank was recorded each minute after a hose was turned on. ' +
      `The line of best fit for the data is y = ${eq}, where y is the volume of water, in gallons, ` +
      'x minutes after the hose was turned on.',
    rate: (v, dir) => `The predicted volume of water in the tank ${dir} by ${plural(v, 'gallon')} each minute.`,
    start: (v) => `The predicted volume of water in the tank when the hose was turned on is ${plural(v, 'gallon')}.`,
    slopes: [2, 3, 4, 5, 6, 8, 10, 12, 15],
    intercept: (rng) => rng.int(10, 300),
  },
  {
    fmt: fmtComma,
    intro: (eq) =>
      'The value of a car was estimated each year after it was purchased. ' +
      `The line of best fit for the data is y = ${eq}, where y is the value of the car, in dollars, ` +
      'x years after it was purchased.',
    rate: (v, dir) => `The predicted value of the car ${dir} by ${fmtMoney(v)} each year.`,
    start: (v) => `The predicted value of the car when it was purchased is ${fmtMoney(v)}.`,
    slopes: [-800, -1000, -1200, -1500, -1800, -2000, -2200, -2500],
    intercept: (rng) => 500 * rng.int(20, 80),
  },
  {
    fmt: fmtNum,
    intro: (eq) =>
      'The height of a candle was measured each hour after it was lit. ' +
      `The line of best fit for the data is y = ${eq}, where y is the height of the candle, in centimeters, ` +
      'x hours after it was lit.',
    rate: (v, dir) => `The predicted height of the candle ${dir} by ${plural(v, 'centimeter')} each hour.`,
    start: (v) => `The predicted height of the candle when it was lit is ${plural(v, 'centimeter')}.`,
    slopes: [-0.5, -1.5, -2, -2.5, -3, -3.5, -4, -4.5],
    intercept: (rng) => rng.int(20, 80) / 2,
  },
  {
    fmt: fmtNum,
    intro: (eq) =>
      'A teacher recorded the number of hours each student studied for a test and the score each student earned. ' +
      `The line of best fit for the data is y = ${eq}, where y is the score, in points, of a student who studied ` +
      'for x hours.',
    rate: (v, dir) => `The predicted score ${dir} by ${plural(v, 'point')} for each additional hour of studying.`,
    start: (v) => `The predicted score of a student who studied for 0 hours is ${plural(v, 'point')}.`,
    slopes: [2, 2.5, 3, 3.5, 4, 4.5, 5, 6],
    intercept: (rng) => rng.int(400, 700) / 10,
  },
  {
    fmt: fmtNum,
    intro: (eq) =>
      'A hiker recorded the air temperature at several elevations on a mountain. ' +
      `The line of best fit for the data is y = ${eq}, where y is the temperature, in degrees Fahrenheit, ` +
      'at an elevation of x thousand feet.',
    rate: (v, dir) =>
      `The predicted temperature ${dir} by ${degreesF(v)} for each additional thousand feet of elevation.`,
    start: (v) => `The predicted temperature at an elevation of 0 feet is ${degreesF(v)}.`,
    slopes: [-3, -3.5, -4, -4.5, -5, -5.5, -6, -6.5],
    intercept: (rng) => rng.int(500, 900) / 10,
  },
  {
    fmt: fmtComma,
    intro: (eq) =>
      'The altitude of an airplane was recorded each minute after it began its descent. ' +
      `The line of best fit for the data is y = ${eq}, where y is the altitude of the airplane, in feet, ` +
      'x minutes after the descent began.',
    rate: (v, dir) => `The predicted altitude of the airplane ${dir} by ${fmtComma(v)} feet each minute.`,
    start: (v) => `The predicted altitude of the airplane when the descent began is ${fmtComma(v)} feet.`,
    slopes: [-400, -500, -600, -750, -800, -1000, -1200, -1500],
    intercept: (rng) => 500 * rng.int(30, 90),
  },
];

// mx + b written the way a fitted line is reported: 2.5x + 12, or 30 − 1.5x when m < 0.
function rhs(m, b, fmt) {
  const term = `${fmt(Math.abs(m))}x`;
  return m > 0 ? `${term} + ${fmt(b)}` : `${fmt(b)} ${MINUS} ${term}`;
}

export default {
  id: 'psda.linear-model',
  domain: 'psda',
  skill: 'Two-variable data: models and scatterplots',
  // contexts · asks · at least 8 slopes · at least 61 intercepts each, less the one
  // intercept a slope can rule out; every (slope, intercept) pair writes a different equation
  space: 8 * 2 * 8 * 60,

  generate(rng) {
    const context = rng.int(0, CONTEXTS.length - 1);
    const c = CONTEXTS[context];
    const ask = rng.pick(['slope', 'intercept']);
    const m = rng.pick(c.slopes);
    let b;
    do b = c.intercept(rng);
    while (b === Math.abs(m)); // the two numbers must be told apart

    const dir = m < 0 ? 'decreases' : 'increases';
    const asked = ask === 'slope' ? Math.abs(m) : b;
    const stem =
      `${c.intro(rhs(m, b, c.fmt))} ` +
      `Which of the following is the best interpretation of the number ${c.fmt(asked)} in this context?`;

    // The right number in the wrong role, and the other number in either role.
    const correct = ask === 'slope' ? c.rate(Math.abs(m), dir) : c.start(b);
    const distractors =
      ask === 'slope'
        ? [c.start(Math.abs(m)), c.rate(b, dir), c.start(b)]
        : [c.rate(b, dir), c.rate(Math.abs(m), dir), c.start(Math.abs(m))];
    const { choices, answer } = makeChoices(rng, correct, distractors);

    const role =
      ask === 'slope'
        ? 'the size of the predicted change in y for each increase of 1 in x'
        : 'the predicted value of y when x = 0';
    const explanation =
      'In the equation of a line of best fit, the coefficient of x is the slope, the predicted change in y for ' +
      'each increase of 1 in x, and the constant term is the y-intercept, the predicted value of y when x = 0. ' +
      `Here the slope is ${c.fmt(m)} and the y-intercept is ${c.fmt(b)}, so ${c.fmt(asked)} is ${role}. ${correct}`;

    // Reading a whole-number rate of growth is direct; a value at x = 0 or a
    // decimal rate takes more care; a decreasing model adds a sign to interpret.
    const difficulty = m < 0 ? 3 : ask === 'intercept' || !Number.isInteger(m) ? 2 : 1;

    return {
      item: { type: 'mc', difficulty, stem, choices, answer, explanation },
      params: { context, m, b, ask },
    };
  },

  // The stem must quote the equation and the number the parameters describe, the
  // keyed statement must be the one for that role, and a rate must move the way
  // the sign of the slope says.
  verify({ item, params: { context, m, b, ask } }) {
    const c = CONTEXTS[context];
    const text = answerText(item);
    const dir = m < 0 ? 'decreases' : 'increases';
    const expected = ask === 'slope' ? c.rate(Math.abs(m), dir) : c.start(b);
    return (
      m !== 0 &&
      Math.abs(m) !== 1 &&
      b > 0 &&
      Math.abs(m) !== b &&
      item.stem.includes(`is y = ${rhs(m, b, c.fmt)}, where`) &&
      item.stem.includes(`the number ${c.fmt(ask === 'slope' ? Math.abs(m) : b)} in`) &&
      text === expected &&
      (ask !== 'slope' || text.includes(dir))
    );
  },
};
