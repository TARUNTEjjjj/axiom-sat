# Code and persistence review — 7 November 2026 (India Standard Time)

- **230/230 tests pass**, followed by a production build containing all five public pages and validated local dependencies. No npm runtime dependencies are declared.
- Completing a 22-question session previously revalidated and rewrote the bounded 500-answer history once per answer. Practice now validates the batch and existing history once, keeps the original first attempts, and commits one storage update. The single-answer question-bank API retains its behavior.
- New regressions cover one-read/one-write completion, existing and within-batch duplicate answers, exact retries, invalid/oversized/sparse batches, failed writes, corrupted saved history, the 500-record limit and caller-input immutability. An invalid batch or failed write does not leave a partly saved session; its result remains available for retry.
- An alternating Node-only persistence benchmark (5 warmups, 20 samples per version, 500 stored records plus 22 new answers) measured median **326.07 ms → 7.89 ms** and p95 **346.84 ms → 8.09 ms**, with identical final JSON. Storage calls dropped from 22 reads/writes to one each. [Measurements](evidence/review-2026-11-07/progress-benchmark.json) use an in-memory adapter and exclude browser rendering and real disk latency; they are not Web Vitals or physical-device measurements.
- A fresh deep mathematical audit passed **155,124 generated items** across 31 templates, including uint32 boundary seeds, plus **3,800 unchanged published identities**. It checked deterministic generation, schemas, generator verification, finite parameters, exact-answer grading and numeric-choice uniqueness. [Audit output](evidence/review-2026-11-07/question-audit.json). Generator source and published question identities were not changed by the persistence optimization.

Browser and hosted verification are recorded separately during release. These checks do not certify psychometric calibration, every device/browser, or concurrent-user capacity. The historical release notes below describe their original versions.

---

# Release verification — v0.3.0, 1 November 2026 (IST)

## Automated checks

- `npm run build`: **214/214 tests passed**, then all five public pages and their local dependencies were packaged successfully.
- Generator invariant coverage: 400 seeds for each of 31 templates, including 12 new challenge families.
- Deep release audit: **155,124 generated items** (5,000 seeds and four uint32 boundary seeds for each template) passed schema, deterministic generation, generator verification, finite parameter, exact-answer grading, and numeric-choice uniqueness checks.
- **3,800 previously published items** matched a SHA-256 baseline from release `c7bf02c`, preserving their generated content and deep links.
- Twelve separate mathematical audits cover **3,000 challenge cases**, using root enumeration, Vieta's formulas, logarithmic interpolation, elimination, and geometry independently of the answer-generation path.
- Practice coverage includes all custom domain/difficulty/length combinations, exact missed-question retries, first-attempt deduplication, bounded settings, invalid stored data, wall-clock expiry, and a frozen v1 session fixture from the original 19-template catalog.
- Existing numeric-answer, progress, atomic backup import, and corrupted-storage regressions continue to pass.

The review caught and corrected an exponential-template variety shortfall, an overcounted conditional-probability parameter space, and a verifier that needed to reject negative exponential values.

## Browser checks

Tested in the available Chromium-based browser at desktop and 390 px / 320 px viewport widths, including the packaged `dist/` release:

- Bank difficulty filtering, correct-answer feedback, skill selection, and a clear empty state when a challenge-only skill is filtered to Foundation. Switching back to Challenge recovers normally.
- Bank-to-custom practice links preserve domain and difficulty. Custom deep links prefill settings without starting a session.
- Five-question Advanced Math challenge starts with a 10-minute clock. Answers, flags, index, and elapsed time survive a reload.
- An unfinished fraction remains unanswered; submission counts it as skipped. Test session results matched the expected one correct, one incorrect, and three skipped.
- Finish confirmation and keyboard Escape cancellation; expanded worked solutions and exact question links.
- Retry includes exactly the four missed/skipped questions, clears their responses/flags, has no timer, and survives reload. Correcting a previous wrong answer keeps the original first-attempt history (two distinct attempts, 50% first-attempt accuracy in the test case).
- Custom settings survive a fresh setup. A 20-question set shows a 40-minute budget; switching the timer off produces an untimed session.
- Mobile setup, bank, navigator, and result layouts remain usable. The 390 px packaged session has matching document/client widths.
- A pending finish dialog in one tab closes when another tab completes the same custom session; both show the same results.
- The packaged catalog lists all 31 templates; no browser console warnings or errors were observed during these checks.

## Limits

This is a tested static learning app, not a validated SAT scoring system. The suite does not establish psychometric calibration or equivalent test difficulty. Timed-session expiry is covered by deterministic clock tests; a full 35-minute exam was not manually completed. Browser checks do not constitute a complete assistive-technology or cross-browser certification. Local storage can be unavailable and does not provide cloud backup or automatic cross-device synchronization.
