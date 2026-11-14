// The question-bank explorer. The filters narrow the templates, a seed pins one
// question, and the address bar (?t=<templateId>&s=<seed>) always points at the
// question on screen, so any question can be linked to.

import { normalizeSpr, parseSpr, sprEquals } from '../../src/questions/spr.js';
import { MINUS } from '../../src/questions/format.js';
import { recordAttempt } from '../../src/learning/progress.js';
import { isSprAnswer } from '../../src/questions/schema.js';

const MAX_SEED = 2 ** 31 - 1;
// Question-bank answers and reveal state are intentionally kept in this page.
window.appUpdateCanReload = () => false;
const KEYS = ['A', 'B', 'C', 'D'];
const DIGITS = ['1', '2', '3', '4'];
const grouped = new Intl.NumberFormat('en-US');
// Below this width the controls sit under the question (bank.css), so a new
// question would otherwise render out of view.
const stacked = matchMedia('(max-width: 860px)');

const byId = (id) => document.getElementById(id);
const form = byId('controls');
const domainSelect = byId('domain');
const skillSelect = byId('skill');
const difficultySelect = byId('difficulty');
const practiceLink = byId('practice-filter');
const seedInput = byId('seed');
const seedError = byId('seed-error');
const copyButton = byId('copy');
const linkField = byId('link-field');
const linkInput = byId('link');
const note = byId('note');
const card = byId('card');
const live = byId('live');

const state = { templateId: null, seed: null, graded: false, eliminating: false };

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (name === 'class') node.className = value;
    else if (name === 'text') node.textContent = value;
    else node.setAttribute(name, value === true ? '' : value);
  }
  node.append(...children);
  return node;
}

// index.js evaluates every generator module and validates every template as it
// loads, so one broken module would otherwise leave the page blank and silent.
async function loadEngine() {
  try {
    return await import('../../src/questions/index.js');
  } catch (error) {
    const text = 'The question bank could not load.';
    card.replaceChildren(
      el('p', { class: 'q-stem', id: 'q-stem', text }),
      el('p', { class: 'q-id small muted', text: error && error.message }),
    );
    live.textContent = text;
    for (const control of form.elements) control.disabled = true;
    throw error;
  }
}

const { DOMAINS, listTemplates, getTemplate, totalSpace, generate, generateSet, hashSeed } =
  await loadEngine();
const LEVELS = { 1: 'Foundation', 2: 'Standard', 3: 'Challenge' };

function randomBelow(n) {
  return crypto.getRandomValues(new Uint32Array(1))[0] % n;
}

function randomSeed() {
  return randomBelow(MAX_SEED + 1);
}

function plural(n, word) {
  return `${grouped.format(n)} ${n === 1 ? word : word + 's'}`;
}

// ?s= is normally a whole number; any other text is hashed so word seeds work too.
function parseSeed(text) {
  if (!text) return randomSeed();
  if (/^\d{1,10}$/.test(text) && Number(text) <= 0xffffffff) return Number(text);
  return hashSeed(text);
}

// Safari throws once a page rewrites its address more than 100 times in half a
// minute (holding Enter on New question gets there); the question still renders.
function writeUrl(mutate) {
  const url = new URL(location.href);
  mutate(url.searchParams);
  try {
    history.replaceState(null, '', url);
  } catch {
    // The address bar lags behind until the throttle lifts.
  }
}

/* Filters */

function fillDomains() {
  domainSelect.replaceChildren(
    el('option', { value: '', text: 'All domains' }),
    ...DOMAINS.map((d) => el('option', { value: d.id, text: d.name })),
  );
}

// One option per distinct skill, valued by the first template that teaches it,
// grouped by domain when every domain is listed.
function fillSkills(domain) {
  const options = [el('option', { value: '', text: 'All skills' })];
  const domains = domain ? DOMAINS.filter((d) => d.id === domain) : DOMAINS;
  for (const d of domains) {
    const firstIds = new Map();
    for (const t of listTemplates(d.id)) {
      if (!firstIds.has(t.skill)) firstIds.set(t.skill, t.id);
    }
    const items = [...firstIds].map(([skill, id]) => el('option', { value: id, text: skill }));
    if (!items.length) continue;
    if (domain) options.push(...items);
    else options.push(el('optgroup', { label: d.name }, items));
  }
  skillSelect.replaceChildren(...options);
}

