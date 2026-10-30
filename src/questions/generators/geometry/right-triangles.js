import { sprFrac, sprNum, sup, DEGREES, MINUS, TIMES } from '../../format.js';
import { parseSpr, sprEquals } from '../../spr.js';

const TRIPLES = [[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25]];
// The largest multiplier of each triple: in a named triangle, and in a word
// problem, where a ladder or a kite string has to stay a believable length.
const SCALES = [10, 6, 4, 4];
const WORD_SCALES = [6, 3, 2, 1];
const TRIANGLES = ['ABC', 'DEF', 'PQR', 'XYZ', 'JKL', 'RST'];
const NAMES = ['Priya', 'Marcus', 'Elena', 'Jamal', 'Sofia', 'Noah'];
const FUNCTIONS = ['sin', 'cos', 'tan'];
const SIDES = ['run', 'rise', 'hyp'];

// Word-problem settings: a horizontal leg (run), a vertical leg (rise) and a
// slanted hypotenuse. {name} is filled in from NAMES. Where the shape has a
// natural orientation, `steep` says whether the rise is the longer leg: a ladder
// stands steeply, a ramp climbs gently, and a field is longer than it is wide.
// Ladders and ramps are measured in feet so that a 39-unit one stays believable.
const SETTINGS = [
  {
    intro: 'A ladder leans against a vertical wall.',
    run: 'the distance from the base of the ladder to the wall',
    rise: 'the height of the top of the ladder above the ground',
    hyp: 'the length of the ladder',
    units: ['feet'],
    steep: true,
  },
  {
    intro: 'A guy wire runs from the top of a vertical pole to a point on level ground.',
    run: 'the distance from the base of the pole to that point',
    rise: 'the height of the pole',
    hyp: 'the length of the wire',
    units: ['feet', 'meters'],
  },
  {
    intro: 'A straight ramp rises from level ground to the edge of a platform.',
    run: 'the horizontal distance covered by the ramp',
    rise: 'the height of the platform',
    hyp: 'the length of the ramp',
    units: ['feet'],
    steep: false,
  },
  {
    intro: 'A kite flies at the end of a taut string held at ground level.',
    run: 'the horizontal distance from the string holder to the point directly below the kite',
    rise: 'the height of the kite above the ground',
    hyp: 'the length of the string',
    units: ['feet', 'meters', 'yards'],
  },
  {
    intro: 'A rectangular field has a straight path from one corner to the opposite corner.',
    run: 'the length of the field',
    rise: 'the width of the field',
    hyp: 'the length of the path',
    units: ['feet', 'meters', 'yards'],
    steep: false,
  },
  {
    intro: '{name} drives due east and then due north.',
    run: 'the distance driven east',
    rise: 'the distance driven north',
    hyp: "the straight-line distance between {name}'s starting point and ending point",
    units: ['miles', 'kilometers'],
  },
];

const cap = (text) => text[0].toUpperCase() + text.slice(1);
const fill = (text, name) => text.split('{name}').join(name);

// Side names in a triangle whose right angle is at its third vertex: legA is the
// leg opposite angle A, legB the leg opposite angle B.
function sidesOf(triangle) {
  const [A, B, C] = triangle;
  return { A, B, C, hyp: A + B, legA: B + C, legB: A + C };
}

