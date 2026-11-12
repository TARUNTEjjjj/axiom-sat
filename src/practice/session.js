// A session stores identities and responses, never a second copy of answer keys.
// Deadlines are wall-clock timestamps so a sleeping or reloaded tab cannot pause time.
import { generate, listTemplates } from '../questions/index.js';
import { createRng } from '../questions/prng.js';
import { MAX_SPR_INPUT_LENGTH, normalizeSpr, parseSpr, sprEquals } from '../questions/spr.js';

// Keep the original key so existing learners can resume after a release.
export const SESSION_KEY = 'axiom.practice.v1';
export const MODES = Object.freeze({
  sprint: {
    name: 'Quick sprint',
    count: 10,
    minutes: 16,
    domains: [4, 3, 2, 1],
  },
  module: {
    name: 'Math module',
    count: 22,
    minutes: 35,
    domains: [8, 8, 3, 3],
  },
});
const DOMAINS = ['algebra', 'advanced', 'psda', 'geometry'];
const MAX_AGE = 30 * 86400000;
const validTime = (n) => Number.isSafeInteger(n) && n > 0;
const validSeed = (n) => Number.isInteger(n) && n >= 0 && n <= 0xffffffff;

export function normalizeCustom(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid custom practice settings');
  const { domain = 'all', difficulty = 0, count = 10 } = value;
  if (
    !['all', ...DOMAINS].includes(domain) ||
    ![0, 1, 2, 3].includes(difficulty) ||
    ![5, 10, 20].includes(count)
  )
    throw new Error('Invalid custom practice settings');
  return { domain, difficulty, count };
}

export function customMinutes(custom) {
  return normalizeCustom(custom).count * 2;
}

export function sessionName(session) {
  if (session.mode === 'custom') return 'Custom practice';
  if (session.mode === 'retry') return 'Retry missed questions';
  return MODES[session.mode]?.name || 'Practice';
}

export function makeQuestions(mode, seed, custom) {
  if (typeof mode !== 'string' || !validSeed(seed)) throw new Error('Invalid practice setup');
  const rng = createRng(seed);
  const questions = [];
  const stems = new Set();
  if (mode === 'custom') {
    const settings = normalizeCustom(custom);
    const pool = rng.shuffle(listTemplates(settings.domain === 'all' ? undefined : settings.domain));
    // Rotate even when a template cannot produce this difficulty. The bound
    // prevents unsupported combinations from hanging the browser.
    const maxAttempts = settings.count * pool.length * 100;
    for (let attempt = 0; questions.length < settings.count && attempt < maxAttempts; attempt++) {
      const item = generate(pool[attempt % pool.length].id, rng.int(0, 0xffffffff));
      if ((settings.difficulty && item.difficulty !== settings.difficulty) || stems.has(item.stem)) continue;
      stems.add(item.stem);
      questions.push(item);
    }
    if (questions.length !== settings.count)
      throw new Error('Not enough questions match this setup. Try mixed difficulty or all domains.');
  } else {
    if (!Object.hasOwn(MODES, mode)) throw new Error('Invalid practice setup');
    const config = MODES[mode];
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
  }
  // Shuffle before sorting so domains are mixed within each difficulty group.
  return rng.shuffle(questions).sort((a, b) => a.difficulty - b.difficulty);
}

function newSession({ mode, seed, timed, now, custom, minutes, items }) {
  return {
    version: 2,
    mode,
    seed,
    custom,
    durationMinutes: minutes,
    timed,
    startedAt: now,
    deadline: timed ? now + minutes * 60000 : null,
    finishedAt: null,
    expired: false,
    progressSaved: false,
    index: 0,
    questions: items.map(({ templateId, seed: questionSeed }) => ({
      templateId,
      seed: questionSeed,
    })),
    responses: items.map(() => ''),
    flags: items.map(() => false),
  };
}

export function createSession({ mode = 'sprint', seed, timed = true, custom, now = Date.now() }) {
  if (!validTime(now) || typeof timed !== 'boolean') throw new Error('Invalid practice setup');
  const settings = mode === 'custom' ? normalizeCustom(custom) : null;
  const items = makeQuestions(mode, seed, settings);
  const minutes = settings ? customMinutes(settings) : MODES[mode].minutes;
  return newSession({
    mode,
    seed,
    timed,
    now,
    custom: settings,
    minutes,
    items,
  });
}

export function sessionItems(session) {
  return session.questions.map(({ templateId, seed }) => generate(templateId, seed));
}

// Retry uses the exact missed identities, not new questions with similar stems.
// It does not erase the first-attempt history kept by the progress module.
export function createRetrySession(source, now = Date.now()) {
  const clean = restoreSession(JSON.stringify(source), now);
  if (!clean || clean.finishedAt === null || !validTime(now))
    throw new Error('Finish a session before retrying');
  const items = gradeSession(clean)
    .rows.filter((row) => !row.correct)
    .map((row) => row.item);
  if (!items.length) throw new Error('There are no missed questions to retry');
  return newSession({
    mode: 'retry',
    seed: clean.seed,
    timed: false,
    now,
    custom: null,
    minutes: null,
    items,
  });
}