// A chosen skill stands for every template with that domain and skill.
function matchingTemplates() {
  const chosen = skillSelect.value ? getTemplate(skillSelect.value) : null;
  return listTemplates(domainSelect.value).filter(
    (t) => !chosen || (t.domain === chosen.domain && t.skill === chosen.skill),
  );
}

function selectSkillOf(template) {
  const option = [...skillSelect.options].find((o) => {
    if (!o.value) return false;
    const t = getTemplate(o.value);
    return t.domain === template.domain && t.skill === template.skill;
  });
  skillSelect.value = option ? option.value : '';
}

function updatePracticeLink() {
  const chosen = skillSelect.value ? getTemplate(skillSelect.value) : null;
  const params = new URLSearchParams({
    mode: 'custom',
    domain: domainSelect.value || chosen?.domain || 'all',
    difficulty: difficultySelect.value || '0',
    count: '10',
  });
  practiceLink.href = `practice.html?${params}`;
}

/* The question */

function focusCard() {
  card.scrollIntoView({ block: 'start' });
  card.focus({ preventScroll: true });
}

// A control far from the card (Next question, Practice) hands it focus so the
// keyboard flow continues there; a filter only scrolls it into view, so focus
// stays on the control that changed.
function revealCard({ focus, scroll }) {
  if (focus) focusCard();
  else if (scroll) card.scrollIntoView({ block: 'start' });
}

function show(templateId, seed, { focus = false, scroll = false } = {}) {
  state.templateId = templateId;
  state.seed = seed;
  state.graded = false;
  state.eliminating = false;
  note.hidden = true;
  linkField.hidden = true;
  copyButton.disabled = false;
  live.textContent = '';

  let item = null;
  try {
    item = generate(templateId, seed);
    if (difficultySelect.value && Number(difficultySelect.value) !== item.difficulty) {
      difficultySelect.value = String(item.difficulty);
      note.textContent = `This exact seed is a ${LEVELS[item.difficulty].toLowerCase()} question. The difficulty filter now matches it.`;
      note.hidden = false;
    }
    renderItem(item);
  } catch (error) {
    renderFailure(error);
  }
  seedInput.value = String(seed);
  clearSeedError();
  writeUrl((params) => {
    params.set('t', templateId);
    params.set('s', String(seed));
    params.delete('d');
    if (difficultySelect.value) params.set('level', difficultySelect.value);
    else params.delete('level');
  });
  updatePracticeLink();

  // Announced even when the card takes focus: the card then reads its stem, which
  // this message does not repeat.
  live.textContent = item ? `New question: ${item.skill}, seed ${seed}` : 'This question could not be built.';
  revealCard({ focus, scroll });
}

// A fresh question that fits the filters: a random template and a random seed.
function draw({ focus = false, scroll = false } = {}) {
  const pool = matchingTemplates();
  if (!pool.length) {
    showEmpty({ focus, scroll });
    return;
  }
  if (!difficultySelect.value) {
    show(pool[randomBelow(pool.length)].id, randomSeed(), { focus, scroll });
    return;
  }
  // Try every matching template, starting at a random point. Some skills have
  // no items at a requested level; show that explicitly instead of ignoring it.
  const start = randomBelow(pool.length);
  for (let i = 0; i < pool.length; i++) {
    try {
      const [item] = generateSet({
        templateId: pool[(start + i) % pool.length].id,
        difficulty: Number(difficultySelect.value),
        count: 1,
        seed: randomSeed(),
      });
      show(item.templateId, item.seed, { focus, scroll });
      return;
    } catch (error) {
      if (!error.message.startsWith('No questions match')) {
        renderFailure(error);
        return;
      }
    }
  }
  showEmpty({ focus, scroll });
}

