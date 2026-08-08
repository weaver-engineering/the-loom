# Task WVR-60 — Resync task-phases from magpie-weaver's actual main

**State:** Specified
**Phase:** specification → test → build → deploy → done
**Component:**
**Depends on:** none
**Related design docs:**
-

---

## 1. Summary

Wholesale-replace `packages/task-phases/src` and `test/packages/task-phases` with magpie-weaver's actual current `main` content, bringing in the real implementations of `task promote`, `task list`, the `task <ref>` switch command, `init --wip`/`--doc`/`--specs`, and `status --fix` that the-loom's copy was missing.

## 2. Why this task, why now

WVR-52 copied gate-checks/task-phases from a stale point in magpie-weaver's history (matching commit `adad712`, 2026-08-02) instead of magpie-weaver's actual `main` at copy time (2026-08-08) -- 22 commits and a week of development behind. Root cause: a past session read from magpie-weaver's dev worktree while it was unsynced, instead of the architect worktree (now guarded against in `~/.claude/CLAUDE.md`). `task promote` was a hard `throw new Error("not implemented")` stub as a direct result -- discovered by hitting it for real while trying to raise WVR-53's PR.

## 3. In Scope

- `packages/task-phases/src`, `test/packages/task-phases`: wholesale replace with magpie-weaver's current `main` content, plus the `@magpieweaver` -> `@weaver-engineering` scope rename reapplied on top.
- A behavior fix discovered by actually using the resynced `task promote` for real: `quick::ready -> pr-raised` and `test::ready -> pr-raised` both only published the *base* branch (when missing) and never pushed the *head* branch itself before opening a PR -- requiring a separate manual push first, contrary to the intended UX ("having reached `ready`, `task promote` alone should be enough"). Both now push the head branch unconditionally before raising the PR. Confirmed present in magpie-weaver's own current `main` too (both actions' tests explicitly asserted `push` was never called) -- fixed in the-loom only for now, since the-loom is the canonical copy going forward and magpie-weaver's is being retired via WVR-54.

## 4. Explicitly out of scope

- `packages/gate-checks` -- confirmed already fully in sync with magpie-weaver's main (every diff was purely the scope rename WVR-53 already did), no changes needed.
- Fixing the 10 pre-existing lint errors inherited from magpie-weaver's own `promote.ts`/test code (quote-style, one unused import) -- kept byte-identical to upstream rather than diverging; `pnpm lint` isn't part of gate-check's actual enforcement.
- Backporting the push fix to magpie-weaver's own copy, or updating the LLD doc in the-loom-docs repo (a clarifying note there is optional, not a correction of a false claim -- would need its own PR in a separate repo).

## 5. Acceptance criteria

- `pnpm install && pnpm -r build && pnpm test && pnpm lint` all green (334 tests, up from 267; same pre-existing + newly-inherited lint failures, nothing gate-check-relevant).
- `task list --json` returns real structured output instead of a stub error.
- `task promote --json` reaches its real state-machine logic (confirmed: `quick::ready -> pr-raised` is implemented) instead of the universal "not implemented" throw.
