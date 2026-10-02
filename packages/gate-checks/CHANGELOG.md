# @weaver-engineering/gate-checks

## 0.2.0

### Minor Changes

- 3d88aa9: Add `docs-gate` (the docs-repo main gate: branch-ref, exactly one commit ahead of the destination, destination not advanced, valid commit message — no coverage or build) and `validate-commit-message` (the ref/title/body rules, now shared by every `validate-*-commit` check).

## 0.1.1

### Patch Changes

- 625e1e0: Rename scope from `@the-loom` to `@weaver-engineering` and publish to GitHub Packages (`https://npm.pkg.github.com`), so other weaver-engineering repos' GitHub Actions workflows can install these CLIs directly instead of checking out and building the-loom's source.
