import { test, assert, assertEqual } from './harness.js';
import { normalizeSpr, parseSpr, sprEquals, sprTooShort } from '../src/questions/spr.js';

test('fraction spacing is accepted without merging separate digits', () => {
  assertEqual(normalizeSpr(' −1 / 2 '), '-1/2');
  assertEqual(parseSpr('1 / 2'), 0.5);
  assert(sprEquals('1 / 2', '.5'));
  assert(sprEquals('12 / 34', '6/17'));
  assert(!sprEquals('12 / 34', '4'));
  const spaced = '12' + ' '.repeat(28) + '/34';
  assert(sprEquals(spaced, '6/17'));
  assert(!sprEquals(spaced, '4'));
  for (const text of ['1 2', '1 2 / 3', '1 .5', '1 / 2 / 3']) {
    assertEqual(parseSpr(normalizeSpr(text)), null);
    assert(!sprEquals(text, '12'));
  }
});

test('parseSpr reads integers, decimals and fractions', () => {
  assertEqual(parseSpr('12'), 12);
  assertEqual(parseSpr(' -3 '), -3);
  assertEqual(parseSpr('.5'), 0.5);
  assertEqual(parseSpr('7/2'), 3.5);
  assertEqual(parseSpr('-7/2'), -3.5);
  assertEqual(parseSpr('−4'), -4);
});

test('parseSpr returns null for anything that is not a number', () => {
  for (const bad of ['', 'x', '1/0', '3,5', '1 2', '2/', '/2', '1.2.3'])
    assertEqual(parseSpr(bad), null, bad);
});

test('sprEquals accepts equivalent and box-fitted forms of the answer', () => {
  assert(sprEquals('3.5', '7/2'));
  assert(sprEquals('7/2', '3.5'));
  assert(sprEquals('.6666', '2/3'));
  assert(sprEquals('.6667', '2/3'));
  assert(sprEquals('0.666', '2/3'));
  assert(sprEquals('-0.5', '-1/2'));
  assert(sprEquals('4/6', '2/3'));
  assert(sprEquals('0.384', '5/13'));
  assert(sprEquals('.3846', '5/13'));
});

test('sprEquals rejects wrong and imprecise responses', () => {
  assert(!sprEquals('.67', '2/3'));
  assert(!sprEquals('.667', '2/3'));
  assert(!sprEquals('0.38', '5/13'));
  assert(!sprEquals('1.999', '2'));
  assert(!sprEquals('3', '7/2'));
  assert(!sprEquals('abc', '7/2'));
  assert(!sprEquals('', '0'));
});

test('parseSpr rejects numeric overflow and non-finite fractional components', () => {
  const huge = '9'.repeat(400);
  for (const text of [huge, `${huge}/1`, `1/${huge}`, `${huge}/${huge}`]) {
    assertEqual(parseSpr(text), null);
  }
});

test('sprEquals enforces the response box even for equivalent values', () => {
  assert(!sprEquals('000001', '1'));
  assert(!sprEquals('0.6667', '2/3'));
  assert(!sprEquals('-0.6667', '-2/3'));
  assert(sprEquals('0.667', '2/3'));
  assert(sprEquals('-.6667', '-2/3'));
});

test('sprEquals does not round exact decimals that fit in the box', () => {
  assert(sprEquals('.0625', '1/16'));
  assert(!sprEquals('.062', '1/16'));
  assert(!sprEquals('.063', '1/16'));
  assert(!sprEquals('.000', '.0001'));
  assert(!sprEquals('.125', '.1245'));
});

// The College Board's examples for a decimal that does not fit: round or truncate at
// the fourth digit, where a typed leading zero is one of the four.
test('sprEquals needs four typed digits, counting a leading zero, when a decimal does not fit', () => {
  for (const ok of ['2/3', '.6666', '.6667', '0.666', '0.667']) assert(sprEquals(ok, '2/3'), ok);
  for (const bad of ['0.66', '.66', '0.67', '.67', '.666', '.667', '00.67']) assert(!sprEquals(bad, '2/3'), bad);
  for (const ok of ['-1/3', '-.3333', '-0.333']) assert(sprEquals(ok, '-1/3'), ok);
  for (const bad of ['-.333', '-.33', '-0.33']) assert(!sprEquals(bad, '-1/3'), bad);
  // Generated keys: conditional probability (7/17), right-triangle trigonometry (5/13).
  for (const ok of ['.4117', '.4118', '0.411', '0.412']) assert(sprEquals(ok, '7/17'), ok);
  for (const bad of ['.411', '.412']) assert(!sprEquals(bad, '7/17'), bad);
  for (const ok of ['.3846', '0.384', '0.385']) assert(sprEquals(ok, '5/13'), ok);
  for (const bad of ['.384', '.385']) assert(!sprEquals(bad, '5/13'), bad);
  assert(sprEquals('0.031', '1/32'));
  assert(!sprEquals('.031', '1/32'));
  assert(!sprEquals('01.71', '12/7'));
});

test('sprTooShort spots a right decimal typed with too few digits, so feedback can say so', () => {
  for (const [short, answer] of [
    ['.667', '2/3'], ['.666', '2/3'], ['.67', '2/3'], ['0.67', '2/3'], ['.6', '2/3'], ['-.667', '-2/3'],
    ['.412', '7/17'], ['1.71', '12/7'], ['01.71', '12/7'], ['22.1', '199/9'], ['.063', '1/16'],
  ])
    assert(sprTooShort(short, answer), `${short} for ${answer}`);
  // Accepted, wrong, not a decimal, or too long for the box.
  for (const [other, answer] of [
    ['.6667', '2/3'], ['0.667', '2/3'], ['.668', '2/3'], ['.5', '2/3'], ['1', '2/3'], ['2/3', '2/3'],
    ['.66667', '2/3'], ['6.9', '7'], ['7.', '7'], ['bad', '2/3'],
  ])
    assert(!sprTooShort(other, answer), `${other} for ${answer}`);
});

test('sprEquals allows box-fitted approximations with longer integer parts', () => {
  assert(sprEquals('22.11', '199/9'));
  assert(!sprEquals('22.1', '199/9'));
  assert(sprEquals('1.714', '12/7'));
  assert(!sprEquals('1.71', '12/7'));
  assert(sprEquals('.0312', '1/32'));
  assert(sprEquals('.0313', '1/32'));
  assert(sprEquals('-.0313', '-1/32'));
});