// Validate stored identities instead of regenerating the set from today's
// registry. Adding templates must not replace a learner's unfinished questions.
// v1 sessions are upgraded in memory, then saved as v2 by the UI.
export function restoreSession(raw, now = Date.now()) {
  if (typeof raw !== 'string' || raw.length > 20000 || !validTime(now)) return null;
  try {
    const value = JSON.parse(raw);
    if (!value || ![1, 2].includes(value.version) || typeof value.mode !== 'string' || !validSeed(value.seed))
      return null;
    const fixed = Object.hasOwn(MODES, value.mode);
    if (!fixed && (value.version !== 2 || !['custom', 'retry'].includes(value.mode))) return null;
    if (!validTime(value.startedAt) || value.startedAt > now + 60000 || now - value.startedAt > MAX_AGE)
      return null;
    if (typeof value.timed !== 'boolean' || typeof value.expired !== 'boolean') return null;
    if (value.progressSaved != null && typeof value.progressSaved !== 'boolean') return null;
    if (value.mode === 'custom' && (!value.custom || typeof value.custom !== 'object')) return null;
    const custom = value.mode === 'custom' ? normalizeCustom(value.custom) : null;
    if (value.version === 2 && value.mode !== 'custom' && value.custom !== null) return null;
    const minutes = fixed ? MODES[value.mode].minutes : custom ? customMinutes(custom) : null;
    if (value.version === 2 && value.durationMinutes !== minutes) return null;
    if (value.mode === 'retry' && value.timed) return null;
    const deadline = value.timed ? value.startedAt + minutes * 60000 : null;
    if (value.deadline !== deadline) return null;
    if (!Array.isArray(value.questions) || !value.questions.length || value.questions.length > 22)
      return null;
    const count = fixed ? MODES[value.mode].count : custom ? custom.count : value.questions.length;
    if (value.questions.length !== count) return null;
    const questions = value.questions.map((q) => {
      if (!q || typeof q.templateId !== 'string' || !validSeed(q.seed)) throw new Error('Invalid identity');
      return { templateId: q.templateId, seed: q.seed };
    });
    const items = sessionItems({ questions });
    if (
      new Set(items.map((item) => item.id)).size !== count ||
      new Set(items.map((item) => item.stem)).size !== count
    )
      return null;
    if (
      fixed &&
      DOMAINS.some(
        (domain, i) => items.filter((item) => item.domain === domain).length !== MODES[value.mode].domains[i],
      )
    )
      return null;
    if (
      custom &&
      items.some(
        (item) =>
          (custom.domain !== 'all' && item.domain !== custom.domain) ||
          (custom.difficulty && item.difficulty !== custom.difficulty),
      )
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
    if (
      !value.responses.every(
        (response, i) =>
          typeof response === 'string' &&
          response.length <= MAX_SPR_INPUT_LENGTH &&
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
    if (value.expired && (!value.timed || value.finishedAt !== deadline)) return null;
    if (
      value.finishedAt !== null &&
      value.timed &&
      ((!value.expired && value.finishedAt >= deadline) || value.finishedAt > deadline)
    )
      return null;
    if (value.progressSaved && value.finishedAt === null) return null;
    const clean = newSession({
      mode: value.mode,
      seed: value.seed,
      timed: value.timed,
      now: value.startedAt,
      custom,
      minutes,
      items,
    });
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
  return {
    ...session,
    finishedAt: expired ? session.deadline : Math.max(session.startedAt, now),
    expired,
  };
}

export function gradeSession(session) {
  const rows = sessionItems(session).map((item, i) => {
    // An incomplete numeric draft is unanswered, as shown by the navigator.
    // Passing it to the progress batch would reject every valid answer too.
    const draft = session.responses[i].trim();
    const response = responseIsValid(item, draft) ? draft : '';
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
    domains: DOMAINS.map(domain => {
      const matching = rows.filter(row => row.item.domain === domain);
      return {
        domain,
        total: matching.length,
        correct: matching.filter(row => row.correct).length,
        incorrect: matching.filter(row => row.status === 'incorrect').length,
        skipped: matching.filter(row => row.status === 'skipped').length,
      };
    }).filter(domain => domain.total > 0),
    correct: rows.filter((row) => row.correct).length,
    incorrect: rows.filter((row) => row.status === 'incorrect').length,
    skipped: rows.filter((row) => row.status === 'skipped').length,
    total: rows.length,
  };
}

export function responseIsValid(item, response) {
  if (typeof response !== 'string') return false;
  const text = item.type === 'mc' ? response.trim() : normalizeSpr(response);
  if (!text) return true;
  if (item.type === 'mc') return /^[A-D]$/.test(text);
  return text.replace(/^-/, '').length <= 5 && text.length <= 6 && Number.isFinite(parseSpr(text));
}