// Nothing fits the filters: the card says so and no longer stands for a question,
// so the seed, the link and the address bar are cleared with it.
function showEmpty({ focus = false, scroll = false } = {}) {
  const text = 'No questions match this skill and difficulty. Try mixed difficulty or another skill.';
  state.templateId = null;
  state.seed = null;
  state.graded = false;
  state.eliminating = false;
  seedInput.value = '';
  clearSeedError();
  note.hidden = true;
  linkField.hidden = true;
  copyButton.disabled = true;
  writeUrl((params) => {
    params.delete('t');
    params.delete('s');
    params.delete('d');
    if (domainSelect.value) params.set('d', domainSelect.value);
    if (difficultySelect.value) params.set('level', difficultySelect.value);
    else params.delete('level');
  });
  updatePracticeLink();
  card.replaceChildren(el('p', { class: 'q-stem', id: 'q-stem', text }));
  live.textContent = text;
  revealCard({ focus, scroll });
}

// The stem's id names the card (aria-labelledby in bank.html), so a focused card
// announces its question.
function renderItem(item) {
  const domain = DOMAINS.find((d) => d.id === item.domain);
  const meta = el('div', { class: 'q-meta' }, [
    el('span', { class: 'chip', text: domain ? domain.name : item.domain }),
    el('span', { class: 'chip', text: item.skill }),
    el('span', {
      class: `chip level-${item.difficulty}`,
      text: `${LEVELS[item.difficulty]} · ${item.difficulty} of 3`,
    }),
    el('span', { class: 'chip', text: `Seed ${item.seed}` }),
    el('span', { class: 'q-id small muted', text: item.templateId }),
  ]);
  const parts = [meta, el('p', { class: 'q-stem', id: 'q-stem', text: item.stem })];
  if (item.table) parts.push(renderTable(item.table));
  parts.push(item.type === 'mc' ? renderChoices(item) : renderResponse(item));
  card.replaceChildren(...parts);
}

// The scroller is a named region that joins the tab order only while the table is
// wider than the card: a scroller with nothing to scroll would be a dead stop. A
// scroller that left the page with its question is dropped on its last notification.
const scrollObserver = new ResizeObserver((entries) => {
  for (const { target } of entries) {
    if (!target.isConnected) scrollObserver.unobserve(target);
    else if (target.scrollWidth > target.clientWidth) target.setAttribute('tabindex', '0');
    else target.removeAttribute('tabindex');
  }
});

// A first cell that is not a number is a row label, as in a two-way table, and is
// rendered as the row's header.
function renderTable({ caption, headers, rows }) {
  const cell = (text, first) =>
    first && parseSpr(text) === null ? el('th', { scope: 'row', text }) : el('td', { text });
  const scroller = el('div', { class: 'q-scroll', role: 'region', 'aria-label': 'Table' }, [
    el('table', { class: 'q-table' }, [
      caption
        ? el('caption', { text: caption })
        : el('caption', { class: 'sr-only', text: 'Data for this question' }),
      el('thead', {}, [
        el(
          'tr',
          {},
          headers.map((h) => el('th', { scope: 'col', text: String(h) })),
        ),
      ]),
      el(
        'tbody',
        {},
        rows.map((row) =>
          el(
            'tr',
            {},
            row.map((c, i) => cell(String(c), i === 0)),
          ),
        ),
      ),
    ]),
  ]);
  scrollObserver.observe(scroller);
  return scroller;
}

function setCrossed(choice, crossed) {
  choice.classList.toggle('is-eliminated', crossed);
  choice.querySelector('.choice-mark').textContent = crossed ? ' (crossed out)' : '';
}

