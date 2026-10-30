import { test, assert, assertEqual } from './harness.js';
import { createRng } from '../src/questions/prng.js';
import { gcd } from '../src/questions/format.js';
import { answerText, isSprAnswer } from '../src/questions/schema.js';
import { parseSpr } from '../src/questions/spr.js';
import { testTemplates } from './generators.shared.js';
import psda from '../src/questions/generators/psda/index.js';
import ratios from '../src/questions/generators/psda/ratios.js';
import percentages from '../src/questions/generators/psda/percentages.js';
import center from '../src/questions/generators/psda/center.js';
import probability from '../src/questions/generators/psda/probability.js';
import linearModel from '../src/questions/generators/psda/linear-model.js';

const SEEDS = 300;

// The number in a choice such as $1,250, 35% or 12,500; NaN for a negative one.
const amount = (text) => Number(text.replace(/[$,%]/g, ''));

// Where the key falls among the choices sorted by value: 0 is the smallest, 3 the largest.
const keyRank = (item) => {
  const values = item.choices.map((c) => amount(c.text)).sort((a, b) => a - b);
  return values.indexOf(amount(answerText(item)));
};

const consecutive = (item) => {
  const values = item.choices.map((c) => amount(c.text)).sort((a, b) => a - b);
  return values.every((v, i) => Number.isInteger(v) && (i === 0 || v - values[i - 1] === 1));
};

testTemplates(psda);

test('ratios: the ratio is in lowest terms, the asked pair is new and the answer is a positive whole number', () => {
  for (let seed = 0; seed < SEEDS; seed++) {
    const { params } = ratios.generate(createRng(seed));
    const { n, d, m1, m2, reverse, given, answer } = params;
    assert(gcd(n, d) === 1, `seed ${seed}: ${n}:${d} is not reduced`);
    assert(m1 !== m2, `seed ${seed}: the asked pair repeats the known pair`);
    assert(Number.isInteger(answer) && answer > 0, `seed ${seed}: answer ${answer}`);
    assertEqual(reverse ? given * d : given * n, answer * (reverse ? n : d), `seed ${seed}: not proportional`);
  }
});

test('ratios: every choice is a positive whole number', () => {
  for (let seed = 0; seed < SEEDS; seed++) {
    const { item } = ratios.generate(createRng(seed));
    for (const choice of item.choices) {
      assert(/^[1-9]\d{0,2}(,\d{3})*$/.test(choice.text), `seed ${seed}: choice ${choice.text}`);
    }
  }
});

test('ratios: answers are at least 4, the choices never run consecutively, and the key is sometimes the largest or smallest', () => {
  const ranks = new Set();
  for (let seed = 0; seed < SEEDS; seed++) {
    const { item, params } = ratios.generate(createRng(seed));
    assert(params.answer >= 4, `seed ${seed}: answer ${params.answer} leaves no room for distractors`);
    assert(!consecutive(item), `seed ${seed}: consecutive choices ${item.choices.map((c) => c.text).join(', ')}`);
    ranks.add(keyRank(item));
  }
  assert(ranks.has(0) && ranks.has(3), `the key is never the smallest or never the largest choice: ${[...ranks]}`);
});

test('percentages: parts and sale prices are whole, and percents lie strictly between 0 and 100', () => {
  for (let seed = 0; seed < SEEDS; seed++) {
    const { params } = percentages.generate(createRng(seed));
    const where = `seed ${seed} (${params.variant})`;
    if (params.variant === 'of') {
      assert(Number.isInteger(params.part) && params.part > 0 && params.part < params.total, where);
      assert(params.percent > 0 && params.percent < 100, where);
    } else if (params.variant === 'change') {
      assert(params.percent > 0 && params.percent < 100 && params.after > 0, where);
      assert(params.after !== params.before, where);
    } else if (params.variant === 'sale') {
      assert((params.price * (100 - params.discount)) % 100 === 0, `${where}: sale price has cents`);
      assert(Number.isInteger(params.totalCents) && params.totalCents > 0, where);
    } else {
      assert(Number.isInteger(params.sale) && params.sale > 0 && params.sale < params.original, where);
    }
  }
});

test('percentages: every choice is positive and formatted like the answer', () => {
  const shape = (text) => `${text.startsWith('$') ? '$' : ''}${text.endsWith('%') ? '%' : ''}`;
  for (let seed = 0; seed < SEEDS; seed++) {
    const { item } = percentages.generate(createRng(seed));
    const key = answerText(item);
    for (const choice of item.choices) {
      assert(amount(choice.text) > 0, `seed ${seed}: choice ${choice.text}`);
      assertEqual(shape(choice.text), shape(key), `seed ${seed}: choice ${choice.text} next to ${key}`);
    }
  }
});

test('percentages: no choice is impossible in context: a count never exceeds the group, a regular price never undercuts the sale price', () => {
  for (let seed = 0; seed < SEEDS; seed++) {
    const { item, params } = percentages.generate(createRng(seed));
    for (const choice of item.choices) {
      const value = amount(choice.text);
      if (params.variant === 'of') assert(value <= params.total, `seed ${seed}: ${value} of ${params.total}`);
      if (params.variant === 'original') assert(value > params.sale, `seed ${seed}: regular price ${value} below sale price ${params.sale}`);
    }
  }
});

