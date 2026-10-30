import { test, assert, assertEqual } from './harness.js';
import { createRng } from '../src/questions/prng.js';
import { isSprAnswer } from '../src/questions/schema.js';
import { parseSpr } from '../src/questions/spr.js';
import { gcd, MINUS, PI } from '../src/questions/format.js';
import { testTemplates } from './generators.shared.js';
import geometry from '../src/questions/generators/geometry/index.js';
import areaVolume from '../src/questions/generators/geometry/area-volume.js';
import anglesTriangles from '../src/questions/generators/geometry/angles-triangles.js';
import rightTriangles from '../src/questions/generators/geometry/right-triangles.js';
import circles from '../src/questions/generators/geometry/circles.js';

const SEEDS = 300;

const positiveChoices = (item, seed) => {
  for (const choice of item.choices) {
    assert(!choice.text.startsWith(MINUS) && choice.text !== '0', `seed ${seed}: choice ${choice.text}`);
  }
};

// The number in a choice such as 1,250, 48π or (3, −4) is read without its dressing.
const amount = (text) => Number(text.replace(/[,π]/g, '').replace(MINUS, '-'));

// Where the key falls among the choices sorted by value: 0 is the smallest, 3 the largest.
const keyRank = (item) => {
  const values = item.choices.map((c) => amount(c.text)).sort((a, b) => a - b);
  return values.indexOf(amount(item.choices.find((c) => c.key === item.answer).text));
};

const consecutive = (item) => {
  const values = item.choices.map((c) => amount(c.text)).sort((a, b) => a - b);
  return values.every((v, i) => Number.isInteger(v) && (i === 0 || v - values[i - 1] === 1));
};

// Whether putting v in place of the asked angle or side makes the item's relation hold.
const satisfies = ({ kind, a, b, base, vertex, askVertex, p, q, s, t, supplementary, ab, bc, de, ef, askBig }, v) => {
  if (kind === 'sum') return a + b + v === 180;
  if (kind === 'isosceles') return askVertex ? 2 * base + v === 180 : 2 * v + vertex === 180;
  if (kind === 'transversal') return supplementary ? p * v + q + s * v + t === 180 : p * v + q === s * v + t;
  return askBig ? de * bc === v * ab : de * v === ef * ab;
};

testTemplates(geometry);

test('area-volume: dimensions are at least 2, answers are whole and positive, cones divide evenly', () => {
  for (let seed = 0; seed < SEEDS; seed++) {
    const { item, params } = areaVolume.generate(createRng(seed));
    assert(Number.isInteger(params.value) && params.value > 0, `seed ${seed}: value ${params.value}`);
    for (const key of ['l', 'w', 'h', 'r', 'long', 'wide', 'a', 'b']) {
      if (params[key] != null) assert(params[key] >= 2, `seed ${seed}: ${key} = ${params[key]}`);
    }
    if (params.kind === 'cone') assert(params.h % 3 === 0, `seed ${seed}: cone height ${params.h}`);
    if (params.kind === 'lshape') {
      assert(params.a < params.long && params.b < params.wide, `seed ${seed}: the cut-out is not a corner`);
    }
    positiveChoices(item, seed);
  }
});

test('area-volume: every choice carries π exactly when the solid is a cylinder or a cone', () => {
  for (let seed = 0; seed < SEEDS; seed++) {
    const { item, params } = areaVolume.generate(createRng(seed));
    const round = params.kind === 'cylinder' || params.kind === 'cone';
    const pattern = round ? /^([1-9]\d{0,2}(,\d{3})*)?π$/ : /^[1-9]\d{0,2}(,\d{3})*$/;
    for (const choice of item.choices) assert(pattern.test(choice.text), `seed ${seed}: choice ${choice.text}`);
  }
});

test('area-volume: objects come in believable sizes', () => {
  for (let seed = 0; seed < SEEDS; seed++) {
    const { item, params } = areaVolume.generate(createRng(seed));
    const { kind } = params;
    if (kind === 'prism' || kind === 'missing') {
      assert(Math.min(params.l, params.w, params.h) >= 3, `seed ${seed}: a box with a side of 2: ${item.stem}`);
    }
    if (kind === 'cone' && item.stem.includes('pile of sand')) {
      assert(params.h <= params.r, `seed ${seed}: a sand pile taller than its radius`);
    }
    if (kind === 'cylinder') assert(params.h >= 4, `seed ${seed}: cylinder height ${params.h}`);
    if (kind === 'lshape') {
      assert(params.long >= 8 && 2 * params.wide >= params.long, `seed ${seed}: ${params.long} by ${params.wide}`);
    }
  }
});