function renderChoices(item) {
  const hint = el('span', {
    class: 'q-tools-hint small muted',
    hidden: true,
    text: 'Select a choice to cross it out',
  });
  const toggle = el(
    'button',
    {
      type: 'button',
      class: 'eliminator',
      'aria-pressed': 'false',
      title: 'Cross out answer choices you think are wrong',
    },
    [el('span', { class: 'abc', 'aria-hidden': 'true', text: 'ABC' }), 'Cross out'],
  );
  const list = el(
    'ul',
    { class: 'choices', role: 'list' },
    item.choices.map((choice) =>
      el('li', {}, [
        el('button', { type: 'button', class: 'choice', 'data-key': choice.key }, [
          el('span', { class: 'choice-key', text: choice.key }),
          el('span', { class: 'choice-text', text: choice.text }),
          el('span', { class: 'sr-only choice-mark' }),
        ]),
      ]),
    ),
  );

  toggle.addEventListener('click', () => {
    state.eliminating = !state.eliminating;
    toggle.setAttribute('aria-pressed', String(state.eliminating));
    hint.hidden = !state.eliminating;
  });

  list.addEventListener('click', (event) => {
    const picked = event.target.closest('.choice');
    if (!picked || picked.disabled) return;
    if (state.eliminating) {
      const crossed = !picked.classList.contains('is-eliminated');
      setCrossed(picked, crossed);
      live.textContent = `Choice ${picked.dataset.key} ${crossed ? 'crossed out' : 'restored'}`;
      return;
    }
    setCrossed(picked, false);
    picked.classList.add('is-selected');
    for (const choice of list.querySelectorAll('.choice')) {
      choice.disabled = true;
      if (choice.dataset.key === item.answer) {
        setCrossed(choice, false);
        choice.classList.add('is-correct');
      } else if (choice === picked) {
        choice.classList.add('is-incorrect');
      }
    }
    toggle.disabled = true;
    hint.hidden = true;
    finish(item, picked.dataset.key === item.answer, item.answer, picked.dataset.key);
  });

  return el('div', { class: 'q-answer' }, [el('div', { class: 'q-tools' }, [hint, toggle]), list]);
}

// A plain text field: a numeric keypad has no minus or slash, and the answers
// need both.
function renderResponse(item) {
  const input = el('input', {
    id: 'spr-input',
    class: 'spr-input',
    type: 'text',
    autocomplete: 'off',
    'aria-describedby': 'spr-hint',
  });
  const check = el('button', { type: 'submit', class: 'btn btn-secondary', text: 'Check' });
  const inputHint = 'Enter a number, a decimal or a fraction like 7/2';
  const hint = el('p', {
    id: 'spr-hint',
    class: 'small muted',
    text: inputHint,
  });
  const response = el('form', { class: 'spr', novalidate: true }, [
    el('label', { class: 'spr-label', for: 'spr-input', text: 'Your answer' }),
    el('div', { class: 'spr-row' }, [input, check]),
    hint,
  ]);

  input.addEventListener('input', () => {
    input.removeAttribute('aria-invalid');
    hint.textContent = inputHint;
  });

  response.addEventListener('submit', (event) => {
    event.preventDefault();
    if (state.graded) return;
    const typed = normalizeSpr(input.value);
    if (!typed) {
      input.focus();
      return;
    }
    // A typo is not an answer: the box asks again instead of grading it.
    if (!isSprAnswer(typed) || parseSpr(typed) === null) {
      hint.textContent =
        'Use up to 5 characters (6 with a minus sign): digits, a decimal point, or a fraction like 7/2.';
      live.textContent = hint.textContent;
      input.setAttribute('aria-invalid', 'true');
      input.focus();
      return;
    }
    const correct = sprEquals(typed, item.answer);
    input.classList.add(correct ? 'is-correct' : 'is-incorrect');
    input.readOnly = true;
    check.disabled = true;
    finish(item, correct, item.answer, typed);
  });

  return response;
}

// The result line is prose, so a typed answer gets the stem's minus sign and a
// leading zero; grading still compares the typed form.
function displayAnswer(answer) {
  return answer.replace('-', MINUS).replace(/^(−?)\./, (_, sign) => `${sign}0.`);
}

