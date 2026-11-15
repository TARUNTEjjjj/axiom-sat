import { test, assert, assertEqual, assertThrows } from './harness.js';
import { createRng } from '../src/questions/prng.js';
import { makeChoices, notARun, offCenter, pickDistractors } from '../src/questions/choices.js';

test('makeChoices labels A–D and points at the correct text', () => {
  const { choices, answer } = makeChoices(createRng(1), '12', ['10', '14', '6']);
  assertEqual(choices.map((c) => c.key).join(''), 'ABCD');
  assertEqual(choices.find((c) => c.key === answer).text, '12');
  assertEqual(new Set(choices.map((c) => c.text)).size, 4);
});

test('makeChoices rejects duplicate or missing texts', () => {
  assertThrows(() => makeChoices(createRng(1), '12', ['12', '14', '6']));
  assertThrows(() => makeChoices(createRng(1), '12', ['10', '14']));
});

test('pickDistractors uses candidates first and skips the correct value and repeats', () => {
  assertEqual(JSON.stringify(pickDistractors(5, [-5, 5, 6, -5, 7])), '[-5,6,7]');
});

test('pickDistractors ignores non-finite candidates and fills from the fallback', () => {
  assertEqual(JSON.stringify(pickDistractors(5, [NaN, Infinity, -5])), '[-5,6,4]');
  assertEqual(JSON.stringify(pickDistractors(5, [], 2, (k) => 5 * (k + 1))), '[10,0]');
});

test('pickDistractors passes over a value that breaks a rule and keeps looking', () => {
  // 5 would complete the run 2, 3, 4, 5; 9 does not.
  assertEqual(JSON.stringify(pickDistractors(2, [3, 4, 5, 9])), '[3,4,5]');
  assertEqual(JSON.stringify(pickDistractors(2, [3, 4, 5, 9], 3, undefined, notARun(2))), '[3,4,9]');
  // 4 and 1 mirror 6 and 9 about 5, which would leave 5 in the middle of evenly spaced values.
  assertEqual(JSON.stringify(pickDistractors(5, [6, 4, 9, 1], 3, undefined, offCenter(5))), '[6,9,7]');
  // Gap fillers obey the rules too: 24, 23 and 28 are passed over for 25.
  assertEqual(JSON.stringify(pickDistractors(25, [], 3, undefined, offCenter(25), notARun(25))), '[26,27,22]');
});

test('pickDistractors never returns the correct value', () => {
  const rng = createRng(9);
  for (let i = 0; i < 200; i++) {
    const correct = rng.int(-50, 50);
    const out = pickDistractors(correct, [correct, -correct, correct + 1]);
    assertEqual(out.length, 3);
    assert(!out.includes(correct));
  }
});
