import { SESSION_KEY, restoreSession } from './session.js';

// Storage events can wait in a tab's queue. Their payload is a historical
// snapshot, not necessarily the current session. In particular, replaying an
// old completion can write its results over a newer session during rendering.
// The handler also receives the stored text it read.
export function subscribeSessionChanges(target, getStorage, onChange, onError, now = Date.now) {
  const listener = (event) => {
    if (event.key !== SESSION_KEY && event.key !== null) return;
    let raw, next;
    try {
      const storage = getStorage();
      if (event.storageArea !== storage) return;
      raw = storage.getItem(SESSION_KEY);
      next = restoreSession(raw, now());
    } catch {
      onError();
      return;
    }
    onChange(next, raw);
  };
  target.addEventListener('storage', listener);
  return () => target.removeEventListener('storage', listener);
}

// Storage events reach only a running page. One restored from the back/forward
// cache missed them, or has them queued until after pageshow, so its session is
// an old copy. Compare the stored text with what the page last saved or loaded;
// null means nothing changed.
export function readSessionChange(storage, known, now = Date.now()) {
  const raw = storage.getItem(SESSION_KEY);
  return raw === known ? null : { raw, session: restoreSession(raw, now) };
}
