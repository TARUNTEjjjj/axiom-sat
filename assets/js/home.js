// Home page: reveals blocks as they scroll into view, tilts the hero product
// toward the pointer, and asks the question engine for the live numbers and the
// hero item so the page never drifts from what the bank actually generates.

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const noHover = matchMedia('(hover: none)');

revealOnScroll(document.querySelectorAll('.reveal'));
tilt(document.querySelector('.tilt'), document.querySelector('.hero-card'));

// A dynamic import keeps a broken engine from taking the reveals down with it;
// the static markup already shows the same item and numbers.
import('../../src/questions/index.js')
  .then((engine) => {
    fillStats(engine);
    renderHero(engine, engine.generate('algebra.linear-one-var', 48213));
  })
  .catch((error) => console.warn('question engine unavailable', error));

function revealOnScroll(blocks) {
  if (!('IntersectionObserver' in window) || reduceMotion.matches) {
    for (const block of blocks) block.classList.add('is-visible');
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    }
  }, { threshold: 0.2 });
  for (const block of blocks) observer.observe(block);
}

// The side of the card under the pointer lifts toward the viewer, within ±8°.
// A rAF loop eases the angles toward the target and stops once it arrives, so
// an idle card costs nothing. Touch devices float the card in CSS instead.
function tilt(wrapper, card) {
  if (!wrapper || !card || reduceMotion.matches || noHover.matches) return;

  const MAX_DEG = 8;
  const EASE = 0.12;
  let rect = null;
  let targetX = 0;
  let targetY = 0;
  let angleX = 0;
  let angleY = 0;
  let frame = 0;

  const measure = () => {
    rect = wrapper.getBoundingClientRect();
  };

  const step = () => {
    angleX += (targetX - angleX) * EASE;
    angleY += (targetY - angleY) * EASE;
    const settled = Math.abs(targetX - angleX) < 0.02 && Math.abs(targetY - angleY) < 0.02;
    if (settled) {
      angleX = targetX;
      angleY = targetY;
    }
    card.style.transform =
      angleX === 0 && angleY === 0
        ? ''
        : `rotateX(${angleX.toFixed(2)}deg) rotateY(${angleY.toFixed(2)}deg)`;
    frame = settled ? 0 : requestAnimationFrame(step);
  };

  const run = () => {
    if (!frame) frame = requestAnimationFrame(step);
  };

  const clamp = (value) => Math.max(-0.5, Math.min(0.5, value));

  wrapper.addEventListener('pointerenter', measure, { passive: true });
  wrapper.addEventListener('pointermove', (event) => {
    if (!rect) measure();
    if (!rect.width || !rect.height) return;
    const px = clamp((event.clientX - rect.left) / rect.width - 0.5);
    const py = clamp((event.clientY - rect.top) / rect.height - 0.5);
    targetX = py * 2 * MAX_DEG;
    targetY = -px * 2 * MAX_DEG;
    run();
  }, { passive: true });
  wrapper.addEventListener('pointerleave', () => {
    targetX = 0;
    targetY = 0;
    run();
  }, { passive: true });

  // The cached rect goes stale when the page resizes or scrolls under the pointer.
  window.addEventListener('resize', () => {
    if (rect) measure();
  }, { passive: true });
  window.addEventListener('scroll', () => {
    rect = null;
  }, { passive: true });
}

function fillStats({ listTemplates, totalSpace, DOMAINS }) {
  const count = listTemplates().length;
  setStat('templates', String(count), count === 1 ? 'Question template' : 'Question templates');
  // 28.2M+ fits the tile at every width; the exact lower bound lives on the bank page.
  const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
  setStat('space', compact.format(totalSpace()) + '+');
  setStat('domains', String(DOMAINS.length));
}

function setStat(name, value, label) {
  const number = document.querySelector(`[data-stat="${name}"]`);
  if (number) number.textContent = value;
  const caption = document.querySelector(`[data-stat-label="${name}"]`);
  if (caption && label) caption.textContent = label;
}

// Rewrites the static hero card from the engine's own item, text only.
function renderHero({ DOMAINS }, item) {
  const card = document.querySelector('.hero-card');
  if (!card || item.type !== 'mc') return;

  const domain = DOMAINS.find((d) => d.id === item.domain);
  setField(card, 'domain', domain ? domain.name : item.domain);
  setField(card, 'skill', item.skill);
  setField(card, 'difficulty', `Difficulty ${item.difficulty} of 3`);
  setField(card, 'stem', item.stem);
  setField(card, 'explanation', item.explanation);

  const choices = card.querySelectorAll('.choice');
  item.choices.forEach((choice, i) => {
    const el = choices[i];
    if (!el) return;
    const correct = choice.key === item.answer;
    el.querySelector('.choice-key').textContent = choice.key;
    el.querySelector('.choice-text').textContent = choice.text;
    el.classList.toggle('is-correct', correct);
    const note = el.querySelector('.sr-only');
    if (correct && !note) {
      const span = document.createElement('span');
      span.className = 'sr-only';
      span.textContent = 'Correct answer';
      el.append(span);
    } else if (!correct && note) {
      note.remove();
    }
  });
}

function setField(root, name, text) {
  const el = root.querySelector(`[data-field="${name}"]`);
  if (el) el.textContent = text;
}
