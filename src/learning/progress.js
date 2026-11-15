// Browser-local learning history of the most recent 500 distinct template/seed
// pairs. Only the first attempt at each question counts; the answer is rechecked
// when data is read.
import { DOMAINS, generate, getTemplate } from '../questions/index.js';
import { normalizeSpr, parseSpr, sprEquals } from '../questions/spr.js';
import { answerText, isSprAnswer } from '../questions/schema.js';

export const PROGRESS_KEY = 'axiom.progress.v1';
export const MAX_ATTEMPTS = 500;
export const MAX_BACKUP_BYTES = 256 * 1024;
const EARLIEST = Date.UTC(2020, 0, 1);
// A clock before 2020 is plainly wrong, so it cannot show that a record is from the future.
const latest = (now) => (now < EARLIEST ? Infinity : now);

function defaultStorage() {
  try {
    return globalThis.localStorage || null;
  } catch {
    return null;
  }
}

// Records are stored once per template/seed pair.
function key(attempt) {
  return `${attempt.templateId}#${attempt.seed}`;
}

// Another seed can give a learner the same question again: the same stem and data
// with the same correct answer, where only the distractors, their order or the
// wording of the solution differ. Identities are cached per template/seed pair.
const questions = new Map();
function questionOf(item) {
  const answer = item.type === 'mc' ? answerText(item) : item.answer;
  return JSON.stringify([item.templateId, item.stem, item.table ?? null, answer]);
}
function question(attempt) {
  const id = key(attempt);
  if (!questions.has(id)) questions.set(id, questionOf(generate(attempt.templateId, attempt.seed)));
  return questions.get(id);
}

export function normalizeAttempt(value, now = Date.now()) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  if (
    typeof value.templateId !== 'string' ||
    !Number.isInteger(value.seed) ||
    value.seed < 0 ||
    value.seed > 0xffffffff
  )
    return null;
  if (!['bank', 'practice'].includes(value.source)) return null;
  if (!Number.isInteger(value.at) || value.at < EARLIEST || value.at > latest(now) + 300_000) return null;
  if (typeof value.response !== 'string' || value.response.length > 64) return null;
  const response = normalizeSpr(value.response);
  if (!response) return null;
  try {
    const item = generate(value.templateId, value.seed);
    questions.set(item.id, questionOf(item));
    if (item.type === 'mc' && !['A', 'B', 'C', 'D'].includes(response)) return null;
    if (item.type === 'spr' && (!isSprAnswer(response) || !Number.isFinite(parseSpr(response)))) return null;
    const correct = item.type === 'mc' ? response === item.answer : sprEquals(response, item.answer);
    return {
      templateId: item.templateId,
      seed: item.seed,
      response,
      correct,
      source: value.source,
      at: value.at,
    };
  } catch {
    return null;
  }
}

// Earliest attempts win when backups overlap; retain the newest 500 distinct
// questions afterwards. Invalid entries never reach rendering or statistics.
export function normalizeAttempts(values, now = Date.now()) {
  const unique = new Map();
  for (const value of values) {
    const attempt = normalizeAttempt(value, now);
    if (!attempt) continue;
    const existing = unique.get(key(attempt));
    if (!existing || attempt.at < existing.at) unique.set(key(attempt), attempt);
  }
  return [...unique.values()].sort((a, b) => a.at - b.at).slice(-MAX_ATTEMPTS);
}

// The attempts that count, given in stored (time) order: the earliest at each
// question. Histories saved before questions were compared by content can hold one
// question under two seeds; both records stay stored and only the first counts.
export function firstAttempts(attempts) {
  const counted = new Set();
  return attempts.filter((attempt) => {
    const id = question(attempt);
    if (counted.has(id)) return false;
    counted.add(id);
    return true;
  });
}

// The incoming attempts at questions the history does not hold yet. Existing first
// attempts win: a retry, or the same question under another seed, cannot revise them.
function unsaved(saved, incoming) {
  const seen = new Set(saved.flatMap((attempt) => [key(attempt), question(attempt)]));
  return incoming.filter((attempt) => {
    const ids = [key(attempt), question(attempt)];
    if (ids.some((id) => seen.has(id))) return false;
    ids.forEach((id) => seen.add(id));
    return true;
  });
}

