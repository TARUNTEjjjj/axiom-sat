import { fmtComma, sup, MINUS, PI, TIMES } from '../../format.js';
import { makeChoices, pickDistractors } from '../../choices.js';
import { answerText } from '../../schema.js';

// Each object carries the unit it is measured in and the sizes it comes in, so
// that a planter is never 2 inches wide and a silo never 2 feet tall. Every
// length is at least 2, so the plural unit words are always right.
const BOXES = [
  { name: 'storage box', unit: 'inches', range: [8, 20] },
  { name: 'shipping crate', unit: 'feet', range: [3, 8] },
  { name: 'fish tank', unit: 'inches', range: [10, 24] },
  { name: 'planter', unit: 'inches', range: [6, 18] },
  { name: 'toolbox', unit: 'inches', range: [6, 20] },
  { name: 'jewelry box', unit: 'centimeters', range: [4, 12] },
];
const CANS = [
  { name: 'can', unit: 'centimeters', r: [3, 7], h: [8, 18] },
  { name: 'water tank', unit: 'feet', r: [2, 6], h: [4, 12] },
  { name: 'candle', unit: 'centimeters', r: [2, 5], h: [8, 20] },
  { name: 'silo', unit: 'meters', r: [2, 5], h: [6, 15] },
  { name: 'paint bucket', unit: 'inches', r: [4, 7], h: [10, 15] },
  { name: 'drinking glass', unit: 'centimeters', r: [3, 4], h: [8, 15] },
];
// A cone's height is 3m, so (1/3)πr²h = r²m·π is a whole multiple of π.
const CONES = [
  { name: 'paper cup', unit: 'centimeters', r: [2, 5], m: [3, 5] },
  { name: 'funnel', unit: 'centimeters', r: [4, 8], m: [2, 5] },
  { name: 'party hat', unit: 'centimeters', r: [5, 9], m: [4, 8] },
  { name: 'traffic cone', unit: 'inches', r: [5, 8], m: [6, 10] },
  { name: 'pile of sand', unit: 'feet', r: [6, 15], m: [1, 2] }, // no taller than it is wide
  { name: 'tent', unit: 'feet', r: [4, 9], m: [2, 4] },
  { name: 'roof', unit: 'feet', r: [5, 12], m: [2, 5] },
];
// The range is for the longer side; the shorter side is at least half of it.
const REGIONS = [
  { name: 'garden', units: ['feet', 'meters'], range: [8, 20] },
  { name: 'patio', units: ['feet'], range: [8, 20] },
  { name: 'parking lot', units: ['yards', 'meters'], range: [20, 50] },
  { name: 'deck', units: ['feet'], range: [8, 20] },
  { name: 'courtyard', units: ['feet', 'meters'], range: [10, 30] },
  { name: 'playground', units: ['feet', 'meters', 'yards'], range: [15, 40] },
];
const KINDS = ['prism', 'cylinder', 'cone', 'lshape', 'missing'];

// A coefficient of π: 48π, or just π.
const fmtPi = (n) => (n === 1 ? PI : fmtComma(n) + PI);

// Filler distractors step away from the answer by a natural unit of the
// problem (one more layer of the base, one more cut-out, ...) on both sides,
// but never reach zero; a length, area or volume cannot be negative.
const filler = (value, unit) => (k) => (value + unit * k > 0 ? value + unit * k : NaN);

function prism(rng) {
  const { name: object, unit, range } = rng.pick(BOXES);
  const l = rng.int(...range);
  const w = rng.int(...range);
  const h = rng.int(...range);
  const value = l * w * h;
  return {
    stem:
      `A ${object} in the shape of a rectangular prism has a length of ${l} ${unit}, ` +
      `a width of ${w} ${unit}, and a height of ${h} ${unit}. ` +
      `What is the volume, in cubic ${unit}, of the ${object}?`,
    value,
    // Adding the height to the base area, finding the surface area instead,
    // forgetting the height, adding two dimensions before multiplying.
    slips: [l * w + h, 2 * (l * w + l * h + w * h), l * w, (l + w) * h],
    unit: l * w,
    explanation:
      `The volume of a rectangular prism is length ${TIMES} width ${TIMES} height. ` +
      `Here that is ${l} ${TIMES} ${w} ${TIMES} ${h} = ${fmtComma(value)}, so the volume is ` +
      `${fmtComma(value)} cubic ${unit}.`,
    params: { l, w, h },
  };
}

