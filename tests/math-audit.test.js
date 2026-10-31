// Independent release checks: solve from the displayed data with a different
// method than each template's verifier, rather than trusting its answer key.
import { test, assert, assertEqual } from './harness.js';
import { getTemplate } from '../src/questions/index.js';
import { createRng } from '../src/questions/prng.js';
import { parseSpr } from '../src/questions/spr.js';

const SAMPLES = 250;
const close = (a, b) => Math.abs(a - b) < 1e-9 * Math.max(1, Math.abs(b));
const integerCandidates = Array.from({ length: 201 }, (_, i) => i - 100);

function audit(id, solve) {
  test(`independent math: ${id} (${SAMPLES} seeds)`, () => {
    const template = getTemplate(id);
    for (let seed = 0; seed < SAMPLES; seed++) {
      const { item, params } = template.generate(createRng(seed));
      const expected = solve(params, item);
      assert(
        close(parseSpr(item.answer), expected),
        `${id} seed ${seed}: expected ${expected}, got ${item.answer}`,
      );
    }
  });
}

audit('advanced.discriminant-parameter', ({ a, b, shift }) => {
  // Completing the square makes the minimum value k + shift - b²/(4a).
  assert(a > 0);
  return (b * b) / (4 * a) - shift;
});

audit('advanced.root-relationships', ({ a, b, constant, offset }) => {
  // Vieta's identity avoids the quadratic formula used by the verifier.
  const c = constant - offset;
  assert(b * b - 4 * a * c > 0);
  return (b * b - 2 * a * c) / (a * a);
});

audit('advanced.rational-equations', ({ a, r, rhs }) => {
  const solutions = integerCandidates.filter((x) => x !== r && a * x * x - a * r * r === rhs * (x - r));
  assertEqual(solutions.length, 1, 'There must be exactly one allowed integer candidate');
  // The multiplied polynomial has the excluded root r and this second root;
  // its integer discriminant confirms enumeration has not missed fractional roots.
  const disc = rhs * rhs - 4 * a * (rhs * r - a * r * r);
  const roots = [(rhs + Math.sqrt(disc)) / (2 * a), (rhs - Math.sqrt(disc)) / (2 * a)];
  assert(roots.every((root) => Number.isInteger(root) && Math.abs(root) <= 100));
  return solutions[0];
});

audit('advanced.radical-equations', ({ m, n, k }) => {
  // Enumerate the possible integer candidates, checking the unsquared equation.
  // The discriminant check certifies that its only two algebraic roots are integral.
  const b = -2 * k - m;
  const c = k * k - n;
  const disc = Math.sqrt(b * b - 4 * c);
  assert([(-b + disc) / 2, (-b - disc) / 2].every((root) => Number.isInteger(root) && Math.abs(root) <= 100));
  const solutions = integerCandidates.filter((x) => m * x + n >= 0 && Math.sqrt(m * x + n) === x - k);
  assertEqual(solutions.length, 1, 'The original radical equation must have exactly one solution');
  return solutions[0];
});

audit('advanced.exponential-observations', ({ time, first, gap, second, target }, item) => {
  assert(first > 0 && second > 0 && gap > 0);
  const observations = item.stem
    .replaceAll(',', '')
    .match(/If f\((\d+)\) = (\d+) and f\((\d+)\) = (\d+) what is f\((\d+)\)/);
  assert(observations, 'Both observations and target must be printed in the stem');
  assertEqual(Number(observations[1]), time);
  assertEqual(Number(observations[2]), first);
  assertEqual(Number(observations[3]), time + gap);
  assertEqual(Number(observations[4]), second);
  assertEqual(Number(observations[5]), target);
  // Exponential interpolation is linear in log(f), independent of the
  // generator's integer base and its verifier's cross-power identity.
  return Math.exp(Math.log(first) + ((target - time) * (Math.log(second) - Math.log(first))) / gap);
});

audit('advanced.quadratic-from-points', ({ h, k, x, y }) => {
  assert(x !== h);
  const a = (y - k) / (x - h) ** 2;
  assert(a !== 0);
  return a * h * h + k;
});

audit('advanced.polynomial-parameter', ({ p, a, d, constant }) => {
  assert(p !== 0);
  // The factor x+p forces the right-hand polynomial to vanish at x=-p.
  // This finds k without reconstructing b and c or expanding the product.
  return (-a * p ** 3 + d * p * p + constant) / p;
});

audit('advanced.nonlinear-system-sum', ({ a, b, c, m, n }) => {
  assert(m !== 0 && a !== 0);
  assert((b - m) ** 2 - 4 * a * (c - n) > 0);
  // Eliminate x using x=(y-n)/m. The coefficient of y is
  // -2an+bm-m², so the sum of the y roots follows directly from Vieta.
  return (2 * a * n - b * m + m * m) / a;
});

audit('algebra.system-parameter', ({ a, b, c, d, e }) => {
  assert(a !== 0 && b !== 0 && d !== 0);
  const slope = -a / b;
  const k = -d / slope;
  assert(!close(c / b, e / k), 'Parallel lines must have different y-intercepts');
  return k;
});

audit('geometry.circle-tangency', ({ xCoefficient, yCoefficient, axis, t }) => {
  const h = -xCoefficient / 2;
  const k = -yCoefficient / 2;
  const radius = Math.abs(t - (axis === 'x' ? h : k));
  assert(radius > 0);
  return h * h + k * k - radius * radius;
});

audit('geometry.similar-solids', ({ volumeA, volumeB, areaA }) => {
  assert(volumeA > 0 && volumeB > 0 && areaA > 0);
  const lengthFactor = Math.cbrt(volumeB / volumeA);
  return areaA * lengthFactor * lengthFactor;
});

audit('psda.conditional-probability', ({ a, b, c, rateNumerator, rateDenominator }, item) => {
  const probability = rateNumerator / rateDenominator;
  assert(probability > 0 && probability < 1);
  const rows = item.table.rows;
  assertEqual(Number(rows[0][1]), a);
  assertEqual(Number(rows[0][2]), b);
  assertEqual(Number(rows[1][1]), c);
  assertEqual(rows[1][2], '?');
  // Find the missing cell by exhaustive count, then form the new sample space.
  const candidates = Array.from({ length: 100 }, (_, i) => i + 1).filter((missing) =>
    close(c / (c + missing), probability),
  );
  assertEqual(candidates.length, 1);
  return candidates[0] / (b + candidates[0]);
});