// Records were checked when this app wrote them, here or on the device that made a
// backup. A clock that runs fast there, or ran fast here and was corrected, leaves
// some in the future, so their times are clamped to now instead of rejecting the
// whole history or backup.
function decode(text, now) {
  if (typeof text !== 'string' || text.length > MAX_BACKUP_BYTES) throw new Error('Backup is too large.');
  const data = JSON.parse(text);
  if (!data || data.version !== 1 || !Array.isArray(data.attempts) || data.attempts.length > MAX_ATTEMPTS) {
    throw new Error('This is not an Axiom progress backup.');
  }
  const values = data.attempts.map((value) =>
    Number.isInteger(value?.at) ? { ...value, at: Math.min(value.at, latest(now)) } : value,
  );
  const attempts = normalizeAttempts(values, now);
  if (attempts.length !== data.attempts.length)
    throw new Error('Backup contains invalid or repeated questions.');
  return attempts;
}

// The stored history and the text it was read from. A failure gives its reason: the
// storage itself ('storage'), or a history it returns that cannot be read ('unreadable').
function load(storage, now = Date.now()) {
  if (!storage)
    return { attempts: [], persisted: false, reason: 'storage', error: 'Browser storage is unavailable.' };
  let text;
  try {
    text = storage.getItem(PROGRESS_KEY);
    return { text, attempts: text === null ? [] : decode(text, now), persisted: true };
  } catch {
    return {
      attempts: [],
      persisted: false,
      reason: text === undefined ? 'storage' : 'unreadable',
      error:
        'Saved progress could not be read. Reset it here to start fresh before restoring a valid backup.',
    };
  }
}

export function readProgress(storage = defaultStorage(), now = Date.now()) {
  const { text, ...result } = load(storage, now);
  return result;
}

// localStorage has no lock. Two tabs that each read the history before the other's
// write landed both save their own merge, and the later write drops the earlier
// one's attempts although both callers were told they persisted. A page keeps what
// it added for a few seconds and records it again if another tab's write lands
// without it (keepRecordedAttempts). A reset is never undone.
const REPAIR_MS = 10_000;
const recent = new WeakMap();
// The last history this page wrote and the one it read first. While this page writes
// on top of its own writes, the base stays the last write it found from another tab.
const ownWrites = new WeakMap();

function remember(storage, attempts, time = Date.now()) {
  const kept = (recent.get(storage) || []).filter((entry) => time - entry.time < REPAIR_MS);
  recent.set(storage, [...kept, ...attempts.map((attempt) => ({ attempt, time }))]);
}

function wrote(storage, base, text) {
  const mine = ownWrites.get(storage);
  ownWrites.set(storage, { base: mine && mine.text === base ? mine.base : base, text });
}

// A completed practice session has at most 22 questions. Validate once and
// persist once instead of regenerating the 500-entry history for every answer.
export function recordAttempts(values, storage = defaultStorage()) {
  if (!Array.isArray(values) || !values.length || values.length > 22)
    return { recorded: 0, persisted: false, reason: 'invalid' };
  const now = Date.now();
  const saved = load(storage, now);
  // Attempts come from this app's own pages, stamped by the device clock. A time ahead
  // of now is from a clock set back since, and one before 2020 from a clock that is
  // plainly wrong. Both are kept: the first at now, the second at the latest time the
  // clock or the history can vouch for, so new answers never sort below older ones.
  const vouched = Math.max(EARLIEST, now, saved.attempts.at(-1)?.at ?? EARLIEST);
  const time = (at) =>
    !Number.isSafeInteger(at) || at <= 0 ? at : at < EARLIEST ? vouched : Math.min(at, latest(now));
  const incoming = Array.from(values, value => normalizeAttempt(value && { ...value, at: time(value.at ?? now) }, now));
  if (incoming.some(attempt => !attempt))
    return { recorded: 0, persisted: false, reason: 'invalid' };
  if (!saved.persisted) return { recorded: 0, persisted: false, reason: saved.reason };
  const added = unsaved(saved.attempts, incoming);
  if (!added.length) return { recorded: 0, persisted: true, reason: 'duplicate' };
  // Both collections are already validated and their questions are distinct.
  const attempts = [...saved.attempts, ...added].sort((a, b) => a.at - b.at).slice(-MAX_ATTEMPTS);
  // A result older than every record of a full history is not kept, as if it had been
  // recorded in time and then made way for newer ones; only the records kept count.
  const kept = added.filter((attempt) => attempts.includes(attempt));
  if (!kept.length) return { recorded: 0, persisted: true, reason: 'old' };
  try {
    const text = JSON.stringify({ version: 1, attempts });
    storage.setItem(PROGRESS_KEY, text);
    wrote(storage, saved.text, text);
    remember(storage, kept);
    return { recorded: kept.length, persisted: true };
  } catch {
    return { recorded: 0, persisted: false, reason: 'storage' };
  }
}

