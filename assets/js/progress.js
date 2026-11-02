import { DOMAINS, generate, getTemplate, listTemplates } from '../../src/questions/index.js';
import {
  PROGRESS_KEY,
  MAX_BACKUP_BYTES,
  readProgress,
  summarize,
  exportProgress,
  importProgress,
  clearProgress,
} from '../../src/learning/progress.js';

const $ = (id) => document.getElementById(id);
function el(tag, attributes = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attributes)) {
    if (key === 'text') node.textContent = value;
    else if (key === 'class') node.className = value;
    else node.setAttribute(key, value);
  }
  node.append(...children);
  return node;
}
function bankLink(templateId, seed) {
  const params = new URLSearchParams({ t: templateId });
  if (seed !== undefined) params.set('s', String(seed));
  return `bank.html?${params}`;
}
function metric(value, title, note) {
  return el('article', { class: 'card progress-metric' }, [
    el('p', { class: 'small muted', text: title }),
    el('strong', { text: value }),
    el('span', { class: 'small muted', text: note }),
  ]);
}
function empty(title, description, linkText = 'Open the question bank', href = 'bank.html') {
  return el('div', { class: 'card empty-progress' }, [
    el('h3', { text: title }),
    el('p', { class: 'muted', text: description }),
    el('a', { class: 'text-link', href, text: `${linkText} →` }),
  ]);
}
function attemptRow(attempt, showStem = false) {
  const template = getTemplate(attempt.templateId);
  const date = new Date(attempt.at);
  const children = [
    el('div', { class: 'attempt-top' }, [
      el('span', {
        class: `result-badge ${attempt.correct ? 'result-correct' : 'result-review'}`,
        text: attempt.correct ? 'Correct' : 'Revisit',
      }),
      el('time', {
        datetime: date.toISOString(),
        class: 'small muted',
        text: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      }),
    ]),
    el('h3', { text: template.skill }),
  ];
  if (showStem)
    children.push(el('p', { class: 'attempt-stem', text: generate(attempt.templateId, attempt.seed).stem }));
  children.push(
    el('div', { class: 'attempt-footer' }, [
      el('span', {
        class: 'small muted',
        text: `${attempt.source === 'practice' ? 'Practice session' : 'Question bank'} · Seed ${attempt.seed}`,
      }),
      el('a', {
        class: 'text-link',
        href: bankLink(attempt.templateId, attempt.seed),
        'aria-label': `Revisit ${template.skill}, seed ${attempt.seed}`,
        text: 'Revisit →',
      }),
    ]),
  );
  return el('article', { class: 'card attempt-row', tabindex: '-1' }, children);
}