function pythag(rng) {
  const i = rng.int(0, TRIPLES.length - 1);
  const [x, y, z] = TRIPLES[i];
  const plain = rng.chance(1 / 3);
  const k = rng.int(1, plain ? SCALES[i] : WORD_SCALES[i]);
  const setting = plain ? null : rng.pick(SETTINGS);
  // The triples list the shorter leg first; a setting with a natural
  // orientation decides which leg is vertical, otherwise chance does.
  const steep = setting && setting.steep !== undefined ? setting.steep : rng.chance(0.5);
  const [run, rise] = steep ? [k * x, k * y] : [k * y, k * x];
  const hyp = k * z;
  const lengths = { run, rise, hyp };
  const unknown = rng.pick(SIDES);
  const [known1, known2] = SIDES.filter((side) => side !== unknown);
  const value = lengths[unknown];
  const otherLeg = unknown === 'run' ? rise : run;

  const work =
    unknown === 'hyp'
      ? `the hypotenuse squared is ${run}${sup(2)} + ${rise}${sup(2)} = ${run * run} + ${rise * rise} = ` +
        `${hyp * hyp}, and ${hyp}${sup(2)} = ${hyp * hyp}`
      : `the missing leg squared is ${hyp}${sup(2)} ${MINUS} ${otherLeg}${sup(2)} = ` +
        `${hyp * hyp} ${MINUS} ${otherLeg * otherLeg} = ${value * value}, and ${value}${sup(2)} = ${value * value}`;

  let stem;
  let explanation;
  if (plain) {
    const t = sidesOf(rng.pick(TRIANGLES));
    const names = { run: t.legB, rise: t.legA, hyp: t.hyp };
    stem =
      `In right triangle ${t.A}${t.B}${t.C}, angle ${t.C} is a right angle, ` +
      `${names[known1]} = ${lengths[known1]}, and ${names[known2]} = ${lengths[known2]}. ` +
      `What is the length of ${names[unknown]}?`;
    explanation =
      `Angle ${t.C} is the right angle, so ${t.hyp} is the hypotenuse and ${t.legA} and ${t.legB} are the legs. ` +
      `By the Pythagorean theorem, ${work}, so ${names[unknown]} = ${value}.`;
  } else {
    const name = rng.pick(NAMES);
    const unit = rng.pick(setting.units);
    const text = (side) => fill(setting[side], name);
    stem =
      `${fill(setting.intro, name)} ${cap(text(known1))} is ${lengths[known1]} ${unit}, ` +
      `and ${text(known2)} is ${lengths[known2]} ${unit}. What is ${text(unknown)}, in ${unit}?`;
    explanation =
      `The two perpendicular distances are the legs of a right triangle, and ${text('hyp')} is its hypotenuse. ` +
      `By the Pythagorean theorem, ${work}, so ${text(unknown)} is ${value} ${unit}.`;
  }

  // Adding squares for the hypotenuse is 1, subtracting for a leg is 2, and a
  // word problem adds one more.
  const difficulty = (unknown === 'hyp' ? 1 : 2) + (plain ? 0 : 1);

  return {
    stem,
    answer: sprNum(value),
    explanation,
    difficulty,
    params: { kind: 'pythag', run, rise, hyp, unknown, value, setting: setting ? SETTINGS.indexOf(setting) : -1 },
  };
}

function trig(rng) {
  const i = rng.int(0, TRIPLES.length - 1);
  const [x, y, z] = TRIPLES[i];
  const k = rng.int(1, SCALES[i]);
  const [a, b] = rng.chance(0.5) ? [k * x, k * y] : [k * y, k * x]; // a opposite angle A, b opposite angle B
  const c = k * z;
  const t = sidesOf(rng.pick(TRIANGLES));
  const f = rng.pick(FUNCTIONS);
  const atA = rng.chance(0.5);
  const angle = atA ? t.A : t.B;
  const oppRole = atA ? 'legA' : 'legB';
  const adjRole = atA ? 'legB' : 'legA';
  const lengths = { hyp: c, legA: a, legB: b };
  const opp = lengths[oppRole];
  const adj = lengths[adjRole];
  const [num, den] = f === 'sin' ? [opp, c] : f === 'cos' ? [adj, c] : [opp, adj];
  const needed = f === 'tan' ? [oppRole, adjRole] : [f === 'sin' ? oppRole : adjRole, 'hyp'];

  const omitted = rng.pick(['hyp', 'legA', 'legB']);
  const [shown1, shown2] = ['hyp', 'legA', 'legB'].filter((role) => role !== omitted);
  const needsThird = needed.includes(omitted);

  const stem =
    `In right triangle ${t.A}${t.B}${t.C}, angle ${t.C} is a right angle, ` +
    `${t[shown1]} = ${lengths[shown1]}, and ${t[shown2]} = ${lengths[shown2]}. ` +
    `What is the value of ${f}(${angle})?`;

  const otherLeg = omitted === 'legA' ? b : a;
  const third =
    omitted === 'hyp'
      ? `By the Pythagorean theorem, ${t.hyp}${sup(2)} = ${a}${sup(2)} + ${b}${sup(2)} = ${c * c}, so ${t.hyp} = ${c}. `
      : `By the Pythagorean theorem, ${t[omitted]}${sup(2)} = ${c}${sup(2)} ${MINUS} ${otherLeg}${sup(2)} = ` +
        `${lengths[omitted] * lengths[omitted]}, so ${t[omitted]} = ${lengths[omitted]}. `;
  const ratioName = f === 'sin' ? 'opposite/hypotenuse' : f === 'cos' ? 'adjacent/hypotenuse' : 'opposite/adjacent';
  const reduced = sprFrac(num, den);
  const ratio = reduced === `${num}/${den}` ? reduced : `${num}/${den} = ${reduced}`;
  const explanation =
    `Angle ${t.C} is the right angle, so ${t.hyp} is the hypotenuse. ` +
    (needsThird ? third : '') +
    `For angle ${angle}, the opposite side is ${t[oppRole]} = ${opp} and the adjacent side is ${t[adjRole]} = ${adj}, ` +
    `so ${f}(${angle}) = ${ratioName} = ${ratio}.`;

  // Reading the ratio off two given sides is 2; finding the third side first is 3.
  return {
    stem,
    answer: reduced,
    explanation,
    difficulty: needsThird ? 3 : 2,
    params: { kind: 'trig', a, b, c, f, atA },
  };
}

