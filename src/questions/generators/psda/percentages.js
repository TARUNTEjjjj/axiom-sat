import { MINUS, TIMES, fmtComma, fmtMoney, fmtNum, fmtPct } from '../../format.js';
import { makeChoices, pickDistractors } from '../../choices.js';
import { answerText } from '../../schema.js';

// Four kinds of percent question. Base quantities are multiples of 20 and
// percents multiples of 5, so every part and every sale price is a whole number;
// a price after tax is worked in cents so it is exact to the penny.

const GROUPS = [
  { group: 'students at a school', noun: 'students', action: 'ride a bus to school' },
  { group: 'books in a library collection', noun: 'books', action: 'are nonfiction' },
  { group: 'cars in a parking lot', noun: 'cars', action: 'are electric' },
  { group: 'trees in an orchard', noun: 'trees', action: 'are apple trees' },
  { group: 'employees at a company', noun: 'employees', action: 'work remotely' },
  { group: 'seats in a theater', noun: 'seats', action: 'were sold for a show' },
  { group: 'registered voters in a precinct', noun: 'voters', action: 'voted in a local election' },
];

// Each count stays believable anywhere from 60 to 3,000.
const COUNTS = [
  ['The number of students enrolled at a school', 'the number of students'],
  ['The number of members of a hiking club', 'the number of members'],
  ['The number of books in a school library', 'the number of books'],
  ['The number of monthly visitors to a museum', 'the number of visitors'],
  ['The number of employees at a company', 'the number of employees'],
  ['The number of trees in a park', 'the number of trees'],
  ['The number of subscribers to a newsletter', 'the number of subscribers'],
];

const ITEMS = [
  'jacket',
  'backpack',
  'lamp',
  'skateboard',
  'tennis racket',
  'coffee maker',
  'pair of running shoes',
  'desk chair',
];

const cents = (c) => fmtMoney(c / 100);

// A percent a student could believe: strictly between 0 and 100.
const pct = (v) => (v > 0 && v < 100 ? v : NaN);

