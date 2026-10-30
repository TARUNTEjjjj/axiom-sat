import { TIMES, fmtComma, gcd } from '../../format.js';
import { makeChoices, pickDistractors } from '../../choices.js';
import { answerText } from '../../schema.js';

// Two quantities in a fixed ratio n : d. One pair (d·m1 of the first, n·m1 of the
// second) is given and the pair for another multiple m2 is asked about, so the
// answer is a whole number whichever of the two quantities is unknown.

const MINUTES = ['minute', 'minutes'];
const HOURS = ['hour', 'hours'];

const RATES = [
  { subject: 'A printer', noun: 'printer', verb: ['prints', 'print'], item: ['page', 'pages'], period: MINUTES },
  { subject: 'A bottling machine', noun: 'machine', verb: ['fills', 'fill'], item: ['bottle', 'bottles'], period: MINUTES },
  { subject: 'A bakery', noun: 'bakery', verb: ['bakes', 'bake'], item: ['loaf of bread', 'loaves of bread'], period: HOURS },
  { subject: 'A packing crew', noun: 'crew', verb: ['packs', 'pack'], item: ['box', 'boxes'], period: HOURS },
  { subject: 'A robot', noun: 'robot', verb: ['assembles', 'assemble'], item: ['circuit board', 'circuit boards'], period: HOURS },
  { subject: 'A knitting machine', noun: 'machine', verb: ['knits', 'knit'], item: ['scarf', 'scarves'], period: HOURS },
  {
    subject: 'A farm worker',
    noun: 'worker',
    verb: ['picks', 'pick'],
    item: ['basket of apples', 'baskets of apples'],
    period: HOURS,
  },
  { subject: 'A ticket machine', noun: 'machine', verb: ['dispenses', 'dispense'], item: ['ticket', 'tickets'], period: MINUTES },
];

const SCALES = [
  { map: ['inch', 'inches'], real: ['mile', 'miles'] },
  { map: ['centimeter', 'centimeters'], real: ['kilometer', 'kilometers'] },
];
const PLACES = ['towns', 'cities', 'villages', 'campsites', 'train stations', 'lighthouses', 'ranger stations'];

const INGREDIENTS = [
  ['cup of flour', 'cups of flour'],
  ['cup of sugar', 'cups of sugar'],
  ['egg', 'eggs'],
  ['tablespoon of butter', 'tablespoons of butter'],
  ['cup of milk', 'cups of milk'],
  ['teaspoon of vanilla', 'teaspoons of vanilla'],
  ['ounce of chocolate', 'ounces of chocolate'],
  ['cup of oats', 'cups of oats'],
];
const DISHES = [
  ['muffin', 'muffins'],
  ['pancake', 'pancakes'],
  ['cookie', 'cookies'],
  ['waffle', 'waffles'],
  ['biscuit', 'biscuits'],
  ['brownie', 'brownies'],
  ['scone', 'scones'],
  ['cupcake', 'cupcakes'],
];

// A larger unit expressed in a smaller one.
const UNITS = [
  { big: ['foot', 'feet'], small: ['inch', 'inches'], factor: 12 },
  { big: ['pound', 'pounds'], small: ['ounce', 'ounces'], factor: 16 },
  { big: ['yard', 'yards'], small: ['foot', 'feet'], factor: 3 },
  { big: ['gallon', 'gallons'], small: ['quart', 'quarts'], factor: 4 },
  { big: ['hour', 'hours'], small: ['minute', 'minutes'], factor: 60 },
  { big: ['week', 'weeks'], small: ['day', 'days'], factor: 7 },
  { big: ['cup', 'cups'], small: ['fluid ounce', 'fluid ounces'], factor: 8 },
  { big: ['quart', 'quarts'], small: ['pint', 'pints'], factor: 2 },
  { big: ['mile', 'miles'], small: ['foot', 'feet'], factor: 5280 },
  { big: ['kilometer', 'kilometers'], small: ['meter', 'meters'], factor: 1000 },
  { big: ['day', 'days'], small: ['hour', 'hours'], factor: 24 },
  { big: ['ton', 'tons'], small: ['pound', 'pounds'], factor: 2000 },
];

// plural() with thousands separators, since every count here is a whole number.
const count = (n, [one, many]) => `${fmtComma(n)} ${n === 1 ? one : many}`;

