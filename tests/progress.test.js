import { test, assert, assertEqual, assertThrows } from './harness.js';
import { generate, listTemplates } from '../src/questions/index.js';
import {
  PROGRESS_KEY,
  MAX_ATTEMPTS,
  MAX_BACKUP_BYTES,
  normalizeAttempt,
  normalizeAttempts,
  recordAttempt,
  recordAttempts,
  readProgress,
  summarize,
  clearProgress,
  exportProgress,
  importProgress,
} from '../src/learning/progress.js';

const now = Date.now();
const templateId = 'algebra.linear-one-var';
function storage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}
function attempt(seed = 10, correct = true, extra = {}) {
  const item = generate(templateId, seed);
  const response = correct
    ? item.answer
    : item.type === 'mc'
      ? ['A', 'B', 'C', 'D'].find((key) => key !== item.answer)
      : String(Number(item.answer) + 1);
  return { templateId, seed, response, correct, at: now - 1000, source: 'bank', ...extra };
}

test('progress records one first attempt per question, even if it is later answered correctly', () => {
  const store = storage();
  assert(recordAttempt(attempt(10, false), store).recorded);
  const duplicate = recordAttempt(attempt(10, true), store);
  assert(!duplicate.recorded && duplicate.persisted);
  const saved = readProgress(store);
  assertEqual(saved.attempts.length, 1);
  assertEqual(saved.attempts[0].correct, false);
});

test('progress rechecks correctness instead of trusting a stored boolean', () => {
  assertEqual(normalizeAttempt(attempt(10, false, { correct: true })).correct, false);
  assertEqual(normalizeAttempt(attempt(10, true, { correct: false })).correct, true);
});

test('progress rejects invalid identities, time, source and response without writing', () => {
  const store = storage();
  assert(!recordAttempt(null, store).recorded);
  assert(!recordAttempt(undefined, store).recorded);
  for (const bad of [
    { templateId: 'unknown' },
    { seed: -1 },
    { seed: 1.5 },
    { seed: 0x100000000 },
    { seed: '10' },
    { source: 'external' },
    { at: -1 },
    { at: now + 600_000 },
    { at: '2026-10-30' },
    { response: '' },
    { response: ' '.repeat(4) },
    { response: 'A'.repeat(65) },
    { response: null },
  ]) {
    assertEqual(normalizeAttempt(attempt(10, true, bad), now), null, JSON.stringify(bad));
    assert(!recordAttempt(attempt(10, true, bad), store).recorded);
  }
  assertEqual(store.getItem(PROGRESS_KEY), null);
});

test('progress student response normalization rejects invalid numbers and accepts equivalent fractions', () => {
  let item;
  for (const template of listTemplates()) {
    for (let seed = 0; seed < 20; seed++) {
      const candidate = generate(template.id, seed);
      if (candidate.type === 'spr') {
        item = candidate;
        break;
      }
    }
    if (item) break;
  }
  assert(item);
  const base = {
    templateId: item.templateId,
    seed: item.seed,
    response: item.answer,
    at: now,
    source: 'practice',
  };
  assert(normalizeAttempt(base, now).correct);
  for (const response of ['1/0', 'Infinity', 'NaN', 'bad', '<script>', '123456', '-123456']) {
    assertEqual(normalizeAttempt({ ...base, response }, now), null);
  }
});

test('progress records a spaced fraction that practice graded correct, in canonical form', () => {
  const store = storage();
  const item = generate('psda.conditional-probability', 1);
  assert(item.type === 'spr' && item.answer.includes('/'));
  const value = {
    templateId: item.templateId,
    seed: item.seed,
    response: item.answer.replace('/', ' / '),
    at: now - 1000,
    source: 'practice',
  };
  const saved = recordAttempt(value, store);
  assert(saved.recorded && saved.persisted, JSON.stringify(saved));
  const [stored] = readProgress(store).attempts;
  assertEqual(stored.response, item.answer);
  assertEqual(stored.correct, true);
  // Spaces only collapse around a fraction bar; separate digits are still not an answer.
  assertEqual(normalizeAttempt({ ...value, response: '1 2' }, now), null);
});

test('progress reports unavailable and throwing storage without breaking answer checking', () => {
  assert(!recordAttempt(attempt(), null).persisted);
  assert(!readProgress(null).persisted);
  const throwing = {
    getItem() {
      throw new Error('denied');
    },
  };
  assert(!recordAttempt(attempt(), throwing).persisted);
  assert(!readProgress(throwing).persisted);
  const quota = {
    getItem() {
      return null;
    },
    setItem() {
      throw new Error('quota');
    },
  };
  assert(!recordAttempt(attempt(), quota).persisted);
});

