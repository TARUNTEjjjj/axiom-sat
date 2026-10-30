import { fmtComma, fmtFrac, fmtNum, sup, DEGREES, MINUS, PI, TIMES } from '../../format.js';
import { makeChoices, pickDistractors } from '../../choices.js';
import { answerText } from '../../schema.js';

// Each object carries the unit it is measured in and the radii it comes in, so
// a pizza is never 2 inches across and a rug never 30 feet in radius. Every
// radius is at least 2, so the plural unit words are always right.
const OBJECTS = [
  { name: 'garden', unit: 'feet', range: [4, 15] },
  { name: 'garden', unit: 'meters', range: [2, 8] },
  { name: 'tabletop', unit: 'inches', range: [10, 24] },
  { name: 'pond', unit: 'feet', range: [5, 20] },
  { name: 'pond', unit: 'meters', range: [2, 10] },
  { name: 'clock face', unit: 'inches', range: [4, 12] },
  { name: 'clock face', unit: 'centimeters', range: [10, 25] },
  { name: 'rug', unit: 'feet', range: [2, 6] },
  { name: 'pizza', unit: 'inches', range: [4, 9] },
  { name: 'pizza', unit: 'centimeters', range: [10, 22] },
  { name: 'fountain', unit: 'feet', range: [3, 10] },
  { name: 'swimming pool', unit: 'feet', range: [6, 15] },
  { name: 'mirror', unit: 'inches', range: [8, 18] },
  { name: 'plate', unit: 'inches', range: [4, 6] },
  { name: 'plate', unit: 'centimeters', range: [10, 15] },
  { name: 'trampoline', unit: 'feet', range: [4, 8] },
];
const POINTS = [['A', 'B', 'O'], ['P', 'Q', 'C'], ['R', 'S', 'O'], ['X', 'Y', 'M'], ['J', 'K', 'P'], ['D', 'E', 'T']];
// Central angles under 180°, so "minor arc" and "sector" are unambiguous.
const ANGLES = [30, 40, 45, 60, 72, 90, 120, 135, 144, 150];
const KINDS = ['measure', 'arc', 'equation', 'inverse'];

// A coefficient of π: 48π, 1,156π, or just π.
const fmtPi = (n) => (n === 1 ? PI : fmtComma(n) + PI);

// Filler distractors step away from the answer on both sides by a natural unit
// of the problem, but never reach zero; a length or area cannot be negative.
const filler = (value, step) => (k) => (value + step * k > 0 ? value + step * k : NaN);

const point = (x, y) => `(${fmtNum(x)}, ${fmtNum(y)})`;

const pickObject = (rng) => {
  const { name, unit, range } = rng.pick(OBJECTS);
  return { object: name, unit, r: rng.int(...range) };
};

// Numeric answers: the correct value and the results of common slips, all
// formatted the same way. Which three slips appear is left to chance, so the
// answer is not pinned to one position among the sorted choices.
function numeric(rng, value, slips, fmt, step) {
  const distractors = pickDistractors(value, rng.shuffle(slips), 3, filler(value, step));
  return makeChoices(rng, fmt(value), distractors.map(fmt));
}

function measure(rng) {
  const { object, unit, r } = pickObject(rng);
  const ask = rng.pick(['circumference', 'area']);
  const given = rng.pick(['radius', 'diameter']);
  const value = ask === 'area' ? r * r : 2 * r;
  const note = given === 'diameter' ? `The radius is half the diameter: ${2 * r}/2 = ${r}. ` : '';
  const area = ask === 'area';
  return {
    stem:
      `A circular ${object} has a ${given} of ${given === 'radius' ? r : 2 * r} ${unit}. ` +
      `What is the ${area ? `area, in square ${unit}` : `circumference, in ${unit}`}, of the ${object}?`,
    // Area: the diameter as the radius, the circumference instead, an unsquared
    // radius, a doubled coefficient. Circumference: a dropped 2, the diameter in
    // 2πr, the area instead, the radius squared and doubled.
    ...numeric(rng, value, area ? [4 * r * r, 2 * r, r, 2 * r * r] : [r, 4 * r, r * r, 2 * r * r], fmtPi, r),
    explanation: area
      ? `${note}The area of a circle with radius r is ${PI}r${sup(2)}. With r = ${r}, ` +
        `the area is ${PI}(${r})${sup(2)} = ${fmtPi(value)} square ${unit}.`
      : `${note}The circumference of a circle with radius r is 2${PI}r. With r = ${r}, ` +
        `the circumference is 2${PI}(${r}) = ${fmtPi(value)} ${unit}.`,
    difficulty: given === 'radius' ? 1 : 2, // converting the diameter is the extra step
    params: { r, ask, value },
  };
}

