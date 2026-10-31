import { fmtComma, fmtFrac, gcd, sprNum } from '../../format.js';
import { parseSpr } from '../../spr.js';

export default {
  id: 'geometry.similar-solids',
  domain: 'geometry',
  skill: 'Volume and area scale factors of similar solids',
  // At least 20 distinct reduced ratios, with independent volume and area scales.
  space: 20 * 91 * 81,
  generate(rng) {
    let p;
    let q;
    do {
      p = rng.int(2, 8);
      q = rng.int(1, 7);
    } while (p === q || gcd(p, q) !== 1);
    const volumeUnit = rng.int(10, 100);
    const areaUnit = rng.int(10, 90);
    const volumeA = volumeUnit * q ** 3;
    const volumeB = volumeUnit * p ** 3;
    const areaA = areaUnit * q * q;
    const areaB = areaUnit * p * p;
    return {
      item: {
        type: 'spr',
        difficulty: 3,
        stem: `Two triangular prisms, A and B, are similar. Their volumes are ${fmtComma(volumeA)} cm³ and ${fmtComma(volumeB)} cm³, respectively. A triangular base of prism A has area ${fmtComma(areaA)} cm². What is the area, in cm², of the corresponding triangular base of prism B?`,
        answer: sprNum(areaB),
        explanation: `For similar solids, volumes scale by the cube of the length scale factor, while corresponding areas scale by its square. The volume ratio B/A is ${fmtComma(volumeB)} / ${fmtComma(volumeA)} = (${fmtFrac(p, q)})³. Hence the length scale factor from A to B is ${fmtFrac(p, q)}, and the area ratio is (${fmtFrac(p, q)})² = ${fmtFrac(p * p, q * q)}. Multiply the original base area: ${fmtComma(areaA)} × (${fmtFrac(p * p, q * q)}) = ${fmtComma(areaB)} cm². Using the volume ratio directly for area would use the wrong exponent.`,
      },
      params: { volumeA, volumeB, areaA },
    };
  },
  verify({ item, params: { volumeA, volumeB, areaA } }) {
    const areaB = parseSpr(item.answer);
    // Area ratios cubed equal volume ratios squared; this avoids cube-root rounding.
    const difference = areaB ** 3 * volumeA ** 2 - areaA ** 3 * volumeB ** 2;
    return areaB > 0 && Math.abs(difference) <= 1e-12 * areaB ** 3 * volumeA ** 2;
  },
};
