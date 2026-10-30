// A tiny test runner that works both in the browser (run.html) and in Node (run.js).

const tests = [];

export function test(name, fn) {
  tests.push({ name, fn });
}

export function assert(condition, message = 'assertion failed') {
  if (!condition) throw new Error(message);
}

export function assertEqual(actual, expected, message) {
  const close =
    typeof actual === 'number' && typeof expected === 'number' && Math.abs(actual - expected) < 1e-9;
  if (!Object.is(actual, expected) && !close) {
    throw new Error(
      `${message ? message + ': ' : ''}expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

export function assertThrows(fn, message = 'expected an error to be thrown') {
  try {
    fn();
  } catch {
    return;
  }
  throw new Error(message);
}

export async function run(report = () => {}) {
  let passed = 0;
  let failed = 0;
  for (const t of tests) {
    try {
      await t.fn();
      passed++;
      report({ name: t.name, ok: true });
    } catch (error) {
      failed++;
      report({ name: t.name, ok: false, error });
    }
  }
  return { passed, failed, total: tests.length };
}
