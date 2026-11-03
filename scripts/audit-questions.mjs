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
// (nonlinear-models a = 1 intercept steps; answers unchanged).
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
const LEGACY_HASH = '6e6bdcd526e3b957a1c24e2f8e66695237c160cad15a7943fa5dfed381271479';
const samples = Number(process.argv[2] ?? 5000);
assert(
  Number.isInteger(samples) && samples >= 1 && samples <= 20000,
  'Use an integer from 1 to 20000 for seeds per template.',
);

const hash = createHash('sha256');
for (const id of LEGACY_IDS) {
  for (let seed = 0; seed < 200; seed++) hash.update(JSON.stringify(generate(id, seed)) + '\n');
}
assert.equal(hash.digest('hex'), LEGACY_HASH, 'A published question changed for an existing template/seed.');

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
      summary,
    },
    null,
    2,
  ),
);
