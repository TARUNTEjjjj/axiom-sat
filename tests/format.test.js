import { test, assertEqual, assertThrows } from './harness.js';
import {
  MINUS,
  fmtComma,
  fmtFrac,
  fmtLinear,
  fmtMoney,
  fmtNum,
  fmtPct,
  fmtPoly,
  fmtTerm,
  gcd,
  plural,
  sprFrac,
  sprNum,
  sup,
  supVar,
} from '../src/questions/format.js';

test('fmtNum: integers, trimmed decimals, true minus, no negative zero', () => {
  assertEqual(fmtNum(7), '7');
  assertEqual(fmtNum(-7), `${MINUS}7`);
  assertEqual(fmtNum(3.5), '3.5');
  assertEqual(fmtNum(0.1 + 0.2), '0.3');
  assertEqual(fmtNum(1 / 3), '0.3333');
  assertEqual(fmtNum(-0), '0');
  assertThrows(() => fmtNum(NaN));
});

test('fmtComma and fmtMoney group thousands', () => {
  assertEqual(fmtComma(12500), '12,500');
  assertEqual(fmtComma(-1200), `${MINUS}1,200`);
  assertEqual(fmtMoney(1250), '$1,250');
  assertEqual(fmtMoney(3.5), '$3.50');
  assertEqual(fmtPct(12.5), '12.5%');
});

test('gcd and fmtFrac reduce fractions', () => {
  assertEqual(gcd(12, 18), 6);
  assertEqual(gcd(-4, 6), 2);
  assertEqual(fmtFrac(6, -8), `${MINUS}3/4`);
  assertEqual(fmtFrac(4, 2), '2');
  assertEqual(fmtFrac(0, 5), '0');
  assertThrows(() => fmtFrac(1, 0));
});

test('fmtTerm and fmtLinear handle unit and zero coefficients', () => {
  assertEqual(fmtTerm(1), 'x');
  assertEqual(fmtTerm(-1, 'y'), `${MINUS}y`);
  assertEqual(fmtTerm(0), '0');
  assertEqual(fmtLinear(3, 4), '3x + 4');
  assertEqual(fmtLinear(1, -5), `x ${MINUS} 5`);
  assertEqual(fmtLinear(-1, 0), `${MINUS}x`);
  assertEqual(fmtLinear(0, 7), '7');
  assertEqual(fmtLinear(0, -7), `${MINUS}7`);
});

test('fmtPoly writes polynomials from the highest degree down', () => {
  assertEqual(fmtPoly([1, -3, 2]), `x² ${MINUS} 3x + 2`);
  assertEqual(fmtPoly([-2, 0, 5]), `${MINUS}2x² + 5`);
  assertEqual(fmtPoly([0, 2, 1]), '2x + 1');
  assertEqual(fmtPoly([0, 0]), '0');
  assertEqual(sup(12), '¹²');
  assertEqual(supVar('t'), 'ᵗ');
  assertThrows(() => supVar('q'));
});

test('plural picks the right form', () => {
  assertEqual(plural(1, 'hour'), '1 hour');
  assertEqual(plural(3, 'hour'), '3 hours');
  assertEqual(plural(2, 'inch', 'inches'), '2 inches');
});

test('sprNum and sprFrac produce what fits in a response box', () => {
  assertEqual(sprNum(12), '12');
  assertEqual(sprNum(-3), '-3');
  assertEqual(sprNum(2.5), '2.5');
  assertEqual(sprNum(2 / 3), '.6667');
  assertEqual(sprNum(-0.5), '-.5');
  assertThrows(() => sprNum(123456));
  assertEqual(sprFrac(6, 8), '3/4');
  assertEqual(sprFrac(-6, 3), '-2');
  assertEqual(sprFrac(3, -9), '-1/3');
  assertThrows(() => sprFrac(123, 4567));
});
