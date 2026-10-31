import { test, assert, assertEqual, assertThrows } from './harness.js';
import {
  MODES,
  makeQuestions,
  createSession,
  createRetrySession,
  normalizeCustom,
  customMinutes,
  sessionName,
  restoreSession,
  sessionItems,
  remainingSeconds,
  finishSession,
  gradeSession,
  responseIsValid,
} from '../src/practice/session.js';

const NOW = 1793520000000;
const fresh = (options = {}) => createSession({ seed: 42, now: NOW, ...options });

test('practice generates deterministic, distinct, difficulty-ordered questions', () => {
  for (const mode of Object.keys(MODES)) {
    for (const seed of [0, 1, 42, 0xffffffff]) {
      const items = makeQuestions(mode, seed);
      assertEqual(items.length, MODES[mode].count);
      assertEqual(new Set(items.map((item) => item.stem)).size, items.length);
      assertEqual(JSON.stringify(items), JSON.stringify(makeQuestions(mode, seed)));
      assert(items.every((item, i) => i === 0 || item.difficulty >= items[i - 1].difficulty));
    }
  }
});

test('module and sprint include the planned four-domain coverage', () => {
  for (const mode of Object.keys(MODES)) {
    const items = makeQuestions(mode, 9);
    ['algebra', 'advanced', 'psda', 'geometry'].forEach((domain, i) => {
      assertEqual(items.filter((item) => item.domain === domain).length, MODES[mode].domains[i]);
    });
  }
});

test('invalid mode, seed, time and timer settings cannot create a session', () => {
  for (const seed of [-1, 0x100000000, NaN, 1.1, '42', null]) assertThrows(() => fresh({ seed }));
  assertThrows(() => fresh({ mode: 'full-test' }));
  assertThrows(() => fresh({ mode: ['sprint'] }));
  assertThrows(() => fresh({ timed: 'yes' }));
  assertThrows(() => fresh({ now: NaN }));
});

test('wall-clock timer survives reload and hidden elapsed time', () => {
  const session = fresh({ mode: 'module' });
  assertEqual(remainingSeconds(session, NOW), 35 * 60);
  const restored = restoreSession(JSON.stringify(session), NOW + 600000);
  assertEqual(remainingSeconds(restored, NOW + 600000), 25 * 60);
  assertEqual(remainingSeconds(restored, NOW + 2100001), 0);
  assertEqual(finishSession(restored, NOW + 5000000).finishedAt, session.deadline);
  assertEqual(finishSession(restored, NOW + 5000000).expired, true);
});

test('untimed sessions have no deadline and finish without expiry', () => {
  const session = fresh({ timed: false });
  assertEqual(session.deadline, null);
  assertEqual(remainingSeconds(session, NOW + 86400000), null);
  assertEqual(finishSession(session, NOW + 86400000).expired, false);
});

test('finish is idempotent and preserves the first submission time', () => {
  const finished = finishSession(fresh(), NOW + 5000);
  assertEqual(finishSession(finished, NOW + 10000), finished);
  assertEqual(finished.expired, false);
  assertEqual(finished.finishedAt, NOW + 5000);
});

test('session restore retains answers, navigation and flags without answers embedded', () => {
  const session = fresh();
  const items = sessionItems(session);
  session.responses[0] = items[0].answer;
  session.index = 3;
  session.flags[3] = true;
  assertEqual(JSON.stringify(restoreSession(JSON.stringify(session), NOW + 3000)), JSON.stringify(session));
  assert(!Object.hasOwn(session.questions[0], 'answer'));
});

test('session restore rejects malformed, oversized, future and expired storage', () => {
  for (const input of [null, 'null', '{bad}', '{}', 'x'.repeat(20001)])
    assertEqual(restoreSession(input, NOW), null);
  assertEqual(restoreSession(JSON.stringify(fresh({ now: NOW + 120000 })), NOW), null);
  assertEqual(restoreSession(JSON.stringify(fresh()), NOW + 31 * 86400000), null);
});

