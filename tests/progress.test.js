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
  firstAttempts,
  keepRecordedAttempts,
} from '../src/learning/progress.js';
import { SESSION_KEY, SETTINGS_KEY } from '../src/practice/session.js';

const now = Date.now();
const templateId = 'algebra.linear-one-var';
// Enumerable like localStorage, so code that walks its keys is tested as well.
function storage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
    key: (index) => [...values.keys()][index] ?? null,
    get length() {
      return values.size;
    },
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

test('a three-digit decimal stored as correct by an earlier release is kept and regraded', () => {
  const item = generate('psda.conditional-probability', 0);
  assertEqual(item.answer, '7/17');
  // Releases before the fourth-digit rule graded .412 correct for 7/17 and stored it.
  const record = { templateId: item.templateId, seed: 0, response: '.412', correct: true, at: now - 1000, source: 'bank' };
  const backup = JSON.stringify({ version: 1, attempts: [record] });
  const store = storage();
  store.setItem(PROGRESS_KEY, backup);
  const saved = readProgress(store, now);
  assert(saved.persisted && saved.attempts.length === 1, JSON.stringify(saved));
  assertEqual(saved.attempts[0].response, '.412');
  assertEqual(saved.attempts[0].correct, false);
  const restored = storage();
  assertEqual(importProgress(backup, restored, now).added, 1);
  assertEqual(readProgress(restored, now).attempts[0].correct, false);
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
    // Recording keeps a time from a clock that was set back since (tested below).
    if (bad.at !== now + 600_000) assert(!recordAttempt(attempt(10, true, bad), store).recorded, JSON.stringify(bad));
  }
  assertEqual(store.getItem(PROGRESS_KEY), null);
});

test('progress records the app’s own attempts from a wrong clock, dated no later than now', () => {
  const store = storage();
  // A session finished 9 minutes ahead of a clock that was set back since then.
  const ahead = recordAttempts([attempt(1, true, { source: 'practice', at: Date.now() + 540_000 })], store);
  assert(ahead.recorded === 1 && ahead.persisted, JSON.stringify(ahead));
  // A timed session that ran out while the clock read 2019, saved after it was corrected.
  const early = recordAttempts([attempt(2, true, { source: 'practice', at: Date.UTC(2019, 11, 31) })], store);
  assert(early.recorded === 1 && early.persisted, JSON.stringify(early));
  const [first, second] = readProgress(store).attempts;
  assert(first.seed === 1 && first.at <= Date.now(), JSON.stringify(first));
  assert(second.seed === 2 && second.at >= first.at && second.at <= Date.now(), JSON.stringify(second));
  // No clock gives these.
  for (const at of [0, -1, 1.5]) assert(!recordAttempt(attempt(3, true, { at }), store).recorded, String(at));
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
    // A backup made on a device whose clock runs ahead restores too, clamped to now.
    const ahead = JSON.stringify({ version: 1, attempts: [attempt(5, true, { at: realNow() + 3_600_000 })] });
    const restored = storage();
    assertEqual(importProgress(ahead, restored).total, 1);
    assert(readProgress(restored).attempts[0].at <= realNow());
  } finally {
    Date.now = realNow;
  }
});

test('a backup from a device whose clock runs ahead restores in full right away', () => {
  const realNow = Date.now;
  const fast = storage();
  let backup;
  try {
    Date.now = () => realNow() + 6 * 60_000;
    for (const seed of [1, 2, 3]) {
      const value = attempt(seed);
      delete value.at;
      assert(recordAttempt(value, fast).recorded);
    }
    backup = exportProgress(fast);
  } finally {
    Date.now = realNow;
  }
  const restored = storage();
  recordAttempt(attempt(4), restored);
  const merged = importProgress(backup, restored);
  assertEqual(merged.total, 4);
  assertEqual(merged.added, 3);
  assert(readProgress(restored).attempts.every((a) => a.at <= Date.now()));
});

