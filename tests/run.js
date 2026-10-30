// node tests/run.js
// On a Mac without Node, the system JavaScriptCore shell runs it too:
//   /System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc -m tests/run.js
import './all.js';
import { run } from './harness.js';

const log = globalThis.console ? console.log : print;
const { passed, failed, total } = await run(({ name, ok, error }) => {
  log(`${ok ? 'ok  ' : 'FAIL'} ${name}`);
  if (error) log(`     ${error.message}`);
});

log(`\n${passed}/${total} passed${failed ? `, ${failed} failed` : ''}`);
if (globalThis.process) process.exitCode = failed ? 1 : 0;
