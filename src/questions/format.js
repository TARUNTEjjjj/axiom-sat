// Text formatting for question stems, choices and explanations. Display text uses
// real typographic symbols (a true minus sign, superscript exponents); the spr*
// helpers produce what a student would actually type into a response box.

export const MINUS = '−';
export const TIMES = '×';
export const PI = 'π';
export const DEGREES = '°';

const SUPERSCRIPTS = '⁰¹²³⁴⁵⁶⁷⁸⁹';

export function sup(n) {
  const digits = [...String(Math.abs(n))].map((d) => SUPERSCRIPTS[+d]).join('');
  return n < 0 ? '⁻' + digits : digits;
}

// A variable written as an exponent, for models such as 2,000(1.05)ᵗ.
const SUPERSCRIPT_LETTERS = { t: 'ᵗ', n: 'ⁿ', x: 'ˣ' };

export function supVar(letter) {
  const glyph = SUPERSCRIPT_LETTERS[letter];
  if (!glyph) throw new Error(`supVar: no superscript for ${letter}`);
  return glyph;
}

export function gcd(a, b) {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}

// Integers as-is; decimals trimmed to `digits` places with no trailing zeros.
export function fmtNum(n, digits = 4) {
  if (!Number.isFinite(n)) throw new Error(`fmtNum: ${n} is not a finite number`);
  const magnitude = Number.isInteger(n) ? String(Math.abs(n)) : String(+Math.abs(n).toFixed(digits));
  return n < 0 && magnitude !== '0' ? MINUS + magnitude : magnitude;
}

// Whole numbers with thousands separators: 12,500.
export function fmtComma(n) {
  const magnitude = Math.abs(Math.round(n)).toLocaleString('en-US');
  return n < 0 ? MINUS + magnitude : magnitude;
}

export function fmtMoney(n) {
  const abs = Math.abs(n);
  const magnitude = Number.isInteger(abs)
    ? abs.toLocaleString('en-US')
    : abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (n < 0 ? MINUS : '') + '$' + magnitude;
}

export function fmtPct(n) {
  return fmtNum(n) + '%';
}

// Reduced fraction, or a plain number when the denominator divides out.
export function fmtFrac(num, den) {
  if (den === 0) throw new Error('fmtFrac: zero denominator');
  if (den < 0) [num, den] = [-num, -den];
  const g = gcd(num, den) || 1;
  num /= g;
  den /= g;
  if (den === 1) return fmtNum(num);
  return (num < 0 ? MINUS : '') + Math.abs(num) + '/' + den;
}

// One term: x, −x, 3x, 0.
export function fmtTerm(coef, variable = 'x') {
  if (coef === 0) return '0';
  if (coef === 1) return variable;
  if (coef === -1) return MINUS + variable;
  return fmtNum(coef) + variable;
}

// a·x + b with proper signs: 3x − 5, −x + 2, 4, 2x.
export function fmtLinear(a, b, variable = 'x') {
  if (a === 0) return fmtNum(b);
  if (b === 0) return fmtTerm(a, variable);
  return fmtTerm(a, variable) + (b < 0 ? ` ${MINUS} ` : ' + ') + fmtNum(Math.abs(b));
}

// Coefficients from the highest degree down: fmtPoly([1, -3, 2]) → x² − 3x + 2.
export function fmtPoly(coefs, variable = 'x') {
  const degree = coefs.length - 1;
  let out = '';
  coefs.forEach((c, i) => {
    if (c === 0) return;
    const power = degree - i;
    const magnitude = Math.abs(c);
    const body =
      power === 0
        ? fmtNum(magnitude)
        : (magnitude === 1 ? '' : fmtNum(magnitude)) + variable + (power > 1 ? sup(power) : '');
    if (out === '') out = (c < 0 ? MINUS : '') + body;
    else out += (c < 0 ? ` ${MINUS} ` : ' + ') + body;
  });
  return out || '0';
}

export function plural(n, word, pluralWord = word + 's') {
  return `${fmtNum(n)} ${n === 1 ? word : pluralWord}`;
}

// Student-produced responses hold at most 5 characters (6 with a leading minus).
function fitsResponseBox(text) {
  return text.replace('-', '').length <= 5;
}

export function sprNum(n) {
  if (!Number.isFinite(n)) throw new Error(`sprNum: ${n} is not a finite number`);
  const text = Number.isInteger(n) ? String(n) : String(+n.toFixed(4)).replace(/^(-?)0\./, '$1.');
  if (!fitsResponseBox(text)) throw new Error(`sprNum: ${text} does not fit a response box; use sprFrac`);
  return text;
}

export function sprFrac(num, den) {
  if (den === 0) throw new Error('sprFrac: zero denominator');
  if (den < 0) [num, den] = [-num, -den];
  const g = gcd(num, den) || 1;
  num /= g;
  den /= g;
  const text = den === 1 ? String(num) : `${num}/${den}`;
  if (!fitsResponseBox(text)) throw new Error(`sprFrac: ${text} does not fit a response box`);
  return text;
}