test('progress stays readable and keeps recording while the device clock reads before 2020', () => {
  const store = storage();
  for (const seed of [1, 2]) recordAttempt(attempt(seed), store);
  const before = readProgress(store).attempts;
  const realNow = Date.now;
  try {
    Date.now = () => Date.UTC(2019, 11, 31, 23);
    const saved = readProgress(store);
    assert(saved.persisted, saved.error);
    assertEqual(JSON.stringify(saved.attempts), JSON.stringify(before));
    assertEqual(JSON.parse(exportProgress(store)).attempts.length, 2);
    const unstamped = attempt(3);
    delete unstamped.at;
    assert(recordAttempt(unstamped, store).recorded);
    const finished = attempt(4, true, { source: 'practice', at: Date.UTC(2019, 11, 31, 22) });
    assert(recordAttempts([finished], store).persisted);
    assertEqual(importProgress(JSON.stringify({ version: 1, attempts: [attempt(5)] }), store).added, 1);
  } finally {
    Date.now = realNow;
  }
  const attempts = readProgress(store).attempts;
  assertEqual(attempts.length, 5);
  // Earlier records keep their times. Answers given under the wrong clock take the newest
  // stored time, so they stay the newest records instead of sorting back to 2020.
  assertEqual(JSON.stringify(attempts.filter((a) => a.seed <= 2)), JSON.stringify(before));
  assertEqual(attempts.map((a) => a.seed).join(), '1,2,3,4,5');
  assert(attempts.filter((a) => [3, 4].includes(a.seed)).every((a) => a.at === before.at(-1).at));
});

test('answers given while the clock reads before 2020 are kept when the history is full', () => {
  const store = storage();
  const full = Array.from({ length: MAX_ATTEMPTS }, (_, i) => normalizeAttempt(attempt(i, true, { at: now - 10_000 + i }), now));
  store.setItem(PROGRESS_KEY, JSON.stringify({ version: 1, attempts: full }));
  const realNow = Date.now;
  try {
    Date.now = () => Date.UTC(2019, 5, 1);
    const unstamped = attempt(500);
    delete unstamped.at;
    const one = recordAttempt(unstamped, store);
    assert(one.recorded && one.persisted, JSON.stringify(one));
    const batch = [501, 502, 503].map((seed) => attempt(seed, true, { source: 'practice', at: Date.UTC(2019, 5, 1) }));
    const many = recordAttempts(batch, store);
    assert(many.recorded === 3 && many.persisted, JSON.stringify(many));
  } finally {
    Date.now = realNow;
  }
  const saved = readProgress(store).attempts;
  assertEqual(saved.length, MAX_ATTEMPTS);
  // They are the newest records, so the four oldest made room for them.
  assertEqual(saved.slice(-4).map((a) => a.seed).join(), '500,501,502,503');
  assertEqual(saved[0].seed, 4);
});

test('a result older than every record of a full history is reported as not kept', () => {
  const store = storage();
  const full = Array.from({ length: MAX_ATTEMPTS }, (_, i) => normalizeAttempt(attempt(i, true, { at: now - 10_000 + i }), now));
  store.setItem(PROGRESS_KEY, JSON.stringify({ version: 1, attempts: full }));
  const before = store.getItem(PROGRESS_KEY);
  // A session that finished before all 500 stored answers, saved only now.
  const late = recordAttempts([attempt(500, true, { source: 'practice', at: now - 20_000 })], store);
  assert(late.recorded === 0 && late.persisted && late.reason === 'old', JSON.stringify(late));
  assertEqual(store.getItem(PROGRESS_KEY), before);
  // Part of a batch that is newer than the oldest record counts, and only that part.
  const mixed = recordAttempts(
    [attempt(501, true, { source: 'practice', at: now - 20_000 }), attempt(502, true, { source: 'practice' })],
    store,
  );
  assert(mixed.recorded === 1 && mixed.persisted, JSON.stringify(mixed));
  assertEqual(readProgress(store).attempts.at(-1).seed, 502);
});

