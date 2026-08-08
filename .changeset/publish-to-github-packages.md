---
"@weaver-engineering/gate-checks": patch
"@weaver-engineering/task-phases": patch
---

Rename scope from `@the-loom` to `@weaver-engineering` and publish to GitHub Packages (`https://npm.pkg.github.com`), so other weaver-engineering repos' GitHub Actions workflows can install these CLIs directly instead of checking out and building the-loom's source.
