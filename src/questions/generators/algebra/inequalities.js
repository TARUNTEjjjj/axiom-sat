import { MINUS, fmtLinear, fmtNum, fmtTerm, sprNum } from '../../format.js';
import { makeChoices } from '../../choices.js';
import { answerText } from '../../schema.js';
import { parseSpr, sprEquals } from '../../spr.js';

const KINDS = ['equivalent', 'value', 'pair'];
const RELATIONS = ['<', '>', '≤', '≥'];
const FLIP = { '<': '>', '>': '<', '≤': '≥', '≥': '≤' };

const holds = (left, relation, right) =>
  relation === '<' ? left < right : relation === '>' ? left > right : relation === '≤' ? left <= right : left >= right;

const strict = (relation) => relation === '<' || relation === '>';

const point = (x, y) => `(${fmtNum(x)}, ${fmtNum(y)})`;

// "(x, y)" back to numbers; fmtNum writes a true minus, which parseSpr accepts.
const coordinates = (text) => text.slice(1, -1).split(', ').map(parseSpr);

// ax + b R cx + d, built around an integer boundary k: it reduces to x R' k, where
// R' is R reversed exactly when a − c is negative.
function oneVariable(rng) {
  const k = rng.nonzero(-9, 9);
  const a = rng.nonzero(-6, 6);
  let c = rng.int(-5, 5);
  while (c === a) c = rng.int(-5, 5); // a ≠ c keeps a single boundary
  const b = rng.int(-12, 12);
  const d = (a - c) * k + b;
  const relation = rng.pick(RELATIONS);
  const flip = a - c < 0;
  const solved = flip ? FLIP[relation] : relation;
  return { k, a, b, c, d, relation, flip, solved };
}

// The reminder only mentions reversing the symbol when the division is by a negative number.
const reminder = (flip) =>
  flip
    ? 'Solve as with an equation, remembering that dividing both sides by a negative number reverses the inequality symbol. '
    : 'Solve as with an equation. ';

function solveText({ k, a, b, c, d, relation, flip, solved }) {
  const n = a - c;
  const collected = `Collect the x-terms on one side and the constants on the other: ${fmtTerm(n)} ${relation} ${fmtNum(d - b)}.`;
  if (n === 1) return collected;
  const divided = flip
    ? `Dividing both sides by ${fmtNum(n)}, a negative number, reverses the inequality symbol`
    : `Dividing both sides by ${fmtNum(n)}, a positive number, keeps the symbol as it is`;
  return `${collected} ${divided}: x ${solved} ${fmtNum(k)}.`;
}

// Which ordered pair satisfies y R mx + b. The correct pair sits a chosen distance
// from the boundary line, on the solution side; every distractor is checked to be
// off it.
function pair(rng) {
  const m = rng.nonzero(-6, 6);
  const b = rng.int(-15, 15);
  const relation = rng.pick(RELATIONS);
  const side = relation === '>' || relation === '≥' ? 1 : -1; // solutions lie on this side of the line
  const x0 = rng.int(-5, 5);
  const edge = m * x0 + b;
  const t = rng.int(1, 6);
  const y0 = !strict(relation) && rng.chance(0.3) ? edge : edge + side * t;
  const correct = point(x0, y0);
  const satisfies = (x, y) => holds(y, relation, m * x + b);

  // The choices show two x-values with two pairs at each, so the correct pair is
  // never the odd one out. Beside it sits its mirror image across the line (or the
  // point on the line itself, a non-solution when the symbol is strict); at the
  // other x the slips are the point on the line and points just across it on the
  // wrong side. Whichever of these are not solutions are kept, and points farther
  // across the line at the other x fill any gap.
  const x1 = x0 + rng.nonzero(-3, 3);
  const edge1 = m * x1 + b;
  const r = rng.int(1, 4);
  const beside = strict(relation) && rng.chance(0.4) ? [x0, edge] : [x0, edge - side * t];
  const candidates = [beside, [x1, edge1], [x1, edge1 - side * r], [x1, edge1 - side * (r + rng.int(1, 3))]];
  const distractors = [];
  const add = ([x, y]) => {
    const text = point(x, y);
    if (!satisfies(x, y) && text !== correct && !distractors.includes(text)) distractors.push(text);
  };
  for (const candidate of candidates) if (distractors.length < 3) add(candidate);
  for (let u = r + 4; distractors.length < 3; u++) add([x1, edge1 - side * u]);
  const { choices, answer } = makeChoices(rng, correct, distractors);

  const constant = b === 0 ? '' : ` ${b < 0 ? MINUS : '+'} ${fmtNum(Math.abs(b))}`;
  const explanation =
    'A pair (x, y) is a solution when substituting its coordinates makes the inequality true. ' +
    `For ${correct}, the right side is ${fmtNum(m)}(${fmtNum(x0)})${constant} = ${fmtNum(edge)}, and ` +
    `${fmtNum(y0)} ${relation} ${fmtNum(edge)} is true. The other three pairs make the inequality false, ` +
    `so ${correct} is the solution.`;

  // Two variables: 1, plus one level for a negative slope and one for a negative intercept.
  const difficulty = 1 + (m < 0 ? 1 : 0) + (b < 0 ? 1 : 0);

  return {
    item: {
      type: 'mc',
      difficulty,
      stem: `Which of the following ordered pairs (x, y) is a solution to the inequality y ${relation} ${fmtLinear(m, b)}?`,
      choices,
      answer,
      explanation,
    },
    params: { kind: 'pair', m, b, relation, x0, y0 },
  };
}

