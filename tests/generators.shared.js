import { test, assert, assertEqual } from './harness.js';
import { createRng } from '../src/questions/prng.js';
import { validateItem } from '../src/questions/schema.js';

const SEEDS = 400;

// The contract every template must meet, checked over many seeds: the item is
// well-formed, its own verify() accepts it, and the stems vary.
export function testTemplates(templates) {
  for (const template of templates) {
    test(`${template.id}: ${SEEDS} seeds give valid items that pass verify()`, () => {
      const stems = new Set();
      for (let seed = 0; seed < SEEDS; seed++) {
        const out = template.generate(createRng(seed));
        const item = validateItem({
          ...out.item,
          id: `${template.id}#${seed}`,
          domain: template.domain,
          skill: template.skill,
        });
        assert(template.verify(out), `${item.id} failed verify(): ${item.stem}`);
        stems.add(item.stem);
      }
      assert(stems.size >= 0.85 * SEEDS, `${template.id}: only ${stems.size}/${SEEDS} distinct stems`);
    });

    test(`${template.id}: the same seed gives the same item`, () => {
      const a = template.generate(createRng(7));
      const b = template.generate(createRng(7));
      assertEqual(JSON.stringify(a.item), JSON.stringify(b.item));
    });
  }
}
