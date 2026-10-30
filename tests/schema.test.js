import { test, assert, assertEqual, assertThrows } from './harness.js';
import { answerText, isSprAnswer, validateItem } from '../src/questions/schema.js';

const mc = () => ({
  type: 'mc',
  domain: 'algebra',
  skill: 'Linear equations in one variable',
  difficulty: 1,
  stem: 'If x + 1 = 3, what is x?',
  choices: [
    { key: 'A', text: '1' },
    { key: 'B', text: '2' },
    { key: 'C', text: '3' },
    { key: 'D', text: '4' },
  ],
  answer: 'B',
  explanation: 'Subtract 1 from both sides.',
});

test('validateItem accepts a well-formed multiple-choice item', () => {
  const item = mc();
  assertEqual(validateItem(item), item);
  assertEqual(answerText(item), '2');
});

test('validateItem accepts a well-formed student-produced response item', () => {
  const item = { ...mc(), type: 'spr', choices: undefined, answer: '7/2' };
  assertEqual(validateItem(item), item);
});

test('validateItem rejects malformed items', () => {
  assertThrows(() => validateItem({ ...mc(), stem: ' ' }), 'blank stem');
  assertThrows(() => validateItem({ ...mc(), explanation: '' }), 'blank explanation');
  assertThrows(() => validateItem({ ...mc(), domain: 'history' }), 'bad domain');
  assertThrows(() => validateItem({ ...mc(), difficulty: 4 }), 'bad difficulty');
  assertThrows(() => validateItem({ ...mc(), answer: 'E' }), 'bad answer key');
  assertThrows(() => validateItem({ ...mc(), type: 'essay' }), 'bad type');

  const dup = mc();
  dup.choices[3].text = '1';
  assertThrows(() => validateItem(dup), 'duplicate choice texts');

  const keys = mc();
  keys.choices[1].key = 'C';
  assertThrows(() => validateItem(keys), 'choices out of order');

  assertThrows(() => validateItem({ ...mc(), type: 'spr', choices: undefined, answer: 'B' }), 'spr answer');
  assertThrows(() => validateItem({ ...mc(), type: 'spr', answer: '12' }), 'spr with choices');
});

test('validateItem checks optional tables', () => {
  const table = { headers: ['x', 'y'], rows: [[1, 2], [3, 4]] };
  assert(validateItem({ ...mc(), table }));
  assertThrows(() => validateItem({ ...mc(), table: { headers: ['x', 'y'], rows: [[1]] } }));
  assertThrows(() => validateItem({ ...mc(), table: { headers: [], rows: [[1]] } }));
});

test('isSprAnswer matches what fits in a response box', () => {
  for (const ok of ['12', '-3', '3.5', '.6667', '-.5', '7/2', '-7/2', '12345', '-12345']) {
    assert(isSprAnswer(ok), ok);
  }
  for (const bad of ['123456', '1/2/3', 'x', '', '3,5', '−3', 12]) {
    assert(!isSprAnswer(bad), String(bad));
  }
});
