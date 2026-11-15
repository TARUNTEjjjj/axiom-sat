// A deeper release audit, separate from the fast build tests. No network or packages.
// Usage: node scripts/audit-questions.mjs [seeds-per-template, default 5000]
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { templates, generate } from '../src/questions/index.js';
import { createRng } from '../src/questions/prng.js';
import { validateItem, answerText } from '../src/questions/schema.js';
import { parseSpr, sprEquals } from '../src/questions/spr.js';

// Captured from release c7bf02c before adding challenge templates. Stable seeded
// questions matter because saved sessions, progress and shared links refer to IDs.
// The hash was re-baselined on 2026-11-03 for an explanation-only fix
// (nonlinear-models a = 1 intercept steps; answers unchanged), on 2026-11-15 for
// another (function-values seed 21 wrote g(0) = −0 + 5; answers unchanged), and on
// 2026-11-15 for distractor-only fixes: linear-functions seeds 5, 53, 125, 134, 135
// and 173 put the key between two evenly spaced choices, seeds 30, 162 and 167
// offered a choice next to the key, and circles seed 99 offered the run π, 2π, 3π,
// 4π. Every key and its letter are unchanged, so saved answers grade the same, but a
// saved wrong letter on these seeds now names a different value in review.
const LEGACY_IDS = [
  'advanced.expressions',
  'advanced.function-values',
  'advanced.line-parabola',
  'advanced.nonlinear-models',
  'advanced.quadratic-roots',
  'algebra.inequalities',
  'algebra.line-two-points',
  'algebra.linear-functions',
  'algebra.linear-one-var',
  'algebra.systems',
  'geometry.angles-triangles',
  'geometry.area-volume',
  'geometry.circles',
  'geometry.right-triangles',
  'psda.center',
  'psda.linear-model',
  'psda.percentages',
  'psda.probability',
  'psda.ratios',
];
const LEGACY_HASH = '4c9b1695c6bd14545f5f940683c868f78731b45b0b9a71bb503880e2cf5ac078';
// Templates published later are pinned one by one, so a release can add templates
// without re-baselining these. The challenge templates from e405b1c were captured from
// 23a84e7 with one explanation-only fix: quadratic-from-points no longer writes a zero
// vertex constant out (seeds 14, 26, 123, 129, 136, 166 and 190; answers unchanged).
const TEMPLATE_HASHES = {
  'algebra.system-parameter': '78df14a9c7b5ab6e43a27b8224919effeb36db3ab374883d8c5978405f396c15',
  'advanced.discriminant-parameter': 'e9895e0d232526de1f60bc3a462860334984f3566b5a10a8d9ed1c9508bff5b9',
  'advanced.root-relationships': '8ad8b0f3aad31abaeb545472f466350c1a60364384fae3607444f0bf33ab5ca9',
  'advanced.rational-equations': 'e61861c4a3172db5ddca59b3c31c30b3b56576aaf585ae1d9a8334df0043a11e',
  'advanced.radical-equations': 'a03bab167592481744fc6f68097d433472d64b9388ffe6dcc661808b693f629f',
  'advanced.exponential-observations': '21e1172ea5a29ccab188d1be4e65aaefaac40f91737ea1b295ded2e2dbf94777',
  'advanced.quadratic-from-points': '2145b792ace2dd34d7744b28a7c22cbc62dd93d05d42afb1969fed5acb3695d4',
  'advanced.polynomial-parameter': 'fd96e46bc98f0b122e255182da18fbf2aa0e204741312d7b157787c9e8796e7e',
  'advanced.nonlinear-system-sum': 'c1822f9116998bcca3e34b80e16e46caba010e4d5f9165a38074f648edf54bb4',
  'psda.conditional-probability': 'd30e3f893a6438eea29fc1682d3779aa750cb2d1f8028f1593a7f8a027a04867',
  'geometry.circle-tangency': '6b804358f60d139a26696ab1406818fb7fbb57220a07bef0c3f92729f01dfe0f',
  'geometry.similar-solids': '426e4136dcd28fcd4d5bc781353f60cdbbee07e30289bfa9c1514e095a091afe',
};
const samples = Number(process.argv[2] ?? 5000);
assert(
  Number.isInteger(samples) && samples >= 1 && samples <= 20000,
  'Use an integer from 1 to 20000 for seeds per template.',
);

function fingerprint(ids) {
  const hash = createHash('sha256');
  for (const id of ids) {
    for (let seed = 0; seed < 200; seed++) hash.update(JSON.stringify(generate(id, seed)) + '\n');
  }
  return hash.digest('hex');
}
assert.equal(fingerprint(LEGACY_IDS), LEGACY_HASH, 'A published question changed for an existing template/seed.');
const changed = Object.keys(TEMPLATE_HASHES).filter((id) => fingerprint([id]) !== TEMPLATE_HASHES[id]);
assert(!changed.length, `A published question changed for an existing template/seed: ${changed.join(', ')}`);
// Every template must be pinned before it is published; the message gives each new hash.
const unpinned = templates
  .map(({ id }) => id)
  .filter((id) => !LEGACY_IDS.includes(id) && !Object.hasOwn(TEMPLATE_HASHES, id))
  .map((id) => `'${id}': '${fingerprint([id])}'`);
assert(!unpinned.length, `Add each new template to TEMPLATE_HASHES: ${unpinned.join(', ')}`);

function finiteParameters(value) {
  if (typeof value === 'number') assert(Number.isFinite(value), 'Non-finite generator parameter');
  else if (Array.isArray(value)) value.forEach(finiteParameters);
  else if (value && typeof value === 'object') Object.values(value).forEach(finiteParameters);
}

const summary = [];
const seeds = [...Array(samples).keys(), 0x7fffffff, 0x80000000, 0xfffffffe, 0xffffffff];
for (const template of templates) {
  const stems = new Set();
  const levels = { 1: 0, 2: 0, 3: 0 };
  let numericChoiceChecks = 0;
  for (const seed of seeds) {
    try {
      const output = template.generate(createRng(seed));
      const item = generate(template.id, seed);
      validateItem(item);
      assert(template.verify(output), 'Generator verifier rejected its result');
      assert.deepEqual(item, generate(template.id, seed), 'Seeded generation changed between calls');
      finiteParameters(output.params);
      assert(!/\b(?:undefined|NaN|Infinity)\b/.test(JSON.stringify(item)), 'Invalid text rendered in item');
      if (item.type === 'spr') {
        assert(sprEquals(item.answer, item.answer), 'Correct answer was not accepted by the grader');
      } else {
        assert(answerText(item), 'No choice matches the answer key');
        const numbers = item.choices.map((choice) => parseSpr(choice.text));
        if (numbers.every((number) => number !== null)) {
          assert.equal(new Set(numbers).size, 4, 'Distinct-looking choices have equivalent numeric values');
          numericChoiceChecks++;
        }
      }
      stems.add(item.stem);
      levels[item.difficulty]++;
    } catch (error) {
      throw new Error(`${template.id}, seed ${seed}: ${error.message}`, {
        cause: error,
      });
    }
  }
  summary.push({
    template: template.id,
    checked: seeds.length,
    distinctStems: stems.size,
    levels,
    numericChoiceChecks,
  });
}
console.log(
  JSON.stringify(
    {
      passed: true,
      templates: templates.length,
      generatedItemsChecked: templates.length * seeds.length,
      legacyItemsUnchanged: LEGACY_IDS.length * 200,
      publishedItemsUnchanged: (LEGACY_IDS.length + Object.keys(TEMPLATE_HASHES).length) * 200,
      summary,
    },
    null,
    2,
  ),
);