// Linear inequalities: solve ax + b R cx + d for x (reversing the symbol when the
// division is by a negative), either as an equivalent inequality or as the least or
// greatest integer that satisfies it, or pick the ordered pair that satisfies y R mx + b.
export default {
  id: 'algebra.inequalities',
  domain: 'algebra',
  skill: 'Linear inequalities in one or two variables',
  // One variable: 18 boundaries · 12 values of a · at least 10 values of c ≠ a · 25
  // constants · 4 symbols · two asks with different wording. Two variables: 12
  // slopes · 31 intercepts · 4 symbols (the stem does not show the pairs).
  space: 18 * 12 * 10 * 25 * 4 * 2 + 12 * 31 * 4,

  generate(rng) {
    const kind = rng.pick(KINDS);
    if (kind === 'pair') return pair(rng);

    const params = oneVariable(rng);
    const { k, a, b, c, d, relation, flip, solved } = params;
    const inequality = `${fmtLinear(a, b)} ${relation} ${fmtLinear(c, d)}`;
    const target = `x ${solved} ${fmtNum(k)}`;
    // One variable: x on one side only is 1, x on both sides is 2, and dividing by a
    // negative, which reverses the symbol, is 3.
    const difficulty = flip ? 3 : c === 0 ? 1 : 2;

    if (kind === 'equivalent') {
      // Reversing the symbol when it should stay (or keeping it when it should
      // reverse), a sign slip on the boundary, and both at once. None of these has
      // the same solution set as the key, so asking for an equivalent inequality
      // leaves exactly one right answer; "must be true" would not, since x ≥ −7
      // follows from x ≥ 7.
      const distractors = [
        `x ${FLIP[solved]} ${fmtNum(k)}`,
        `x ${solved} ${fmtNum(-k)}`,
        `x ${FLIP[solved]} ${fmtNum(-k)}`,
      ];
      const { choices, answer } = makeChoices(rng, target, distractors);
      return {
        item: {
          type: 'mc',
          difficulty,
          stem: `Which of the following inequalities is equivalent to ${inequality}?`,
          choices,
          answer,
          explanation: reminder(flip) + solveText(params),
        },
        params: { kind, ...params },
      };
    }

    // The extreme integer solution: the boundary itself when the symbol is not
    // strict, one step inside the solution set when it is.
    const side = solved === '<' || solved === '≤' ? -1 : 1; // solutions lie on this side of k
    const bound = side > 0 ? 'least' : 'greatest';
    const v = strict(relation) ? k + side : k;
    const closing = strict(relation)
      ? `Since x must be strictly ${side > 0 ? 'greater' : 'less'} than ${fmtNum(k)}, the ${bound} integer value of x is ${fmtNum(v)}.`
      : `The boundary ${fmtNum(k)} itself satisfies the inequality, so the ${bound} possible value of x is ${fmtNum(v)}.`;
    return {
      item: {
        type: 'spr',
        difficulty,
        stem: `If ${inequality}, what is the ${bound} possible integer value of x?`,
        answer: sprNum(v),
        explanation: `${reminder(flip)}${solveText(params)} ${closing}`,
      },
      params: { kind, v, ...params },
    };
  },

  // The original inequality is evaluated numerically rather than rearranged: the
  // boundary k is a solution exactly when the symbol is not strict, the solved side
  // holds and the other does not. Then the chosen text must be the solved
  // inequality; the typed value must satisfy the inequality while its neighbour
  // toward the boundary does not, so it is the extreme integer solution; or the
  // chosen pair must satisfy the inequality while the other three fail it.
  verify({ item, params }) {
    if (params.kind === 'pair') {
      const { m, b, relation, x0, y0 } = params;
      const text = answerText(item);
      const others = item.choices.filter((choice) => choice.key !== item.answer).map((choice) => choice.text);
      const satisfies = (pairText) => {
        const [x, y] = coordinates(pairText);
        return holds(y, relation, m * x + b);
      };
      return text === point(x0, y0) && satisfies(text) && others.every((other) => !satisfies(other));
    }
    const { k, a, b, c, d, relation, solved, v } = params;
    const at = (x) => holds(a * x + b, relation, c * x + d);
    const side = solved === '<' || solved === '≤' ? -1 : 1;
    if (at(k) === strict(relation) || !at(k + side) || at(k - side)) return false;
    if (params.kind === 'equivalent') return answerText(item) === `x ${solved} ${fmtNum(k)}`;
    return sprEquals(item.answer, String(v)) && at(v) && !at(v - side);
  },
};
