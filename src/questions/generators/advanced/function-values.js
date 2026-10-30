import { MINUS, TIMES, fmtLinear, fmtNum, fmtPoly, sup } from '../../format.js';
import { makeChoices, pickDistractors } from '../../choices.js';
import { answerText } from '../../schema.js';
import { parseSpr } from '../../spr.js';

// Negative numbers get parentheses when they follow an operator or carry an exponent.
const operand = (n) => (n < 0 ? `(${fmtNum(n)})` : fmtNum(n));

// m × p + n written out with the actual numbers; a coefficient of ±1 is not written
// as a product (5 − 3, −(−4) − 3) and a zero constant is not written at all.
const scaled = (m, p) => (m === 1 ? fmtNum(p) : m === -1 ? MINUS + operand(p) : `${fmtNum(m)} ${TIMES} ${operand(p)}`);
const linearSteps = (m, n, p) => scaled(m, p) + (n === 0 ? '' : ` ${n < 0 ? MINUS : '+'} ${fmtNum(Math.abs(n))}`);

// A table of consecutive x-values and arbitrary integer outputs for the function `fn`.
function makeTable(rng, fn, rows) {
  const x0 = rng.int(-4, 2);
  const xs = Array.from({ length: rows }, (_, i) => x0 + i);
  const fv = xs.map(() => rng.int(-9, 12));
  return { xs, fv, table: () => ({ headers: ['x', `${fn}(x)`], rows: xs.map((x, i) => [fmtNum(x), fmtNum(fv[i])]) }) };
}

// f(g(p)) or g(f(p)) for f(x) = x² − k and g(x) = mx + n. The inner value g(p) is
// drawn first and kept to one digit, with the intercept n following from it, so the
// item tests the order of composition rather than three-digit arithmetic: every
// value and every distractor stays within ±100.
function formulas(rng) {
  const order = rng.pick(['fg', 'gf']);
  const k = rng.nonzero(-12, 12);
  const m = rng.nonzero(-4, 4);
  const p = rng.int(-3, 3);
  let gp = rng.int(-6, 6);
  while (gp === m * p || Math.abs(gp - m * p) > 9) gp = rng.int(-6, 6); // n nonzero and within ±9
  const n = gp - m * p;
  const fp = p * p - k;
  const fg = gp * gp - k;
  const gf = m * fp + n;
  const value = order === 'fg' ? fg : gf;

  const stem =
    `The functions f and g are defined by f(x) = ${fmtPoly([1, 0, -k])} and g(x) = ${fmtLinear(m, n)}. ` +
    `What is the value of ${order === 'fg' ? 'f(g' : 'g(f'}(${fmtNum(p)}))?`;

  // Composing in the wrong order, multiplying (when that stays small) or adding the
  // two values, and a sign slip on the last step.
  const distractors = pickDistractors(value, [
    order === 'fg' ? gf : fg,
    Math.abs(fp * gp) > 100 ? NaN : fp * gp,
    fp + gp,
    order === 'fg' ? gp * gp + k : m * fp - n,
  ]);
  const { choices, answer } = makeChoices(rng, fmtNum(value), distractors.map(fmtNum));

  const squareMinusK = (x) => `${operand(x)}${sup(2)} ${k < 0 ? '+' : MINUS} ${fmtNum(Math.abs(k))}`;
  const explanation =
    order === 'fg'
      ? `Work from the inside out. First g(${fmtNum(p)}) = ${linearSteps(m, n, p)} = ${fmtNum(gp)}. ` +
        `Then f(${fmtNum(gp)}) = ${squareMinusK(gp)} = ${fmtNum(fg)}. So f(g(${fmtNum(p)})) = ${fmtNum(fg)}.`
      : `Work from the inside out. First f(${fmtNum(p)}) = ${squareMinusK(p)} = ${fmtNum(fp)}. ` +
        `Then g(${fmtNum(fp)}) = ${linearSteps(m, n, fp)} = ${fmtNum(gf)}. So g(f(${fmtNum(p)})) = ${fmtNum(gf)}.`;

  // Negative inputs, slopes or constants add sign work to the two steps.
  const difficulty = m > 0 && p >= 0 && k > 0 ? 2 : 3;

  return {
    item: { type: 'mc', difficulty, stem, choices, answer, explanation },
    params: { kind: 'formulas', order, k, m, n, p },
  };
}

