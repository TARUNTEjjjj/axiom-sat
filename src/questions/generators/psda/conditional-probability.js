import { fmtFrac, sprFrac } from '../../format.js';
import { parseSpr } from '../../spr.js';

export default {
  id: 'psda.conditional-probability',
  domain: 'psda',
  skill: 'Conditional probability with an unknown table entry',
  // Count only the numerator = 1 subset, avoiding duplicate equivalent rates.
  space: 71 * 31 * 4 * 11,
  generate(rng) {
    const a = rng.int(20, 90);
    const b = rng.int(10, 40);
    const numerator = rng.int(1, 4);
    const remainder = rng.int(1, 4);
    const scale = rng.int(2, 12);
    const c = numerator * scale;
    const missing = remainder * scale;
    const rate = fmtFrac(numerator, numerator + remainder);
    return {
      item: {
        type: 'spr',
        difficulty: 3,
        stem: `A study records whether participants in programs A and B completed a course. Program A has ${a} completers and ${b} non-completers; program B has ${c} completers. A randomly selected participant from program B completed the course with probability ${rate}. If one participant is selected uniformly at random from all participants who did not complete the course, what is the probability that this participant was in program B?`,
        table: {
          caption: 'Participants by program and course completion',
          headers: ['Program', 'Completed', 'Did not complete'],
          rows: [
            ['A', String(a), String(b)],
            ['B', String(c), '?'],
          ],
        },
        answer: sprFrac(missing, b + missing),
        explanation: `Let x be the number of program B participants who did not complete the course. The given probability uses only program B: ${c}/(${c} + x) = ${rate}. Cross-multiplication gives (${numerator + remainder})(${c}) = (${numerator})(${c} + x), so x = ${missing}. For the requested probability, the sample space changes to all non-completers. There are ${b} + ${missing} = ${b + missing} of them, and ${missing} are in B. The probability is ${missing}/${b + missing} = ${fmtFrac(missing, b + missing)}.`,
      },
      params: { a, b, c, rateNumerator: numerator, rateDenominator: numerator + remainder },
    };
  },
  verify({ item, params: { b, c, rateNumerator, rateDenominator } }) {
    const probability = parseSpr(item.answer);
    const missing = (c * rateDenominator) / rateNumerator - c;
    return Number.isInteger(missing) && missing > 0 && Math.abs(probability * (b + missing) - missing) < 1e-9;
  },
};