test('recording tells storage that fails from a saved history it cannot read', () => {
  assertEqual(recordAttempt(attempt(), null).reason, 'storage');
  assertEqual(recordAttempt(attempt(), { getItem() { throw new Error('denied'); } }).reason, 'storage');
  const quota = { getItem: () => null, setItem() { throw new Error('quota'); } };
  assertEqual(recordAttempt(attempt(), quota).reason, 'storage');
  const store = storage();
  store.setItem(PROGRESS_KEY, '{');
  assertEqual(recordAttempt(attempt(), store).reason, 'unreadable');
  assertEqual(store.getItem(PROGRESS_KEY), '{');
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
  // The unfinished practice session and the custom settings stay, as the reset dialog
  // and the README promise.
  const kept = [SESSION_KEY, SETTINGS_KEY];
  for (const key of kept) store.setItem(key, key);
  recordAttempt(attempt(), store);
  assert(clearProgress(store));
  assertEqual(store.getItem(PROGRESS_KEY), null);
  for (const key of kept) assertEqual(store.getItem(key), key, `${key} was deleted`);
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

const answered = (templateId, seed, response, at = now - 1000) => ({ templateId, seed, response, at, source: 'bank' });

test('the same question under another seed is not a new first attempt', () => {
  const store = storage();
  // Both seeds ask for the real solution to √(2x + 108) = x − 6 (answer 18).
  assert(recordAttempt(answered('advanced.radical-equations', 610286695, '12'), store).recorded);
  const repeat = recordAttempt(answered('advanced.radical-equations', 349816471, '18'), store);
  assert(!repeat.recorded && repeat.persisted, JSON.stringify(repeat));
  // The same choices in another order repeat a question too.
  assert(recordAttempt(answered('geometry.circles', 20, 'A'), store).recorded);
  assert(!recordAttempt(answered('geometry.circles', 67, 'B'), store).recorded);
  // A shared stem over a different table is a different question.
  assertEqual(generate('psda.probability', 28).stem, generate('psda.probability', 108).stem);
  assert(recordAttempt(answered('psda.probability', 28, 'A'), store).recorded);
  assert(recordAttempt(answered('psda.probability', 108, 'A'), store).recorded);
  const summary = summarize(readProgress(store).attempts);
  assertEqual(summary.attempted, 4);
  assertEqual(summary.domains.find((d) => d.id === 'advanced').correct, 0);
});

test('a history that holds one question under two seeds keeps both records and counts the first', () => {
  const store = storage();
  const stored = [
    answered('advanced.radical-equations', 610286695, '12', now - 2000),
    answered('advanced.radical-equations', 349816471, '18', now - 1000),
  ].map((value) => normalizeAttempt(value, now));
  store.setItem(PROGRESS_KEY, JSON.stringify({ version: 1, attempts: stored }));
  const saved = readProgress(store);
  assert(saved.persisted, saved.error);
  assertEqual(saved.attempts.length, 2);
  assertEqual(firstAttempts(saved.attempts).map((a) => a.seed).join(), '610286695');
  const summary = summarize(saved.attempts);
  assertEqual(summary.attempted, 1);
  assertEqual(summary.accuracy, 0);
  const restored = storage();
  assertEqual(importProgress(exportProgress(store), restored).total, 1);
  assertEqual(readProgress(restored).attempts.length, 2);
});

// A page that records attempts, and the storage events other tabs send it.
function page(store) {
  const listeners = new Set();
  const target = {
    addEventListener: (_, listener) => listeners.add(listener),
    removeEventListener: (_, listener) => listeners.delete(listener),
  };
  let time = Date.now();
  const off = keepRecordedAttempts(target, () => store, () => time);
  return {
    off,
    wait(ms) {
      time += ms;
    },
    // An event can reach the page after later writes, so newValue may not be what is stored.
    send(key = PROGRESS_KEY, storageArea = store, newValue = key === null ? null : store.getItem(key)) {
      for (const listener of listeners) listener({ key, newValue, storageArea });
    },
  };
}
// Another tab merges its answer into what it read earlier and writes last.
function overwrite(store, base, seed) {
  const other = storage();
  if (base !== null) other.setItem(PROGRESS_KEY, base);
  recordAttempt(attempt(seed), other);
  store.setItem(PROGRESS_KEY, other.getItem(PROGRESS_KEY));
}
const seeds = (store) => readProgress(store).attempts.map((a) => a.seed).sort((a, b) => a - b).join();

test('attempts another tab overwrote are recorded again when that write lands', () => {
  const store = storage();
  recordAttempt(attempt(1), store);
  const base = store.getItem(PROGRESS_KEY);
  const tab = page(store);
  assert(recordAttempts([attempt(2), attempt(3)], store).persisted);
  overwrite(store, base, 4);
  assertEqual(seeds(store), '1,4');
  tab.send('axiom.practice.v1');
  tab.send(PROGRESS_KEY, {});
  assertEqual(seeds(store), '1,4');
  tab.send();
  assertEqual(seeds(store), '1,2,3,4');
  tab.off();
});

test('a reset is never undone by repairing attempts after another tab writes', () => {
  for (const reset of [
    (store, tab) => { store.removeItem(PROGRESS_KEY); tab.send(); },
    (store, tab) => { store.removeItem(PROGRESS_KEY); tab.send(null); },
    (store) => assert(clearProgress(store)),
  ]) {
    const store = storage();
    const tab = page(store);
    assert(recordAttempt(attempt(1), store).recorded);
    reset(store, tab);
    overwrite(store, null, 2);
    tab.send();
    assertEqual(seeds(store), '2');
    tab.off();
  }
});

test('a write event that arrives after a reset never brings the reset history back', () => {
  for (const later of [
    () => {},
    // A fourth tab already started a fresh history after the reset.
    (store) => overwrite(store, null, 4),
  ]) {
    const store = storage();
    const tab = page(store);
    assert(recordAttempts([attempt(1), attempt(2)], store).persisted);
    // Another tab adds an answer on top, then a third resets progress before this page
    // gets to the first write's event.
    overwrite(store, store.getItem(PROGRESS_KEY), 3);
    const write = store.getItem(PROGRESS_KEY);
    store.removeItem(PROGRESS_KEY);
    later(store);
    const after = store.getItem(PROGRESS_KEY);
    tab.send(PROGRESS_KEY, store, write);
    assertEqual(store.getItem(PROGRESS_KEY), after);
    tab.send(PROGRESS_KEY, store, null);
    tab.send();
    assertEqual(store.getItem(PROGRESS_KEY), after);
    tab.off();
  }
  // Clearing site data sends no event at all; finding the history gone is a reset too.
  const store = storage();
  const tab = page(store);
  assert(recordAttempts([attempt(1), attempt(2)], store).persisted);
  overwrite(store, store.getItem(PROGRESS_KEY), 3);
  const write = store.getItem(PROGRESS_KEY);
  store.removeItem(PROGRESS_KEY);
  tab.send(PROGRESS_KEY, store, write);
  overwrite(store, null, 4);
  tab.send();
  assertEqual(seeds(store), '4');
  tab.off();
});

test('attempts another tab overwrote are recorded again after this page wrote on top', () => {
  const store = storage();
  recordAttempt(attempt(1), store);
  const base = store.getItem(PROGRESS_KEY);
  const tab = page(store);
  assert(recordAttempt(attempt(2), store).recorded);
  overwrite(store, base, 3);
  const write = store.getItem(PROGRESS_KEY);
  // This page answers twice more before that write's event reaches it, so its own writes
  // are the latest and no other event will follow.
  assert(recordAttempt(attempt(4), store).recorded);
  assert(recordAttempt(attempt(5), store).recorded);
  assertEqual(seeds(store), '1,3,4,5');
  tab.send(PROGRESS_KEY, store, write);
  assertEqual(seeds(store), '1,2,3,4,5');
  tab.off();
});

test('repairs stop after a few seconds and never write over history that cannot be read', () => {
  const store = storage();
  const tab = page(store);
  assert(recordAttempt(attempt(1), store).recorded);
  store.setItem(PROGRESS_KEY, '{');
  tab.send();
  assertEqual(store.getItem(PROGRESS_KEY), '{');
  overwrite(store, null, 2);
  tab.wait(11_000);
  tab.send();
  assertEqual(seeds(store), '2');
  tab.off();
});
