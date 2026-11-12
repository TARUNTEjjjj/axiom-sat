import { DOMAINS } from '../../src/questions/index.js';
import { recordAttempts } from '../../src/learning/progress.js';
import {
  SESSION_KEY,
  MODES,
  createSession,
  createRetrySession,
  normalizeCustom,
  customMinutes,
  sessionName,
  sessionItems,
  restoreSession,
  remainingSeconds,
  finishSession,
  gradeSession,
  responseIsValid,
} from '../../src/practice/session.js';
import { MAX_SPR_INPUT_LENGTH, normalizeSpr, parseSpr } from '../../src/questions/spr.js';
import { subscribeSessionChanges } from '../../src/practice/sync.js';

const root = document.getElementById('practice-app');
const status = document.getElementById('save-status');
const live = document.getElementById('practice-live');
const dialog = document.getElementById('finish-dialog');
let session = null;
let items = [];
let reviewFilter = 'all';
let timerWarning = false;
let persistWarning = false;
let finishTarget = null;
const el = (tag, attrs = {}, children = []) => {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === false || value == null) continue;
    if (key === 'text') node.textContent = String(value);
    else if (key === 'class') node.className = value;
    else node.setAttribute(key, value === true ? '' : String(value));
  }
  node.append(...children);
  return node;
};
const button = (text, action, attrs = {}) => {
  const node = el('button', {
    type: 'button',
    class: 'btn btn-secondary',
    text,
    ...attrs,
  });
  node.addEventListener('click', action);
  return node;
};
function storageWarning() {
  persistWarning = true;
  status.classList.add('is-warning');
  status.textContent =
    'Browser storage is unavailable or full. You can keep practicing here, but your session or progress may not survive leaving this page.';
}
function persist() {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    if (!persistWarning) {
      status.textContent =
        session.finishedAt !== null
          ? 'Session complete. Your results are saved on this browser.'
          : session.timed
            ? 'Session saved on this browser. The timer keeps counting while you are away.'
            : 'Session saved on this browser. Return whenever you are ready to continue.';
    }
    return true;
  } catch {
    storageWarning();
    return false;
  }
}
function restore() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    session = restoreSession(raw);
    if (raw && !session) {
      status.textContent =
        'An old or invalid saved session could not be resumed. Start a fresh session below.';
      localStorage.removeItem(SESSION_KEY);
    }
  } catch {
    storageWarning();
  }
  if (session) items = sessionItems(session);
}
function answerCount() {
  return session.responses.filter((response, i) => response.trim() && responseIsValid(items[i], response))
    .length;
}
function expired() {
  if (session && session.finishedAt === null && session.timed && remainingSeconds(session) === 0) {
    complete();
    return true;
  }
  return false;
}
function complete() {
  if (!session || session.finishedAt !== null) return;
  // A half-typed fraction is a draft, not a submitted answer.
  session.responses = session.responses.map((response, i) =>
    responseIsValid(items[i], response) ? response.trim() : '',
  );
  session = finishSession(session);
  persist();
  const result = gradeSession(session);
  if (dialog.open) dialog.close('expired');
  renderResults();
  live.textContent = `${session.expired ? 'Time is up. ' : ''}Session complete. ${result.correct} correct, ${result.incorrect} incorrect, ${result.skipped} skipped.`;
  document.getElementById('result-heading').focus({ preventScroll: true });
  root.scrollIntoView({ block: 'start' });
}
const SETTINGS_KEY = 'axiom.practice.settings.v1';
const DIFFICULTIES = ['Mixed difficulty', 'Foundation', 'Standard', 'Challenge'];
function readSetup() {
  const defaults = { mode: 'sprint', timed: true, custom: normalizeCustom() };
  try {
    const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY));
    if (!stored || !['sprint', 'module', 'custom'].includes(stored.mode) || typeof stored.timed !== 'boolean')
      return defaults;
    return {
      mode: stored.mode,
      timed: stored.timed,
      custom: normalizeCustom(stored.custom),
    };
  } catch {
    return defaults;
  }
}
function customDescription(custom) {
  return `${custom.domain === 'all' ? 'All domains' : DOMAINS.find((domain) => domain.id === custom.domain).name} · ${DIFFICULTIES[custom.difficulty]}`;
}
function renderSetup() {
  const saved = readSetup();
  const params = new URLSearchParams(location.search);
  const preferredMode = params.get('mode');
  const selectedMode = ['sprint', 'module', 'custom'].includes(preferredMode) ? preferredMode : saved.mode;
  let preferredCustom = saved.custom;
  if (preferredMode === 'custom') {
    const domain = params.get('domain');
    const difficulty = params.get('difficulty');
    const count = params.get('count');
    preferredCustom = normalizeCustom({
      domain: ['all', ...DOMAINS.map((d) => d.id)].includes(domain) ? domain : 'all',
      difficulty: ['0', '1', '2', '3'].includes(difficulty) ? Number(difficulty) : 0,
      count: ['5', '10', '20'].includes(count) ? Number(count) : 10,
    });
  }
  const form = el('form', { class: 'practice-setup' });
  const fieldset = el('fieldset', { class: 'mode-grid' }, [el('legend', { text: 'Choose your session' })]);
  const modes = {
    ...MODES,
    custom: { name: 'Build your own', count: '5–20', minutes: 'Your pace' },
  };
  for (const [id, mode] of Object.entries(modes)) {
    fieldset.append(
      el('label', { class: 'mode-card card' }, [
        el('input', {
          type: 'radio',
          name: 'mode',
          value: id,
          checked: id === selectedMode,
        }),
        el('span', { class: 'eyebrow', text: mode.name }),
        el('span', { class: 'mode-number', text: mode.count }),
        el('span', {
          class: 'small muted',
          text: id === 'custom' ? 'questions · your focus' : `questions · ${mode.minutes} minutes`,
        }),
        el('p', {
          text:
            id === 'sprint'
              ? 'A compact daily workout across all four math domains. Start small, finish strong.'
              : id === 'module'
                ? 'Practice the length and timing of one math module, with a fresh mix of all four domains.'
                : 'Choose a domain, raise the difficulty, and work on exactly what you need.',
        }),
      ]),
    );
  }
  function select(id, label, options, value) {
    const control = el(
      'select',
      { id, name: id },
      options.map(([optionValue, text]) =>
        el('option', {
          value: optionValue,
          text,
          selected: String(optionValue) === String(value),
        }),
      ),
    );
    return {
      control,
      field: el('div', { class: 'custom-field' }, [el('label', { for: id, text: label }), control]),
    };
  }
  const domain = select(
    'practice-domain',
    'Math domain',
    [['all', 'All domains'], ...DOMAINS.map((d) => [d.id, d.name])],
    preferredCustom.domain,
  );
  const difficulty = select(
    'practice-difficulty',
    'Difficulty',
    DIFFICULTIES.map((name, value) => [value, name]),
    preferredCustom.difficulty,
  );
  const count = select(
    'practice-count',
    'Session length',
    [5, 10, 20].map((n) => [n, `${n} questions`]),
    preferredCustom.count,
  );
  const customPanel = el('fieldset', { class: 'custom-setup card' }, [
    el('legend', { text: 'Make this session yours' }),
    el('div', { class: 'custom-fields' }, [domain.field, difficulty.field, count.field]),
    el('p', {
      class: 'small muted',
      text: 'Challenge questions need more steps and deeper reasoning. These difficulty labels describe Axiom practice; they are not calibrated SAT levels.',
    }),
  ]);
  const timed = el('input', {
    type: 'checkbox',
    checked: saved.timed,
    id: 'use-timer',
  });
  const timerBudget = el('p', {
    class: 'timer-budget',
    id: 'timer-budget',
    role: 'status',
  });
  const setupError = el('p', { class: 'setup-error', role: 'alert' });
  function selectedCustom() {
    return normalizeCustom({
      domain: domain.control.value,
      difficulty: Number(difficulty.control.value),
      count: Number(count.control.value),
    });
  }
  function updateSetup() {
    const mode = new FormData(form).get('mode');
    const isCustom = mode === 'custom';
    customPanel.hidden = !isCustom;
    customPanel.disabled = !isCustom;
    const minutes = isCustom ? customMinutes(selectedCustom()) : MODES[mode].minutes;
    timerBudget.textContent = timed.checked
      ? `${minutes} minutes total${isCustom ? ' · 2 minutes per question' : ''}. The timer keeps running if you leave or reload.`
      : 'Untimed: work at your own pace, with answers and flags saved as you go.';
    setupError.textContent = '';
  }
  form.append(
    fieldset,
    customPanel,
    el('div', { class: 'setup-options card' }, [
      el('div', {}, [
        el('label', { class: 'timer-option', for: 'use-timer' }, [
          timed,
          el('span', {}, [
            el('strong', { text: 'Practice with a timer' }),
            el('small', {
              text: 'Turn this off to work at your own pace. Timed sessions end automatically.',
            }),
          ]),
        ]),
        timerBudget,
      ]),
      el('button', {
        type: 'submit',
        class: 'btn btn-primary',
        text: 'Start practicing →',
      }),
    ]),
    setupError,
    el('p', {
      class: 'setup-tip',
      text: 'Have paper and your calculator ready. You can change answers and flag questions until you finish. Solutions appear afterward; missed questions can be retried without a timer.',
    }),
  );
  form.addEventListener('change', updateSetup);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const mode = new FormData(form).get('mode');
    const custom = selectedCustom();
    try {
      session = createSession({
        mode,
        custom,
        seed: crypto.getRandomValues(new Uint32Array(1))[0],
        timed: timed.checked,
      });
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify({ mode, custom, timed: timed.checked }));
      } catch {
        storageWarning();
      }
      items = sessionItems(session);
      timerWarning = false;
      reviewFilter = 'all';
      persist();
      renderActive(true);
    } catch (error) {
      setupError.textContent = error.message || 'This session could not start. Reload and try again.';
    }
  });
  root.replaceChildren(form);
  updateSetup();
}
function renderTable(table) {
  return el(
    'div',
    {
      class: 'practice-table-scroll',
      tabindex: '0',
      role: 'region',
      'aria-label': 'Question data table',
    },
    [
      el('table', { class: 'q-table' }, [
        el('caption', { text: table.caption || 'Data for this question' }),
        el('thead', {}, [
          el(
            'tr',
            {},
            table.headers.map((text) => el('th', { scope: 'col', text })),
          ),
        ]),
        el(
          'tbody',
          {},
          table.rows.map((row) =>
            el(
              'tr',
              {},
              // A first cell that is not a number labels its row, as in a two-way table.
              row.map((text, i) =>
                i === 0 && parseSpr(String(text)) === null ? el('th', { scope: 'row', text }) : el('td', { text }),
              ),
            ),
          ),
        ),
      ]),
    ],
  );
}
function saveResponse(response) {
  if (expired() || session.finishedAt !== null) return;
  session.responses[session.index] = response;
  persist();
  updateNavigation();
}
function navigate(index) {
  if (expired() || session.finishedAt !== null) return;
  session.index = index;
  persist();
  renderActive(true);
}
function updateNavigation() {
  const answered = answerCount();
  const label = document.getElementById('answer-count');
  if (label)
    label.textContent = `${answered} of ${items.length} answered · ${session.flags.filter(Boolean).length} flagged`;
  const navigator = document.getElementById('question-numbers');
  if (!navigator) return;
  navigator.replaceChildren(
    ...items.map((item, i) => {
      const done = session.responses[i].trim() !== '' && responseIsValid(item, session.responses[i]);
      const flagged = session.flags[i];
      return button(String(i + 1), () => navigate(i), {
        class: `question-number${done ? ' is-answered' : ''}${flagged ? ' is-flagged' : ''}`,
        'aria-current': i === session.index ? 'step' : null,
        'aria-label': `Question ${i + 1}, ${done ? 'answered' : 'unanswered'}${flagged ? ', flagged' : ''}`,
      });
    }),
  );
}
function renderActive(focus = false) {
  if (session.finishedAt !== null) {
    renderResults();
    return;
  }
  if (expired()) return;
  const item = items[session.index];
  const flag = button(
    session.flags[session.index] ? '⚑ Flagged for review' : '⚐ Flag for review',
    () => {
      if (expired()) return;
      session.flags[session.index] = !session.flags[session.index];
      flag.textContent = session.flags[session.index] ? '⚑ Flagged for review' : '⚐ Flag for review';
      flag.setAttribute('aria-pressed', String(session.flags[session.index]));
      persist();
      updateNavigation();
    },
    { 'aria-pressed': String(session.flags[session.index]) },
  );
  const card = el('article', { class: 'q-card practice-card', 'aria-labelledby': 'practice-stem' }, [
    el('div', { class: 'practice-tools' }, [
      el('span', {
        class: 'chip',
        text: `Question ${session.index + 1} of ${items.length}`,
      }),
      flag,
    ]),
    el('div', { class: 'q-meta' }, [
      el('span', {
        text: DOMAINS.find((domain) => domain.id === item.domain).name,
      }),
      el('span', { 'aria-hidden': true, text: '·' }),
      el('span', { text: item.skill }),
      el('span', {
        class: 'difficulty-label',
        text: DIFFICULTIES[item.difficulty],
      }),
    ]),
    el('h2', {
      class: 'q-stem',
      id: 'practice-stem',
      tabindex: '-1',
      text: item.stem,
    }),
  ]);
  if (item.table) card.append(renderTable(item.table));
  if (item.type === 'mc') {
    const list = el('ul', {
      class: 'choices',
      role: 'list',
      'aria-label': 'Choose one answer',
    });
    for (const choice of item.choices) {
      const option = button(
        '',
        () => {
          if (expired()) return;
          saveResponse(choice.key);
          for (const candidate of list.querySelectorAll('button'))
            candidate.setAttribute('aria-pressed', String(candidate === option));
        },
        {
          class: 'choice',
          'aria-pressed': String(session.responses[session.index] === choice.key),
        },
      );
      option.append(
        el('span', { class: 'choice-key', text: choice.key }),
        el('span', { class: 'choice-text', text: choice.text }),
      );
      list.append(el('li', {}, [option]));
    }
    card.append(list);
  } else {
    const input = el('input', {
      id: 'practice-response',
      type: 'text',
      autocomplete: 'off',
      'aria-describedby': 'response-hint response-error',
    });
    input.value = session.responses[session.index];
    const error = el('p', {
      id: 'response-error',
      class: 'input-error',
      'aria-live': 'polite',
    });
    const validate = () => {
      const tooLong = normalizeSpr(input.value).length > MAX_SPR_INPUT_LENGTH;
      const valid = responseIsValid(item, input.value);
      input.setAttribute('aria-invalid', String(!valid));
      error.textContent = tooLong
        ? 'This draft is too long to save. Shorten it; this question is currently unanswered.'
        : valid
        ? ''
        : 'Use a number or fraction, up to 5 characters plus a minus sign. Invalid entries remain unanswered.';
    };
    input.addEventListener('input', () => {
      const draft = normalizeSpr(input.value);
      // Never slice an answer: preserve the full visible draft, but clear its
      // saved answer if too large so a previous answer cannot be graded instead.
      const tooLong = draft.length > MAX_SPR_INPUT_LENGTH;
      saveResponse(tooLong ? '' : draft);
      if (tooLong || input.hasAttribute('aria-invalid')) validate();
    });
    input.addEventListener('blur', validate);
    card.append(
      el('div', { class: 'practice-response' }, [
        el('label', { for: 'practice-response', text: 'Your answer' }),
        input,
        el('p', {
          class: 'input-hint',
          id: 'response-hint',
          text: 'Enter a number, decimal or fraction such as 7/2. Your answer saves as you type.',
        }),
        error,
      ]),
    );
  }
  card.append(
    button(
      'Clear answer',
      () => {
        if (expired()) return;
        saveResponse('');
        renderActive(true);
      },
      { class: 'btn btn-secondary btn-small' },
    ),
    el('div', { class: 'practice-controls' }, [
      button('← Previous', () => navigate(session.index - 1), {
        disabled: session.index === 0,
      }),
      button(
        session.index === items.length - 1 ? 'Finish session' : 'Next question →',
        () => (session.index === items.length - 1 ? askFinish() : navigate(session.index + 1)),
        { class: 'btn btn-primary' },
      ),
    ]),
  );
  root.replaceChildren(
    el('div', { class: 'practice-toolbar' }, [
      el('div', {}, [
        el('h2', { text: sessionName(session) }),
        ...(session.custom
          ? [
              el('p', {
                class: 'small muted',
                text: customDescription(session.custom),
              }),
            ]
          : []),
        el('p', { class: 'small muted', id: 'answer-count' }),
      ]),
      el('div', {
        class: 'practice-clock',
        id: 'practice-clock',
        role: 'timer',
        'aria-label': 'Time remaining',
      }),
    ]),
    el('div', { class: 'practice-grid' }, [
      card,
      el(
        'aside',
        {
          class: 'card practice-navigator',
          'aria-label': 'Question navigator',
        },
        [
          el('h3', { text: 'Your questions' }),
          el('div', { class: 'number-grid', id: 'question-numbers' }),
          el('p', {
            class: 'nav-legend',
            text: 'Blue = answered · Gold dot = flagged. Select a number to jump to a question.',
          }),
          button('Finish & review', askFinish, { class: 'btn btn-primary' }),
          el('p', {
            class: 'small muted',
            text: 'Answers stay editable until you finish. Closing the page does not pause a timed session.',
          }),
        ],
      ),
    ]),
  );
  updateNavigation();
  tick();
  if (focus && session.finishedAt === null) {
    document.getElementById('practice-stem').focus({ preventScroll: true });
    card.scrollIntoView({ block: 'start' });
  }
}
function askFinish() {
  if (expired()) return;
  document.getElementById('finish-description').textContent =
    `${answerCount()} of ${items.length} answered. ${items.length - answerCount()} unanswered. ${session.flags.filter(Boolean).length} flagged for review.`;
  // Native dialogs retain their previous return value when reopened. Escape
  // must never reuse a prior session's confirmation.
  dialog.returnValue = '';
  finishTarget = session;
  dialog.showModal();
}
function answerLabel(item, response) {
  if (!response) return 'Not answered';
  return item.type === 'mc'
    ? `${response}. ${item.choices.find((choice) => choice.key === response)?.text || ''}`
    : response;
}
function saveFinishedProgress(result) {
  if (session.progressSaved) return;
  const attempts = result.rows.filter(row => row.response).map(row => ({
    templateId: row.item.templateId,
    seed: row.item.seed,
    response: row.response,
    source: 'practice',
    at: session.finishedAt,
  }));
  let savedAll = !attempts.length;
  try {
    if (attempts.length) savedAll = recordAttempts(attempts).persisted;
  } catch { savedAll = false; }
  // Keep results even when progress storage fails. A reload retries only the
  // incomplete write; duplicate attempts are idempotent in the progress store.
  session.progressSaved = savedAll;
  if (!savedAll) storageWarning();
  persist();
}
function renderResults() {
  const result = gradeSession(session);
  saveFinishedProgress(result);
  const elapsed = Math.max(0, Math.round((session.finishedAt - session.startedAt) / 60000));
  const review = el('div', { class: 'review-list', id: 'review-list' });
  const filters = el('div', {
    class: 'review-tools',
    role: 'group',
    'aria-label': 'Filter answer review',
  });
  const filterNames = {
    all: `All (${result.total})`,
    missed: `To review (${result.incorrect + result.skipped})`,
    flagged: `Flagged (${session.flags.filter(Boolean).length})`,
  };
  function fillReviews() {
    const filtered = result.rows
      .map((row, i) => ({ ...row, index: i }))
      .filter((row) => reviewFilter === 'all' || (reviewFilter === 'missed' ? !row.correct : row.flagged));
    review.replaceChildren(
      ...filtered.map((row) => {
        const { item } = row;
        const details = el('details', { class: 'card review-item' });
        const body = el('div', { class: 'review-body' }, [el('p', { class: 'q-stem', text: item.stem })]);
        if (item.table) body.append(renderTable(item.table));
        body.append(
          el('div', { class: 'review-answers' }, [
            el('div', {}, [
              el('span', { text: 'Your answer' }),
              el('strong', { text: answerLabel(item, row.response) }),
            ]),
            el('div', {}, [
              el('span', { text: 'Correct answer' }),
              el('strong', { text: answerLabel(item, item.answer) }),
            ]),
          ]),
          el('p', { class: 'explanation', text: item.explanation }),
          el('a', {
            class: 'review-link',
            href: `bank.html?t=${encodeURIComponent(item.templateId)}&s=${item.seed}`,
            text: 'Open this question in the bank →',
          }),
        );
        details.append(
          el('summary', {}, [
            el('span', {
              class: `review-status is-${row.status}`,
              text:
                row.status === 'correct' ? 'Correct' : row.status === 'incorrect' ? 'Incorrect' : 'Skipped',
            }),
            el('span', { class: 'review-summary' }, [
              el('strong', { text: `${row.index + 1}. ${item.skill}` }),
              el('span', {
                text: `${DOMAINS.find((domain) => domain.id === item.domain).name}${row.flagged ? ' · Flagged' : ''}`,
              }),
            ]),
          ]),
          body,
        );
        return details;
      }),
    );
    if (!filtered.length)
      review.append(
        el('p', {
          class: 'review-empty',
          text:
            reviewFilter === 'missed'
              ? 'Every answer was correct. Nice work — try a fresh session when you are ready.'
              : 'No flagged questions in this session.',
        }),
      );
  }
  for (const [id, name] of Object.entries(filterNames)) {
    const control = button(
      name,
      () => {
        reviewFilter = id;
        for (const node of filters.querySelectorAll('button'))
          node.setAttribute('aria-pressed', String(node === control));
        fillReviews();
      },
      {
        class: 'btn btn-secondary btn-small',
        'aria-pressed': String(reviewFilter === id),
      },
    );
    filters.append(control);
  }
  root.replaceChildren(
    el('div', { class: 'practice-results-head' }, [
      el('div', {}, [
        el('h2', {
          id: 'result-heading',
          tabindex: '-1',
          text: session.expired ? 'Time’s up. Let’s learn from it.' : 'Good work. Now make it stick.',
        }),
        el('p', {
          class: 'muted',
          text: `${sessionName(session)} · ${session.timed ? 'Timed' : 'Untimed'} · ${elapsed < 1 ? 'Less than a minute' : `${elapsed} minute${elapsed === 1 ? '' : 's'}`}`,
        }),
      ]),
      el('div', { class: 'practice-actions' }, [
        button(
          `Retry missed (${result.incorrect + result.skipped})`,
          () => {
            try {
              session = createRetrySession(session);
              items = sessionItems(session);
              reviewFilter = 'all';
              timerWarning = false;
              persist();
              renderActive(true);
              live.textContent = `Untimed retry started with ${items.length} question${items.length === 1 ? '' : 's'}. First-attempt progress is preserved.`;
            } catch (error) {
              live.textContent = error.message;
            }
          },
          {
            disabled: result.incorrect + result.skipped === 0,
            class: 'btn btn-primary',
          },
        ),
        button('Start a fresh session', () => {
          session = null;
          items = [];
          try {
            localStorage.removeItem(SESSION_KEY);
          } catch {
            storageWarning();
          }
          if (!persistWarning) status.textContent = 'Your session stays on this browser. No account needed.';
          renderSetup();
        }),
        el('a', {
          class: 'btn btn-primary',
          href: 'progress.html',
          text: 'View my progress →',
        }),
      ]),
    ]),
    el(
      'div',
      { class: 'result-metrics' },
      [
        ['Accuracy', `${Math.round((result.correct / result.total) * 100)}%`],
        ['Correct', result.correct],
        ['Incorrect', result.incorrect],
        ['Skipped', result.skipped],
      ].map(([label, value]) =>
        el('div', { class: 'card result-metric' }, [
          el('strong', { text: value }),
          el('span', { text: label }),
        ]),
      ),
    ),
    el('p', {
      class: 'small muted',
      text:
        session.mode === 'retry'
          ? 'This retry shows how you did on the same questions. Your first-attempt progress stays unchanged for previously answered questions; answering a previously skipped question records its first attempt.'
          : 'Session accuracy includes skipped questions. Retry missed questions to practice the exact problems again. Progress records only your first answer to each unique question, so retries do not inflate it.',
    }),
    el('h3', { class: 'subtitle', text: 'Your results by domain' }),
    el('ul', { class: 'domain-results' }, result.domains.map(result =>
      el('li', {}, [
        el('strong', { text: `${DOMAINS.find(domain => domain.id === result.domain).name}: ` }),
        el('span', { text: `${result.correct}/${result.total} correct · ${result.incorrect} incorrect · ${result.skipped} skipped` }),
      ]),
    )),
    el('h3', { class: 'subtitle', text: 'Review the reasoning' }),
    filters,
    review,
  );
  fillReviews();
}
function tick() {
  if (!session || session.finishedAt !== null || expired()) return;
  const clock = document.getElementById('practice-clock');
  if (!clock) return;
  const seconds = remainingSeconds(session);
  clock.textContent =
    seconds === null
      ? 'Untimed practice'
      : `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')} left`;
  clock.classList.toggle('is-low', seconds !== null && seconds <= 300);
  if (seconds !== null && seconds <= 300 && !timerWarning) {
    timerWarning = true;
    live.textContent = 'Five minutes or less remain in this session.';
  }
}
dialog.addEventListener('close', () => {
  // A queued close event from a previous dialog must not affect a reopened one.
  if (dialog.open) return;
  const target = finishTarget;
  finishTarget = null;
  if (dialog.returnValue === 'finish' && target === session) complete();
});
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) tick();
});
window.addEventListener('pageshow', tick);
subscribeSessionChanges(window, () => localStorage, (next) => {
  // Revoke the old confirmation before adopting another tab's answers or a new
  // session. close() queues its event, so also discard the captured target.
  finishTarget = null;
  dialog.returnValue = 'external-change';
  if (dialog.open) dialog.close('external-change');
  session = next;
  items = next ? sessionItems(next) : [];
  timerWarning = false;
  if (!next && !persistWarning) status.textContent = 'Your session stays on this browser. No account needed.';
  if (!next) renderSetup();
  else if (next.finishedAt !== null) renderResults();
  else renderActive();
  live.textContent = 'Practice updated from another tab in this browser.';
}, storageWarning);
try {
  restore();
  if (!session) renderSetup();
  else if (session.finishedAt !== null) renderResults();
  else renderActive();
  setInterval(tick, 1000);
} catch {
  root.replaceChildren(
    el('p', {
      role: 'alert',
      text: 'Practice could not load. Your question bank is still available; reload this page to try again.',
    }),
    el('a', {
      class: 'btn btn-primary',
      href: 'bank.html',
      text: 'Open the question bank',
    }),
  );
}