export function recordAttempt(value, storage = defaultStorage()) {
  const result = recordAttempts([value], storage);
  return { ...result, recorded: result.recorded > 0 };
}

// Each page that records attempts listens for other tabs' writes to the history.
export function keepRecordedAttempts(target, getStorage = defaultStorage, now = Date.now) {
  const listener = (event) => {
    if (event.key !== PROGRESS_KEY && event.key !== null) return;
    const storage = getStorage();
    if (!storage || event.storageArea !== storage) return;
    // A removal is a reset, and a null key is clear(): forget instead of undoing it.
    if (event.key === null || event.newValue === null) {
      recent.delete(storage);
      return;
    }
    const time = now();
    const kept = (recent.get(storage) || []).filter((entry) => time - entry.time < REPAIR_MS);
    recent.set(storage, kept);
    if (!kept.length) return;
    // The event can be older than the latest write. A history that is gone was reset
    // since, and that event is still on its way: forget now instead of writing.
    const saved = load(storage);
    if (saved.text === null) {
      recent.delete(storage);
      return;
    }
    // Act on the latest write only, because each later change from another tab, a reset
    // included, has its own event on the way. A write this page made on top of this one
    // since then has no event, so it counts as this one.
    const mine = ownWrites.get(storage);
    const isLatestWrite = saved.text === event.newValue || (mine?.text === saved.text && mine.base === event.newValue);
    if (!isLatestWrite || !saved.persisted) return;
    const missing = unsaved(saved.attempts, kept.map((entry) => entry.attempt));
    const attempts = [...saved.attempts, ...missing].sort((a, b) => a.at - b.at).slice(-MAX_ATTEMPTS);
    if (!missing.some((attempt) => attempts.includes(attempt))) return;
    try {
      const text = JSON.stringify({ version: 1, attempts });
      storage.setItem(PROGRESS_KEY, text);
      wrote(storage, saved.text, text);
    } catch {
      // The next write from another tab tries again.
    }
  };
  target.addEventListener('storage', listener);
  return () => target.removeEventListener('storage', listener);
}

export function clearProgress(storage = defaultStorage()) {
  try {
    if (!storage) return false;
    storage.removeItem(PROGRESS_KEY);
    recent.delete(storage);
    ownWrites.delete(storage);
    return true;
  } catch {
    return false;
  }
}

export function exportProgress(storage = defaultStorage()) {
  const result = readProgress(storage);
  if (!result.persisted) throw new Error(result.error);
  return JSON.stringify({ version: 1, attempts: result.attempts }, null, 2);
}

export function importProgress(text, storage = defaultStorage(), now = Date.now()) {
  // Parse before touching stored data. A malformed file cannot erase progress.
  const incoming = decode(text, now);
  if (!storage) throw new Error('Browser storage is unavailable.');
  const saved = load(storage, now);
  if (!saved.persisted) throw new Error(saved.error);
  const attempts = normalizeAttempts([...saved.attempts, ...incoming], now);
  const stored = JSON.stringify({ version: 1, attempts });
  storage.setItem(PROGRESS_KEY, stored);
  wrote(storage, saved.text, stored);
  const keys = new Set(saved.attempts.map(key));
  remember(storage, attempts.filter((a) => !keys.has(key(a))));
  const before = new Set(saved.attempts.map(question));
  const counted = firstAttempts(attempts);
  return {
    total: counted.length,
    added: counted.filter((a) => !before.has(question(a))).length,
  };
}

export function summarize(values) {
  const attempts = firstAttempts(values);
  const domains = DOMAINS.map((domain) => ({ ...domain, attempted: 0, correct: 0 }));
  const skills = new Map();
  let correct = 0;
  for (const attempt of attempts) {
    const template = getTemplate(attempt.templateId);
    const domain = domains.find((d) => d.id === template.domain);
    domain.attempted++;
    domain.correct += Number(attempt.correct);
    correct += Number(attempt.correct);
    const skillKey = `${template.domain}|${template.skill}`;
    const skill = skills.get(skillKey) || {
      templateId: template.id,
      name: template.skill,
      domain: template.domain,
      attempted: 0,
      correct: 0,
    };
    skill.attempted++;
    skill.correct += Number(attempt.correct);
    skills.set(skillKey, skill);
  }
  const weakest =
    [...skills.values()]
      .filter((s) => s.correct < s.attempted)
      .sort((a, b) => a.correct / a.attempted - b.correct / b.attempted || b.attempted - a.attempted)[0] ||
    null;
  return {
    attempted: attempts.length,
    correct,
    accuracy: attempts.length ? Math.round((100 * correct) / attempts.length) : null,
    domains,
    weakest,
  };
}
