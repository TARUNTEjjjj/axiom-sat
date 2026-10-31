import { test, assert, assertEqual } from './harness.js';
import { parseSpr, sprEquals } from '../src/questions/spr.js';

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
  assert(sprEquals('.667', '2/3'));
  assert(sprEquals('-0.5', '-1/2'));
  assert(sprEquals('4/6', '2/3'));
  assert(sprEquals('0.384', '5/13'));
  assert(sprEquals('.3846', '5/13'));
});

test('sprEquals rejects wrong and imprecise responses', () => {
  assert(!sprEquals('.67', '2/3'));
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

test('sprEquals allows box-fitted approximations with longer integer parts', () => {
  assert(sprEquals('22.11', '199/9'));
  assert(!sprEquals('22.1', '199/9'));
  assert(sprEquals('1.714', '12/7'));
  assert(!sprEquals('1.71', '12/7'));
  assert(sprEquals('.0312', '1/32'));
  assert(sprEquals('.0313', '1/32'));
  assert(sprEquals('-.0313', '-1/32'));
});
