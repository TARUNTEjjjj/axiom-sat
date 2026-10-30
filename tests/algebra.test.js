import { test, assert, assertEqual } from './harness.js';
import { createRng } from '../src/questions/prng.js';
import { isSprAnswer } from '../src/questions/schema.js';
import { parseSpr } from '../src/questions/spr.js';
import { fmtNum, gcd } from '../src/questions/format.js';
import { testTemplates } from './generators.shared.js';
import algebra from '../src/questions/generators/algebra/index.js';
import linearOneVar from '../src/questions/generators/algebra/linear-one-var.js';
import linearFunctions from '../src/questions/generators/algebra/linear-functions.js';
import lineTwoPoints from '../src/questions/generators/algebra/line-two-points.js';
import systems from '../src/questions/generators/algebra/systems.js';
import inequalities from '../src/questions/generators/algebra/inequalities.js';

const SEEDS = 300;

const holds = (left, relation, right) =>
  relation === '<' ? left < right : relation === '>' ? left > right : relation === '≤' ? left <= right : left >= right;

testTemplates(algebra);

test('linear-one-var: the solution is an integer and the equation is never degenerate', () => {
  for (let seed = 0; seed < SEEDS; seed++) {
    const { params } = linearOneVar.generate(createRng(seed));
    assert(Number.isInteger(params.x), `seed ${seed}`);
    assert(params.a !== params.c, `seed ${seed}: a = c`);
    assert(params.a !== 0, `seed ${seed}: a = 0`);
  }
});

test('linear-functions: the starting value is positive, the number asked about appears once, f never goes negative', () => {
  for (let seed = 0; seed < SEEDS; seed++) {
    const { item, params } = linearFunctions.generate(createRng(seed));
    assert(params.b > 0, `seed ${seed}: b = ${params.b}`);
    assert(Math.abs(params.m) !== params.b, `seed ${seed}: |m| = b`);
    if (params.kind === 'evaluate') {
      assert(Number.isInteger(params.value) && params.value >= 0, `seed ${seed}: f(${params.x}) = ${params.value}`);
    } else {
      assert(item.stem.includes('f(x) = '), `seed ${seed}: ${item.stem}`);
    }
  }
});

test('linear-functions: exactly one choice reads the rate with the right direction and unit', () => {
  for (let seed = 0; seed < SEEDS; seed++) {
    const { item, params } = linearFunctions.generate(createRng(seed));
    if (params.kind !== 'slope') continue;
    const direction = params.m > 0 ? 'increases' : 'decreases';
    const wrong = item.choices.filter((c) => c.key !== item.answer && c.text.includes(direction) && c.text.includes('for each'));
    assertEqual(wrong.length, 1, `seed ${seed}: only the wrong-unit distractor may share the direction`);
  }
});

test('linear-functions: every evaluate choice makes sense in the story', () => {
  for (let seed = 0; seed < SEEDS; seed++) {
    const { item, params } = linearFunctions.generate(createRng(seed));
    if (params.kind !== 'evaluate') continue;
    const { m, b, value } = params;
    const percent = item.stem.includes('percent');
    for (const choice of item.choices) {
      const v = parseSpr(choice.text.replace(/,/g, ''));
      assert(v > 0 && v <= 3 * value, `seed ${seed}: ${choice.text} against a key of ${value}`);
      if (m < 0) assert(v <= b, `seed ${seed}: ${choice.text} exceeds the starting value ${b}`);
      if (percent) assert(v <= 100, `seed ${seed}: ${choice.text} is more than 100%`);
    }
  }
});

test('line-two-points: the two points are distinct, lie on the line and the slope is in lowest terms', () => {
  for (let seed = 0; seed < SEEDS; seed++) {
    const { params } = lineTwoPoints.generate(createRng(seed));
    const { p, q, b, x1, y1, x2, y2 } = params;
    assert(x1 !== x2, `seed ${seed}: same x`);
    for (const n of [p, q, b, x1, y1, x2, y2]) assert(Number.isInteger(n), `seed ${seed}: ${n}`);
    assert(q > 0 && p !== 0 && gcd(p, q) === 1, `seed ${seed}: slope ${p}/${q}`);
    assertEqual(q * y1, p * x1 + q * b, `seed ${seed}: first point`);
    assertEqual(q * y2, p * x2 + q * b, `seed ${seed}: second point`);
  }
});

test('systems: the coefficient pairs are never proportional and the answer fits the response box', () => {
  for (let seed = 0; seed < SEEDS; seed++) {
    const { item, params } = systems.generate(createRng(seed));
    const { a1, b1, a2, b2, x, y, value } = params;
    assert(a1 * b2 - a2 * b1 !== 0, `seed ${seed}: proportional coefficients`);
    for (const n of [a1, b1, a2, b2]) assert(n !== 0, `seed ${seed}: zero coefficient`);
    assert(Number.isInteger(x) && Number.isInteger(y), `seed ${seed}: non-integer solution`);
    assert(isSprAnswer(item.answer), `seed ${seed}: ${item.answer}`);
    assertEqual(parseSpr(item.answer), value, `seed ${seed}`);
    assert(item.choices === undefined, `seed ${seed}: spr items have no choices`);
  }
});