// Both item types end the same way: the result is shown and announced, the
// explanation appears, and the next question takes focus so the keyboard flow continues.
function finish(item, correct, answer, response) {
  state.graded = true;
  const saved = recordAttempt({
    templateId: item.templateId,
    seed: item.seed,
    correct,
    response,
    source: 'bank',
  });
  const progressMessage = !saved.persisted
    ? 'Your answer was checked, but progress could not be saved on this browser.'
    : saved.recorded
      ? 'First attempt saved on this device.'
      : 'Already practiced. Your first attempt stays in your progress.';
  const message = correct ? 'Correct' : `Not quite — the answer is ${displayAnswer(answer)}`;
  const next = nextButton();
  // Focus moving to the button can cut the live announcement short, so the button
  // carries the result as its description too.
  next.setAttribute('aria-describedby', 'q-result');
  card.append(
    el('div', { class: 'q-outcome' }, [
      el('p', {
        id: 'q-result',
        class: `q-result ${correct ? 'is-correct' : 'is-incorrect'}`,
        text: message,
      }),
      el('div', { class: 'explanation', text: item.explanation }),
      el('p', { class: 'small muted' }, [
        progressMessage,
        ' ',
        el('a', { href: 'progress.html', text: 'View progress →' }),
      ]),
      el('div', { class: 'q-next' }, [next]),
    ]),
  );
  live.textContent = message;
  next.focus();
}

function nextButton() {
  const next = el('button', { type: 'button', class: 'btn btn-primary', text: 'Next question' });
  next.addEventListener('click', () => draw({ focus: true }));
  return next;
}

function renderFailure(error) {
  card.replaceChildren(
    el('p', { class: 'q-stem', id: 'q-stem', text: 'This question could not be built.' }),
    el('p', { class: 'q-id small muted', text: error && error.message }),
    el('div', { class: 'q-next' }, [nextButton()]),
  );
}

/* Bank at a glance */

function renderGlance() {
  const grid = byId('glance');
  grid.replaceChildren(
    ...DOMAINS.map((domain) => {
      const templates = listTemplates(domain.id);
      const skills = [...new Set(templates.map((t) => t.skill))];
      const empty = !templates.length;
      const heading = [el('h3', { class: 'glance-name', text: domain.name })];
      if (empty) heading.push(el('span', { class: 'chip', text: 'In development' }));
      const parts = [
        el('div', { class: 'glance-title' }, heading),
        el('p', { class: 'glance-stats' }, [
          el('strong', { text: empty ? 'No questions yet' : `${grouped.format(totalSpace(domain.id))}+` }),
          el('span', {
            text: empty
              ? plural(0, 'template')
              : `distinct questions · ${plural(templates.length, 'template')}`,
          }),
        ]),
      ];
      if (!empty) {
        parts.push(
          el(
            'ul',
            { class: 'glance-skills', role: 'list' },
            skills.map((skill) => el('li', { text: skill })),
          ),
        );
      }
      parts.push(
        el('button', {
          type: 'button',
          class: 'btn btn-secondary btn-small',
          'aria-label': `Practice ${domain.name}`,
          disabled: empty,
          text: 'Practice',
        }),
      );
      const classes = `card glance-card${empty ? ' is-empty' : ''}`;
      return el('article', { class: classes, 'data-domain': domain.id }, parts);
    }),
  );
  byId('totals').textContent =
    `${plural(listTemplates().length, 'template')} · ${grouped.format(totalSpace())}+ distinct questions`;

  grid.addEventListener('click', (event) => {
    const chosen = event.target.closest('.glance-card:not(.is-empty)');
    if (!chosen) return;
    // Releasing a text selection inside the card is a click too, but not a choice.
    if (!event.target.closest('.btn') && String(getSelection())) return;
    domainSelect.value = chosen.dataset.domain;
    fillSkills(chosen.dataset.domain);
    draw({ focus: true });
  });
}

/* Controls */

function clearSeedError() {
  seedError.hidden = true;
  seedError.textContent = '';
  seedInput.removeAttribute('aria-invalid');
}