test('session restore rejects forged identities, timing, indexes and answers', () => {
  const mutations = [
    (s) => {
      s.version = 3;
    },
    (s) => {
      s.mode = '__proto__';
    },
    (s) => {
      s.mode = ['sprint'];
    },
    (s) => {
      s.deadline += 1;
    },
    (s) => {
      s.index = -1;
    },
    (s) => {
      s.index = 10;
    },
    (s) => {
      s.questions[0].seed = -1;
    },
    (s) => {
      s.questions.pop();
    },
    (s) => {
      s.responses[0] = 'x'.repeat(7);
    },
    (s) => {
      s.responses = [];
    },
    (s) => {
      s.flags[0] = 'yes';
    },
    (s) => {
      s.finishedAt = NOW - 1;
    },
    (s) => {
      s.finishedAt = NOW + 120000;
    },
    (s) => {
      s.expired = true;
    },
  ];
  for (const mutate of mutations) {
    const session = fresh();
    mutate(session);
    assertEqual(restoreSession(JSON.stringify(session), NOW + 1000), null);
  }
});

test('grading separates unanswered from incorrect and checks numeric equivalence', () => {
  const session = fresh({ mode: 'module' });
  const items = sessionItems(session);
  session.responses = items.map((item) => item.answer);
  assertEqual(gradeSession(session).correct, 22);
  session.responses[0] = '';
  const mcIndex = items.findIndex((item, i) => i !== 0 && item.type === 'mc');
  session.responses[mcIndex] = ['A', 'B', 'C', 'D'].find((key) => key !== items[mcIndex].answer);
  const graded = gradeSession(session);
  assertEqual(graded.correct, 20);
  assertEqual(graded.incorrect, 1);
  assertEqual(graded.skipped, 1);
  assertEqual(graded.total, 22);
});

test('draft numeric responses need valid bounded notation before counting as answered', () => {
  const numeric = { type: 'spr' };
  for (const input of ['', '3', '-3', '7/2', '.6667', '-.6667']) assert(responseIsValid(numeric, input));
  for (const input of ['1/', '1/0', 'hello', 'Infinity', '123456', '-123456', '2+2'])
    assert(!responseIsValid(numeric, input));
  assert(responseIsValid({ type: 'mc' }, 'A'));
  assert(!responseIsValid({ type: 'mc' }, 'E'));
});

test('custom practice honors every domain, difficulty and length combination', () => {
  for (const domain of ['all', 'algebra', 'advanced', 'psda', 'geometry']) {
    for (const difficulty of [0, 1, 2, 3]) {
      for (const count of [5, 10, 20]) {
        const custom = { domain, difficulty, count };
        const session = fresh({ mode: 'custom', custom });
        const items = sessionItems(session);
        assertEqual(items.length, count);
        assert(items.every((item) => domain === 'all' || item.domain === domain));
        assert(items.every((item) => !difficulty || item.difficulty === difficulty));
        assertEqual(new Set(items.map((item) => item.stem)).size, count);
        assertEqual(session.durationMinutes, count * 2);
        assertEqual(remainingSeconds(session, NOW), count * 120);
        assertEqual(JSON.stringify(restoreSession(JSON.stringify(session), NOW)), JSON.stringify(session));
      }
    }
  }
});

test('custom sampling is reproducible and rejects invalid configuration', () => {
  const custom = { domain: 'advanced', difficulty: 3, count: 20 };
  assertEqual(
    JSON.stringify(makeQuestions('custom', 7, custom)),
    JSON.stringify(makeQuestions('custom', 7, custom)),
  );
  for (const value of [
    null,
    [],
    'all',
    { domain: '__proto__' },
    { difficulty: '3' },
    { difficulty: 4 },
    { count: 22 },
    { count: 0 },
  ]) {
    assertThrows(() => normalizeCustom(value));
    assertThrows(() => fresh({ mode: 'custom', custom: value }));
  }
  assertEqual(customMinutes({ count: 5 }), 10);
  assertEqual(sessionName(fresh({ mode: 'custom' })), 'Custom practice');
});

