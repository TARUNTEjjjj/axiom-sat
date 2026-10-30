import { fmtLinear, fmtNum, fmtTerm, DEGREES, MINUS, TIMES } from '../../format.js';
import { makeChoices, pickDistractors } from '../../choices.js';
import { answerText } from '../../schema.js';

const TRIANGLES = ['ABC', 'DEF', 'PQR', 'XYZ', 'JKL', 'RST'];
const PAIRS = [['ABC', 'DEF'], ['PQR', 'XYZ'], ['JKL', 'MNP'], ['RST', 'UVW'], ['FGH', 'KLM'], ['ABC', 'PQR']];
const EQUAL = ['alternate interior angles', 'corresponding angles', 'alternate exterior angles'];
const SUPPLEMENTARY = ['same-side interior angles', 'same-side exterior angles'];
const KINDS = ['sum', 'isosceles', 'transversal', 'similar'];

// A length or angle that came out zero or negative is not a believable wrong
// answer, so it is dropped and pickDistractors fills the gap.
const positive = (n) => (n > 0 ? n : NaN);

// Filler distractors step away from the answer on both sides (5° for an angle,
// 2 for a length, 3 for x) but only to values the variant finds believable, so
// they are never impossible and never a run of consecutive numbers.
const filler = (value, step, ok) => (k) => ok(value + step * k);
const angle = (v) => (v > 0 && v < 180 ? v : NaN);

// An angle measure in degrees: (3x − 5)°, or 3x° when there is a single term.
const measure = (text) => (text.includes(' ') ? `(${text})${DEGREES}` : text + DEGREES);

function sum(rng) {
  const [p, q, r] = rng.pick(TRIANGLES);
  const c = rng.int(15, 120);
  const a = rng.int(15, 165 - c); // keeps the third angle b at least 15° as well
  const b = 180 - a - c;
  return {
    stem:
      `In triangle ${p}${q}${r}, the measure of angle ${p} is ${a}${DEGREES} and the measure of ` +
      `angle ${q} is ${b}${DEGREES}. What is the measure, in degrees, of angle ${r}?`,
    value: c,
    // Forgetting one of the given angles, stopping at their sum, subtracting
    // them from each other. (A triangle's angle is never 180° or more, so
    // 360° − a − b is not offered.)
    slips: [180 - a, 180 - b, a + b, positive(Math.abs(a - b))],
    step: 5,
    ok: angle,
    explanation:
      `The measures of the three angles of a triangle add up to 180${DEGREES}. ` +
      `The two given angles total ${a}${DEGREES} + ${b}${DEGREES} = ${a + b}${DEGREES}, ` +
      `so angle ${r} measures 180${DEGREES} ${MINUS} ${a + b}${DEGREES} = ${c}${DEGREES}.`,
    params: { a, b, c },
  };
}

function isosceles(rng) {
  const [p, q, r] = rng.pick(TRIANGLES);
  let base;
  do base = rng.int(20, 80); while (base === 60); // equilateral: every slip would equal the answer
  const vertex = 180 - 2 * base; // sides pq = pr, so the vertex angle is at p
  const askVertex = rng.chance(0.5);
  const sides = `${p}${q} = ${p}${r}`;
  if (askVertex) {
    return {
      stem:
        `In triangle ${p}${q}${r}, ${sides} and the measure of angle ${q} is ${base}${DEGREES}. ` +
        `What is the measure, in degrees, of angle ${p}?`,
      value: vertex,
      // Forgetting the second base angle, taking all angles equal, treating the
      // given angle as the vertex angle, doubling without subtracting from 180°.
      slips: [180 - base, base, Math.round((180 - base) / 2), 2 * base],
      step: 5,
      ok: angle,
      explanation:
        `Because ${sides}, the angles opposite those sides are equal, so angle ${r} also measures ` +
        `${base}${DEGREES}. The angles of a triangle add up to 180${DEGREES}, so angle ${p} measures ` +
        `180${DEGREES} ${MINUS} 2(${base}${DEGREES}) = ${vertex}${DEGREES}.`,
      params: { base, vertex, askVertex },
    };
  }
  return {
    stem:
      `In triangle ${p}${q}${r}, ${sides} and the measure of angle ${p} is ${vertex}${DEGREES}. ` +
      `What is the measure, in degrees, of angle ${q}?`,
    value: base,
    // Forgetting to halve, taking all angles equal, treating the given angle as
    // a base angle, halving the given angle instead of what is left.
    slips: [180 - vertex, vertex, positive(180 - 2 * vertex), Math.round(vertex / 2)],
    step: 5,
    ok: angle,
    explanation:
      `Because ${sides}, angles ${q} and ${r} are equal. Together they measure ` +
      `180${DEGREES} ${MINUS} ${vertex}${DEGREES} = ${180 - vertex}${DEGREES}, ` +
      `so each measures ${180 - vertex}${DEGREES}/2 = ${base}${DEGREES}.`,
    params: { base, vertex, askVertex },
  };
}