// An invalid seed is reverted and said so, under the field and in the live region.
function applySeed() {
  const value = Number(seedInput.value);
  const valid = seedInput.value !== '' && Number.isInteger(value) && value >= 0 && value <= 0xffffffff;
  if (!valid) {
    seedInput.value = state.seed == null ? '' : String(state.seed);
    const message =
      `Seed must be a whole number from 0 to ${grouped.format(0xffffffff)}` +
      (state.seed == null ? '' : `; kept seed ${state.seed}`);
    seedError.textContent = message;
    seedError.hidden = false;
    seedInput.setAttribute('aria-invalid', 'true');
    live.textContent = message;
  } else if (state.templateId && value !== state.seed) {
    show(state.templateId, value, { scroll: stacked.matches });
  } else {
    clearSeedError();
  }
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  applySeed();
});

seedInput.addEventListener('input', clearSeedError);
seedInput.addEventListener('change', applySeed);
seedInput.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter') return;
  event.preventDefault();
  applySeed();
});

domainSelect.addEventListener('change', () => {
  fillSkills(domainSelect.value);
  draw({ scroll: stacked.matches });
});

// Picking a skill keeps the seed: the same seed now shows that skill's question.
skillSelect.addEventListener('change', () => {
  const pool = matchingTemplates();
  if (!skillSelect.value || !pool.length || difficultySelect.value) {
    draw({ scroll: stacked.matches });
    return;
  }
  show(pool[randomBelow(pool.length)].id, state.seed == null ? randomSeed() : state.seed, {
    scroll: stacked.matches,
  });
});

difficultySelect.addEventListener('change', () => draw({ scroll: stacked.matches }));

byId('new').addEventListener('click', () => draw({ focus: stacked.matches }));

// The link is built from the state, not read from the address bar, which lags
// behind while replaceState is throttled.
function permalink() {
  const url = new URL(location.href);
  url.searchParams.set('t', state.templateId);
  url.searchParams.set('s', String(state.seed));
  url.searchParams.delete('d');
  if (difficultySelect.value) url.searchParams.set('level', difficultySelect.value);
  else url.searchParams.delete('level');
  return url.href;
}

let copyTimer = 0;
copyButton.addEventListener('click', async () => {
  const href = permalink();
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(href);
      copyButton.textContent = 'Copied';
      live.textContent = 'Link copied';
      clearTimeout(copyTimer);
      copyTimer = setTimeout(() => {
        copyButton.textContent = 'Copy link';
      }, 1500);
      return;
    } catch {
      // Clipboard access was refused: fall through to the selectable field.
    }
  }
  linkField.hidden = false;
  linkInput.value = href;
  linkInput.focus();
  linkInput.setSelectionRange(0, href.length);
});

// 1–4 and A–D pick a choice while the question card has focus; elsewhere on the
// page the keys keep their usual meaning.
card.addEventListener('keydown', (event) => {
  if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
  const target = event.target;
  if (!(target instanceof Element)) return;
  if (target.closest('input, select, textarea') || target.isContentEditable) return;
  const key = event.key.toUpperCase();
  const index = KEYS.includes(key) ? KEYS.indexOf(key) : DIGITS.indexOf(key);
  if (index === -1) return;
  const choice = card.querySelectorAll('.choice')[index];
  if (choice && !choice.disabled) choice.click();
});

/* Start */

fillDomains();
fillSkills('');
renderGlance();

const params = new URLSearchParams(location.search);
if (['1', '2', '3'].includes(params.get('level'))) difficultySelect.value = params.get('level');
const requested = params.get('t');
const template = requested ? listTemplates().find((t) => t.id === requested) : null;
const requestedDomain = DOMAINS.find((d) => d.id === params.get('d'));
if (template) {
  domainSelect.value = template.domain;
  fillSkills(template.domain);
  selectSkillOf(template);
  show(template.id, parseSeed(params.get('s')));
} else {
  // A domain landing starts with every skill available. Once drawn, the URL
  // becomes the exact question permalink; an explicit valid ?t always wins.
  if (requestedDomain) {
    domainSelect.value = requestedDomain.id;
    fillSkills(requestedDomain.id);
  }
  draw();
  note.textContent = 'That question link was not recognized, so here is a new one.';
  note.hidden = !requested;
}