function arc(rng) {
  const [a, b, o] = rng.pick(POINTS);
  const theta = rng.pick(ANGLES);
  const sector = rng.chance(0.5);
  // Only radii for which θ/360 of the circumference (or area) is a whole
  // multiple of π; every angle in ANGLES admits several between 2 and 24.
  const radii = [];
  for (let r = 2; r <= 24; r++) {
    if ((sector ? theta * r * r : 2 * theta * r) % 360 === 0) radii.push(r);
  }
  const r = rng.pick(radii);
  const value = sector ? (theta * r * r) / 360 : (2 * theta * r) / 360;
  const fraction = fmtFrac(theta, 360);
  const whole = sector ? fmtPi(r * r) : fmtPi(2 * r);
  return {
    stem:
      `Points ${a} and ${b} lie on a circle with center ${o}. The radius of the circle is ${r}, ` +
      `and the measure of angle ${a}${o}${b} is ${theta}${DEGREES}. ` +
      `What is the ${sector ? `area of sector ${a}${o}${b}` : `length of minor arc ${a}${b}`}?`,
    // Sector: the arc length instead, the whole area, 180 in place of 360, an
    // unsquared radius. Arc: the sector area instead, the whole circumference,
    // a dropped 2, 180 in place of 360.
    ...numeric(
      rng,
      value,
      sector
        ? [Math.round((theta * r) / 180), r * r, 2 * value, Math.round((theta * r) / 360)]
        : [Math.round((theta * r * r) / 360), 2 * r, Math.round(value / 2), 2 * value],
      fmtPi,
      r,
    ),
    explanation:
      `The central angle is ${theta}${DEGREES} out of 360${DEGREES}, so the ${sector ? 'sector' : 'arc'} is ` +
      `${theta}/360 = ${fraction} of the ${sector ? 'circle' : 'circumference'}. ` +
      (sector
        ? `The area of the circle is ${PI}(${r})${sup(2)} = ${whole}, so the sector area is `
        : `The circumference is 2${PI}(${r}) = ${whole}, so the arc length is `) +
      `${fraction} ${TIMES} ${whole} = ${fmtPi(value)}.`,
    difficulty: 3, // the angle fraction on top of the circle formula
    params: { theta, r, sector, value },
  };
}

function equation(rng) {
  const h = rng.nonzero(-9, 9); // nonzero h and k keep the four sign variants distinct
  const k = rng.nonzero(-9, 9);
  const askCenter = rng.chance(0.5);
  // When the radius is asked for, r² of 1 or 4 leaves too few believable slips.
  const r = rng.int(askCenter ? 1 : 3, 12);
  const shift = (variable, n) => `(${variable} ${n > 0 ? MINUS : '+'} ${Math.abs(n)})${sup(2)}`;
  const equationText = `${shift('x', h)} + ${shift('y', k)} = ${r * r}`;
  const standard = `(x ${MINUS} h)${sup(2)} + (y ${MINUS} k)${sup(2)} = r${sup(2)}`;
  const common = {
    difficulty: 2, // reading the standard form, with its sign reversal
    params: { h, k, r, askCenter },
  };
  if (askCenter) {
    return {
      stem:
        `In the xy-plane, the graph of the equation ${equationText} is a circle. ` +
        'What are the coordinates of the center of the circle?',
      // Every combination of sign slips on h and k.
      ...makeChoices(rng, point(h, k), [point(-h, -k), point(h, -k), point(-h, k)]),
      explanation:
        `A circle with center (h, k) and radius r has the equation ${standard}. ` +
        `Matching ${equationText} to this form gives h = ${fmtNum(h)} and k = ${fmtNum(k)}, ` +
        `so the center is ${point(h, k)}.`,
      ...common,
    };
  }
  return {
    stem: `In the xy-plane, the graph of the equation ${equationText} is a circle. What is the radius of the circle?`,
    // Stopping at r², doubling, halving r², reading a coordinate of the center as the radius.
    ...numeric(rng, r, [r * r, 2 * r, Math.round((r * r) / 2), Math.abs(h), Math.abs(k)], fmtNum, 2),
    explanation:
      `A circle with center (h, k) and radius r has the equation ${standard}, so the right side is ` +
      `the square of the radius. Here r${sup(2)} = ${r * r}, so the radius is ${r}.`,
    ...common,
  };
}

