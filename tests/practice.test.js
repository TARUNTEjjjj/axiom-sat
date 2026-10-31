import { test, assert, assertEqual, assertThrows } from './harness.js';
import {
  MODES,
  makeQuestions,
  createSession,
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
      s.version = 2;
    },
    (s) => {
      s.mode = '__proto__';
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
      s.questions[0].seed++;
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
