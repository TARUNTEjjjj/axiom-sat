import { MINUS, TIMES, fmtNum, plural, sprNum } from '../../format.js';
import { parseSpr } from '../../spr.js';

// A short list of whole-number values, built so that whatever is asked about (its
// mean, its median, a value that brings the mean to a target, or the mean once the
// greatest value is dropped) is exact: a whole number or a half.

const CONTEXTS = [
  { what: 'points a basketball player scored', per: ['game', 'games'], range: [4, 36] },
  { what: 'books a student read', per: ['month', 'months'], range: [1, 12] },
  { what: 'cars sold at a dealership', per: ['week', 'weeks'], range: [3, 25] },
  { what: 'hours a lifeguard worked', per: ['week', 'weeks'], range: [6, 40] },
  { what: 'pages a writer edited', per: ['day', 'days'], range: [4, 30] },
  { what: 'emails a manager received', per: ['day', 'days'], range: [10, 60] },
  { what: 'laps a swimmer completed', per: ['practice', 'practices'], range: [10, 50] },
  { what: 'customers served at a bakery', per: ['hour', 'hours'], range: [8, 60] },
];

const ORDINALS = { 6: 'A sixth', 7: 'A seventh', 8: 'An eighth' };

// A mean the list can hit exactly (whole, or a half when the count is even), kept
// away from the ends of the range so the solved-for last value lands in it quickly.
function pickMean(rng, count, [lo, hi]) {
  const margin = Math.ceil((hi - lo) / 4);
  return count % 2 === 0
    ? rng.int(2 * (lo + margin), 2 * (hi - margin)) / 2
    : rng.int(lo + margin, hi - margin);
}

// `count` values in [lo, hi] with exactly the given mean: the last value is solved
// for, and the draw is repeated until it falls in range.
function listWithMean(rng, count, mean, [lo, hi]) {
  let values;
  let last;
  do {
    values = Array.from({ length: count - 1 }, () => rng.int(lo, hi));
    last = count * mean - values.reduce((sum, v) => sum + v, 0);
  } while (last < lo || last > hi);
  return rng.shuffle([...values, last]);
}

// The k-th smallest of the values (k counted from 1), found by counting how many
// values each one is at least as large as, rather than by sorting.
function kth(values, k) {
  return Math.min(...values.filter((v) => values.filter((u) => u <= v).length >= k));
}

export default {
  id: 'psda.center',
  domain: 'psda',
  skill: 'One-variable data: distributions and measures of center and spread',
  // median variant alone: contexts · list lengths · every ordered list of 5 values
  // drawn from the narrowest range (12 whole numbers)
  space: 8 * 3 * 12 ** 5,

  generate(rng) {
    const variant = rng.pick(['mean', 'median', 'add', 'remove']);
    const c = rng.pick(CONTEXTS);
    const count = rng.int(5, 7);
    const [lo, hi] = c.range;
    const draw = (k) => Array.from({ length: k }, () => rng.int(lo, hi));

    let values;
    let answer;
    let ask;
    let explanation;
    let params;
    if (variant === 'mean') {
      answer = pickMean(rng, count, c.range);
      values = listWithMean(rng, count, answer, c.range);
      const sum = count * answer;
      ask = `What is the mean of these ${count} numbers?`;
      explanation =
        `Add the values: ${values.join(' + ')} = ${sum}. ` +
        `Divide the sum by the number of values: ${sum}/${count} = ${fmtNum(answer)}.`;
    } else if (variant === 'median') {
      values = draw(count);
      const sorted = [...values].sort((a, b) => a - b);
      const mid = Math.floor(count / 2);
      answer = count % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
      ask = `What is the median of these ${count} numbers?`;
      explanation =
        `Order the values from least to greatest: ${sorted.join(', ')}. ` +
        (count % 2
          ? `With ${count} values, the median is the middle value, the ${mid + 1}${mid + 1 === 3 ? 'rd' : 'th'} ` +
            `in the ordered list: ${answer}.`
          : `With ${count} values, the median is the mean of the two middle values: ` +
            `(${sorted[mid - 1]} + ${sorted[mid]})/2 = ${fmtNum(answer)}.`);
    } else if (variant === 'add') {
      let sum;
      let low;
      let high;
      do {
        values = draw(count);
        sum = values.reduce((s, v) => s + v, 0);
        low = Math.ceil((sum + lo) / (count + 1));
        high = Math.floor((sum + hi) / (count + 1));
      } while (low > high); // some whole-number target mean must keep x in range
      const target = rng.int(low, high);
      const total = (count + 1) * target;
      answer = total - sum;
      ask =
        `${ORDINALS[count + 1]} value, x, is added to the list so that the mean of all ${count + 1} values ` +
        `is ${target}. What is the value of x?`;
      explanation =
        `The ${count} values have a sum of ${sum}. For ${count + 1} values to have a mean of ${target}, ` +
        `their sum must be ${count + 1} ${TIMES} ${target} = ${total}. So x = ${total} ${MINUS} ${sum} = ${answer}.`;
      params = { target };
    } else {
      const kept = [lo, hi - 5]; // leaves room above the rest for the greatest value
      answer = pickMean(rng, count - 1, kept);
      const rest = listWithMean(rng, count - 1, answer, kept);
      const greatest = rng.int(Math.max(...rest) + 1, hi);
      values = rng.shuffle([...rest, greatest]);
      const sum = (count - 1) * answer + greatest;
      ask = `If the greatest value is removed from the list, what is the mean of the remaining ${count - 1} numbers?`;
      explanation =
        `The ${count} values have a sum of ${sum}, and the greatest value is ${greatest}. ` +
        `Removing it leaves ${count - 1} values with a sum of ${sum} ${MINUS} ${greatest} = ${sum - greatest}, ` +
        `so their mean is ${sum - greatest}/${count - 1} = ${fmtNum(answer)}.`;
    }

    const stem =
      `The list gives the numbers of ${c.what} in each of ${plural(count, ...c.per)}: ${values.join(', ')}. ${ask}`;

    // A mean or median of five values is one step; six or seven values mean more
    // arithmetic and possibly a half; adding or removing a value needs the sum first.
    const difficulty = variant === 'mean' || variant === 'median' ? (count === 5 ? 1 : 2) : 3;

    return {
      item: { type: 'spr', difficulty, stem, answer: sprNum(answer), explanation },
      params: { variant, values, answer, ...params },
    };
  },

  // Each measure is re-checked from its definition rather than by recomputing it.
  verify({ item, params: { variant, values, answer, target } }) {
    const n = values.length;
    const sum = values.reduce((s, v) => s + v, 0);
    let ok;
    if (variant === 'mean') {
      // The deviations from the mean cancel out.
      ok = values.reduce((s, v) => s + (v - answer), 0) === 0;
    } else if (variant === 'median') {
      // The middle order statistic, or the midpoint of the two middle ones.
      ok = n % 2 ? kth(values, (n + 1) / 2) === answer : kth(values, n / 2) + kth(values, n / 2 + 1) === 2 * answer;
    } else if (variant === 'add') {
      ok = sum + answer === target * (n + 1);
    } else {
      const greatest = kth(values, n);
      ok = values.filter((v) => v === greatest).length === 1 && sum - greatest === answer * (n - 1);
    }
    return ok && n >= 5 && n <= 7 && parseSpr(item.answer) === answer;
  },
};
