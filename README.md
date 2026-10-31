# Axiom

Open-source SAT Math practice, built with plain HTML, CSS and JavaScript. No build step, no dependencies.

Live at https://axiom-sat.pages.dev. Example question: https://axiom-sat.pages.dev/bank?t=algebra.linear-one-var&s=48213

## What is here

- **Home page** (`index.html`): a product-style overview with a question card that tilts in 3D toward the pointer and sections that settle into place as you scroll. Moving between pages is a 3D page turn (`assets/js/transitions.js`).
- **Question bank** (`bank.html`): pick a domain and a skill and get an SAT-style question built from a seed. Answer it, strike out choices the way the digital test allows, read the worked solution, and share the exact question with its link (`bank.html?t=<template>&s=<seed>`).
- **Question engine** (`src/questions/`): 19 templates across the four Digital SAT Math domains. A template turns a seed into one complete item (stem, choices or a typed response, answer, explanation), so nothing is stored and every answer is computed. Together the templates can produce more than 28 million distinct questions.

## Run it

Any static server works:

    python3 -m http.server 8787

then open http://localhost:8787/.

## Tests

Open `tests/run.html` in a browser, or run `node tests/run.js` (Node 20 or newer). On a Mac without Node, the system JavaScriptCore shell runs the same file:

    /System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc -m tests/run.js

Every template is generated over 400 seeds; each item is validated against the schema and re-checked by the template's own `verify()`, which solves the problem a second way. GitHub Actions runs the Node version on every push.

## Adding a template

Copy `src/questions/generators/algebra/linear-one-var.js`: choose the answer first and derive the givens from it, build distractors from real student mistakes with `pickDistractors`, write `verify()` so it would catch a wrong answer, and set `space` to an honest lower bound of the distinct stems the template can produce. Register it in the domain's `index.js` and add an invariant test under `tests/`.

## Deploy

Cloudflare Pages builds `main` with no framework preset. The build command is `node tests/run.js && mkdir -p dist && cp -R index.html bank.html 404.html _headers assets src dist/` and the output directory is `dist`, so a failing test fails the build and the last good deploy stays live, and only the site's files are published. `_headers` sets the security headers and deliberately no `Cache-Control`: the modules are not fingerprinted, so revalidating on every visit keeps a deploy from mixing old and new files. `404.html` answers unknown paths. GitHub Pages mirrors the same commit at https://taruntejjjj.github.io/axiom-sat/, which is why `404.html` moves its base on that host.

## Roadmap

Timed practice tests in the format of the digital test, a progress view, and a video library of free, licensed lessons.

## What I learned

- A seeded PRNG makes generated content reproducible: the same template and seed give the same question forever, which makes permalinks and tests simple.
- Choosing the answer first and deriving the problem from it keeps every answer exact, with no rounding.
- CSS 3D needs `perspective` on a parent and `transform-style: preserve-3d` on the element that moves; animating only `transform` and `opacity` keeps it smooth.
- Cross-document view transitions are not available in every browser yet, so a small script that animates the page out before following a link works everywhere.
- Cloudflare Pages redirects `bank.html` to `/bank` and keeps the query string, so permalinks written with `.html` keep working after the move.
