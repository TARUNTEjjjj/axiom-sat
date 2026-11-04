import { test, assertEqual } from './harness.js';
import { SESSION_KEY, createSession, finishSession } from '../src/practice/session.js';
import { subscribeSessionChanges } from '../src/practice/sync.js';

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

test('a failed cross-tab read preserves the visible session and reports unavailable storage', () => {
  let changes = 0;
  const tab = setup(() => changes++);
  tab.storage.getItem = () => { throw new Error('Storage disabled'); };
  tab.send(SESSION_KEY, null);
  assertEqual(changes, 0);
  assertEqual(tab.failures, 1);
  tab.off();
});