test('systems: the explanation scales as many equations as the difficulty says, by coprime factors, and states the asked value', () => {
  for (let seed = 0; seed < SEEDS; seed++) {
    const { item, params } = systems.generate(createRng(seed));
    const factors = [...item.explanation.matchAll(/ equation by (\d+)/g)].map((match) => +match[1]);
    assertEqual(factors.length, item.difficulty - 1, `seed ${seed}: ${item.explanation}`);
    if (factors.length === 2) assertEqual(gcd(factors[0], factors[1]), 1, `seed ${seed}: ${item.explanation}`);
    assert(item.explanation.includes(`${params.ask} = ${fmtNum(params.value)}`), `seed ${seed}: ${item.explanation}`);
    assert(!/(^|\D)0 [+−] /.test(item.explanation), `seed ${seed}: a zero term is written out: ${item.explanation}`);
  }
});

test('inequalities: the symbol reverses exactly when a − c is negative', () => {
  for (let seed = 0; seed < SEEDS; seed++) {
    const { params } = inequalities.generate(createRng(seed));
    if (params.kind === 'pair') continue;
    const { a, b, c, d, k, relation, solved } = params;
    assertEqual(solved !== relation, a - c < 0, `seed ${seed}: flip`);
    assertEqual(a * k + b, c * k + d, `seed ${seed}: k is not the boundary`);
    assert(a !== c && k !== 0, `seed ${seed}: degenerate`);
  }
});

test('inequalities: an "equivalent" item has exactly one choice with the same solution set as the inequality', () => {
  for (let seed = 0; seed < SEEDS; seed++) {
    const { item, params } = inequalities.generate(createRng(seed));
    if (params.kind !== 'equivalent') continue;
    const { a, b, c, d, k, relation } = params;
    assert(item.stem.includes('equivalent'), `seed ${seed}: ${item.stem}`);
    // Each choice "x R v" is compared with the original inequality on the whole and
    // half numbers around the boundary; agreeing on all of them means the same
    // solution set, and no distractor may do so.
    const original = (x) => holds(a * x + b, relation, c * x + d);
    const samples = [];
    for (let x = k - 12; x <= k + 12; x += 0.5) samples.push(x);
    const equivalent = item.choices.filter((choice) => {
      const [, symbol, value] = choice.text.match(/^x (.) (.+)$/);
      return samples.every((x) => holds(x, symbol, parseSpr(value)) === original(x));
    });
    assertEqual(equivalent.length, 1, `seed ${seed}: ${item.stem}`);
    assertEqual(equivalent[0].key, item.answer, `seed ${seed}`);
  }
});

test('inequalities: a typed value is the least or greatest integer solution', () => {
  for (let seed = 0; seed < SEEDS; seed++) {
    const { item, params } = inequalities.generate(createRng(seed));
    if (params.kind !== 'value') continue;
    const { a, b, c, d, relation, solved, v } = params;
    const at = (x) => holds(a * x + b, relation, c * x + d);
    const side = solved === '<' || solved === '≤' ? -1 : 1;
    assertEqual(item.type, 'spr', `seed ${seed}`);
    assertEqual(parseSpr(item.answer), v, `seed ${seed}`);
    assert(at(v) && !at(v - side), `seed ${seed}: ${v} is not the extreme integer solution of ${item.stem}`);
    assert(item.stem.includes(side > 0 ? 'least' : 'greatest'), `seed ${seed}: ${item.stem}`);
  }
});

test('inequalities: exactly one pair satisfies the inequality, and the correct pair is never alone at its x', () => {
  for (let seed = 0; seed < SEEDS; seed++) {
    const { item, params } = inequalities.generate(createRng(seed));
    if (params.kind !== 'pair') continue;
    const pairs = item.choices.map((c) => c.text.slice(1, -1).split(', ').map(parseSpr));
    const solutions = item.choices.filter((c, i) => holds(pairs[i][1], params.relation, params.m * pairs[i][0] + params.b));
    assertEqual(solutions.length, 1, `seed ${seed}: ${item.stem}`);
    assertEqual(solutions[0].key, item.answer, `seed ${seed}`);
    // A choice that is the only one at its x-coordinate must not be the answer unless
    // another choice is just as alone, so the x-coordinates give nothing away.
    const count = (x) => pairs.filter(([other]) => other === x).length;
    const alone = pairs.filter(([x]) => count(x) === 1).length;
    assert(count(params.x0) > 1 || alone > 1, `seed ${seed}: the answer is the odd x out in ${item.choices.map((c) => c.text).join(' ')}`);
  }
});
