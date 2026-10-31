// A session stores identities and responses, never a second copy of answer keys.
// Deadlines are wall-clock timestamps so a sleeping or reloaded tab cannot pause time.
import { generate, listTemplates } from '../questions/index.js';
import { createRng } from '../questions/prng.js';
import { parseSpr, sprEquals } from '../questions/spr.js';

export const SESSION_KEY = 'axiom.practice.v1';
export const MODES = Object.freeze({
  sprint: { name: 'Quick sprint', count: 10, minutes: 16, domains: [4, 3, 2, 1] },
  module: { name: 'Math module', count: 22, minutes: 35, domains: [8, 8, 3, 3] },
});
const DOMAINS = ['algebra', 'advanced', 'psda', 'geometry'];
const MAX_AGE = 30 * 86400000;
const validTime = (n) => Number.isSafeInteger(n) && n > 0;

export function makeQuestions(mode, seed) {
  const config = MODES[mode];
  if (!config || !Number.isInteger(seed) || seed < 0 || seed > 0xffffffff)
    throw new Error('Invalid practice setup');
  const rng = createRng(seed);
  const questions = [];
  const stems = new Set();
  config.domains.forEach((count, index) => {
    const pool = rng.shuffle(listTemplates(DOMAINS[index]));
    for (let i = 0; i < count; i++) {
      let item;
      for (let attempt = 0; attempt < 100; attempt++) {
        item = generate(pool[i % pool.length].id, rng.int(0, 0xffffffff));
        if (!stems.has(item.stem)) break;
      }
      if (stems.has(item.stem)) throw new Error('Could not create distinct questions');
      stems.add(item.stem);
      questions.push(item);
    }
  });
  // Shuffle before sorting so domains are mixed within each difficulty group.
  return rng.shuffle(questions).sort((a, b) => a.difficulty - b.difficulty);
}

export function createSession({ mode = 'sprint', seed, timed = true, now = Date.now() }) {
  if (!validTime(now) || typeof timed !== 'boolean') throw new Error('Invalid practice setup');
  const items = makeQuestions(mode, seed);
  return {
    version: 1,
    mode,
    seed,
    timed,
    startedAt: now,
    deadline: timed ? now + MODES[mode].minutes * 60000 : null,
    finishedAt: null,
    expired: false,
    progressSaved: false,
    index: 0,
    questions: items.map(({ templateId, seed: questionSeed }) => ({ templateId, seed: questionSeed })),
    responses: items.map(() => ''),
    flags: items.map(() => false),
  };
}

export function sessionItems(session) {
  return session.questions.map(({ templateId, seed }) => generate(templateId, seed));
}

// Malformed, stale or future-dated storage is ignored. Only trusted generated IDs
// survive; all markup rendered later comes from our engine rather than storage.
export function restoreSession(raw, now = Date.now()) {
  if (typeof raw !== 'string' || raw.length > 20000 || !validTime(now)) return null;
  try {
    const value = JSON.parse(raw);
    if (!value || value.version !== 1 || !Object.hasOwn(MODES, value.mode)) return null;
    if (!validTime(value.startedAt) || value.startedAt > now + 60000 || now - value.startedAt > MAX_AGE)
      return null;
    if (typeof value.timed !== 'boolean' || typeof value.expired !== 'boolean') return null;
    if (value.progressSaved != null && typeof value.progressSaved !== 'boolean') return null;
    const clean = createSession({
      mode: value.mode,
      seed: value.seed,
      timed: value.timed,
      now: value.startedAt,
    });
    const count = clean.questions.length;
    if (
      value.deadline !== clean.deadline ||
      JSON.stringify(value.questions) !== JSON.stringify(clean.questions)
    )
      return null;
    if (!Number.isInteger(value.index) || value.index < 0 || value.index >= count) return null;
    if (
      !Array.isArray(value.responses) ||
      value.responses.length !== count ||
      !Array.isArray(value.flags) ||
      value.flags.length !== count
    )
      return null;
    const items = sessionItems(clean);
    if (
      !value.responses.every(
        (response, i) =>
          typeof response === 'string' &&
          response.length <= 6 &&
          (response === '' || (items[i].type === 'mc' ? /^[A-D]$/.test(response) : true)),
      )
    )
      return null;
    if (!value.flags.every((flag) => typeof flag === 'boolean')) return null;
    if (
      value.finishedAt !== null &&
      (!validTime(value.finishedAt) || value.finishedAt < value.startedAt || value.finishedAt > now + 60000)
    )
      return null;
    if (value.expired && (!value.timed || value.finishedAt !== value.deadline)) return null;
    return {
      ...clean,
      index: value.index,
      responses: [...value.responses],
      flags: [...value.flags],
      finishedAt: value.finishedAt,
      expired: value.expired,
      progressSaved: value.progressSaved === true,
    };
  } catch {
    return null;
  }
}

export function remainingSeconds(session, now = Date.now()) {
  return session.timed ? Math.max(0, Math.ceil((session.deadline - now) / 1000)) : null;
}

export function finishSession(session, now = Date.now()) {
  if (session.finishedAt !== null) return session;
  const expired = session.timed && now >= session.deadline;
  return { ...session, finishedAt: expired ? session.deadline : Math.max(session.startedAt, now), expired };
}

export function gradeSession(session) {
  const rows = sessionItems(session).map((item, i) => {
    const response = session.responses[i].trim();
    const correct =
      response !== '' && (item.type === 'mc' ? response === item.answer : sprEquals(response, item.answer));
    return {
      item,
      response,
      correct,
      status: response === '' ? 'skipped' : correct ? 'correct' : 'incorrect',
      flagged: session.flags[i],
    };
  });
  return {
    rows,
    correct: rows.filter((row) => row.correct).length,
    incorrect: rows.filter((row) => row.status === 'incorrect').length,
    skipped: rows.filter((row) => row.status === 'skipped').length,
    total: rows.length,
  };
}

export function responseIsValid(item, response) {
  if (typeof response !== 'string') return false;
  const text = response.trim().replace(/−/g, '-');
  if (!text) return true;
  if (item.type === 'mc') return /^[A-D]$/.test(text);
  return text.replace(/^-/, '').length <= 5 && text.length <= 6 && Number.isFinite(parseSpr(text));
}
