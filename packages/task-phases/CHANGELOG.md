# @weaver-engineering/task-phases

## 0.3.1

### Patch Changes

- Updated dependencies [3d88aa9]
  - @weaver-engineering/gate-checks@0.2.0

## 0.3.0

### Minor Changes

- 1c9d798: `task promote` now accepts `[title] [message]` positionals (mirroring `wip`'s convention), letting the caller supply a real PR title/body instead of an auto-generated one.

## 0.2.0

### Minor Changes

- bc88be9: Resync from magpie-weaver's current main: `task promote`, `task list`, the `task <ref>` switch command, `init --wip`/`--doc`/`--specs`, and `status --fix` are now fully implemented instead of stubbed.

## 0.1.1

### Patch Changes

- 625e1e0: Rename scope from `@the-loom` to `@weaver-engineering` and publish to GitHub Packages (`https://npm.pkg.github.com`), so other weaver-engineering repos' GitHub Actions workflows can install these CLIs directly instead of checking out and building the-loom's source.
- Updated dependencies [625e1e0]
  - @weaver-engineering/gate-checks@0.1.1
