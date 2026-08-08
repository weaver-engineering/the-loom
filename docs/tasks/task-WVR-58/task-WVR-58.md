# Task WVR-58 — Auto-assign a reviewer on the Version Packages PR

**State:** Specified
**Phase:** specification → test → build → deploy → done
**Component:**
**Depends on:** none
**Related design docs:**
-

---

## 1. Summary

Auto-assign Simon as reviewer + assignee on the "Version Packages" PR that `release.yaml` opens/updates via `changesets/action`, so it shows up in his default GitHub PR list.

## 2. Why this task, why now

That PR is authored by `github-actions[bot]`, so a human who is neither its author, assignee, reviewer, nor mentioned never sees it in `github.com/pulls` even though merging it is the step that actually publishes to GitHub Packages, and only a human may approve/merge PRs in this repo. Discovered and fixed once by hand on PR #3 while working through WVR-53's first real release; this task makes it automatic.

## 3. In Scope

- A step in `.github/workflows/release.yaml`, after the `changesets/action` step, that adds Simon as reviewer + assignee whenever that step opened/updated a PR (`steps.changesets.outputs.pullRequestNumber` set).

## 4. Explicitly out of scope

- Anything about the PR's approval/merge itself — still exclusively human, per repo convention.

## 5. Acceptance criteria

- Next time a changeset lands on `main` and `release.yaml` opens/updates the Version Packages PR, it shows up in `github.com/pulls` without manual intervention.