test('area-volume: the choices never run consecutively and no kind pins the key to one position', () => {
  const ranks = {};
  for (let seed = 0; seed < SEEDS; seed++) {
    const { item, params } = areaVolume.generate(createRng(seed));
    assert(!consecutive(item), `seed ${seed}: consecutive choices ${item.choices.map((c) => c.text).join(', ')}`);
    (ranks[params.kind] = ranks[params.kind] || new Set()).add(keyRank(item));
  }
  for (const [kind, set] of Object.entries(ranks)) {
    // Every honest slip for a height recovered from a volume (dividing by one
    // dimension, stopping at the base area) is larger than the height, so that
    // kind is allowed to keep its key smallest, as the test itself does.
    if (kind !== 'missing') assert(set.size >= 2, `${kind}: the key is always rank ${[...set]}`);
  }
});

test('angles-triangles: every angle is strictly between 0° and 180° and fits its relation', () => {
  for (let seed = 0; seed < SEEDS; seed++) {
    const { item, params } = anglesTriangles.generate(createRng(seed));
    if (params.kind === 'sum') {
      assert(params.a >= 15 && params.b >= 15 && params.c >= 15, `seed ${seed}: a thin triangle`);
      assert(params.a + params.b + params.c === 180, `seed ${seed}: angles do not sum to 180`);
    }
    if (params.kind === 'isosceles') {
      assert(params.base > 0 && params.vertex > 0 && 2 * params.base + params.vertex === 180, `seed ${seed}`);
      assert(params.base !== 60, `seed ${seed}: an equilateral triangle leaves no wrong answers`);
    }
    if (params.kind === 'transversal') {
      const first = params.p * params.x + params.q;
      const second = params.s * params.x + params.t;
      assert(first > 0 && first < 180 && second > 0 && second < 180, `seed ${seed}: angle out of range`);
      if (params.supplementary) assert(first + second === 180, `seed ${seed}: not supplementary`);
      else assert(first === second && params.p !== params.s, `seed ${seed}: not a unique equal pair`);
    }
    if (params.kind === 'similar') {
      const k = params.de / params.ab;
      assert(Number.isInteger(k) && k >= 2 && params.ef === k * params.bc, `seed ${seed}: scale factor ${k}`);
    }
    positiveChoices(item, seed);
  }
});

test('angles-triangles: exactly one choice satisfies the stated relation', () => {
  for (let seed = 0; seed < SEEDS; seed++) {
    const { item, params } = anglesTriangles.generate(createRng(seed));
    const solutions = item.choices.filter((c) => satisfies(params, parseSpr(c.text)));
    assertEqual(solutions.length, 1, `seed ${seed}: ${item.stem}`);
    assertEqual(solutions[0].key, item.answer, `seed ${seed}`);
  }
});

test('angles-triangles: no choice is an impossible angle, and the angle-sum key is not always the smallest', () => {
  const ranks = new Set();
  for (let seed = 0; seed < SEEDS; seed++) {
    const { item, params } = anglesTriangles.generate(createRng(seed));
    const { kind, p, q, s, t } = params;
    for (const choice of item.choices) {
      const v = parseSpr(choice.text);
      if (kind === 'sum' || kind === 'isosceles') assert(v < 180, `seed ${seed}: a triangle angle of ${v}°`);
      if (kind === 'transversal') {
        for (const measure of [p * v + q, s * v + t]) {
          assert(measure > 0 && measure < 180, `seed ${seed}: x = ${v} gives an angle of ${measure}°`);
        }
      }
    }
    if (kind === 'sum') ranks.add(keyRank(item));
  }
  assert(ranks.size >= 3, `the angle-sum key only ever takes ranks ${[...ranks]}`);
});

test('right-triangles: the answer fits the response box and the sides satisfy a² + b² = c²', () => {
  for (let seed = 0; seed < SEEDS; seed++) {
    const { item, params } = rightTriangles.generate(createRng(seed));
    assert(isSprAnswer(item.answer), `seed ${seed}: "${item.answer}" does not fit the box`);
    assert(parseSpr(item.answer) > 0, `seed ${seed}: answer ${item.answer} is not positive`);
    if (params.kind === 'pythag') {
      assert(params.run ** 2 + params.rise ** 2 === params.hyp ** 2, `seed ${seed}: not a right triangle`);
      assert(Number.isInteger(params.value), `seed ${seed}`);
    }
    if (params.kind === 'trig') {
      assert(params.a ** 2 + params.b ** 2 === params.c ** 2, `seed ${seed}: not a right triangle`);
      assert(item.answer.includes('/'), `seed ${seed}: the ratio ${item.answer} is not a fraction`);
      if (params.f !== 'tan') assert(parseSpr(item.answer) < 1, `seed ${seed}: ${params.f} is not below 1`);
    }
    if (params.kind === 'special') {
      assert(params.value === (params.askHyp ? 2 * params.s : params.s), `seed ${seed}`);
    }
  }
});

