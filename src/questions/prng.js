// Deterministic random numbers: the same seed always gives the same sequence,
// so a (template, seed) pair identifies one exact question forever.

export function createRng(seed) {
  let state = seed >>> 0;

  // mulberry32
  const next = () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const rng = {
    next,

    // Integer in [min, max], both inclusive.
    int(min, max) {
      if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
        throw new Error(`rng.int(${min}, ${max}): bad range`);
      }
      return min + Math.floor(next() * (max - min + 1));
    },

    nonzero(min, max) {
      if (min === 0 && max === 0) throw new Error('rng.nonzero: empty range');
      let value;
      do value = rng.int(min, max);
      while (value === 0);
      return value;
    },

    sign() {
      return next() < 0.5 ? -1 : 1;
    },

    chance(probability) {
      return next() < probability;
    },

    pick(array) {
      if (!array.length) throw new Error('rng.pick: empty array');
      return array[rng.int(0, array.length - 1)];
    },

    // Fisher–Yates, on a copy.
    shuffle(array) {
      const out = array.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = rng.int(0, i);
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
  };

  return rng;
}

// FNV-1a: turns a string such as a URL parameter into a 32-bit seed.
export function hashSeed(text) {
  let hash = 0x811c9dc5;
  for (const char of String(text)) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}