let shownReview = 6;
function render() {
  const saved = readProgress();
  const summary = summarize(saved.attempts);
  $('storage-notice').hidden = saved.persisted;
  $('storage-notice').textContent = saved.error || '';
  $('export').disabled = !saved.persisted || !saved.attempts.length;
  $('metrics').replaceChildren(
    metric(summary.attempted, 'Questions attempted', 'Distinct questions on this device'),
    metric(
      summary.accuracy === null ? '—' : `${summary.accuracy}%`,
      'First-attempt accuracy',
      summary.attempted
        ? `${summary.correct} correct out of ${summary.attempted}`
        : 'Answer a question to begin',
    ),
    metric(
      summary.attempted - summary.correct,
      'Questions to revisit',
      'A starting point for focused practice',
    ),
    metric(
      summary.domains.filter((d) => d.attempted).length + ' / 4',
      'Domains explored',
      'Build range across the Math section',
    ),
  );
  const next = summary.weakest;
  const nextTemplate = next?.templateId || listTemplates(summary.domains.find((d) => !d.attempted)?.id)[0].id;
  $('next-step').replaceChildren(
    el('div', { class: 'next-icon', 'aria-hidden': 'true', text: '↗' }),
    el('div', {}, [
      el('p', { class: 'eyebrow', text: 'Recommended next step' }),
      el('h2', {
        class: 'subtitle',
        id: 'next-title',
        text: next
          ? `Focus on ${next.name.toLowerCase()}.`
          : summary.attempted
            ? 'Keep building your range.'
            : 'Start with one question.',
      }),
      el('p', {
        class: 'muted',
        text: next
          ? `You got ${next.correct} of ${next.attempted} first attempts right in this skill. Try a fresh question, then read the worked solution.`
          : 'Try a fresh question, check your reasoning, and see your progress take shape here.',
      }),
    ]),
    el('a', {
      class: 'btn btn-primary',
      href: bankLink(nextTemplate),
      text: next ? 'Practice this skill' : 'Try a question',
    }),
  );
  $('domains').replaceChildren(
    ...summary.domains.map((domain, index) => {
      const percent = domain.attempted ? Math.round((100 * domain.correct) / domain.attempted) : 0;
      return el('article', { class: 'card domain-progress' }, [
        el('span', { class: 'domain-number', text: `0${index + 1}` }),
        el('h3', { text: domain.name }),
        el('div', { class: 'domain-score' }, [
          el('strong', { text: domain.attempted ? `${percent}%` : '—' }),
          el('span', {
            class: 'small muted',
            text: domain.attempted ? `${domain.correct} / ${domain.attempted} correct` : 'Not practiced yet',
          }),
        ]),
        el('progress', {
          max: '100',
          value: percent,
          'aria-label': `${domain.name} first-attempt accuracy`,
          'aria-valuetext': domain.attempted
            ? `${percent} percent from ${domain.attempted} attempt${domain.attempted === 1 ? '' : 's'}`
            : 'No attempts yet',
        }),
        el('a', {
          class: 'text-link',
          href: `bank.html?d=${encodeURIComponent(domain.id)}`,
          text: 'Practice domain →',
        }),
      ]);
    }),
  );
  const missed = saved.attempts.filter((a) => !a.correct).reverse();
  $('review-count').textContent = `${missed.length} to revisit`;
  $('review-list').replaceChildren(
    ...(missed.length
      ? missed.slice(0, shownReview).map((a) => attemptRow(a, true))
      : [
          empty(
            summary.attempted ? 'No missed questions yet.' : 'Your review queue starts here.',
            summary.attempted
              ? 'Try a timed session or explore another skill to keep learning.'
              : 'Questions you miss will appear here with an exact link to try them again.',
          ),
        ]),
  );
  if (missed.length > shownReview) {
    const more = el('button', {
      class: 'btn btn-secondary',
      type: 'button',
      text: `Show more (${missed.length - shownReview} remaining)`,
    });
    more.addEventListener('click', () => {
      const firstNew = shownReview;
      shownReview += 6;
      render();
      const row = $('review-list').querySelectorAll('.attempt-row')[firstNew];
      row?.focus({ preventScroll: true });
      row?.scrollIntoView({ block: 'nearest' });
    });
    $('review-list').append(more);
  }
  $('recent-list').replaceChildren(
    ...(saved.attempts.length
      ? saved.attempts
          .slice(-5)
          .reverse()
          .map((a) => attemptRow(a))
      : [empty('Every answer is a step forward.', 'Your latest five distinct questions will appear here.')]),
  );
}

$('export').addEventListener('click', () => {
  try {
    const url = URL.createObjectURL(new Blob([exportProgress()], { type: 'application/json' }));
    const anchor = el('a', {
      href: url,
      download: `axiom-progress-${new Date().toISOString().slice(0, 10)}.json`,
    });
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    $('data-message').textContent = 'Your progress backup is ready. Keep it somewhere you can find it.';
  } catch (error) {
    $('data-message').textContent = error.message;
  }
});
$('backup-file').addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    if (file.size > MAX_BACKUP_BYTES) throw new Error('This file is too large for an Axiom progress backup.');
    const result = importProgress(await file.text());
    render();
    $('data-message').textContent =
      `Backup merged: ${result.added} new question${result.added === 1 ? '' : 's'}, ${result.total} retained in total.`;
  } catch (error) {
    $('data-message').textContent = `Could not restore: ${error.message}`;
  }
  event.target.value = '';
});
$('reset').addEventListener('click', () => {
  $('reset-dialog').returnValue = 'cancel';
  $('reset-dialog').showModal();
});
$('reset-dialog').addEventListener('close', () => {
  if ($('reset-dialog').returnValue !== 'reset') return;
  if (clearProgress()) {
    render();
    $('data-message').textContent = 'Saved progress was reset on this device.';
  } else $('data-message').textContent = 'The browser did not allow progress to be reset.';
});
window.addEventListener('storage', (event) => {
  if (event.key === PROGRESS_KEY || event.key === null) render();
});
window.addEventListener('pageshow', render);
render();
