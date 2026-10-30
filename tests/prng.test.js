import { test, assert, assertEqual, assertThrows } from './harness.js';
import { createRng, hashSeed } from '../src/questions/prng.js';

test('createRng: the same seed gives the same sequence', () => {
  const a = createRng(42);
  const b = createRng(42);
  for (let i = 0; i < 50; i++) assertEqual(a.next(), b.next());
});

test('createRng: different seeds give different sequences', () => {
  const a = createRng(1);
  const b = createRng(2);
  assert(a.next() !== b.next());
});

test('rng.int covers the whole range, both ends included', () => {
  const rng = createRng(3);
  const seen = new Set();
  for (let i = 0; i < 2000; i++) {
    const v = rng.int(-2, 2);
    assert(v >= -2 && v <= 2 && Number.isInteger(v), `out of range: ${v}`);
    seen.add(v);
  }
  assertEqual(seen.size, 5);
  assertThrows(() => rng.int(5, 1));
});

test('rng.nonzero never returns zero', () => {
  const rng = createRng(4);
  for (let i = 0; i < 500; i++) assert(rng.nonzero(-3, 3) !== 0);
});

test('rng.shuffle returns a permutation and leaves the input alone', () => {
  const rng = createRng(5);
  const input = [1, 2, 3, 4, 5, 6];
  const out = rng.shuffle(input);
  assertEqual(JSON.stringify(input), '[1,2,3,4,5,6]');
  assertEqual(JSON.stringify([...out].sort()), '[1,2,3,4,5,6]');
});

test('rng.pick throws on an empty array', () => {
  assertThrows(() => createRng(6).pick([]));
});

test('hashSeed is stable and sensitive to its input', () => {
  assertEqual(hashSeed('axiom'), hashSeed('axiom'));
  assert(hashSeed('axiom') !== hashSeed('axiom '));
  assert(Number.isInteger(hashSeed('')) && hashSeed('') >= 0);
});