test('right-triangles: trigonometric ratios are typed in lowest terms and no side exceeds 100', () => {
  for (let seed = 0; seed < SEEDS; seed++) {
    const { item, params } = rightTriangles.generate(createRng(seed));
    if (params.kind === 'trig') {
      const [num, den] = item.answer.split('/').map(Number);
      assert(Number.isInteger(num) && Number.isInteger(den) && gcd(num, den) === 1, `seed ${seed}: ${item.answer}`);
    }
    for (const side of ['run', 'rise', 'hyp', 'a', 'b', 'c']) {
      if (params[side] != null) assert(params[side] <= 100, `seed ${seed}: ${side} = ${params[side]}`);
    }
  }
});

test('right-triangles: ladders stand steeply, ramps and fields lie long, and both ladders and ramps are in feet', () => {
  for (let seed = 0; seed < SEEDS; seed++) {
    const { item, params } = rightTriangles.generate(createRng(seed));
    if (params.kind !== 'pythag' || params.setting < 0) continue;
    const { run, rise } = params;
    if (item.stem.startsWith('A ladder')) assert(rise > run && item.stem.includes('feet'), `seed ${seed}: ${item.stem}`);
    if (item.stem.startsWith('A straight ramp')) assert(run > rise && item.stem.includes('feet'), `seed ${seed}: ${item.stem}`);
    if (item.stem.startsWith('A rectangular field')) assert(run > rise, `seed ${seed}: ${item.stem}`);
  }
});

test('circles: coefficients of π are whole, central angles are acute or obtuse, centers avoid the axes', () => {
  for (let seed = 0; seed < SEEDS; seed++) {
    const { item, params } = circles.generate(createRng(seed));
    if (params.kind === 'arc') {
      assert(Number.isInteger(params.value) && params.value > 0, `seed ${seed}: value ${params.value}`);
      assert(params.theta > 0 && params.theta < 180, `seed ${seed}: angle ${params.theta}`);
    }
    if (params.kind === 'equation') {
      assert(params.h !== 0 && params.k !== 0 && params.r >= 1, `seed ${seed}: h = ${params.h}, k = ${params.k}`);
      if (!params.askCenter) assert(params.r >= 3, `seed ${seed}: r² = ${params.r ** 2} leaves too few wrong answers`);
    }
    if (params.kind === 'measure' || params.kind === 'inverse') {
      assert(Number.isInteger(params.value) && params.value >= 2, `seed ${seed}: value ${params.value}`);
    }
    if (params.kind === 'inverse' && params.fromCircumference) {
      assertEqual(params.askDiameter ? params.value : 2 * params.value, params.given, `seed ${seed}: ${item.stem}`);
      assert(item.stem.includes(params.askDiameter ? 'the diameter' : 'the radius'), `seed ${seed}: ${item.stem}`);
    }
    positiveChoices(item, seed);
  }
});

test('circles: center choices are the four sign variants of (h, k); other choices never mix π with plain numbers', () => {
  for (let seed = 0; seed < SEEDS; seed++) {
    const { item, params } = circles.generate(createRng(seed));
    if (params.kind === 'equation' && params.askCenter) {
      const points = item.choices.map((c) => c.text.slice(1, -1).split(', ').map(parseSpr));
      for (const [x, y] of points) {
        assert(Math.abs(x) === Math.abs(params.h) && Math.abs(y) === Math.abs(params.k), `seed ${seed}: (${x}, ${y})`);
      }
      assertEqual(new Set(points.map((point) => point.join(','))).size, 4, `seed ${seed}: repeated points`);
    } else {
      const withPi = item.choices.filter((c) => c.text.endsWith(PI)).length;
      assert(withPi === 0 || withPi === 4, `seed ${seed}: mixed π and plain choices`);
      for (const choice of item.choices) {
        assert(/^([1-9]\d{0,2}(,\d{3})*)?π$|^[1-9]\d*$/.test(choice.text), `seed ${seed}: choice ${choice.text}`);
      }
    }
  }
});

test('circles: the choices never run consecutively and the radius read from an equation is not always the smallest', () => {
  const ranks = new Set();
  for (let seed = 0; seed < SEEDS; seed++) {
    const { item, params } = circles.generate(createRng(seed));
    if (params.kind === 'equation' && params.askCenter) continue;
    assert(!consecutive(item), `seed ${seed}: consecutive choices ${item.choices.map((c) => c.text).join(', ')}`);
    if (params.kind === 'equation') ranks.add(keyRank(item));
  }
  assert(ranks.size >= 2, `the radius key only ever takes ranks ${[...ranks]}`);
});