function special(rng) {
  const t = sidesOf(rng.pick(TRIANGLES));
  const triangle = t.A + t.B + t.C;
  const opening = `In right triangle ${triangle}, angle ${t.C} is a right angle and the measure of angle ${t.A} is`;

  if (rng.chance(0.4)) {
    const s = rng.int(2, 40);
    const [given, asked] = rng.chance(0.5) ? [t.legA, t.legB] : [t.legB, t.legA];
    return {
      stem: `${opening} 45${DEGREES}. If the length of ${given} is ${s}, what is the length of ${asked}?`,
      answer: sprNum(s),
      explanation:
        `The angles of a triangle add up to 180${DEGREES}, so angle ${t.B} measures ` +
        `180${DEGREES} ${MINUS} 90${DEGREES} ${MINUS} 45${DEGREES} = 45${DEGREES}. ` +
        `The two legs are opposite equal angles, so they are equal: ${asked} = ${given} = ${s}.`,
      difficulty: 1, // the legs are simply equal
      params: { kind: 'special', angle: 45, s, askHyp: false, value: s },
    };
  }

  const s = rng.int(2, 30);
  const angle = rng.pick([30, 60]);
  const short = angle === 30 ? t.legA : t.legB; // the leg opposite the 30° angle
  const askHyp = rng.chance(0.5);
  const value = askHyp ? 2 * s : s;
  const [given, asked] = askHyp ? [short, t.hyp] : [t.hyp, short];
  const where =
    angle === 30
      ? `Angle ${t.A} measures 30${DEGREES}, so ${short} is the side opposite the 30${DEGREES} angle.`
      : `Angle ${t.A} measures 60${DEGREES}, so angle ${t.B} measures 30${DEGREES} and ${short} is the side ` +
        `opposite the 30${DEGREES} angle.`;
  return {
    stem:
      `${opening} ${angle}${DEGREES}. If the length of ${given} is ${askHyp ? s : 2 * s}, ` +
      `what is the length of ${asked}?`,
    answer: sprNum(value),
    explanation:
      `${where} In a 30-60-90 triangle that side is half the hypotenuse, so ` +
      (askHyp ? `${t.hyp} = 2 ${TIMES} ${s} = ${2 * s}.` : `${short} = ${2 * s}/2 = ${s}.`),
    difficulty: 2, // one special-triangle fact plus locating the 30° angle
    params: { kind: 'special', angle, s, askHyp, value },
  };
}

// Each check recomputes the answer by a different route (the Pythagorean
// identity, or the actual trigonometric functions) and compares it with what
// the student is expected to type.
const CHECKS = {
  pythag: (answer, { run, rise, hyp, value }) =>
    run * run + rise * rise === hyp * hyp && sprEquals(answer, String(value)),
  trig: (answer, { a, b, c, f, atA }) => {
    const angle = atA ? Math.atan2(a, b) : Math.atan2(b, a);
    const typed = parseSpr(answer);
    return a * a + b * b === c * c && typed !== null && Math.abs(typed - Math[f](angle)) < 1e-9;
  },
  special: (answer, { angle, s, askHyp, value }) => {
    const expected = angle === 45 ? s * Math.tan(Math.PI / 4) : askHyp ? s / Math.sin(Math.PI / 6) : s;
    return Math.abs(expected - value) < 1e-9 && sprEquals(answer, String(value));
  },
};

// Student-produced responses: a missing side of a scaled Pythagorean triple (in
// words or in a named triangle), sin/cos/tan of an acute angle as a reduced
// fraction, and the half-hypotenuse and equal-leg facts of 30-60-90 and
// 45-45-90 triangles. Sides come from the triples, so every answer is exact.
export default {
  id: 'geometry.right-triangles',
  domain: 'geometry',
  skill: 'Right triangles and trigonometry',
  // Lower bound summed over the variants: named-triangle Pythagorean 6·24·2·3
  // (triangle, triple–scale pairs, leg order, unknown), word problems 6·1·12·1·3
  // (setting, at least one unit, triple–scale pairs, at least one leg order,
  // unknown), ratios 6·24·2·3·2·3 (triangle, triple–scale pairs, leg order,
  // function, angle, omitted side), 45-45-90 39·2·6, 30-60-90 29·2·2·6.
  space: 6 * 24 * 2 * 3 + 6 * 1 * 12 * 1 * 3 + 6 * 24 * 2 * 3 * 2 * 3 + 39 * 2 * 6 + 29 * 2 * 2 * 6,

  generate(rng) {
    // Pythagorean items half the time, ratios a third, special triangles the rest.
    const roll = rng.int(1, 6);
    const variant = roll <= 3 ? pythag : roll <= 5 ? trig : special;
    const { stem, answer, explanation, difficulty, params } = variant(rng);
    return {
      item: { type: 'spr', difficulty, stem, answer, explanation },
      params,
    };
  },

  verify({ item, params }) {
    return CHECKS[params.kind](item.answer, params);
  },
};
