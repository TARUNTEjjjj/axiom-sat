import { test, assert } from './harness.js';
import { createRng } from '../src/questions/prng.js';
import { isSprAnswer } from '../src/questions/schema.js';
import { parseSpr } from '../src/questions/spr.js';
import { gcd } from '../src/questions/format.js';
import { testTemplates } from './generators.shared.js';
import advanced from '../src/questions/generators/advanced/index.js';
import expressions from '../src/questions/generators/advanced/expressions.js';
import quadraticRoots from '../src/questions/generators/advanced/quadratic-roots.js';
import lineParabola from '../src/questions/generators/advanced/line-parabola.js';
import nonlinearModels from '../src/questions/generators/advanced/nonlinear-models.js';
import functionValues from '../src/questions/generators/advanced/function-values.js';

testTemplates(advanced);

test('expressions: the expansion keeps an x-term and the quotient always divides', () => {
  for (let seed = 0; seed < 300; seed++) {
    const { params } = expressions.generate(createRng(seed));
    if (params.kind === 'expand' || params.kind === 'coefficient') {
      const { a, b, c, d } = params;
      assert(a * d + b * c !== 0, `seed ${seed}: no x-term`);
      assert(a * d !== b * c, `seed ${seed}: ad = bc`);
    } else if (params.kind === 'quotient') {
      assert(Number.isInteger(params.k1 / params.k2), `seed ${seed}: coefficients do not divide`);
      assert(params.m > params.n, `seed ${seed}: the exponent would not be positive`);
    }
  }
});

test('expressions: both binomials of the expansion are primitive', () => {
  for (let seed = 0; seed < 300; seed++) {
    const { item, params } = expressions.generate(createRng(seed));
    if (params.kind !== 'expand' && params.kind !== 'coefficient') continue;
    const { a, b, c, d } = params;
    assert(gcd(a, b) === 1 && gcd(c, d) === 1, `seed ${seed}: a common factor in ${item.stem}`);
  }
});

test('quadratic-roots: the roots are distinct nonzero integers and the answer fits the box', () => {
  for (let seed = 0; seed < 300; seed++) {
    const { item, params } = quadraticRoots.generate(createRng(seed));
    const { ask, r1, r2 } = params;
    assert(Number.isInteger(r1) && Number.isInteger(r2), `seed ${seed}`);
    assert(r1 !== r2 && r1 !== 0 && r2 !== 0, `seed ${seed}: degenerate roots`);
    assert(isSprAnswer(item.answer), `seed ${seed}: ${item.answer} does not fit the box`);
    if (ask === 'positive') assert(r1 > 0 && r2 < 0 && parseSpr(item.answer) === r1, `seed ${seed}: positive root`);
    if (ask !== 'positive') assert(r1 + r2 !== 0, `seed ${seed}: no x-term`);
  }
});

test('line-parabola: the sign of the discriminant matches the number of intersections', () => {
  for (let seed = 0; seed < 300; seed++) {
    const { params } = lineParabola.generate(createRng(seed));
    const { variant, a, b, c, m, n, xs } = params;
    const disc = (b - m) ** 2 - 4 * a * (c - n);
    assert(Math.sign(disc) === xs.length - 1, `seed ${seed}: discriminant ${disc} for ${xs.length} points`);
    assert(xs.every(Number.isInteger), `seed ${seed}: non-integer intersection`);
    if (variant !== 'count') assert(xs.length === (variant === 'greater' ? 2 : 1), `seed ${seed}: ${variant}`);
  }
});

test('line-parabola: the line is never horizontal and a zero root is written as a bare x', () => {
  for (let seed = 0; seed < 300; seed++) {
    const { item, params } = lineParabola.generate(createRng(seed));
    assert(params.m !== 0, `seed ${seed}: horizontal line`);
    assert(!item.explanation.includes('(x)'), `seed ${seed}: ${item.explanation}`);
  }
});

test('nonlinear-models: vertices are integer points off the y-axis and bases stay in (0, 2)', () => {
  for (let seed = 0; seed < 300; seed++) {
    const { item, params } = nonlinearModels.generate(createRng(seed));
    if (params.kind === 'quadratic') {
      const { ask, a, h, k, d } = params;
      assert(Number.isInteger(h) && Number.isInteger(k) && h !== 0, `seed ${seed}: vertex (${h}, ${k})`);
      if (ask === 'intercepts') assert(d >= 2 && k === -a * d * d, `seed ${seed}: intercepts are not integers`);
    } else {
      const { a, r, growth } = params;
      const base = (100 + (growth ? r : -r)) / 100;
      assert(base > 0 && base < 2 && base !== 1, `seed ${seed}: base ${base}`);
      assert(a % 500 === 0 && Number.isInteger((a * r) / 100), `seed ${seed}: ${r}% of ${a} is not whole`);
      assert(item.stem.includes(growth ? 'increases' : 'decreases'), `seed ${seed}: direction`);
    }
  }
});

test('function-values: every choice of a two-formula item stays within ±100', () => {
  for (let seed = 0; seed < 300; seed++) {
    const { item, params } = functionValues.generate(createRng(seed));
    if (params.kind !== 'formulas') continue;
    for (const choice of item.choices) {
      assert(Math.abs(parseSpr(choice.text)) <= 100, `seed ${seed}: choice ${choice.text} in ${item.stem}`);
    }
  }
});

test('function-values: table inputs are consecutive and every lookup lands in the table', () => {
  for (let seed = 0; seed < 300; seed++) {
    const { item, params } = functionValues.generate(createRng(seed));
    if (params.kind === 'formulas') {
      assert(item.table == null, `seed ${seed}: formulas should not have a table`);
      continue;
    }
    const { xs, fv } = params;
    assert(item.table.rows.length === xs.length && new Set(xs).size === xs.length, `seed ${seed}: table`);
    for (let i = 1; i < xs.length; i++) assert(xs[i] === xs[i - 1] + 1, `seed ${seed}: x-values not consecutive`);
    if (params.kind === 'table') {
      const c = fv[xs.indexOf(params.a)];
      assert(xs.includes(c) && c !== params.a, `seed ${seed}: f(a) is not another x-value of the table`);
    } else if (params.ask === 'fg') {
      assert(xs.includes(params.m * params.a + params.n), `seed ${seed}: g(a) is not in the table`);
    }
  }
});