test('legacy v1 sessions retain stored question identities, drafts, flags and deadlines', () => {
  const legacy = fresh({ mode: 'module' });
  legacy.version = 1;
  delete legacy.custom;
  delete legacy.durationMinutes;
  // A saved ordering is preserved even when today's generator catalog/order changes.
  legacy.questions.reverse();
  legacy.index = 5;
  legacy.flags[5] = true;
  const numeric = sessionItems(legacy).findIndex((item) => item.type === 'spr');
  legacy.responses[numeric] = '1/';
  const restored = restoreSession(JSON.stringify(legacy), NOW + 1000);
  assert(restored);
  assertEqual(restored.version, 2);
  assertEqual(JSON.stringify(restored.questions), JSON.stringify(legacy.questions));
  assertEqual(restored.responses[numeric], '1/');
  assertEqual(restored.flags[5], true);
  assertEqual(restored.index, 5);
  assertEqual(restored.deadline, legacy.deadline);
  assertEqual(restored.durationMinutes, 35);
});

test('restore rejects invalid custom metadata, duplicate identities and wrong domain distributions', () => {
  const mutations = [
    (s) => {
      s.durationMinutes++;
    },
    (s) => {
      s.custom.difficulty = 2;
    },
    (s) => {
      s.custom.count = 5;
    },
    (s) => {
      s.custom.domain = 'geometry';
    },
    (s) => {
      s.custom = null;
    },
    (s) => {
      s.questions[1] = { ...s.questions[0] };
    },
    (s) => {
      s.questions[0].templateId = 'advanced.unknown';
    },
    (s) => {
      s.questions[0].seed = 0x100000000;
    },
    (s) => {
      s.progressSaved = true;
    },
  ];
  for (const mutate of mutations) {
    const session = fresh({
      mode: 'custom',
      custom: { domain: 'advanced', difficulty: 3, count: 10 },
    });
    mutate(session);
    assertEqual(restoreSession(JSON.stringify(session), NOW), null);
  }
  const fixed = fresh();
  const advanced = fresh({
    mode: 'custom',
    custom: { domain: 'advanced', count: 10 },
  });
  fixed.questions = advanced.questions;
  assertEqual(restoreSession(JSON.stringify(fixed), NOW), null);
});

test('retry contains exactly the incorrect and skipped identities with blank answers and no timer', () => {
  const source = fresh({
    mode: 'custom',
    custom: { domain: 'advanced', difficulty: 3, count: 5 },
  });
  const items = sessionItems(source);
  source.responses[0] = items[0].answer;
  source.responses[1] =
    items[1].type === 'mc' ? ['A', 'B', 'C', 'D'].find((key) => key !== items[1].answer) : '99999';
  source.flags[2] = true;
  const finished = finishSession(source, NOW + 5000);
  const before = JSON.stringify(finished);
  const retry = createRetrySession(finished, NOW + 10000);
  assertEqual(retry.mode, 'retry');
  assertEqual(retry.questions.length, 4);
  assertEqual(JSON.stringify(retry.questions), JSON.stringify(source.questions.slice(1)));
  assertEqual(retry.timed, false);
  assertEqual(retry.deadline, null);
  assertEqual(retry.finishedAt, null);
  assertEqual(retry.index, 0);
  assert(retry.responses.every((response) => response === ''));
  assert(retry.flags.every((flag) => flag === false));
  assertEqual(retry.progressSaved, false);
  assertEqual(JSON.stringify(finished), before);
  assertEqual(JSON.stringify(restoreSession(JSON.stringify(retry), NOW + 11000)), JSON.stringify(retry));
  retry.responses[0] = sessionItems(retry)[0].answer;
  const next = createRetrySession(finishSession(retry, NOW + 15000), NOW + 20000);
  assertEqual(next.questions.length, 3);
  assertEqual(sessionName(retry), 'Retry missed questions');
});

