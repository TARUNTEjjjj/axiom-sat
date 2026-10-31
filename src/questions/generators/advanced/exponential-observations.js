import { fmtComma, sprNum } from '../../format.js';
import { parseSpr } from '../../spr.js';

export default {
  id: 'advanced.exponential-observations',
  domain: 'advanced',
  skill: 'Exponential models from two observations',
  space: 13 * 111 * 3 * 2 * 2,
  generate(rng) {
    const time = rng.int(2, 14);
    const first = rng.int(10, 120);
    const base = rng.int(2, 4);
    const gap = rng.int(2, 3);
    const step = rng.pick([1, gap + 1]);
    const second = first * base ** gap;
    const target = time + step;
    const value = first * base ** step;
    return {
      item: {
        type: 'spr',
        difficulty: 3,
        stem: `The function f is defined by f(t) = abᵗ, where a and b are positive constants. If f(${time}) = ${fmtComma(first)} and f(${time + gap}) = ${fmtComma(second)}, what is f(${target})?`,
        answer: sprNum(value),
        explanation: `Divide the two observed values: f(${time + gap}) / f(${time}) = b${gap === 2 ? '²' : '³'} = ${fmtComma(second)} / ${fmtComma(first)} = ${base ** gap}. Since b is positive, b = ${base}. The target input is ${step} ${step === 1 ? 'step' : 'steps'} after ${time}, so f(${target}) = ${fmtComma(first)} × ${base}${step === 1 ? '' : step === 3 ? '³' : '⁴'} = ${fmtComma(value)}. The ratio describes ${gap} steps, so using it as a one-step multiplier would overestimate the result.`,
      },
      params: { time, first, gap, second, target },
    };
  },
  verify({ item, params: { time, first, gap, second, target } }) {
    const ratio = second / first;
    const relative = parseSpr(item.answer) / first;
    return relative > 0 && Math.abs(relative ** gap - ratio ** (target - time)) < 1e-8;
  },
};
