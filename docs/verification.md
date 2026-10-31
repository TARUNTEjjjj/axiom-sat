# Release verification — 1 November 2026 (IST)

## Automated checks

- `npm run build`: **151/151 tests passed**, then all public pages and their local dependencies were packaged successfully.
- Generator invariant coverage: 400 seeds for every one of the 19 templates in the regular suite.
- Additional engine review: 95,000 generated items across 5,000 distributed uint32 seeds per template passed schema and independent answer verification, with no duplicate numeric choices found.
- Regression coverage includes the even-sized template-pool selection bug, numeric overflow and zero denominators, exact-decimal rounding, bounded inputs, timed session restoration, missing/incorrect answers, invalid history, duplicate first attempts, and backup merging without overwriting invalid data.

## Browser checks

Tested in the available Chromium-based browser at desktop and 390 px / 320 px viewport widths:

- Module setup with 22 questions and a 35-minute clock; sprint and untimed setup.
- Correct and incorrect answers, flagging, navigation, and reload preserving answers, flags, and elapsed time.
- Finish confirmation, keyboard Escape cancellation, and separate correct/incorrect/skipped result counts.
- Expanded worked solutions and exact question links.
- Progress updates from both practice and bank; repeating the same bank question did not add another attempt.
- Backup download, explicit reset of test data, and successful restore with original counts.
- Domain recommendations select the whole domain with All skills.
- A finish dialog in one tab closes when another tab completes the session. A stale confirmation cannot submit the replacement session.
- Narrow-screen navigator overflow found at 320 px and fixed; rechecked with matching document/client width.

## Limits

This is a tested static learning app, not a validated SAT scoring system. The suite does not establish psychometric calibration or equivalent test difficulty. Timed-session expiry is covered by deterministic clock tests; a full 35-minute exam was not manually completed. Browser checks do not constitute a complete assistive-technology or cross-browser certification. Local storage can be unavailable and does not provide cloud backup or automatic cross-device synchronization.
