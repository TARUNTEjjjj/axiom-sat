// The question bank. Questions are not stored: each template turns a seed into
// one fully worked item, so the bank is as large as the templates' parameter
// spaces and every answer is computed rather than typed.

import { createRng, hashSeed } from './prng.js';
import { DOMAINS, DOMAIN_IDS, validateItem } from './schema.js';
import algebra from './generators/algebra/index.js';
import advanced from './generators/advanced/index.js';
import psda from './generators/psda/index.js';
import geometry from './generators/geometry/index.js';

export { DOMAINS, hashSeed };

export const templates = Object.freeze([...algebra, ...advanced, ...psda, ...geometry]);

const byId = new Map();
for (const template of templates) {
  validateTemplate(template);
  if (byId.has(template.id)) throw new Error(`duplicate template id ${template.id}`);
  byId.set(template.id, template);
}

export function listTemplates(domain) {
  return domain ? templates.filter((t) => t.domain === domain) : [...templates];
}

export function getTemplate(id) {
  const template = byId.get(id);
  if (!template) throw new Error(`unknown template ${id}`);
  return template;
}

// A lower bound on how many distinct questions the matching templates can produce.
export function totalSpace(domain) {
  return listTemplates(domain).reduce((sum, t) => sum + t.space, 0);
}

// The same template and seed always give the same item.
export function generate(templateId, seed) {
  validateSeed(seed);
  const template = getTemplate(templateId);
  const { item } = template.generate(createRng(seed));
  return validateItem({
    ...item,
    id: `${template.id}#${seed}`,
    templateId: template.id,
    seed,
    domain: template.domain,
    skill: template.skill,
  });
}

// Distinct items spread round-robin over the matching templates.
export function generateSet({ domain, templateId, count = 10, seed = 1 } = {}) {
  validateSeed(seed);
  if (!Number.isInteger(count) || count < 0 || count > 1000) {
    throw new Error('count must be an integer from 0 to 1000');
  }
  if (domain && !DOMAIN_IDS.includes(domain)) throw new Error(`unknown domain ${domain}`);
  const pool = templateId ? [getTemplate(templateId)] : listTemplates(domain);
  if (domain && pool.some((template) => template.domain !== domain)) {
    throw new Error('template does not belong to the requested domain');
  }
  if (!pool.length) throw new Error(`no templates for ${domain}`);

  const rng = createRng(seed);
  const items = [];
  const stems = new Set();
  for (let tries = 0; items.length < count && tries < count * 20; tries++) {
    // Advance once per accepted item, retrying this template when a stem repeats.
    // Adding `tries` here used to skip every other template in even-sized pools.
    const template = pool[items.length % pool.length];
    const item = generate(template.id, rng.int(0, 2 ** 31 - 1));
    if (stems.has(item.stem)) continue;
    stems.add(item.stem);
    items.push(item);
  }
  if (items.length !== count)
    throw new Error('could not generate the requested number of distinct questions');
  return items;
}

function validateSeed(seed) {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new Error('seed must be an unsigned 32-bit integer');
  }
}

function validateTemplate(template) {
  const fail = (message) => {
    throw new Error(`invalid template ${template && template.id}: ${message}`);
  };
  if (!template || typeof template.id !== 'string' || !template.id) fail('id is required');
  if (!DOMAIN_IDS.includes(template.domain)) fail(`unknown domain ${template.domain}`);
  if (!template.id.startsWith(`${template.domain}.`)) fail('id must be prefixed by its domain');
  if (typeof template.skill !== 'string' || !template.skill) fail('skill is required');
  if (!Number.isInteger(template.space) || template.space < 1) fail('space must be a positive integer');
  if (typeof template.generate !== 'function' || typeof template.verify !== 'function') {
    fail('generate() and verify() are required');
  }
}