function cylinder(rng) {
  const { name: object, unit, r: rRange, h: hRange } = rng.pick(CANS);
  const r = rng.int(...rRange);
  const h = rng.int(...hRange);
  const given = rng.pick(['radius', 'diameter']);
  const value = r * r * h;
  const note = given === 'diameter' ? `The radius is half the diameter: ${2 * r}/2 = ${r}. ` : '';
  return {
    stem:
      `A cylindrical ${object} has a ${given} of ${given === 'radius' ? r : 2 * r} ${unit} ` +
      `and a height of ${h} ${unit}. What is the volume, in cubic ${unit}, of the ${object}?`,
    value,
    pi: true,
    // Forgetting to square the radius, using the diameter as the radius, finding
    // the lateral area or the surface area instead.
    slips: [r * h, 4 * r * r * h, 2 * r * h, 2 * r * (r + h)],
    unit: r * h,
    explanation:
      note +
      `The volume of a cylinder is ${PI}r${sup(2)}h. Substituting r = ${r} and h = ${h} gives ` +
      `${PI}(${r})${sup(2)}(${h}) = ${PI}(${r * r})(${h}) = ${fmtPi(value)}, ` +
      `so the volume is ${fmtPi(value)} cubic ${unit}.`,
    params: { r, h, given },
  };
}

function cone(rng) {
  const { name: object, unit, r: rRange, m: mRange } = rng.pick(CONES);
  const r = rng.int(...rRange);
  const m = rng.int(...mRange);
  const h = 3 * m;
  const value = r * r * m;
  return {
    stem:
      `A conical ${object} has a base radius of ${r} ${unit} and a height of ${h} ${unit}. ` +
      `What is the volume, in cubic ${unit}, of the ${object}?`,
    value,
    pi: true,
    // Forgetting the 1/3, using the diameter as the radius, forgetting to square
    // the radius, swapping r and h.
    slips: [3 * value, 4 * value, r * m, 3 * m * m * r],
    unit: r * m,
    explanation:
      `The volume of a cone is (1/3)${PI}r${sup(2)}h. Substituting r = ${r} and h = ${h} gives ` +
      `(1/3)${PI}(${r})${sup(2)}(${h}) = (1/3)${PI}(${fmtComma(r * r * h)}) = ${fmtPi(value)}, ` +
      `so the volume is ${fmtPi(value)} cubic ${unit}.`,
    params: { r, h },
  };
}

function lshape(rng) {
  const { name: region, units, range } = rng.pick(REGIONS);
  const unit = rng.pick(units);
  const long = rng.int(...range);
  const wide = rng.int(Math.max(5, Math.ceil(long / 2)), long - 1);
  const a = rng.int(2, long - 2); // the cut-out stops short of both far edges,
  const b = rng.int(2, wide - 2); // so an L shape always remains
  const value = long * wide - a * b;
  return {
    stem:
      `A rectangular ${region} is ${long} ${unit} long and ${wide} ${unit} wide. ` +
      `A rectangular section ${a} ${unit} by ${b} ${unit} is removed from one corner of the ${region}, ` +
      `leaving an L-shaped region. What is the area, in square ${unit}, of the L-shaped region?`,
    value,
    // Forgetting to subtract, adding the corner instead, shrinking both sides,
    // subtracting the corner's dimensions instead of its area, keeping one arm only.
    slips: [long * wide, long * wide + a * b, (long - a) * (wide - b), long * wide - a - b, (long - a) * wide],
    unit: a * b,
    explanation:
      `The whole rectangle has area ${long} ${TIMES} ${wide} = ${fmtComma(long * wide)} square ${unit}, ` +
      `and the removed corner has area ${a} ${TIMES} ${b} = ${fmtComma(a * b)} square ${unit}. ` +
      `The L-shaped region is what remains: ${fmtComma(long * wide)} ${MINUS} ${fmtComma(a * b)} = ` +
      `${fmtComma(value)} square ${unit}.`,
    params: { long, wide, a, b },
  };
}

