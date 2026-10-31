// Checking what a student typed into a response box.

const RESPONSE = /^-?(\d+\.?\d*|\.\d+|\d+\/\d+)$/;

// The numeric value of a typed response, or null when it is not a number.
export function parseSpr(input) {
  const text = String(input).trim().replace(/−/g, '-');
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
// or truncated to the decimal places the student typed, as the test allows for a
// value that does not fit the box: .6666, .6667 and .667 all count for 2/3, .67 does not.
export function sprEquals(input, answer) {
  const text = String(input).trim().replace(/−/g, '-');
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
  const decimals = (text.split('.')[1] || '').length;
  // Four numeric digits fit beside the decimal point. A leading zero consumes
  // one of them; larger integer parts leave fewer fractional places.
  const integerDigits = Math.max(1, String(Math.trunc(Math.abs(b))).length);
  if (decimals < Math.max(0, 4 - integerDigits) || !text.includes('.')) return false;
  const scale = 10 ** decimals;
  const rounded = (Math.sign(b) * Math.round(Math.abs(b) * scale)) / scale;
  const truncated = Math.trunc(b * scale) / scale;
  return Math.abs(a - rounded) < 1e-9 || Math.abs(a - truncated) < 1e-9;
}
