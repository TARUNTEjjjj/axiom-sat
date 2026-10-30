// Turns same-origin link clicks into a 3D page turn: the current page animates
// away (see transitions.css), then the browser navigates as usual.

const html = document.documentElement;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

function isPlainNavigation(anchor, event) {
  if (event.defaultPrevented || event.button !== 0) return false;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
  if (anchor.target && anchor.target !== '_self') return false;
  if (anchor.hasAttribute('download') || anchor.hasAttribute('data-no-transition')) return false;

  const url = new URL(anchor.href, location.href);
  if (url.origin !== location.origin) return false;
  // An in-page anchor just scrolls.
  const samePage = url.pathname === location.pathname && url.search === location.search;
  return !(samePage && url.hash);
}

document.addEventListener('click', (event) => {
  const anchor = event.target.closest('a[href]');
  if (!anchor || !isPlainNavigation(anchor, event)) return;

  event.preventDefault();
  const href = anchor.href;
  const page = document.querySelector('.page');
  if (!page || reduceMotion.matches || html.classList.contains('is-leaving')) {
    location.href = href;
    return;
  }

  let navigated = false;
  const go = () => {
    if (navigated) return;
    navigated = true;
    location.href = href;
  };
  page.addEventListener('animationend', (e) => {
    if (e.target === page) go();
  });
  html.classList.add('is-leaving');
  setTimeout(go, 700); // in case animationend never fires
});

// The back/forward cache restores the page frozen mid-turn; put it back.
window.addEventListener('pageshow', (event) => {
  if (event.persisted) html.classList.remove('is-leaving');
});
