import { test, assert, assertEqual } from './harness.js';
import { createRng } from '../src/questions/prng.js';
import { isSprAnswer } from '../src/questions/schema.js';
import { parseSpr } from '../src/questions/spr.js';
import { generate, getTemplate } from '../src/questions/index.js';

const IDS = [
  'advanced.discriminant-parameter',
  'advanced.root-relationships',
  'advanced.rational-equations',
  'advanced.radical-equations',
  'advanced.exponential-observations',
  'advanced.quadratic-from-points',
  'advanced.polynomial-parameter',
  'advanced.nonlinear-system-sum',
  'geometry.circle-tangency',
  'geometry.similar-solids',
  'psda.conditional-probability',
  'algebra.system-parameter',
];

for (const id of IDS) {
  test(`${id}: challenge answers fit and verifiers reject nearby wrong values`, () => {
    const template = getTemplate(id);
    for (let seed = 0; seed < 300; seed++) {
      const out = template.generate(createRng(seed));
      const { item } = out;
      assertEqual(item.difficulty, 3);
      assert(isSprAnswer(item.answer), `${id}#${seed}: invalid response box answer`);
      assert(item.explanation.length > 150, `${id}#${seed}: missing worked reasoning`);
      assert(template.verify(out), `${id}#${seed}: correct answer rejected`);
      assert(
        !template.verify({ ...out, item: { ...item, answer: 'invalid' } }),
        `${id}#${seed}: invalid answer accepted`,
      );
      const value = parseSpr(item.answer);
      for (const difference of [-1, 1]) {
        const changed = { ...out, item: { ...item, answer: String(value + difference) } };
        assert(!template.verify(changed), `${id}#${seed}: wrong answer ${changed.item.answer} accepted`);
      }
      if (value !== 0) {
        assert(
          !template.verify({ ...out, item: { ...item, answer: String(-value) } }),
          `${id}#${seed}: reversed sign accepted`,
        );
      }
    }
  });
}

test('challenge identities survive uint32 edge seeds and include useful worked explanations', () => {
  for (const id of IDS) {
    for (const seed of [0, 1, 0x7fffffff, 0x80000000, 0xfffffffe, 0xffffffff]) {
      const item = generate(id, seed);
      assertEqual(item.id, `${id}#${seed}`);
      assertEqual(item.difficulty, 3);
      assert(!/NaN|undefined|Infinity/.test(item.stem + item.explanation));
    }
  }
});

test('radical challenges always require rejecting one extraneous candidate', () => {
  const template = getTemplate('advanced.radical-equations');
  for (let seed = 0; seed < 800; seed++) {
    const {
      item,
      params: { m, n, k },
    } = template.generate(createRng(seed));
    const accepted = [];
    const squaredOnly = [];
    for (let x = -40; x <= 40; x++) {
      if (m * x + n === (x - k) ** 2) squaredOnly.push(x);
      if (m * x + n >= 0 && Math.sqrt(m * x + n) === x - k) accepted.push(x);
    }
    assertEqual(squaredOnly.length, 2);
    assertEqual(accepted.length, 1);
    assertEqual(accepted[0], parseSpr(item.answer));
    assert(
      squaredOnly.some((x) => x < k),
      `seed ${seed}: no sign-invalid candidate`,
    );
  }
});

test('rational challenges distinguish the excluded root from the original solution', () => {
  const template = getTemplate('advanced.rational-equations');
  for (let seed = 0; seed < 800; seed++) {
    const {
      item,
      params: { a, r, rhs },
    } = template.generate(createRng(seed));
    const accepted = [];
    for (let x = -45; x <= 45; x++) {
      if (x !== r && (a * x * x - a * r * r) / (x - r) === rhs) accepted.push(x);
    }
    assertEqual(accepted.length, 1);
    assertEqual(accepted[0], parseSpr(item.answer));
    assertEqual(a * r * r - a * r * r, rhs * (r - r));
    assert(!template.verify({ item: { ...item, answer: String(r) }, params: { a, r, rhs } }));
  }
});

test('exponential observations exercise interpolation and extrapolation with both observation gaps', () => {
  const template = getTemplate('advanced.exponential-observations');
  const variants = new Set();
  for (let seed = 0; seed < 500; seed++) {
    const {
      params: { time, gap, target },
    } = template.generate(createRng(seed));
    variants.add(`${gap}:${target < time + gap ? 'between' : 'after'}`);
  }
  assertEqual(variants.size, 4);
});

test('circle challenges cover horizontal and vertical tangents on either side of the center', () => {
  const template = getTemplate('geometry.circle-tangency');
  const variants = new Set();
  for (let seed = 0; seed < 500; seed++) {
    const {
      params: { axis, t, xCoefficient, yCoefficient },
    } = template.generate(createRng(seed));
    const center = -(axis === 'x' ? xCoefficient : yCoefficient) / 2;
    variants.add(`${axis}:${Math.sign(t - center)}`);
  }
  assertEqual(variants.size, 4);
});
