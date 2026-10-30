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
// from the correct value by whole numbers.
export function pickDistractors(correct, candidates, count = 3, fallback = (k) => correct + k) {
  const out = [];
  const seen = new Set([correct]);
  const take = (value) => {
    if (!Number.isFinite(value) || seen.has(value)) return;
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
