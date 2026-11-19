# Browser and assistive-technology acceptance — 19 November 2026 (IST)

This records which browsers and assistive technologies have been checked against the learner flows, how, and what has not been checked. Automated results come from the Playwright suite in [`tests/browser/`](../tests/browser/); the per-check tables are in the [macOS run record](evidence/acceptance-2026-11-19/automated-macos.md) and the [Linux CI run record](evidence/acceptance-2026-11-19/automated-linux-ci.md). Screen-reader results need a person listening and have **not yet been run**.

## Tested matrix

Each automated row ran the same 37 checks: the four learner journeys plus 33 acceptance checks.

| Platform | Browser | Exact version | How | Result | Screen reader |
| --- | --- | --- | --- | --- | --- |
| macOS 27.2.1 (26B131), arm64 | Chromium | 159.0.8154.6 | Playwright 1.65.1 build, headless | 37/37 pass | — |
| macOS 27.2.1 (26B131), arm64 | WebKit | 27.2 | Playwright 1.65.1 build, headless | 37/37 pass | — |
| macOS 27.2.1 (26B131), arm64 | Google Chrome | 157.0.8103.79 | installed browser via Playwright `chrome` channel, headless | 37/37 pass | — |
| macOS 27.2.1 (26B131), arm64 | Firefox | 159.0 (Playwright build) | Not run: this build exits at launch on this Mac with "Could not find profile folder", with or without Playwright | Not run | — |
| __LINUX_ROWS__ |
| macOS | Safari | — | Not run (Playwright cannot drive Safari itself) | Not run | VoiceOver: not yet run |
| iOS | Safari | — | Not run | Not run | VoiceOver: not yet run |
| Windows | Firefox, Chrome | — | Not run | Not run | NVDA: not yet run |
| Android | Chrome | — | Not run | Not run | TalkBack: not yet run |

Also on that Mac: Node.js 26.13.0, @axe-core/playwright 4.14.0 with axe-core 4.14.1. A repeat of the macOS run (`--repeat-each=2`, 222 tests) also passed.

Keyboard note for Safari: by default, Safari and WebKit on macOS move Tab only between text fields and pop-up menus. The WebKit keyboard checks use Option+Tab, as a Safari keyboard user would, or the learner can turn on "Press Tab to highlight each item" in Safari's settings. This is platform behaviour, not an application defect.

"Playwright build" means the engine Playwright downloads and drives headless. It runs the same rendering and JavaScript engine as the branded browser, but it is not the browser a learner installs: Safari's own WebKit, extensions, user settings and platform accessibility bridges are not exercised. Google Chrome was driven through Playwright's `chrome` channel.

## What each check covers

