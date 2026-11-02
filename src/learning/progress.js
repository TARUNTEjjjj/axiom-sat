// Browser-local learning history. Only first attempts on the most recent 500
// distinct template/seed pairs count; the answer is rechecked when data is read.
import { DOMAINS, generate, getTemplate } from '../questions/index.js';
import { parseSpr, sprEquals } from '../questions/spr.js';
import { isSprAnswer } from '../questions/schema.js';

export const PROGRESS_KEY = 'axiom.progress.v1';
export const MAX_ATTEMPTS = 500;
export const MAX_BACKUP_BYTES = 256 * 1024;
const EARLIEST = Date.UTC(2020, 0, 1);

function defaultStorage() {
  try {
    return globalThis.localStorage || null;
  } catch {
    return null;
  }
}

function key(attempt) {
  return `${attempt.templateId}#${attempt.seed}`;
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
  if (!Number.isInteger(value.at) || value.at < EARLIEST || value.at > now + 300_000) return null;
  if (typeof value.response !== 'string' || value.response.length > 64) return null;
  const response = value.response.trim().replace(/−/g, '-');
  if (!response) return null;
  try {
    const item = generate(value.templateId, value.seed);
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

function decode(text, now) {
  if (typeof text !== 'string' || text.length > MAX_BACKUP_BYTES) throw new Error('Backup is too large.');
  const data = JSON.parse(text);
  if (!data || data.version !== 1 || !Array.isArray(data.attempts) || data.attempts.length > MAX_ATTEMPTS) {
    throw new Error('This is not an Axiom progress backup.');
  }
  const attempts = normalizeAttempts(data.attempts, now);
  if (attempts.length !== data.attempts.length)
    throw new Error('Backup contains invalid or repeated questions.');
  return attempts;
}

export function readProgress(storage = defaultStorage(), now = Date.now()) {
  if (!storage) return { attempts: [], persisted: false, error: 'Browser storage is unavailable.' };
  try {
    const text = storage.getItem(PROGRESS_KEY);
    return { attempts: text === null ? [] : decode(text, now), persisted: true };
  } catch {
    return {
      attempts: [],
      persisted: false,
      error:
        'Saved progress could not be read. Reset it here to start fresh before restoring a valid backup.',
    };
  }
}

export function recordAttempt(value, storage = defaultStorage()) {
  const attempt = normalizeAttempt(value && { ...value, at: value.at ?? Date.now() });
  if (!attempt) return { recorded: false, persisted: false, reason: 'invalid' };
  const saved = readProgress(storage);
  if (!saved.persisted) return { recorded: false, persisted: false, reason: 'storage' };
  if (saved.attempts.some((a) => key(a) === key(attempt))) {
    return { recorded: false, persisted: true, reason: 'duplicate' };
  }
  try {
    const attempts = normalizeAttempts([...saved.attempts, attempt]);
    storage.setItem(PROGRESS_KEY, JSON.stringify({ version: 1, attempts }));
    return { recorded: true, persisted: true };
  } catch {
    return { recorded: false, persisted: false, reason: 'storage' };
  }
}

export function clearProgress(storage = defaultStorage()) {
  try {
    if (!storage) return false;
    storage.removeItem(PROGRESS_KEY);
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
  const saved = readProgress(storage, now);
  if (!saved.persisted) throw new Error(saved.error);
  const attempts = normalizeAttempts([...saved.attempts, ...incoming], now);
  storage.setItem(PROGRESS_KEY, JSON.stringify({ version: 1, attempts }));
  return {
    total: attempts.length,
    added: attempts.filter((a) => !saved.attempts.some((old) => key(old) === key(a))).length,
  };
}

export function summarize(attempts) {
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