function missing(rng) {
  const { name: object, unit, range } = rng.pick(BOXES);
  const l = rng.int(...range);
  const w = rng.int(...range);
  const h = rng.int(...range);
  const volume = l * w * h;
  return {
    stem:
      `A ${object} in the shape of a rectangular prism has a volume of ${fmtComma(volume)} cubic ${unit}. ` +
      `The ${object} is ${l} ${unit} long and ${w} ${unit} wide. ` +
      `What is the height, in ${unit}, of the ${object}?`,
    value: h,
    // Dividing by the length only, by the width only, or by the sum of the two,
    // and stopping at the base area.
    slips: [w * h, l * h, Math.round(volume / (l + w)), l * w],
    unit: 2,
    explanation:
      `Volume is length ${TIMES} width ${TIMES} height, so ${l} ${TIMES} ${w} ${TIMES} h = ${fmtComma(volume)}. ` +
      `The base has area ${l} ${TIMES} ${w} = ${fmtComma(l * w)}, so h = ${fmtComma(volume)}/${fmtComma(l * w)} = ${h}. ` +
      `The height is ${h} ${unit}.`,
    params: { l, w, h, volume },
  };
}

const VARIANTS = { prism, cylinder, cone, lshape, missing };

// Each check takes a different route from the one that built the item.
const CHECKS = {
  prism: ({ l, w, h, value }) => value / (l * w) === h,
  cylinder: ({ r, h, value }) => value / h === r * r,
  cone: ({ r, h, value }) => 3 * value === r * r * h,
  lshape: ({ long, wide, a, b, value }) => value === (long - a) * wide + a * (wide - b),
  missing: ({ l, w, volume, value }) => l * w * value === volume,
};

// Volume and area of prisms, cylinders, cones and L-shaped regions, or a height
// recovered from a volume. Dimensions are chosen first, so every answer is a
// whole number or a whole multiple of π.
export default {
  id: 'geometry.area-volume',
  domain: 'geometry',
  skill: 'Area and volume',
  // Lower bound summed over the variants. Prism and missing height: the cube of
  // each box's size range (13³ + 6³ + 15³ + 13³ + 15³ + 9³ = 12,089), every
  // ordered triple writing a different stem. Cylinder: each can's radius × height
  // range (232 in all) × radius or diameter. Cone: each cone's radius × height
  // range (147). L-shape: for each region, the long sides × the fewest short
  // sides × the fewest cut-out lengths and widths × its units.
  space:
    2 * 12089 +
    232 * 2 +
    147 +
    (13 * 3 * 5 * 2 * 2 + 13 * 3 * 5 * 2 * 1 + 31 * 10 * 17 * 7 * 2 + 13 * 3 * 5 * 2 * 1 + 21 * 5 * 7 * 2 * 2 + 26 * 7 * 12 * 5 * 3),

  generate(rng) {
    const kind = rng.pick(KINDS);
    const { stem, value, pi, slips, unit, explanation, params } = VARIANTS[kind](rng);
    const fmt = pi ? fmtPi : fmtComma;
    // Which three slips appear is left to chance, so the answer is not pinned to
    // one position among the sorted choices.
    const distractors = pickDistractors(value, rng.shuffle(slips), 3, filler(value, unit));
    const { choices, answer } = makeChoices(rng, fmt(value), distractors.map(fmt));

    // One direct substitution is 1; converting a diameter, the cone's 1/3 factor,
    // the two-step L-shape and solving backwards for a height are 2; each is one
    // harder when the number worked with is large (a coefficient of π over 300,
    // or a volume or area over 1,000).
    const base = kind === 'prism' || (kind === 'cylinder' && params.given === 'radius') ? 1 : 2;
    const worked = kind === 'missing' ? params.volume : value;
    const difficulty = base + (worked > (pi ? 300 : 1000) ? 1 : 0);

    return {
      item: { type: 'mc', difficulty, stem, choices, answer, explanation },
      params: { kind, value, ...params },
    };
  },

  verify({ item, params }) {
    const fmt = params.kind === 'cylinder' || params.kind === 'cone' ? fmtPi : fmtComma;
    return CHECKS[params.kind](params) && answerText(item) === fmt(params.value);
  },
};