| Issue area | How it is checked | Engines |
| --- | --- | --- |
| Setup | Keyboard-only setup of a custom untimed session (radio arrows, timer checkbox, start); axe on the setup page | Automated, all |
| Question navigation | Next, navigator buttons, focus moved to the new question stem | Automated, all |
| Numeric input | An incomplete fraction is marked `aria-invalid`, its error is the input's accessible description, and a valid answer clears it | Automated, all |
| Flags | Flag toggled by keyboard, `aria-pressed` reported; flags survive reload | Automated, all |
| Finish/cancel dialogs | Escape and "Keep practicing" cancel; focus starts on "Keep practicing" and returns to the opening button; Progress reset dialog likewise | Automated, all |
| Worked review | Results heading receives focus; a worked solution opens from the keyboard; axe on the expanded review | Automated, all |
| Backup restoration | Restore control reachable by Tab and opens a file chooser from the keyboard; valid and malformed backups; status message text | Automated, all |
| Keyboard-only operation | Every step above uses only Tab, Shift+Tab, arrows, Space, Enter and Escape | Automated, all |
| Focus recovery | Start, Next, navigator, dialog close, finish and retry each leave focus on a defined element | Automated, all |
| Announcements | Text written to the polite live regions: session complete with counts, retry started, five-minute warning, backup merged/failed | Automated, all (text only — see the screen-reader protocol for what is spoken) |
| Zoom / narrow viewports | No horizontal scrolling and no element outside the viewport at 320 px (a 1280 px window at 400%) and 390 px, on every page and on the question, dialog and fully expanded results | Automated, all (viewport emulation, not the browser's zoom control) |
| Reduced motion | With `prefers-reduced-motion: reduce`, no animation or transform/position transition over 10 ms on any page or the active question, and links skip the page-turn animation (a control run shows the animation with motion allowed) | Automated, all |
| Storage denial | `localStorage` throws on access: practice runs to results with a visible warning; Progress explains the problem and restore fails without change | Automated, all |
| Storage full | Writes fail mid-session: answers stay on screen with a warning; stored state keeps the last good write and a reload restores it | Automated, all |
| Storage corruption | An unreadable saved session is reported and practice restarts; unreadable progress is kept, never overwritten by a restore or a finished session, and the learner is told how to keep new first attempts | Automated, all |
| Timer reload | Answers, flags and the original deadline survive reload; a deadline that passes while the page is closed finishes the session at that deadline with answers kept | Automated, all |
| Automated rules | axe-core WCAG 2.0/2.1/2.2 A and AA rules on every page, the practice states, the finish and reset dialogs and progress with history | Automated, all |

## Screen-reader protocol

Status for every row: **not yet run**. Record the exact OS, browser and screen-reader versions, the date, and the result of each step (pass, fail with what was heard, or not applicable). File a reproducible issue for each failure.

| Screen reader | Platform and browser | Status |
| --- | --- | --- |
| VoiceOver | macOS, Safari | Not yet run |
| VoiceOver | iOS, Safari | Not yet run |
| NVDA | Windows, Firefox and Chrome | Not yet run |
| TalkBack | Android, Chrome | Not yet run |

Use a fresh browser profile or clear site data first. Navigate with the screen reader's own commands (and touch gestures on mobile), not the mouse.

1. **Setup.** Open Practice. Expect the heading "Find your rhythm.", a group "Choose your session" with three radio buttons whose names include the question count and minutes, and "Practice with a timer" as a checked checkbox. Choose "Build your own" and expect the "Make this session yours" group with three labelled selects. Toggle the timer and expect the budget text to be announced.
2. **Start and navigate.** Start. Expect focus and speech on the question stem. Move to the choices: each is a toggle button announced with its letter and text and "not pressed". Choose one and expect "pressed". Open the navigator: buttons read "Question N, answered/unanswered[, flagged]", and the current one is identified as the current step.
3. **Numeric input.** On a numeric question, the field is "Your answer, edit text" with the hint as its description. Type `3/` and leave the field: expect "invalid" and the error message. Correct it and expect the error to clear.
4. **Flags.** Activate "Flag for review" and expect "pressed"; the navigator entry gains "flagged".
5. **Finish and cancel.** Activate "Finish & review". Expect a dialog "Finish this session?" with the answered/unanswered/flagged counts read as its description and focus on "Keep practicing". Press Escape (or the platform's dismiss gesture): the dialog closes and focus returns to the button. Reopen and choose "Finish & review".
6. **Results and review.** Expect focus on the results heading and the polite announcement "Session complete. N correct, N incorrect, N skipped." Open a worked solution: it reads as a collapsed/expanded disclosure with status, number and skill. Activate "Retry missed" and expect "Untimed retry started with N questions…".
7. **Timer.** In a timed session, wait until five minutes remain (or start a 5-question custom session and wait 5 minutes) and expect "Five minutes or less remain in this session." The clock itself should not be announced every second.
8. **Backup restoration.** On Progress, reach "Restore backup", open the file picker and choose a valid backup: expect "Backup merged: …". Choose a non-backup file: expect "Could not restore: …". Open "Reset progress", expect the dialog title and description, and cancel.
9. **Zoom.** With the platform's text-size or zoom setting at its largest, repeat steps 2 and 6 and note anything clipped or overlapping.

## Defects found

| Defect | Where | Engines | Status |
| --- | --- | --- | --- |
| "Correct" badge text #1a7f37 on its tinted background measured about 4.3:1, below the 4.5:1 WCAG AA minimum for 11 px text (axe `color-contrast`) | Progress page review and recent-work lists | All | Fixed: badge text is now #116329 (about 6.3:1); the axe check covers it |

No other failures were found by the automated checks in any engine that ran. Two test-harness problems found on the way were fixed in the suite, not the app: a clock-install race in the shared fixture (fixed in the #11 branch as well), and axe needing real timers while the page clock is paused.

## Remaining gaps

- Screen readers: every row above is not yet run.
- Branded Safari and Firefox were not driven; WebKit and Firefox results come from Playwright's builds. Microsoft Edge was not tested.
- Real devices: no iPhone, iPad or Android phone; mobile widths are viewport emulation in desktop engines. Touch gestures are not exercised.
- Browser zoom and text-only zoom were not exercised; 320 px reflow stands in for 400% zoom.
- Windows high-contrast (forced colours), Linux desktop browsers and voice control were not checked.
- Live-region checks confirm the text the page writes, not that or how a screen reader speaks it.
- axe-core detects a subset of WCAG failures; a clean scan is not conformance.