function rateText({ subject, noun, verb, item, period }, q1, q2, given, answer, reverse) {
  const known = `${subject} ${verb[0]} ${count(q2, item)} in ${count(q1, period)}.`;
  if (reverse) {
    return {
      stem:
        `${known} At this rate, how many ${period[1]} will it take the ${noun} to ${verb[1]} ` +
        `${count(given, item)}?`,
      unit: period[1],
      closing: `The ${noun} takes ${count(answer, period)} to ${verb[1]} ${count(given, item)}.`,
    };
  }
  return {
    stem: `${known} At this rate, how many ${item[1]} will the ${noun} ${verb[1]} in ${count(given, period)}?`,
    unit: item[1],
    closing: `The ${noun} ${verb[0]} ${count(answer, item)} in ${count(given, period)}.`,
  };
}

function mapText({ map, real, place }, q1, q2, given, answer, reverse) {
  const scale = `On a map, ${count(q1, map)} ${q1 === 1 ? 'represents' : 'represent'} ${count(q2, real)}.`;
  if (reverse) {
    return {
      stem:
        `${scale} The actual distance between two ${place} is ${count(given, real)}. ` +
        `How many ${map[1]} apart are the two ${place} on the map?`,
      unit: map[1],
      closing: `The two ${place} are ${count(answer, map)} apart on the map.`,
    };
  }
  return {
    stem:
      `${scale} Two ${place} are ${count(given, map)} apart on the map. ` +
      `What is the actual distance, in ${real[1]}, between the two ${place}?`,
    unit: real[1],
    closing: `The actual distance between the two ${place} is ${count(answer, real)}.`,
  };
}

function recipeText({ ingredient, dish }, q1, q2, given, answer, reverse) {
  const recipe = `A recipe that uses ${count(q1, ingredient)} makes ${count(q2, dish)}.`;
  if (reverse) {
    return {
      stem: `${recipe} How many ${ingredient[1]} are needed to make ${count(given, dish)} using the same recipe?`,
      unit: ingredient[1],
      closing: `Making ${count(given, dish)} takes ${count(answer, ingredient)}.`,
    };
  }
  return {
    stem: `${recipe} How many ${dish[1]} can be made from ${count(given, ingredient)} using the same recipe?`,
    unit: dish[1],
    closing: `${count(given, ingredient)} ${given === 1 ? 'makes' : 'make'} ${count(answer, dish)}.`,
  };
}

function convertText({ big, small }, q1, q2, given, answer, reverse) {
  const fact = `There are ${count(q2, small)} in ${count(q1, big)}.`;
  if (reverse) {
    return {
      stem: `${fact} How many ${big[1]} are equal to ${count(given, small)}?`,
      unit: big[1],
      closing: `${count(given, small)} is equal to ${count(answer, big)}.`,
    };
  }
  return {
    stem: `${fact} How many ${small[1]} are there in ${count(given, big)}?`,
    unit: small[1],
    closing: `${count(given, big)} is equal to ${count(answer, small)}.`,
  };
}

// Solving to/from = x/given; with from = 1 the proportion is a plain product.
function solve(from, to, given, answer) {
  if (from === 1) return `x = ${fmtComma(to)} ${TIMES} ${fmtComma(given)} = ${fmtComma(answer)}`;
  const product = fmtComma(to * given);
  return (
    `${fmtComma(to)}/${fmtComma(from)} = x/${fmtComma(given)}. Cross-multiplying gives ` +
    `${fmtComma(from)}x = ${fmtComma(to)} ${TIMES} ${fmtComma(given)} = ${product}, ` +
    `so x = ${product}/${fmtComma(from)} = ${fmtComma(answer)}`
  );
}