function transversal(rng) {
  const x = rng.int(5, 30);
  const p = rng.int(2, 5);
  let q;
  let first;
  // Both angles stay between 45° and 135°, which leaves every x within 9 of the
  // answer believable, so the fillers below always have room.
  do {
    q = rng.int(-50, 60);
    first = p * x + q;
  } while (first < 45 || first > 135);
  const supplementary = rng.chance(0.5);
  const relation = rng.pick(supplementary ? SUPPLEMENTARY : EQUAL);
  const second = supplementary ? 180 - first : first;
  let s = rng.int(1, 5);
  while (!supplementary && s === p) s = rng.int(1, 5); // p ≠ s keeps exactly one solution
  const t = second - s * x;

  const left = fmtLinear(p, q);
  const right = fmtLinear(s, t);
  const capitalized = relation[0].toUpperCase() + relation.slice(1);
  const stem =
    `Two parallel lines are cut by a transversal, forming a pair of ${relation} with measures ` +
    `${measure(left)} and ${measure(right)}. What is the value of x?`;

  // Using the other relation, a sign slip on a constant, subtracting the
  // x-coefficients where they should be added (or the reverse), answering with
  // the angle measure instead of x. Divisions by p − s need p ≠ s, and a value
  // of x that would push either angle to 0° or past 180° is not believable.
  const differ = (n) => (p === s ? NaN : Math.round(n / Math.abs(p - s)));
  const believable = (v) =>
    v > 0 && p * v + q > 0 && p * v + q < 180 && s * v + t > 0 && s * v + t < 180 ? v : NaN;
  const slips = supplementary
    ? [differ(t - q), Math.round((180 + q - t) / (p + s)), differ(180 - q - t), first]
    : [Math.round((180 - q - t) / (p + s)), Math.round((t + q) / (p - s)), Math.round((t - q) / (p + s)), first];

  // The x-terms are moved to whichever side keeps their coefficient positive.
  const k = Math.abs(p - s);
  const collected = `${fmtTerm(k)} = ${fmtNum(p > s ? t - q : q - t)}`;
  const combined = `${fmtLinear(p + s, q + t)} = 180`;
  const explanation = supplementary
    ? `${capitalized} formed by parallel lines and a transversal are supplementary, so ` +
      `(${left}) + (${right}) = 180. Combining like terms gives ${combined}, so ` +
      (q + t === 0 ? `x = ${x}.` : `${fmtTerm(p + s)} = ${fmtNum(180 - q - t)} and x = ${x}.`)
    : `${capitalized} formed by parallel lines and a transversal are equal, so ${left} = ${right}. ` +
      `Collecting the x-terms on one side gives ${collected}${k === 1 ? '' : `, so x = ${x}`}. ` +
      `Each of the two angles measures ${first}${DEGREES}.`;

  return {
    stem,
    value: x,
    slips: slips.map(believable),
    step: 3,
    ok: believable,
    explanation,
    params: { x, p, q, s, t, supplementary },
  };
}

