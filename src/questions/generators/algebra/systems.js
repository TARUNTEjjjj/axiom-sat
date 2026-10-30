import { MINUS, fmtLinear, fmtNum, fmtTerm, gcd, sprNum } from '../../format.js';
import { sprEquals } from '../../spr.js';

const ASKS = ['x', 'y', 'x + y'];

// ax + by with proper signs: 3x − 2y, −x + 5y (both coefficients are nonzero).
const fmtPair = (a, b) => `${fmtTerm(a)} ${b < 0 ? MINUS : '+'} ${fmtTerm(Math.abs(b), 'y')}`;

// A known number followed by a variable term: 12 + 4y, −6 − 2y, or just 4y when the
// number is 0.
const fmtSum = (n, coef, variable) =>
  n === 0 ? fmtTerm(coef, variable) : `${fmtNum(n)} ${coef < 0 ? MINUS : '+'} ${fmtTerm(Math.abs(coef), variable)}`;

// How much work it takes to eliminate a variable with coefficients p and q: none
// when they already match up to sign, one equation to scale when one divides the
// other, and both equations otherwise.
const cost = (p, q) => (Math.abs(p) === Math.abs(q) ? 0 : p % q === 0 || q % p === 0 ? 1 : 2);

// One elimination step written out: combine the equations so the variable `gone`
// (coefficients g1, g2) drops out, leaving `kept` (coefficients k1, k2). Each
// equation is scaled by the other's coefficient with their common factor divided
// out, so the multipliers are the smallest that work (none when the sizes already
// match); like signs are then removed by subtracting, unlike by adding.
function eliminate({ gone, kept, g1, g2, k1, k2, c1, c2, value }) {
  const same = g1 * g2 > 0;
  const g = gcd(g1, g2);
  const s1 = Math.abs(g2) / g;
  const s2 = Math.abs(g1) / g;
  let step;
  if (s1 === 1 && s2 === 1) {
    step = same
      ? `Subtract the second equation from the first to eliminate ${gone}`
      : `Add the two equations to eliminate ${gone}`;
  } else {
    const scaled = [];
    if (s1 !== 1) scaled.push(`the first equation by ${s1}`);
    if (s2 !== 1) scaled.push(`the second equation by ${s2}`);
    const combine = same ? 'subtract the second from the first' : 'add them';
    step = `Multiply ${scaled.join(' and ')}, then ${combine} to eliminate ${gone}`;
  }
  const coef = same ? k1 * s1 - k2 * s2 : k1 * s1 + k2 * s2;
  const rhs = same ? c1 * s1 - c2 * s2 : c1 * s1 + c2 * s2;
  const solved = coef === 1 ? '' : `, so ${kept} = ${fmtNum(value)}`;
  return `${step}: ${fmtTerm(coef, kept)} = ${fmtNum(rhs)}${solved}.`;
}

// A system a1x + b1y = c1, a2x + b2y = c2 with exactly one solution. The integer
// solution (x, y) is chosen first and the constants are derived from it; the
// coefficient pairs are never proportional, so the system is never degenerate.
export default {
  id: 'algebra.systems',
  domain: 'algebra',
  skill: 'Systems of two linear equations in two variables',
  // Solutions (19 · 19) · first coefficient pair (12 · 12 nonzero values) · second
  // pair, of which at most 12 are proportional to the first (144 − 12) · three asks.
  // The system fixes its solution, so different parameters give different stems.
  space: 19 * 19 * 144 * 132 * 3,

  generate(rng) {
    const x = rng.int(-9, 9);
    const y = rng.int(-9, 9);
    const a1 = rng.nonzero(-6, 6);
    const b1 = rng.nonzero(-6, 6);
    let a2 = rng.nonzero(-6, 6);
    let b2 = rng.nonzero(-6, 6);
    while (a1 * b2 - a2 * b1 === 0) {
      a2 = rng.nonzero(-6, 6); // a nonzero determinant keeps exactly one solution
      b2 = rng.nonzero(-6, 6);
    }
    const c1 = a1 * x + b1 * y;
    const c2 = a2 * x + b2 * y;
    const ask = rng.pick(ASKS);
    const value = ask === 'x' ? x : ask === 'y' ? y : x + y;

    const first = `${fmtPair(a1, b1)} = ${fmtNum(c1)}`;
    const second = `${fmtPair(a2, b2)} = ${fmtNum(c2)}`;
    const stem =
      `If (x, y) is the solution to the system of equations ${first} and ${second}, ` +
      `what is the value of ${ask}?`;

    // Eliminate whichever variable is cheaper to remove; a tie goes to the variable
    // not asked for, so that no substitution step is needed afterwards.
    const costX = cost(a1, a2);
    const costY = cost(b1, b2);
    const gone = costX < costY || (costX === costY && ask === 'y') ? 'x' : 'y';
    const found = gone === 'x' ? 'y' : 'x';
    let explanation =
      gone === 'x'
        ? eliminate({ gone, kept: 'y', g1: a1, g2: a2, k1: b1, k2: b2, c1, c2, value: y })
        : eliminate({ gone, kept: 'x', g1: b1, g2: b2, k1: a1, k2: a2, c1, c2, value: x });
    if (ask !== found) {
      // The found value goes back into the first equation to give the other one.
      explanation +=
        found === 'x'
          ? ` Substituting x = ${fmtNum(x)} into the first equation gives ${fmtSum(a1 * x, b1, 'y')} = ${fmtNum(c1)}, so y = ${fmtNum(y)}.`
          : ` Substituting y = ${fmtNum(y)} into the first equation gives ${fmtLinear(a1, b1 * y)} = ${fmtNum(c1)}, so x = ${fmtNum(x)}.`;
      if (ask === 'x + y') explanation += ` Therefore x + y = ${fmtNum(x + y)}.`;
    }

    // One step of elimination when a pair of coefficients already match up to sign
    // (1), one equation to scale when a coefficient divides its partner (2), and
    // otherwise both equations to scale (3).
    const difficulty = 1 + Math.min(costX, costY);

    return {
      item: { type: 'spr', difficulty, stem, answer: sprNum(value), explanation },
      params: { a1, b1, c1, a2, b2, c2, x, y, ask, value },
    };
  },

  // Cramer's rule recomputes the solution from the coefficients alone; then both
  // equations are checked by substitution, the typed answer against the exact value,
  // and the explanation must state that value for the quantity asked.
  verify({ item, params: { a1, b1, c1, a2, b2, c2, x, y, ask, value } }) {
    const det = a1 * b2 - a2 * b1;
    if (det === 0) return false;
    const cx = (c1 * b2 - c2 * b1) / det;
    const cy = (a1 * c2 - a2 * c1) / det;
    const expected = ask === 'x' ? cx : ask === 'y' ? cy : cx + cy;
    return (
      a1 * x + b1 * y === c1 &&
      a2 * x + b2 * y === c2 &&
      cx === x &&
      cy === y &&
      expected === value &&
      sprEquals(item.answer, String(expected)) &&
      item.explanation.includes(`${ask} = ${fmtNum(expected)}`)
    );
  },
};