// g(f(a)) or f(g(a)) with f given by a table and g by a formula. For f(g(a)) the
// intercept n is chosen so that g(a) lands on an x-value of the table.
function mixed(rng) {
  const ask = rng.pick(['gf', 'fg']);
  const { xs, fv, table } = makeTable(rng, 'f', 5);
  const a = rng.pick(xs);
  const fa = fv[xs.indexOf(a)];
  const m = rng.nonzero(-4, 4);
  let n;
  let c;
  if (ask === 'gf') {
    n = rng.int(-9, 9);
  } else {
    c = rng.pick(xs.filter((x) => x !== a));
    n = c - m * a;
  }
  const value = ask === 'gf' ? m * fa + n : fv[xs.indexOf(c)];

  const stem =
    `The table gives selected values of the function f. The function g is defined by g(x) = ${fmtLinear(m, n)}. ` +
    `What is the value of ${ask === 'gf' ? 'g(f' : 'f(g'}(${fmtNum(a)}))?`;

  // Applying g straight to a, stopping after one step, a sign slip, swapping the order.
  const slips = ask === 'gf' ? [m * a + n, fa, m * fa - n, a] : [m * fa + n, c, fa, -value];
  const distractors = pickDistractors(value, slips);
  const { choices, answer } = makeChoices(rng, fmtNum(value), distractors.map(fmtNum));

  const explanation =
    ask === 'gf'
      ? `From the table, f(${fmtNum(a)}) = ${fmtNum(fa)}. Then g(${fmtNum(fa)}) = ${linearSteps(m, n, fa)} = ${fmtNum(value)}. ` +
        `So g(f(${fmtNum(a)})) = ${fmtNum(value)}.`
      : `First g(${fmtNum(a)}) = ${linearSteps(m, n, a)} = ${fmtNum(c)}. From the table, f(${fmtNum(c)}) = ${fmtNum(value)}. ` +
        `So f(g(${fmtNum(a)})) = ${fmtNum(value)}.`;

  return {
    item: { type: 'mc', difficulty: 2, stem, table: table(), choices, answer, explanation },
    params: { kind: 'mixed', ask, a, m, n, xs, fv },
  };
}

// f(f(a)) read twice from a table: f(a) is forced onto another x-value of the table.
function table(rng) {
  const fn = rng.pick(['f', 'g', 'h']);
  const rows = rng.pick([4, 5]);
  const built = makeTable(rng, fn, rows);
  const { xs, fv } = built;
  const a = rng.pick(xs);
  const c = rng.pick(xs.filter((x) => x !== a));
  fv[xs.indexOf(a)] = c;
  const d = fv[xs.indexOf(c)];

  const stem =
    `The table gives ${rows === 4 ? 'four' : 'five'} values of x and the corresponding values of ${fn}(x) ` +
    `for the function ${fn}. What is the value of ${fn}(${fn}(${fmtNum(a)}))?`;

  // Stopping after one step, squaring or doubling the inner value, reading back the input.
  const distractors = pickDistractors(d, [c, c * c, 2 * c, a]);
  const { choices, answer } = makeChoices(rng, fmtNum(d), distractors.map(fmtNum));

  const explanation =
    `From the table, ${fn}(${fmtNum(a)}) = ${fmtNum(c)}. Then ${fn}(${fn}(${fmtNum(a)})) = ${fn}(${fmtNum(c)}), ` +
    `and the table gives ${fn}(${fmtNum(c)}) = ${fmtNum(d)}. So ${fn}(${fn}(${fmtNum(a)})) = ${fmtNum(d)}.`;

  return {
    item: { type: 'mc', difficulty: 1, stem, table: built.table(), choices, answer, explanation },
    params: { kind: 'table', fn, a, xs, fv },
  };
}

export default {
  id: 'advanced.function-values',
  domain: 'advanced',
  skill: 'Nonlinear functions',
  // the two-formula question alone: k · which composition is asked · the 572 triples
  // (m, p, g(p)) that leave the intercept n nonzero and within ±9
  space: 24 * 2 * 572,

  generate(rng) {
    // The table-only stem varies little, so it is drawn less often.
    const kind = rng.pick(['formulas', 'formulas', 'formulas', 'mixed', 'mixed', 'table']);
    return kind === 'formulas' ? formulas(rng) : kind === 'mixed' ? mixed(rng) : table(rng);
  },

  // Formulas: compare with the expanded composition. Tables: look the values up in
  // the rendered table the way a student would, and confirm the displayed answer.
  verify({ item, params }) {
    if (params.kind === 'formulas') {
      const { order, k, m, n, p } = params;
      const value = order === 'fg' ? m * m * p * p + 2 * m * n * p + n * n - k : m * p * p - m * k + n;
      return answerText(item) === fmtNum(value);
    }
    const lookup = (x) => {
      const row = item.table.rows.find((cells) => parseSpr(cells[0]) === x);
      return row ? parseSpr(row[1]) : null;
    };
    if (params.kind === 'table') {
      const c = lookup(params.a);
      const d = c === null ? null : lookup(c);
      return c !== null && d !== null && c !== params.a && answerText(item) === fmtNum(d);
    }
    const { ask, a, m, n } = params;
    if (ask === 'gf') {
      const fa = lookup(a);
      return fa !== null && answerText(item) === fmtNum(m * fa + n);
    }
    const d = lookup(m * a + n);
    return d !== null && answerText(item) === fmtNum(d);
  },
};