function inverse(rng) {
  const { object, unit, r } = pickObject(rng);
  const fromCircumference = rng.chance(0.5);
  if (fromCircumference) {
    const askDiameter = rng.chance(0.5);
    const value = askDiameter ? 2 * r : r;
    return {
      stem:
        `A circular ${object} has a circumference of ${fmtPi(2 * r)} ${unit}. ` +
        `What is the ${askDiameter ? 'diameter' : 'radius'}, in ${unit}, of the ${object}?`,
      // Radius: the coefficient taken as the radius, doubling instead, halving
      // twice. Diameter: halving to the radius, doubling, halving twice.
      ...numeric(rng, value, askDiameter ? [r, 4 * r, Math.round(r / 2)] : [2 * r, 4 * r, Math.round(r / 2)], fmtNum, 2),
      explanation: askDiameter
        ? `The circumference of a circle is ${PI}d, where d is the diameter. Setting ${PI}d = ${fmtPi(2 * r)} ` +
          `and dividing both sides by ${PI} gives d = ${2 * r}. The diameter is ${2 * r} ${unit}.`
        : `The circumference of a circle is 2${PI}r. Setting 2${PI}r = ${fmtPi(2 * r)} and dividing ` +
          `both sides by 2${PI} gives r = ${2 * r}/2 = ${r}. The radius is ${r} ${unit}.`,
      difficulty: 1, // one division
      params: { fromCircumference, askDiameter, given: 2 * r, value },
    };
  }
  return {
    stem:
      `A circular ${object} has an area of ${fmtPi(r * r)} square ${unit}. ` +
      `What is the circumference, in ${unit}, of the ${object}?`,
    // Stopping at the radius, reusing the area's coefficient, using the diameter
    // in 2πr, doubling the area's coefficient.
    ...numeric(rng, 2 * r, [r, r * r, 4 * r, 2 * r * r], fmtPi, r),
    explanation:
      `The area of a circle is ${PI}r${sup(2)}, so r${sup(2)} = ${r * r} and r = ${r}. ` +
      `The circumference is 2${PI}r = 2${PI}(${r}) = ${fmtPi(2 * r)} ${unit}.`,
    difficulty: 2, // back to the radius, then forward to the circumference
    params: { fromCircumference, askDiameter: false, given: r * r, value: 2 * r },
  };
}

const VARIANTS = { measure, arc, equation, inverse };

// The text the correct choice must show, recomputed by a different route from
// the one that built the item, or false when the stored numbers disagree.
const EXPECTED = {
  measure: ({ r, ask, value }) => (ask === 'area' ? Math.sqrt(value) === r : value / 2 === r) && fmtPi(value),
  arc: ({ theta, r, sector, value }) =>
    (sector ? value * 360 === theta * r * r : value * 180 === theta * r) && fmtPi(value),
  equation: ({ h, k, r, askCenter }) => h !== 0 && k !== 0 && r > 0 && (askCenter ? point(h, k) : fmtNum(r)),
  inverse: ({ fromCircumference, askDiameter, given, value }) =>
    fromCircumference
      ? (askDiameter ? value === given : 2 * value === given) && fmtNum(value)
      : (value / 2) ** 2 === given && fmtPi(value),
};

// Circumference and area from a radius or diameter, arc length and sector area
// from a central angle, the center or radius read from (x − h)² + (y − k)² = r²,
// and the radius, diameter or circumference recovered from a circumference or
// area. The radius is chosen first, so every answer is a whole number or a
// whole multiple of π.
export default {
  id: 'geometry.circles',
  domain: 'geometry',
  skill: 'Circles',
  // Lower bound summed over the variants: measure 151·2·2 (object–unit–radius
  // combinations, ask, given), arc and sector 118 angle–radius pairs × 6 point
  // sets, equation 18·18·12 for the center and 18·18·10 for the radius, inverse
  // 151·3 (radius or diameter from a circumference, circumference from an area).
  space: 151 * 2 * 2 + 118 * 6 + 18 * 18 * 12 + 18 * 18 * 10 + 151 * 3,

  generate(rng) {
    const kind = rng.pick(KINDS);
    const { stem, choices, answer, explanation, difficulty, params } = VARIANTS[kind](rng);
    return {
      item: { type: 'mc', difficulty, stem, choices, answer, explanation },
      params: { kind, ...params },
    };
  },

  verify({ item, params }) {
    const expected = EXPECTED[params.kind](params);
    return typeof expected === 'string' && answerText(item) === expected;
  },
};
