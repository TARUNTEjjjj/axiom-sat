# Axiom SAT Math

Free, open-source SAT-style math practice with original generated questions, timed sessions, worked review, and progress saved on your device. Plain HTML, CSS, and JavaScript; no runtime dependencies, account, or backend.

**[Open Axiom](https://axiom-sat.pages.dev/)** · [Practice](https://axiom-sat.pages.dev/practice) · [Question bank](https://axiom-sat.pages.dev/bank) · [Progress](https://axiom-sat.pages.dev/progress)

## What you can do

- Explore 19 seeded question templates across Algebra, Advanced Math, Problem-Solving and Data Analysis, and Geometry and Trigonometry. Share any exact question using its template and seed.
- Start a **10-question, 16-minute sprint** or a **22-question, 35-minute module**. Turn the timer off when learning at your own pace.
- Change answers, flag questions, and use the question navigator. Sessions resume after a reload; a timed session keeps counting while the page is closed.
- Review correct, incorrect, skipped, and flagged questions with the full worked reasoning after finishing.
- Track first-attempt accuracy by domain, find a skill to practice next, and revisit missed questions. Duplicate attempts do not inflate your numbers.
- Download and restore a progress backup. History retains the first attempt on each of the latest 500 distinct template/seed pairs.

These are independent, non-adaptive practice sessions, not an official SAT test. Accuracy is not a predicted SAT score or a calibrated mastery estimate. The 35-minute module timing follows [College Board's published structure](https://satsuite.collegeboard.org/sat/whats-on-the-test/structure); questions and difficulty ratings are Axiom's own. Use [Bluebook](https://satsuite.collegeboard.org/practice/practice-tests/bluebook) for official full-length practice.

## Run locally

Use Node 20 or newer for tests and packaging. No install step is needed.

```sh
npm test
npm run build
python3 -m http.server 8787 --directory dist
```

Open `http://localhost:8787/`. To work directly on the source, use `npm run serve`. Open through an HTTP server, not `file://`, so JavaScript modules can load.

## Test and release

`npm test` runs the same dependency-free test list as `tests/run.html`. The generator suite checks every template over 400 seeds and verifies its answers independently. Tests also cover numeric response rounding, template selection, timed-session restore, grading, corrupted storage, deduplication, and atomic backup import.

`npm run build` first runs the tests, then `scripts/build.mjs` packages an explicit public-file list and checks local page/module references. Tests, Git metadata, and local tooling are excluded from `dist/`. GitHub Actions runs this build on every push and pull request.

Cloudflare Pages project **axiom-sat** deploys `main` using:

| Setting           | Value           |
| ----------------- | --------------- |
| Framework         | None            |
| Build command     | `npm run build` |
| Output directory  | `dist`          |
| Production branch | `main`          |

A failed test or missing release asset fails the build, keeping the last good deployment live. `_headers` sets basic security headers. Scripts are not fingerprinted, so Cloudflare's default revalidation behavior is retained. `404.html` handles missing paths, including when the site is mirrored under `/axiom-sat/` on GitHub Pages.

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

The site links to College Board, Khan Academy and Desmos; those services have their own terms and privacy policies. No official questions or instructional videos are redistributed.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for generator invariants, useful feature work, and release checks. Original source is [MIT licensed](LICENSE). Axiom is not affiliated with or endorsed by College Board.