export default {
  id: 'psda.percentages',
  domain: 'psda',
  skill: 'Percentages',
  // of + change + sale + original: each variant's number ranges · its contexts
  space: 38 * 19 * 7 + 148 * 16 * 2 * 7 + 12 * 11 * 7 * 8 + 15 * 11 * 8,

  generate(rng) {
    const variant = rng.pick(['of', 'change', 'sale', 'original']);
    let stem;
    let explanation;
    let correct;
    let format;
    let candidates;
    let params;

    if (variant === 'of') {
      const total = 20 * rng.int(3, 40);
      const percent = 5 * rng.int(1, 19);
      const part = (percent / 5) * (total / 20);
      const c = rng.pick(GROUPS);
      stem =
        `There are ${fmtComma(total)} ${c.group}. If ${fmtPct(percent)} of the ${c.noun} ${c.action}, ` +
        `how many of the ${c.noun} ${c.action}?`;
      // The complement, the percent itself taken as the count (only when that
      // many could exist), and the part for the next percent step up or down
      // (total/20 is 5% of the total).
      candidates = [
        total - part,
        percent < total ? percent : NaN,
        percent < 95 ? part + total / 20 : NaN,
        percent > 5 ? part - total / 20 : NaN,
      ];
      correct = part;
      format = fmtComma;
      explanation =
        `Write the percent as a decimal and multiply: ${fmtNum(percent / 100)} ${TIMES} ${fmtComma(total)} = ` +
        `${fmtComma(part)}. So ${fmtComma(part)} of the ${c.noun} ${c.action}.`;
      params = { variant, total, percent, part };
    } else if (variant === 'change') {
      const k = rng.int(3, 150);
      const j = rng.int(1, 16);
      const before = 20 * k;
      const percent = 5 * j;
      const increase = rng.chance(0.5);
      const change = k * j; // before · percent / 100
      const after = increase ? before + change : before - change;
      const [subject, short] = rng.pick(COUNTS);
      const word = increase ? 'increase' : 'decrease';
      stem =
        `${subject} ${word}d from ${fmtComma(before)} to ${fmtComma(after)}. ` +
        `By what percent did ${short} ${word}?`;
      // Dividing by the new value instead of the original, taking the change
      // itself as the percent, and giving the new value as a percent of the old.
      candidates = [pct(Math.round((100 * change) / after)), pct(change), increase ? 100 + percent : 100 - percent];
      correct = percent;
      format = fmtPct;
      explanation =
        `The amount of the ${word} is ${fmtComma(Math.max(before, after))} ${MINUS} ` +
        `${fmtComma(Math.min(before, after))} = ${fmtComma(change)}. A percent change is measured against the ` +
        `original value: ${fmtComma(change)}/${fmtComma(before)} = ${fmtNum(change / before)} = ${fmtPct(percent)}.`;
      params = { variant, before, after, percent, increase };
    } else if (variant === 'sale') {
      const price = 20 * rng.int(1, 12);
      const discount = 5 * rng.int(2, 12);
      const tax = rng.int(4, 10);
      const sale = price - (price / 20) * (discount / 5);
      const totalCents = sale * (100 + tax);
      const item = rng.pick(ITEMS);
      stem =
        `The regular price of a ${item} is ${fmtMoney(price)}. The ${item} is on sale for ${fmtPct(discount)} off ` +
        `the regular price, and a sales tax of ${fmtPct(tax)} is applied to the sale price. ` +
        `What is the total cost of the ${item}, including tax?`;
      // Stopping at the sale price, subtracting the tax, skipping the discount,
      // and applying both percents to the regular price (added, or both taken
      // off). Which three appear is left to chance, so the answer is not always
      // the second-smallest amount offered.
      candidates = rng.shuffle([
        sale * 100,
        sale * (100 - tax),
        price * (100 + tax),
        price * (100 - discount + tax),
        price * (100 - discount - tax),
      ]);
      correct = totalCents;
      format = cents;
      explanation =
        `The discount is ${fmtPct(discount)} of ${fmtMoney(price)}, so the sale price is ${fmtMoney(price)} ${MINUS} ` +
        `${fmtMoney(price - sale)} = ${fmtMoney(sale)}. The tax is ${fmtPct(tax)} of ${fmtMoney(sale)}, which is ` +
        `${cents(sale * tax)}, so the total cost is ${fmtMoney(sale)} + ${cents(sale * tax)} = ${cents(totalCents)}.`;
      params = { variant, price, discount, tax, totalCents };
    } else {
      const original = 20 * rng.int(1, 15);
      const discount = 5 * rng.int(2, 12);
      const sale = original - (original / 20) * (discount / 5);
      const item = rng.pick(ITEMS);
      stem =
        `A ${item} is on sale for ${fmtPct(discount)} off its regular price. The sale price is ${fmtMoney(sale)}. ` +
        `What is the regular price of the ${item}?`;
      // Adding the percent of the sale price back on, adding the percent as
      // dollars, and solving as if the sale price were the discount itself (kept
      // only while it stays within three times the real price). Every wrong
      // answer exceeds the sale price, as a regular price must.
      candidates = rng.shuffle([
        sale * (100 + discount),
        (sale + discount) * 100,
        discount >= 25 ? Math.round((sale * 10000) / discount) : NaN,
      ]);
      correct = original * 100;
      format = cents;
      const factor = fmtNum((100 - discount) / 100);
      explanation =
        `Let x be the regular price. The sale price is ${fmtPct(100 - discount)} of the regular price, so ` +
        `${factor}x = ${fmtMoney(sale)}. Dividing gives x = ${fmtMoney(sale)}/${factor} = ${fmtMoney(original)}, ` +
        `so the regular price is ${fmtMoney(original)}.`;
      params = { variant, original, discount, sale };
    }

    // Gaps are filled a whole step away: five percent of the group for a count,
    // five percent points, or five dollars when the answer is in cents. A filler
    // never reaches zero, and a regular price never dips to the sale price.
    const step = format === cents ? 500 : format === fmtPct ? 5 : params.total / 20;
    const floor = variant === 'original' ? params.sale * 100 : 0;
    const fallback = (k) => (correct + step * k > floor ? correct + step * k : NaN);
    const distractors = pickDistractors(correct, candidates, 3, fallback);
    const { choices, answer } = makeChoices(rng, format(correct), distractors.map(format));

    // One percent step is easy; a percent change or working back to the original
    // takes a second step; discount then tax takes two percents and cents.
    const difficulty = { of: 1, change: 2, original: 2, sale: 3 }[variant];

    return {
      item: { type: 'mc', difficulty, stem, choices, answer, explanation },
      params,
    };
  },

  // Each variant is re-checked as a product identity rather than by repeating
  // the division that produced it.
  verify({ item, params }) {
    let ok;
    let text;
    if (params.variant === 'of') {
      ok = params.part * 100 === params.percent * params.total;
      text = fmtComma(params.part);
    } else if (params.variant === 'change') {
      const signed = params.increase ? params.percent : -params.percent;
      ok = (params.after - params.before) * 100 === signed * params.before;
      text = fmtPct(params.percent);
    } else if (params.variant === 'sale') {
      ok = params.totalCents * 100 === params.price * (100 - params.discount) * (100 + params.tax);
      text = cents(params.totalCents);
    } else {
      ok = params.sale * 100 === params.original * (100 - params.discount);
      text = fmtMoney(params.original);
    }
    return ok && answerText(item) === text;
  },
};
