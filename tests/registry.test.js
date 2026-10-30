import { test, assert, assertEqual, assertThrows } from './harness.js';
import { DOMAIN_IDS } from '../src/questions/schema.js';
import { generate, generateSet, listTemplates, templates, totalSpace } from '../src/questions/index.js';

test('every domain has at least one template', () => {
  for (const domain of DOMAIN_IDS) assert(listTemplates(domain).length >= 1, `no templates for ${domain}`);
});

test('the bank offers more than 10,000 distinct questions', () => {
  assert(totalSpace() >= 10000, `only ${totalSpace()}`);
});

test('template ids are unique and prefixed by their domain', () => {
  const ids = templates.map((t) => t.id);
  assertEqual(new Set(ids).size, ids.length);
  for (const t of templates) assert(t.id.startsWith(t.domain + '.'), t.id);
});

test('generate() is deterministic and stamps id, template, seed and domain', () => {
  const a = generate('algebra.linear-one-var', 123);
  const b = generate('algebra.linear-one-var', 123);
  assertEqual(JSON.stringify(a), JSON.stringify(b));
  assertEqual(a.id, 'algebra.linear-one-var#123');
  assertEqual(a.templateId, 'algebra.linear-one-var');
  assertEqual(a.seed, 123);
  assertEqual(a.domain, 'algebra');
  assertEqual(a.skill, 'Linear equations in one variable');
});

test('generate() rejects unknown templates', () => {
  assertThrows(() => generate('nope.nothing', 1));
});

test('generateSet() returns distinct items from the requested domain', () => {
  const items = generateSet({ domain: 'algebra', count: 12, seed: 5 });
  assertEqual(items.length, 12);
  assertEqual(new Set(items.map((i) => i.stem)).size, 12);
  for (const item of items) assertEqual(item.domain, 'algebra');
});

test('generateSet() can be pinned to one template', () => {
  const items = generateSet({ templateId: 'algebra.linear-one-var', count: 5, seed: 2 });
  assertEqual(items.length, 5);
  for (const item of items) assertEqual(item.templateId, 'algebra.linear-one-var');
});