function similar(rng) {
  const [small, big] = rng.pick(PAIRS);
  const k = rng.int(2, 5);
  const ab = rng.int(3, 12);
  let bc = rng.int(3, 12);
  while (bc === ab) bc = rng.int(3, 12); // distinct sides keep the pairing meaningful
  const de = k * ab;
  const ef = k * bc;
  const askBig = rng.chance(0.5);
  const s01 = small[0] + small[1];
  const s12 = small[1] + small[2];
  const b01 = big[0] + big[1];
  const b12 = big[1] + big[2];
  const setup =
    `Triangle ${small} is similar to triangle ${big}, where ${small[0]}, ${small[1]}, and ${small[2]} ` +
    `correspond to ${big[0]}, ${big[1]}, and ${big[2]}, respectively. `;
  const proportional = 'Corresponding sides of similar triangles are proportional. ';
  if (askBig) {
    return {
      stem:
        setup +
        `The length of ${s01} is ${ab}, the length of ${s12} is ${bc}, and the length of ${b01} is ${de}. ` +
        `What is the length of ${b12}?`,
      value: ef,
      // Adding the difference instead of scaling, pairing the wrong sides,
      // forgetting to scale at all, dividing by the scale factor instead.
      slips: [bc + de - ab, Math.round((de * ab) / bc), bc, Math.round(bc / k)],
      step: 2,
      explanation:
        proportional +
        `The scale factor from triangle ${small} to triangle ${big} is ${b01}/${s01} = ${de}/${ab} = ${k}, ` +
        `so ${b12} = ${k} ${TIMES} ${bc} = ${ef}.`,
      params: { ab, bc, de, ef, askBig },
    };
  }
  return {
    stem:
      setup +
      `The length of ${b01} is ${de}, the length of ${b12} is ${ef}, and the length of ${s01} is ${ab}. ` +
      `What is the length of ${s12}?`,
    value: bc,
    // Subtracting the difference instead of scaling, pairing the wrong sides,
    // forgetting to scale at all, multiplying by the scale factor instead.
    slips: [positive(ef - de + ab), Math.round((ab * de) / ef), ef, k * ef],
    step: 2,
    explanation:
      proportional +
      `The scale factor from triangle ${big} to triangle ${small} is ${s01}/${b01} = ${ab}/${de} = 1/${k}, ` +
      `so ${s12} = ${ef}/${k} = ${bc}.`,
    params: { ab, bc, de, ef, askBig },
  };
}

const VARIANTS = { sum, isosceles, transversal, similar };

// Each check substitutes the stored numbers back into the geometric relation
// rather than repeating the construction.
const CHECKS = {
  sum: ({ a, b, c, value }) => a + b + c === 180 && value === c,
  isosceles: ({ base, vertex, askVertex, value }) =>
    2 * base + vertex === 180 && value === (askVertex ? vertex : base),
  transversal: ({ x, p, q, s, t, supplementary, value }) => {
    const first = p * x + q;
    const second = s * x + t;
    const related = supplementary ? first + second === 180 : first === second;
    return related && first > 0 && first < 180 && second > 0 && second < 180 && value === x;
  },
  similar: ({ ab, bc, de, ef, askBig, value }) => de * bc === ef * ab && value === (askBig ? ef : bc),
};

// Angle sums in triangles (plain and isosceles), angle pairs along a transversal
// with algebraic measures, and sides of similar triangles. The unknown is chosen
// first so every answer is a whole number of degrees or units.
export default {
  id: 'geometry.angles-triangles',
  domain: 'geometry',
  skill: 'Lines, angles, and triangles',
  // Lower bound summed over the variants: angle sum Σ over c of the a-range
  // (8851) × 6 triangles, isosceles 60·2·6 (base angles 20°–80° except 60°),
  // transversal 26·4·26·4·5 (x, p, the fewest q values that keep the angle in
  // range, s, relation), similar 4·10·9·2·6.
  space: 8851 * 6 + 60 * 2 * 6 + 26 * 4 * 26 * 4 * 5 + 4 * 10 * 9 * 2 * 6,

  generate(rng) {
    const kind = rng.pick(KINDS);
    const { stem, value, slips, step, ok = positive, explanation, params } = VARIANTS[kind](rng);
    // Which three slips appear is left to chance, so the answer is not pinned to
    // one position among the sorted choices.
    const distractors = pickDistractors(value, rng.shuffle(slips), 3, filler(value, step, ok));
    const { choices, answer } = makeChoices(rng, fmtNum(value), distractors.map(fmtNum));

    // The plain angle sum is 1; isosceles and similar triangles add one
    // deduction (2); the transversal asks for an equation to be set up and
    // solved (3).
    const difficulty = kind === 'sum' ? 1 : kind === 'transversal' ? 3 : 2;

    return {
      item: { type: 'mc', difficulty, stem, choices, answer, explanation },
      params: { kind, value, ...params },
    };
  },

  verify({ item, params }) {
    return CHECKS[params.kind](params) && answerText(item) === fmtNum(params.value);
  },
};
