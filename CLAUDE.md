# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working in this repository.

## `gate-checks` and `task-phases`: use the CLIs, not ad hoc git/gh

Two packages in this monorepo — `@weaver-engineering/gate-checks` and `@weaver-engineering/task-phases` — are also exposed as structured OpenCode tools (`.opencode/tool/gate-check.ts`, `.opencode/tool/task.ts`), wrapping the same CLIs with a discovery contract. Claude Code has no equivalent tool integration for these yet — an MCP server is planned, but only once the scheduler work requires a long-running server process anyway (no point standing one up before then). Until that lands, call the CLIs directly via Bash — don't reconstruct their logic with raw `git`/`gh` commands.

### `@weaver-engineering/gate-checks` — `pnpm gate-check`

Runs any of the checks in the catalog independently — not just `test-gate`/`build-gate`/`main-gate`, also `branch-ref`, `pr-title`, `coverage`, `existing-tests-pass`, `new-tests-fail`, `build`, and the `validate-*-commit` checks.

- **Discover what's available first:** `pnpm gate-check --list --json` returns every check's name, description, required arguments, and per-argument descriptions. Don't guess a check's arguments from its name — read this.
- **Run one:** `pnpm gate-check <checkName> --json [--flag value ...]`
- Exit 0 = passed, 1 = ran and failed (or a caught error, e.g. an invalid `--base-ref`), 2 = invalid arguments or an unknown check name — all three still write valid JSON to stdout with `--json`, so parsing doesn't need to branch on exit code.

### `@weaver-engineering/task-phases` — `pnpm task`

Drives the task-phasing workflow: `init`, `status`, `list`, `promote`, `wip`, or a bare task ref (e.g. `AAA-001`) for the `ref`-switch command.

- `pnpm task <command> [...args] --json`
- Every command's `--json` output is one line: `{command, args, result, success}`.
- Exit 0/1 both write valid JSON with `--json` (0 = success, 1 = ran and failed). **Exit 2 is the one exception** — an unknown command or bad top-level argument writes plain text (`Error: <message>`) regardless of `--json`.

### Global availability

Both CLIs are also available as plain shell commands from any weaver-engineering project directory, not just from inside this workspace. One-time setup per machine, after `pnpm install && pnpm -r build` at this repo's root:

```bash
ln -sf "$(pwd)/packages/gate-checks/dist/cli.js" "$PNPM_HOME/bin/gate-checks"
ln -sf "$(pwd)/packages/task-phases/dist/cli.js" "$PNPM_HOME/bin/task"
```

(`$PNPM_HOME/bin` must already be on `PATH` — run `pnpm setup` once if it isn't. `pnpm link --global` would be the more idiomatic way to do this, but the `link --global` flag was dropped in newer pnpm versions, so this repo does it directly instead — it's the same mechanism pnpm's own bin-linking uses under the hood. `src/cli.ts`'s `isRunAsScript()` already accounts for being invoked through a symlink like this.)

### Releasing

Both packages publish independently to GitHub Packages (`https://npm.pkg.github.com`,
scoped `@weaver-engineering`) via Changesets. After changing either package, run
`pnpm changeset` to record a bump + summary, and commit the generated file alongside
your change. `.github/workflows/release.yaml` takes it from there: pushes to `main`
open/update a "Version Packages" PR; merging that PR publishes whichever packages have
pending changesets.
