# Task WVR-61 — Fix task promote's auto-generated PR title/body

**State:** Specified
**Phase:** specification → test → build → deploy → done
**Component:**
**Depends on:** none
**Related design docs:**
-

---

## 1. Summary

`task promote` now accepts `[title] [message]` positionals (mirroring `wip`'s existing convention) so the caller can supply a real PR title/body instead of getting a generic auto-generated one.

## 2. Why this task, why now

WVR-60's PRs were opened by `task promote` with an auto-generated title (`Task <ref>: promote <ref>::phase::state to dest (Gate)`, didn't match this repo's `<ref>: ...` convention) and an always-empty body. The fix isn't just a nicer template -- the tool needs to let the calling agent supply a real description, since it knows what changed far better than any generic string could.

## 3. In Scope

- `promote`'s three `createPR` call sites (test::ready, quick::ready, build::ready) now build title/body via a shared `prTitleAndBody` helper, using `[title] [message]` positionals when supplied and falling back to a generic-but-improved description otherwise.
- New test coverage for all three combinations (neither/title-only/both supplied).

## 4. Explicitly out of scope

- Lint errors inherited from magpie-weaver's `promote.ts`/tests -- covered by WVR-48, not duplicated here.

## 5. Acceptance criteria

- `task promote "<title>" "<message>"` produces a PR titled `<ref>: <title>` with body `<message>` verbatim.
- Full task-phases suite green.