test('progress never silently overwrites corrupted stored data', () => {
  const store = storage();
  store.setItem(PROGRESS_KEY, '{not-json');
  assert(!readProgress(store).persisted);
  assert(!recordAttempt(attempt(), store).persisted);
  assertEqual(store.getItem(PROGRESS_KEY), '{not-json');
});

test('progress keeps the latest 500 distinct questions and the earliest duplicate result', () => {
  const attempts = Array.from({ length: MAX_ATTEMPTS + 5 }, (_, seed) =>
    attempt(seed, false, { at: now - 100_000 + seed }),
  );
  attempts.push(attempt(504, true, { at: now - 1 }));
  const normalized = normalizeAttempts(attempts, now);
  assertEqual(normalized.length, MAX_ATTEMPTS);
  assertEqual(normalized[0].seed, 5);
  assertEqual(normalized.at(-1).seed, 504);
  assertEqual(normalized.at(-1).correct, false);
});

test('progress records automatically timestamped practice results', () => {
  const store = storage();
  const value = attempt(14, true, { source: 'practice' });
  delete value.at;
  assert(recordAttempt(value, store).persisted);
  assert(readProgress(store).attempts[0].at >= now);
});

test('progress summary handles empty history without invented percentages', () => {
  const summary = summarize([]);
  assertEqual(summary.accuracy, null);
  assertEqual(summary.attempted, 0);
  assertEqual(summary.weakest, null);
  assertEqual(summary.domains.length, 4);
  assert(summary.domains.every((d) => d.attempted === 0));
});

test('progress summary counts domains and recommends a skill with mistakes', () => {
  const values = normalizeAttempts([attempt(1, true), attempt(2, false), attempt(3, false)]);
  const summary = summarize(values);
  assertEqual(summary.attempted, 3);
  assertEqual(summary.correct, 1);
  assertEqual(summary.accuracy, 33);
  assertEqual(summary.domains.find((d) => d.id === 'algebra').attempted, 3);
  assertEqual(summary.weakest.templateId, templateId);
});

test('progress summary recommends the weakest skill across all of its templates', () => {
  const answered = (id, seed, correct) => {
    const item = generate(id, seed);
    const response = correct ? item.answer : ['A', 'B', 'C', 'D'].find((key) => key !== item.answer);
    return { templateId: id, seed, response, at: now - 1000, source: 'bank' };
  };
  // Nonlinear functions spans two templates: 5 of 6 right overall, though 0 of 1 on function-values.
  const values = normalizeAttempts([
    ...[1, 2, 3, 4, 5].map((seed) => answered('advanced.nonlinear-models', seed, true)),
    answered('advanced.function-values', 6, false),
    answered('algebra.linear-functions', 7, true),
    ...[8, 9, 10].map((seed) => answered('algebra.linear-functions', seed, false)),
  ]);
  assertEqual(values.length, 10);
  const { weakest } = summarize(values);
  assertEqual(weakest.name, 'Linear functions');
  assertEqual(weakest.attempted, 4);
  assertEqual(weakest.correct, 1);
});

test('progress exports and imports a versioned backup without losing first-attempt results', () => {
  const source = storage();
  const destination = storage();
  recordAttempt(attempt(1, false, { at: now - 20_000 }), source);
  recordAttempt(attempt(2), source);
  recordAttempt(attempt(1, true, { at: now - 10_000 }), destination);
  const merged = importProgress(exportProgress(source), destination, now);
  assertEqual(merged.total, 2);
  assertEqual(merged.added, 1);
  assertEqual(readProgress(destination).attempts[0].correct, false);
});

test('progress stays readable and restorable after a fast device clock is corrected', () => {
  const store = storage();
  const realNow = Date.now;
  const unstamped = (seed) => {
    const value = attempt(seed);
    delete value.at;
    return value;
  };
  try {
    Date.now = () => realNow() + 3_600_000;
    for (const seed of [1, 2, 3]) assert(recordAttempt(unstamped(seed), store).recorded);
    Date.now = realNow;
    const saved = readProgress(store);
    assert(saved.persisted, saved.error);
    assertEqual(saved.attempts.length, 3);
    assert(recordAttempt(unstamped(4), store).recorded);
    const backup = exportProgress(store);
    assertEqual(importProgress(backup, storage()).total, 4);
    // Only the app's own store is clamped: an incoming backup from the future is still refused.
    const ahead = JSON.stringify({ version: 1, attempts: [attempt(5, true, { at: realNow() + 3_600_000 })] });
    assertThrows(() => importProgress(ahead, storage()));
  } finally {
    Date.now = realNow;
  }
});

