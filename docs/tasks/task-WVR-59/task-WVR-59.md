# Task WVR-59 — Fix devEngines EBADDEVENGINES blocking changeset publish

**State:** Specified
**Phase:** specification → test → build → deploy → done
**Component:**
**Depends on:** none
**Related design docs:**
-

---

## 1. Summary

Change root `package.json`'s `devEngines.packageManager.onFail` from `"download"` to `"warn"` so `changeset publish`'s internal `npm info` calls stop hard-failing.

## 2. Why this task, why now

Every `release.yaml` publish attempt since the first Version Packages PR merged has failed with `EBADDEVENGINES`: `changeset publish` shells out to plain `npm info <package>` (not pnpm) to check the registry, and the repo's `devEngines.packageManager` constraint (added by WVR-52 to nudge pnpm usage) hard-blocks any `npm` invocation on a name mismatch, regardless of `onFail`'s intent -- `"download"` only knows how to resolve a version mismatch of the same tool, not a different tool entirely. Nothing has actually published to GitHub Packages yet because of this.

## 3. In Scope

- The one `onFail` value change in root `package.json`.

## 4. Explicitly out of scope

- Removing `devEngines.packageManager` entirely -- it should keep nudging direct pnpm usage, just not hard-block internal read-only tooling calls like this one.

## 5. Acceptance criteria

- Merging this (no pending changesets) causes `release.yaml` to successfully run `pnpm changeset publish` and actually publish `@weaver-engineering/gate-checks`/`@weaver-engineering/task-phases@0.1.1` to GitHub Packages for the first time.
