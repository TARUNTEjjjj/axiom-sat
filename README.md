# Axiom SAT Math

Free SAT-style math practice with original generated questions, timed sessions, worked review, and progress saved on your device. Plain HTML, CSS, and JavaScript; no runtime dependencies, account, or backend.

**[Open Axiom](https://axiom-sat.pages.dev/)** · [Practice](https://axiom-sat.pages.dev/practice) · [Question bank](https://axiom-sat.pages.dev/bank) · [Progress](https://axiom-sat.pages.dev/progress)

## Project ownership and development

Axiom is an independent project created and maintained by Tarun Tej. I planned the project and reviewed and tested the work myself.

The source repository and Git history are private. The learning website remains publicly available on Cloudflare Pages; browser-delivered HTML, CSS, and JavaScript remain inspectable. The original code retains its [MIT license](LICENSE).

## Engineering overview

The application separates question generation, practice-session state, learning history, and browser rendering. A template ID and seed reproduce an exact question; saved sessions preserve those identities, and imported progress is validated and regraded before being stored.

| Layer | Languages and tools |
| --- | --- |
| Browser application | HTML, CSS, vanilla JavaScript ES modules and native Web APIs |
| Local data | Browser `localStorage`, versioned JSON sessions and progress backups |
| Tests and build | Node.js 20+, npm scripts, a custom JavaScript test harness and packaging script; CI uses Node.js 22 |
| Local preview | Python 3 standard-library HTTP server |
| Version control and CI | Git, GitHub and GitHub Actions |
| Production hosting | Cloudflare Pages, serving the static `dist/` build |

There are no npm package dependencies, frontend frameworks, application servers, databases, or AI model services in the application. JSON, YAML and Markdown provide data, workflow configuration and documentation. The `private: true` field in `package.json` prevents accidental npm-package publication; it does not control GitHub repository visibility.

Read the [engineering notes](docs/engineering.md) for architecture, design tradeoffs, regression examples and proposed next work.

## What you can do

- Explore 31 seeded question templates across Algebra, Advanced Math, Problem-Solving and Data Analysis, and Geometry and Trigonometry. Filter by domain, skill, and difficulty; share any exact question using its template and seed.
- Work through 12 new challenge families: quadratic parameters and root relationships, rational and radical equations, exponential observations, reconstructing quadratics, polynomial identities, nonlinear systems, circle tangency, similar solids, conditional probability, and parameterized linear systems. Each includes a multi-step worked solution.
- Start a **10-question, 16-minute sprint** or a **22-question, 35-minute module**. Turn the timer off when learning at your own pace.
- Build a **custom 5-, 10-, or 20-question set** for one domain or all four, with Foundation, Standard, Challenge, or mixed difficulty. The optional custom timer allows two minutes per question. Setup choices are remembered on this browser.
- Change answers, flag questions, and use the question navigator. Sessions resume after a reload; a timed session keeps counting while the page is closed.
- Review correct, incorrect, skipped, and flagged questions with the full worked reasoning after finishing.
- Retry the exact missed and skipped questions in an untimed session. Answers and flags start fresh; prior first-attempt history stays intact. A previously skipped question records its first attempt when answered.
- Track first-attempt accuracy by domain, find a skill to practice next, and revisit missed questions. Duplicate attempts do not inflate your numbers.
- Download and restore a progress backup. History retains the first attempt on each of the latest 500 distinct template/seed pairs.

These are independent, non-adaptive practice sessions, not an official SAT test. Accuracy is not a predicted SAT score or a calibrated mastery estimate. The 35-minute module timing follows [College Board's published structure](https://satsuite.collegeboard.org/sat/whats-on-the-test/structure); questions and difficulty ratings are Axiom's own. Use [Bluebook](https://satsuite.collegeboard.org/practice/practice-tests/bluebook) for official full-length practice.

## Run locally

Use Node 20 or newer for tests and packaging. No install step is needed.

```sh
npm test
npm run audit:questions
npm run build
python3 -m http.server 8787 --directory dist
```

Open `http://localhost:8787/`. To work directly on the source, use `npm run serve`. Open through an HTTP server, not `file://`, so JavaScript modules can load.

## Test and release

`npm test` runs the same dependency-free test list as `tests/run.html`. The generator suite checks every template over 400 seeds. The challenge suite includes separate mathematical audits using enumeration, elimination, interpolation, and geometric relationships. Tests also cover numeric response rounding, difficulty filters, every custom setup combination, legacy-session migration, retries, timed-session restore, grading, corrupted storage, deduplication, and atomic backup import.

`npm run audit:questions` performs the deeper release audit: 5,004 seeds per template, numeric-choice equivalence, schema and deterministic-answer checks, plus fingerprints of 3,800 previously published questions. See [release verification](docs/verification.md) for the tested scope and limits.

`npm run build` first runs the tests, then `scripts/build.mjs` packages an explicit public-file list and checks local page/module references. Tests, Git metadata, and local tooling are excluded from `dist/`. GitHub Actions runs this build on every push and pull request.

Cloudflare Pages project **axiom-sat** deploys `main` using:

| Setting           | Value           |
| ----------------- | --------------- |
| Framework         | None            |
| Build command     | `npm run build` |
| Output directory  | `dist`          |
| Production branch | `main`          |

A failed test or missing release asset fails the build, keeping the last good deployment live. `_headers` sets basic security headers. Scripts are not fingerprinted, so Cloudflare's default revalidation behavior is retained. `404.html` handles missing paths.

Cloudflare's GitHub integration must retain access to this private repository for automatic builds. The canonical website is **https://axiom-sat.pages.dev/**. The former `taruntejjjj.github.io/axiom-sat/` redirect is retired: GitHub Free does not serve Pages from private repositories. Use the Cloudflare address in bookmarks and shared links.

## Project map

| Path                                     | Purpose                                                   |
| ---------------------------------------- | --------------------------------------------------------- |
| `index.html`, `assets/js/home.js`        | Study overview, interactive hero, trusted resource links  |
| `bank.html`, `assets/js/bank.js`         | Question filters, response checking, elimination, sharing |
| `practice.html`, `assets/js/practice.js` | Timed/untimed practice and worked review                  |
| `progress.html`, `assets/js/progress.js` | Learning summary, review queue, backup controls           |
| `src/questions/`                         | Seeded generators, schema validation, numeric answers     |
| `src/practice/session.js`                | Pure session generation, validation, timekeeping, grading |
| `src/learning/progress.js`               | Bounded local history, regraded imports, statistics       |
| `tests/`                                 | Browser/Node-compatible regression tests                  |

## Data and privacy

Practice and progress use `localStorage` on the current origin only. No answer data is sent to an app server, and no third-party analytics are installed. Cloudflare still receives ordinary hosting requests. Local progress does not sync automatically across devices, browser profiles, or domains. Private browsing or storage restrictions can prevent persistence; the UI reports storage failures. Download a backup before clearing browser data. Reset affects progress, not the separately saved practice session. Saved sessions older than 30 days are ignored.

Imported backups are size-limited, validated, and regraded from original generated questions instead of trusting stored correctness. Restore merges records and keeps the earliest attempt for duplicates. Corrupted existing storage must be explicitly reset before a backup can be restored.

Session schema v2 keeps the original storage key and migrates v1 sessions from their stored question identities. Adding new templates does not reshuffle or replace an unfinished session. Custom settings are stored separately from progress; resetting progress does not clear those settings.

The site links to College Board, Khan Academy and Desmos; those services have their own terms and privacy policies. No official questions or instructional videos are redistributed.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for generator invariants, useful feature work, and release checks. Original source is [MIT licensed](LICENSE). Axiom is not affiliated with or endorsed by College Board.