export default {
  id: 'psda.ratios',
  domain: 'psda',
  skill: 'Ratios, rates, proportional relationships, and units',
  // rate variant alone, over coprime (n, d) pairs · m1 · m2 ≠ m1 · contexts: asked
  // forward, 10 choices of m2 for 60 pairs and 9 for the two with n = 2; asked
  // backward, 8 choices for the 23 pairs with d = 1 and 10 for the other 39. m1 is
  // the gcd of the known pair, so every combination writes a different stem.
  space: (60 * 10 + 2 * 9) * 5 * 8 + (23 * 5 * 8 + 39 * 5 * 10) * 8,

  generate(rng) {
    // Rates have the most room to vary, so they come up most often.
    const roll = rng.int(0, 7);
    const variant = roll < 3 ? 'rate' : roll < 5 ? 'map' : roll < 7 ? 'recipe' : 'convert';
    const reverse = rng.chance(0.5);

    let n;
    let d = 1;
    let m1 = 1;
    let m2;
    let context;
    let describe;
    // A tiny answer leaves no room for believable wrong answers, so m2 is kept
    // large enough that the answer (d · m2 asked backward, n · m2 asked forward)
    // is at least 4, or 6 when the ratio's own numbers are as small as 2.
    const least = (lo) => Math.max(lo, reverse ? Math.ceil(4 / d) : Math.ceil(6 / n));
    if (variant === 'rate') {
      d = rng.int(1, 4);
      do n = rng.int(2, 24); while (gcd(n, d) !== 1);
      m1 = rng.int(2, 6);
      do m2 = rng.int(least(2), 12); while (m2 === m1); // the asked pair must be a new one
      context = rng.pick(RATES);
      describe = rateText;
    } else if (variant === 'map') {
      d = rng.int(1, 3);
      do n = rng.int(5, 60); while (gcd(n, d) !== 1);
      m2 = rng.int(least(2), 6);
      context = { ...rng.pick(SCALES), place: rng.pick(PLACES) };
      describe = mapText;
    } else if (variant === 'recipe') {
      d = rng.int(1, 3);
      do n = rng.int(6, 12); while (gcd(n, d) !== 1); // more servings than units of the ingredient
      m1 = rng.int(1, 3);
      do m2 = rng.int(least(1), 6); while (m2 === m1);
      context = { ingredient: rng.pick(INGREDIENTS), dish: rng.pick(DISHES) };
      describe = recipeText;
    } else {
      context = rng.pick(UNITS);
      n = context.factor;
      m2 = rng.int(least(2), 15);
      describe = convertText;
    }

    const q1 = d * m1;
    const q2 = n * m1;
    const given = reverse ? n * m2 : d * m2;
    const answer = reverse ? d * m2 : n * m2;
    const [from, to] = reverse ? [q2, q1] : [q1, q2];
    const { stem, unit, closing } = describe(context, q1, q2, given, answer, reverse);

    // Common slips: inverting the ratio, reasoning additively (keeping the
    // difference of the known pair), multiplying the givens without dividing,
    // stopping at the unit rate or dividing by the wrong known number, forgetting
    // the d groups, and scaling by one group too many or too few (two, when a
    // group is a single unit). A slip more than a factor of 10 from the answer is
    // dropped as implausible. Gaps are filled two, then three, groups away on a
    // randomly chosen side, so the choices do not form a run of consecutive
    // numbers around the answer.
    const step = Math.max(reverse ? d : n, 2);
    const side = rng.sign();
    const plausible = (v) => (v >= 1 && 10 * v >= answer && v <= 10 * answer ? v : NaN);
    const slips = reverse
      ? [Math.round((given * from) / to), to + given - from, given * to, Math.round(given / to), m2]
      : [Math.round((given * from) / to), to + given - from, given * to, Math.round(to / from)];
    const distractors = pickDistractors(
      answer,
      [...slips.map(plausible), plausible(answer + side * step)],
      3,
      (k) => plausible(answer + side * step * (k > 0 ? k + 1 : k - 1)),
    );
    const { choices, answer: key } = makeChoices(rng, fmtComma(answer), distractors.map(fmtComma));

    const explanation =
      `Let x be the number of ${unit}. The quantities are proportional, so ` +
      `${solve(from, to, given, answer)}. ${closing}`;

    // A whole-number unit rate scales directly; a fractional rate and working
    // the proportion backward each add a step.
    const difficulty = (d === 1 ? 1 : 2) + (reverse ? 1 : 0);

    return {
      item: { type: 'mc', difficulty, stem, choices, answer: key, explanation },
      params: { variant, n, d, m1, m2, reverse, given, answer },
    };
  },

  // The cross products of a true proportion are equal.
  verify({ item, params: { n, d, m1, m2, reverse, given, answer } }) {
    const [from, to] = reverse ? [n * m1, d * m1] : [d * m1, n * m1];
    return (
      gcd(n, d) === 1 &&
      m1 !== m2 &&
      answer > 0 &&
      answer * from === to * given &&
      answerText(item) === fmtComma(answer)
    );
  },
};
