// Checking what a student typed into a response box.

const RESPONSE = /^-?(\d+\.?\d*|\.\d+|\d+\/\d+)$/;

// The numeric value of a typed response, or null when it is not a number.
export function parseSpr(input) {
  const text = String(input).trim().replace(/−/g, '-');
  if (!RESPONSE.test(text)) return null;
  if (text.includes('/')) {
    const [num, den] = text.split('/').map(Number);
    return den === 0 ? null : num / den;
  }
  return Number(text);
}

// A response counts when it equals the answer, or when it is the answer rounded
// or truncated to the decimal places the student typed, as the test allows for a
// value that does not fit the box: .6666, .6667 and .667 all count for 2/3, .67 does not.
export function sprEquals(input, answer) {
  const a = parseSpr(input);
  const b = parseSpr(answer);
  if (a === null || b === null) return false;
  if (Math.abs(a - b) < 1e-9) return true;
  const decimals = (String(input).trim().split('.')[1] || '').length;
  if (decimals < 3) return false;
  const scale = 10 ** decimals;
  const rounded = Math.round(b * scale) / scale;
  const truncated = Math.trunc(b * scale) / scale;
  return Math.abs(a - rounded) < 1e-9 || Math.abs(a - truncated) < 1e-9;
}
