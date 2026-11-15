// Helpers for multiple-choice items: pick distractors, then shuffle them with the
// correct answer into choices A–D.

export const KEYS = ['A', 'B', 'C', 'D'];

// Shuffles the correct text with three distractor texts and reports which key is right.
export function makeChoices(rng, correct, distractors) {
  const texts = [correct, ...distractors];
  if (texts.length !== 4 || new Set(texts).size !== 4) {
    throw new Error(`makeChoices: need 4 distinct texts, got ${JSON.stringify(texts)}`);
  }
  const order = rng.shuffle(texts);
  return {
    choices: order.map((text, i) => ({ key: KEYS[i], text })),
    answer: KEYS[order.indexOf(correct)],
  };
}

// Takes up to `count` distinct finite values from `candidates` (the results of
// common mistakes), skipping the correct value, then fills any gaps with
// fallback(1), fallback(-1), fallback(2), ... The default fallback steps away
// from the correct value by whole numbers. Any further arguments are rules
// (value, taken) => boolean, such as notARun below; a value that breaks one next
// to the distractors already taken is passed over.
export function pickDistractors(correct, candidates, count = 3, fallback = (k) => correct + k, ...rules) {
  const out = [];
  const seen = new Set([correct]);
  const take = (value) => {
    if (!Number.isFinite(value) || seen.has(value) || !rules.every((fits) => fits(value, out))) return;
    seen.add(value);
    out.push(value);
  };
  for (const value of candidates) {
    if (out.length === count) break;
    take(value);
  }
  for (let k = 1; out.length < count; k++) {
    take(fallback(k));
    if (out.length < count) take(fallback(-k));
    if (k > 1000) throw new Error('pickDistractors: fallback never produced new values');
  }
  return out;
}

// For pickDistractors: the last of three distractors may not complete a run of
// four consecutive whole numbers.
export const notARun = (correct) => (value, taken) => {
  const values = [correct, ...taken, value];
  return values.length < 4 || !values.every(Number.isInteger) || Math.max(...values) - Math.min(...values) !== 3;
};

// For pickDistractors: offering both correct − d and correct + d would put the
// answer in the middle of three evenly spaced values.
export const offCenter = (correct) => (value, taken) => !taken.includes(2 * correct - value);
