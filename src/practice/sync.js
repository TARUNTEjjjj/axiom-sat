import { SESSION_KEY, restoreSession } from './session.js';

// Storage events can wait in a tab's queue. Their payload is a historical
// snapshot, not necessarily the current session. In particular, replaying an
// old completion can write its results over a newer session during rendering.
export function subscribeSessionChanges(target, getStorage, onChange, onError, now = Date.now) {
  const listener = (event) => {
    if (event.key !== SESSION_KEY && event.key !== null) return;
    let next;
    try {
      const storage = getStorage();
      if (event.storageArea !== storage) return;
      next = restoreSession(storage.getItem(SESSION_KEY), now());
    } catch {
      onError();
      return;
    }
    onChange(next);
  };
  target.addEventListener('storage', listener);
  return () => target.removeEventListener('storage', listener);
}
