# my-gym

Spec: `PLAN.md`.

## Code style
- Minimal and simple: if 2 lines do the job, don't write 10.
- No abstractions, helpers or complicated functions unless they're actually needed.
- Comments only when they add information the code doesn't show. One short line, no paragraphs or docblocks.
- Readable over clever.

## Commits
- Subject starts with a tag: `[FEAT]`, `[FIX]`, `[DOC]`, `[REFACTOR]`, `[TEST]`, `[CHORE]`, `[STYLE]`, `[PERF]`.
- Reads like a changelog entry, not an essay: what changed and why.
- Body uses bullet points written as clear, readable sentences, not word fragments.
- When behaviour changes, add a before/after table:

  | Before | After | Why |
  |---|---|---|
  | Rest was fixed at 90 s | Rest adjusts to reps left in tank | Avoids wasted time on easy sets |