test('percentages: the total cost after discount and tax is not pinned to one position among the choices', () => {
  const ranks = new Set();
  for (let seed = 0; seed < SEEDS; seed++) {
    const { item, params } = percentages.generate(createRng(seed));
    if (params.variant === 'sale') ranks.add(keyRank(item));
  }
  assert(ranks.size >= 3, `the sale key only ever takes ranks ${[...ranks]}`);
});

test('center: the response fits the box, equals the exact value, and the list has 5 to 7 values', () => {
  for (let seed = 0; seed < SEEDS; seed++) {
    const { item, params } = center.generate(createRng(seed));
    assert(isSprAnswer(item.answer), `seed ${seed}: ${item.answer}`);
    assert(parseSpr(item.answer) === params.answer, `seed ${seed}: ${item.answer} is not ${params.answer}`);
    assert(Number.isInteger(params.answer * 2), `seed ${seed}: ${params.answer} is neither whole nor a half`);
    assert(params.values.length >= 5 && params.values.length <= 7, `seed ${seed}: ${params.values.length} values`);
    assert(item.choices === undefined, `seed ${seed}: spr items have no choices`);
  }
});

test('center: each measure agrees with a direct recomputation from the list', () => {
  for (let seed = 0; seed < SEEDS; seed++) {
    const { params } = center.generate(createRng(seed));
    const { variant, values, answer, target } = params;
    const sorted = [...values].sort((a, b) => a - b);
    const n = sorted.length;
    const sum = sorted.reduce((s, v) => s + v, 0);
    if (variant === 'mean') {
      assertEqual(answer, sum / n, `seed ${seed}`);
    } else if (variant === 'median') {
      assertEqual(answer, n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2, `seed ${seed}`);
    } else if (variant === 'add') {
      assertEqual((sum + answer) / (n + 1), target, `seed ${seed}`);
    } else {
      assert(sorted[n - 1] > sorted[n - 2], `seed ${seed}: the greatest value is not unique`);
      assertEqual(answer, (sum - sorted[n - 1]) / (n - 1), `seed ${seed}`);
    }
  }
});

test('center: the explanation works from the sum of the whole list and ends with the answer', () => {
  for (let seed = 0; seed < SEEDS; seed++) {
    const { item, params } = center.generate(createRng(seed));
    const sum = params.values.reduce((s, v) => s + v, 0);
    if (params.variant !== 'median') assert(item.explanation.includes(`${sum}`), `seed ${seed}: the sum ${sum} is not shown`);
    assert(item.explanation.endsWith(`${item.answer}.`), `seed ${seed}: ${item.explanation}`);
  }
});

test('probability: the table totals match its cells and the probability is strictly between 0 and 1', () => {
  for (let seed = 0; seed < SEEDS; seed++) {
    const { item, params } = probability.generate(createRng(seed));
    const [first, second, totals] = item.table.rows;
    assert(item.table.caption && item.table.headers.length === 4, `seed ${seed}: table shape`);
    assertEqual(first[3], first[1] + first[2], `seed ${seed}: first row total`);
    assertEqual(second[3], second[1] + second[2], `seed ${seed}: second row total`);
    assertEqual(totals[1], first[1] + second[1], `seed ${seed}: first column total`);
    assertEqual(totals[2], first[2] + second[2], `seed ${seed}: second column total`);
    assertEqual(totals[3], first[3] + second[3], `seed ${seed}: grand total`);
    assert(params.num > 0 && params.num < params.den, `seed ${seed}: ${params.num}/${params.den}`);
  }
});

test('probability: every choice is a fraction strictly between 0 and 1', () => {
  for (let seed = 0; seed < SEEDS; seed++) {
    const { item } = probability.generate(createRng(seed));
    for (const choice of item.choices) {
      const value = parseSpr(choice.text);
      assert(value !== null && value > 0 && value < 1, `seed ${seed}: choice ${choice.text}`);
    }
  }
});

test('linear-model: the two numbers are distinct and the keyed statement matches the asked role', () => {
  for (let seed = 0; seed < SEEDS; seed++) {
    const { item, params } = linearModel.generate(createRng(seed));
    const { m, b, ask } = params;
    assert(m !== 0 && Math.abs(m) !== 1 && b > 0 && Math.abs(m) !== b, `seed ${seed}: m = ${m}, b = ${b}`);
    assert(item.stem.includes(' y = ') && item.stem.includes('x'), `seed ${seed}: ${item.stem}`);
    const keyed = answerText(item);
    const moves = keyed.includes('increases') || keyed.includes('decreases');
    if (ask === 'slope') {
      assert(keyed.includes(m < 0 ? 'decreases' : 'increases'), `seed ${seed}: ${keyed}`);
    } else {
      assert(!moves, `seed ${seed}: ${keyed}`);
    }
    assertEqual(item.choices.filter((c) => c.text === keyed).length, 1, `seed ${seed}: keyed text repeats`);
  }
});
