# Task WVR-53 — Publish gate-checks/task-phases to GitHub Packages

**State:** Specified
**Phase:** specification → test → build → deploy → done
**Component:**
**Depends on:** none
**Related design docs:**
-

---

## 1. Summary

Rename `@the-loom/gate-checks` and `@the-loom/task-phases` to `@weaver-engineering/gate-checks`/`@weaver-engineering/task-phases` (matching the publishing org, not the repo) and publish both to GitHub Packages via Changesets, so other weaver-engineering repos' GitHub Actions workflows can install them directly instead of checking out and building the-loom's source.

## 2. Why this task, why now

Both CLIs currently only exist as local `workspace:*` packages, usable only via a machine-local symlink into `$PNPM_HOME/bin`. That's unusable from GitHub-hosted CI runners, which start fresh every run. magpie-weaver's gates only work today because it carries its own forked copy of both packages — the intent is to let it (and any future weaver-engineering repo) delete that fork and consume the-loom's published packages instead.

## 3. In Scope

- Renaming the npm scope across both packages, the root workspace, and every import/test reference.
- Adding `publishConfig`/`files` to both `package.json`s so `dist/` actually ships (it's currently gitignored and unlisted, so it would silently be excluded from a published tarball).
- Setting up Changesets for independent per-package semver + changelogs.
- A new `.github/workflows/release.yaml` that opens/updates a Version Packages PR on push to `main`, and publishes on merge.
- Documenting the release flow in CLAUDE.md.

## 4. Explicitly out of scope

- Actually migrating magpie-weaver (or any other repo) to consume these packages — tracked separately as WVR-54.
- Granting cross-repo GitHub Actions access to the published packages (GitHub's "Manage Actions access" package setting has no API and must be set by hand after the first publish) — tracked separately as WVR-57.
- `build-gate.yaml`/`main-gate.yaml` are untouched; they validate PRs via the local workspace and don't need to know about publishing.

## 5. Acceptance criteria

- `pnpm install`, `pnpm -r build`, `pnpm test`, and `pnpm lint` all pass with the renamed scope (lint's pre-existing unrelated failures aside).
- `npm pack --dry-run` in each package directory includes the full `dist/` output.
- `.github/workflows/release.yaml` exists, mirrors the conventions of `build-gate.yaml`/`main-gate.yaml`, and is wired to Changesets.
- A changeset recording this change's version bump is committed alongside it.
