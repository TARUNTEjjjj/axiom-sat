// Checking what a student typed into a response box.

const RESPONSE = /^-?(\d+\.?\d*|\.\d+|\d+\/\d+)$/;
// Persist bounded editable drafts. Validate complete input rather than using a
// native maxlength that can truncate a pasted fraction into a different number.
export const MAX_SPR_INPUT_LENGTH = 32;

// Whitespace around a fraction bar is harmless, but never join separate digits
// ("1 2" must not become "12"). Share this rule across both answer-entry pages.
export function normalizeSpr(input) {
  return String(input).trim().replace(/−/g, '-').replace(/\s*\/\s*/g, '/');
}

// The numeric value of a typed response, or null when it is not a number.
export function parseSpr(input) {
  const text = normalizeSpr(input);
  if (!RESPONSE.test(text)) return null;
  if (text.includes('/')) {
    const [num, den] = text.split('/').map(Number);
    if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) return null;
    const value = num / den;
    return Number.isFinite(value) ? value : null;
  }
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

// A response counts when it equals the answer, or when it is the answer rounded
// or truncated at the fourth digit typed, as the test allows for a value that does
// not fit the box: .6666, .6667, 0.666 and 0.667 count for 2/3; .667 and .67 do not.
export function sprEquals(input, answer) {
  const text = normalizeSpr(input);
  if (text.replace(/^-/, '').length > 5) return false;
  const a = parseSpr(input);
  const b = parseSpr(answer);
  if (a === null || b === null) return false;
  if (Math.abs(a - b) < 1e-9) return true;
  // An exact terminating decimal that fits must not be rounded away: .062 is
  // not 1/16 (= .0625). Approximation is for values that do not fit the box.
  // College Board directions and examples: assessment-framework-for-digital-
  // sat-suite.pdf, Appendix D (e.g. .6667 and 0.667 for 2/3).
  const exactDecimal = String(Math.abs(b)).replace(/^0\./, '.');
  if (!exactDecimal.includes('e') && exactDecimal.length <= 5) return false;
  const { integerDigits, decimals } = places(text);
  if (decimals < Math.max(0, 4 - integerDigits) || !text.includes('.')) return false;
  return approximates(a, b, decimals);
}

// Four numeric digits fit beside the decimal point, counted in what was typed. A
// leading zero is one of them, so 0.667 has four and .667 only three; larger
// integer parts leave fewer fractional places, and padding zeros (00.67) add none.
function places(text) {
  const [whole, fraction = ''] = text.replace(/^-/, '').split('.');
  return { integerDigits: whole.replace(/^0+(?=\d)/, '').length, decimals: fraction.length };
}

// Whether a is b rounded or truncated to the given number of decimal places.
function approximates(a, b, decimals) {
  const scale = 10 ** decimals;
  const rounded = (Math.sign(b) * Math.round(Math.abs(b) * scale)) / scale;
  const truncated = Math.trunc(b * scale) / scale;
  return Math.abs(a - rounded) < 1e-9 || Math.abs(a - truncated) < 1e-9;
}

// A decimal that rounds or truncates the answer at fewer digits than the box holds,
// such as .667 or .67 for 2/3. It is not accepted, but feedback can say it needs
// more digits instead of only showing the answer.
export function sprTooShort(input, answer) {
  const text = normalizeSpr(input);
  const a = parseSpr(input);
  const b = parseSpr(answer);
  if (a === null || b === null || text.replace(/^-/, '').length > 5 || sprEquals(input, answer)) return false;
  const { integerDigits, decimals } = places(text);
  return decimals > 0 && decimals < 4 - integerDigits && approximates(a, b, decimals);
}
