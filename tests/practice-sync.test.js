import { test, assertEqual } from './harness.js';
import { SESSION_KEY, createSession, finishSession, sessionItems } from '../src/practice/session.js';
import { readSessionChange, subscribeSessionChanges } from '../src/practice/sync.js';

const NOW = 1793520000000;
function setup(onChange) {
  const listeners = new Set();
  const target = {
    addEventListener: (_, listener) => listeners.add(listener),
    removeEventListener: (_, listener) => listeners.delete(listener),
  };
  let raw = null, failures = 0;
  const storage = { getItem: () => raw, setItem: (_, value) => { raw = value; } };
  const off = subscribeSessionChanges(target, () => storage, onChange, () => failures++, () => NOW);
  return {
    storage, off,
    get failures() { return failures; },
    send(key, newValue, storageArea = storage) {
      for (const listener of listeners) listener({ key, newValue, storageArea });
    },
  };
}

test('queued completion events cannot restore an old result over a newer practice session', () => {
  const old = finishSession(createSession({ seed: 1, now: NOW - 1000, timed: false }), NOW);
  const current = createSession({ seed: 2, now: NOW, timed: false });
  let visible;
  const tab = setup((next) => {
    visible = next;
    // The results view writes a completed session after saving its progress.
    if (next && next.finishedAt !== null) tab.storage.setItem(SESSION_KEY, JSON.stringify(next));
  });
  tab.storage.setItem(SESSION_KEY, JSON.stringify(current));
  tab.send(SESSION_KEY, JSON.stringify(old));
  assertEqual(visible.seed, current.seed);
  assertEqual(visible.finishedAt, null);
  assertEqual(JSON.parse(tab.storage.getItem(SESSION_KEY)).seed, current.seed);
  tab.off();
});

test('queued clear and removal events read the latest replacement instead of erasing the screen', () => {
  const current = createSession({ seed: 3, now: NOW, timed: false });
  let visible;
  const tab = setup((next) => { visible = next; });
  tab.storage.setItem(SESSION_KEY, JSON.stringify(current));
  for (const key of [null, SESSION_KEY]) {
    tab.send(key, null);
    assertEqual(visible.seed, current.seed);
  }
  tab.storage.setItem(SESSION_KEY, null);
  tab.send(SESSION_KEY, JSON.stringify(current));
  assertEqual(visible, null);
  tab.off();
});

test('session sync ignores unrelated storage and unsubscribes without reading it', () => {
  let changes = 0, reads = 0;
  const tab = setup(() => changes++);
  tab.storage.getItem = () => { reads++; return null; };
  tab.send('unrelated', null);
  tab.send(SESSION_KEY, null, {});
  assertEqual(changes, 0);
  assertEqual(reads, 0);
  tab.off();
  tab.send(SESSION_KEY, null);
  assertEqual(changes, 0);
});

test('a page back from the back/forward cache finds the newer session another page saved', () => {
  // Page 1 answered three questions of a sprint, then left for the bank.
  const sprint = createSession({ seed: 4, now: NOW });
  const answers = sessionItems(sprint).map((item) => item.answer);
  const left = JSON.stringify({ ...sprint, responses: answers.map((answer, i) => (i < 3 ? answer : '')) });
  // Page 2 resumed the same sprint and answered the rest; its storage event reached page 1
  // with the stored text it read.
  let adopted;
  const listening = setup((next, raw) => { adopted = raw; });
  listening.storage.setItem(SESSION_KEY, JSON.stringify({ ...sprint, responses: answers }));
  listening.send(SESSION_KEY, null);
  assertEqual(adopted, listening.storage.getItem(SESSION_KEY));
  listening.off();
  // Back after the deadline, page 1 adopts page 2's answers instead of finishing its own copy.
  const change = readSessionChange(listening.storage, left, NOW + 16.5 * 60000);
  assertEqual(change.raw, adopted);
  assertEqual(change.session.responses.filter(Boolean).length, 10);
  assertEqual(change.session.finishedAt, null);
  assertEqual(readSessionChange(listening.storage, adopted, NOW + 16.5 * 60000), null);
  listening.storage.setItem(SESSION_KEY, null);
  assertEqual(JSON.stringify(readSessionChange(listening.storage, left)), '{"raw":null,"session":null}');
});

test('a failed cross-tab read preserves the visible session and reports unavailable storage', () => {
  let changes = 0;
  const tab = setup(() => changes++);
  tab.storage.getItem = () => { throw new Error('Storage disabled'); };
  tab.send(SESSION_KEY, null);
  assertEqual(changes, 0);
  assertEqual(tab.failures, 1);
  tab.off();
});
