// The shape of a question item and the four SAT Math content domains.
import { parseSpr } from './spr.js';
//
// {
//   id: 'algebra.linear-one-var#123',   // templateId#seed, stamped by the registry
//   templateId, seed, domain, skill,
//   difficulty: 1 | 2 | 3,
//   type: 'mc' | 'spr',                  // multiple choice | student-produced response
//   stem: 'If 3x − 7 = 11, what is the value of x?',
//   table?: { caption?, headers: [...], rows: [[...], ...] },
//   choices?: [{ key: 'A', text: '6' }, ...],   // mc only, always A–D
//   answer: 'B' | '7/2',                 // a key for mc, the typed response for spr
//   explanation: 'Add 7 to both sides: ...',
// }

export const DOMAINS = [
  { id: 'algebra', name: 'Algebra' },
  { id: 'advanced', name: 'Advanced Math' },
  { id: 'psda', name: 'Problem-Solving and Data Analysis' },
  { id: 'geometry', name: 'Geometry and Trigonometry' },
];

export const DOMAIN_IDS = DOMAINS.map((d) => d.id);

const KEYS = ['A', 'B', 'C', 'D'];

// What a student can type into a response box: an integer, decimal or fraction,
// at most 5 characters long (6 with a leading minus).
const SPR = /^-?(\d+\.?\d*|\.\d+|\d+\/\d+)$/;

export function isSprAnswer(text) {
  return (
    typeof text === 'string' && SPR.test(text) && text.replace('-', '').length <= 5 && parseSpr(text) !== null
  );
}

export function answerText(item) {
  return item.choices.find((c) => c.key === item.answer).text;
}

export function validateItem(item) {
  const fail = (message) => {
    throw new Error(`invalid item${item && item.id ? ' ' + item.id : ''}: ${message}`);
  };

  if (!item || typeof item !== 'object') fail('not an object');
  if (typeof item.stem !== 'string' || !item.stem.trim()) fail('stem must be a non-empty string');
  if (typeof item.explanation !== 'string' || !item.explanation.trim()) {
    fail('explanation must be a non-empty string');
  }
  if (!DOMAIN_IDS.includes(item.domain)) fail(`unknown domain ${item.domain}`);
  if (typeof item.skill !== 'string' || !item.skill) fail('skill is required');
  if (![1, 2, 3].includes(item.difficulty)) fail('difficulty must be 1, 2 or 3');
  if (item.table != null) validateTable(item.table, fail);

  if (item.type === 'mc') {
    if (!Array.isArray(item.choices) || item.choices.length !== 4) fail('mc items need exactly 4 choices');
    item.choices.forEach((choice, i) => {
      if (choice.key !== KEYS[i]) fail(`choice ${i} must have key ${KEYS[i]}`);
      if (typeof choice.text !== 'string' || !choice.text.trim()) {
        fail(`choice ${KEYS[i]} text must be a non-empty string`);
      }
    });
    if (new Set(item.choices.map((c) => c.text)).size !== 4) fail('choice texts must be distinct');
    if (!KEYS.includes(item.answer)) fail('answer must be A, B, C or D');
  } else if (item.type === 'spr') {
    if (!isSprAnswer(item.answer)) fail(`"${item.answer}" is not a valid student-produced response`);
    if (item.choices != null) fail('spr items have no choices');
  } else {
    fail(`unknown type ${item.type}`);
  }

  return item;
}

function validateTable(table, fail) {
  if (!Array.isArray(table.headers) || !table.headers.length) fail('table.headers is required');
  if (!Array.isArray(table.rows) || !table.rows.length) fail('table.rows is required');
  for (const row of table.rows) {
    if (!Array.isArray(row) || row.length !== table.headers.length) {
      fail('every table row must have one cell per header');
    }
  }
}