test('retry requires a finished valid session and at least one missed question', () => {
  assertThrows(() => createRetrySession(fresh(), NOW + 1000));
  const perfect = fresh();
  perfect.responses = sessionItems(perfect).map((item) => item.answer);
  assertThrows(() => createRetrySession(finishSession(perfect, NOW + 1000), NOW + 2000));
  const retry = createRetrySession(finishSession(fresh(), NOW + 1000), NOW + 2000);
  retry.timed = true;
  retry.deadline = NOW + 60000;
  assertEqual(restoreSession(JSON.stringify(retry), NOW + 3000), null);
});

test('restore rejects finished timer states that contradict their deadline', () => {
  for (const mutation of [
    (s) => {
      s.finishedAt = s.deadline + 1;
      s.expired = false;
    },
    (s) => {
      s.finishedAt = s.deadline;
      s.expired = false;
    },
    (s) => {
      s.finishedAt = s.deadline - 1;
      s.expired = true;
    },
  ]) {
    const session = fresh();
    mutation(session);
    assertEqual(restoreSession(JSON.stringify(session), NOW + 20 * 60000), null);
  }
});

// Captured from the pre-expansion HEAD implementation with its original 19-template catalog.
// This fixture must never be regenerated by the current sampler.
const LEGACY_V1_FIXTURE = {
  version: 1,
  mode: 'module',
  seed: 42,
  timed: true,
  startedAt: 1793520000000,
  deadline: 1793522100000,
  finishedAt: null,
  expired: false,
  progressSaved: false,
  index: 5,
  questions: [
    {
      templateId: 'advanced.expressions',
      seed: 16505353,
    },
    {
      templateId: 'advanced.function-values',
      seed: 2622596789,
    },
    {
      templateId: 'advanced.expressions',
      seed: 135454488,
    },
    {
      templateId: 'psda.center',
      seed: 2277774085,
    },
    {
      templateId: 'advanced.nonlinear-models',
      seed: 3596336860,
    },
    {
      templateId: 'psda.probability',
      seed: 743051824,
    },
    {
      templateId: 'geometry.right-triangles',
      seed: 1932287441,
    },
    {
      templateId: 'algebra.inequalities',
      seed: 2261697747,
    },
    {
      templateId: 'geometry.angles-triangles',
      seed: 160800198,
    },
    {
      templateId: 'algebra.line-two-points',
      seed: 3788413843,
    },
    {
      templateId: 'algebra.line-two-points',
      seed: 1173505300,
    },
    {
      templateId: 'algebra.inequalities',
      seed: 1073414265,
    },
    {
      templateId: 'algebra.linear-functions',
      seed: 2683257857,
    },
    {
      templateId: 'geometry.area-volume',
      seed: 1372077750,
    },
    {
      templateId: 'algebra.systems',
      seed: 3717185310,
    },
    {
      templateId: 'advanced.line-parabola',
      seed: 2948976162,
    },
    {
      templateId: 'advanced.line-parabola',
      seed: 219942124,
    },
    {
      templateId: 'algebra.linear-one-var',
      seed: 2028586305,
    },
    {
      templateId: 'algebra.linear-one-var',
      seed: 750819978,
    },
    {
      templateId: 'advanced.function-values',
      seed: 2544012168,
    },
    {
      templateId: 'psda.linear-model',
      seed: 116495015,
    },
    {
      templateId: 'advanced.quadratic-roots',
      seed: 2021992966,
    },
  ],
  responses: ['B', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
  flags: [
    false,
    false,
    false,
    false,
    false,
    true,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
  ],
};

test('original production v1 session resumes after the template catalog expands', () => {
  const restored = restoreSession(JSON.stringify(LEGACY_V1_FIXTURE), NOW + 1000);
  assert(restored);
  assertEqual(restored.version, 2);
  assertEqual(JSON.stringify(restored.questions), JSON.stringify(LEGACY_V1_FIXTURE.questions));
  assertEqual(JSON.stringify(restored.responses), JSON.stringify(LEGACY_V1_FIXTURE.responses));
  assertEqual(JSON.stringify(restored.flags), JSON.stringify(LEGACY_V1_FIXTURE.flags));
  assertEqual(restored.index, 5);
  assertEqual(restored.deadline, LEGACY_V1_FIXTURE.deadline);
  assertEqual(gradeSession(restored).correct, 1);
});
