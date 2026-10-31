# Contributing to Axiom

Useful contributions improve mathematical correctness, learning feedback, accessibility, or reliability. Keep changes focused and explain the learner-visible problem in the commit or pull request.

## Add a question template

1. Start with `src/questions/generators/algebra/linear-one-var.js` and follow its item schema.
2. Choose the answer first, derive the givens, and make distractors reflect plausible mistakes. Check that choices are mathematically distinct, not just differently formatted.
3. Implement `verify()` by solving the problem independently of the generation path. Register the template in its domain index.
4. Document an honest lower bound for the template's parameter space. A large parameter space does not mean an equally large variety of concepts.
5. Add invariant tests to the appropriate domain test file, including edge values, notation, and student-produced response limits.

Preserve existing valid template/seed outputs when possible: learners use those links to revisit questions. If a correction changes generated content, explain it and consider how saved sessions and history are affected.

## Test a learning-flow change

Run `npm run build`. For practice or history work, add tests for behavioral failure cases rather than copying the implementation. Test keyboard-only navigation and a narrow viewport. Check a timed session across reload, finish confirmation and cancellation, worked review, and progress updates. Test a backup round trip before changing the storage format. Saved data has an explicit version; do not silently discard or overwrite unrecognized data.

## Release

Push tested changes to the intended branch. Production deploys from `main` through Cloudflare Pages with `npm run build` and output `dist`. Check the GitHub Actions run and Cloudflare deployment for the same commit, then verify `/`, `/bank`, `/practice`, and `/progress`. A build failure should retain the previous working production deployment.

Keep commit authorship and dates accurate. Describe actual features, fixes, and tests; do not add empty commits or artificial activity. Do not commit credentials, local progress exports, `.wrangler/`, or generated `dist/` files.