test('progress import rejects malformed, oversized, unsupported and unrecognized records atomically', () => {
  const store = storage();
  recordAttempt(attempt(), store);
  const before = store.getItem(PROGRESS_KEY);
  const badValues = [
    'bad',
    'null',
    '[]',
    JSON.stringify({ version: 2, attempts: [] }),
    JSON.stringify({ version: 1, attempts: [attempt(1, true, { templateId: 'evil' })] }),
    JSON.stringify({ version: 1, attempts: [attempt(), attempt()] }),
    JSON.stringify({ version: 1, attempts: Array.from({ length: MAX_ATTEMPTS + 1 }, (_, n) => attempt(n)) }),
    ' '.repeat(MAX_BACKUP_BYTES + 1),
  ];
  for (const input of badValues) {
    assertThrows(() => importProgress(input, store));
    assertEqual(store.getItem(PROGRESS_KEY), before);
  }
});

test('progress restore and export explain unavailable storage', () => {
  assertThrows(() => exportProgress(null));
  assertThrows(() => importProgress(JSON.stringify({ version: 1, attempts: [] }), null));
});

test('reset deletes only Axiom progress and reports failed deletion', () => {
  const store = storage();
  store.setItem('axiom.session.v1', 'session');
  recordAttempt(attempt(), store);
  assert(clearProgress(store));
  assertEqual(store.getItem(PROGRESS_KEY), null);
  assertEqual(store.getItem('axiom.session.v1'), 'session');
  assert(!clearProgress(null));
  assert(
    !clearProgress({
      removeItem() {
        throw new Error('denied');
      },
    }),
  );
});


test('a completed session validates history and writes its first attempts only once', () => {
  const store = storage();
  recordAttempt(attempt(10, false), store);
  let reads = 0, writes = 0;
  const counted = { getItem(key) { reads++; return store.getItem(key); }, setItem(key, value) { writes++; store.setItem(key, value); } };
  const batch = [attempt(10, true), attempt(11, false), attempt(11, true), attempt(12, true)];
  const result = recordAttempts(batch, counted);
  assertEqual(result.recorded, 2); assert(result.persisted);
  assertEqual(reads, 1); assertEqual(writes, 1);
  const saved = readProgress(store).attempts;
  assertEqual(saved.length, 3);
  assertEqual(saved.find(a => a.seed === 10).correct, false);
  assertEqual(saved.find(a => a.seed === 11).correct, false);
  assertEqual(saved.find(a => a.seed === 12).correct, true);
  assertEqual(recordAttempts(batch, counted).recorded, 0);
  assertEqual(writes, 1, 'an exact retry does not rewrite history');
});

test('batch validation and failed storage never commit a partial practice session', () => {
  const store = storage(); recordAttempt(attempt(10), store);
  const original = store.getItem(PROGRESS_KEY);
  for (const invalid of [null, [], Array(1), Array.from({ length: 23 }, (_, i) => attempt(i + 30)), [attempt(11), { templateId: 'missing' }]]) {
    assert(!recordAttempts(invalid, store).persisted);
    assertEqual(store.getItem(PROGRESS_KEY), original);
  }
  const failed = { getItem: store.getItem, setItem() { throw new Error('QuotaExceeded'); } };
  assert(!recordAttempts([attempt(11), attempt(12)], failed).persisted);
  assertEqual(store.getItem(PROGRESS_KEY), original);
  assertEqual(recordAttempts([attempt(11), attempt(12)], store).recorded, 2);
  store.setItem(PROGRESS_KEY, '{');
  assert(!recordAttempts([attempt(13)], store).persisted);
  assertEqual(store.getItem(PROGRESS_KEY), '{');
});

test('a full 22-answer batch retains the latest 500 first attempts without mutating its inputs', () => {
  const store = storage();
  const old = Array.from({ length: 500 }, (_, i) => normalizeAttempt(attempt(i, true, { at: now - 10000 + i })));
  store.setItem(PROGRESS_KEY, JSON.stringify({ version: 1, attempts: old }));
  const batch = Array.from({ length: 22 }, (_, i) => attempt(i + 500, true, { source: 'practice' }));
  const original = JSON.stringify(batch);
  assertEqual(recordAttempts(batch, store).recorded, 22);
  const saved = readProgress(store).attempts;
  assertEqual(saved.length, 500); assertEqual(saved[0].seed, 22); assertEqual(saved.at(-1).seed, 521);
  assertEqual(JSON.stringify(batch), original);
});
