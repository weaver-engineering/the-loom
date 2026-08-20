# Task WVR-125 - Support task and chunk references

**State:** Specified
**Phase:** specification -> test -> build -> deploy -> done
**Component:** `@weaver-engineering/gate-checks`, `@weaver-engineering/task-phases`
**Depends on:** none
**Related design docs:**
- `task-WVR-125-01-spec.md`
- `the-loom-docs/notes/loom-service-vision.md`
- `docs/workflows/feature-workflow/feature-workflow.md`
- `docs/workflows/feature-workflow/chunk-scope.md`

---

## 1. Summary

Introduce separate task and chunk reference concepts while retaining a common work reference wherever the tooling can operate on either form.

```text
TaskRef  = ABC-123
ChunkRef = ABC-123.1
WorkRef  = TaskRef | ChunkRef
```

A `TaskRef` identifies the parent task. A `ChunkRef` identifies one independently deliverable chunk belonging to that task and derives its parent from the portion before the dot.

## 2. Why this task, why now

The current tooling uses one task reference for every delivery chunk belonging to that task. As a result, separate chunks share branch, PR, gate, and task-phases identity even though their specification documents already represent separate units of delivery.

The Feature Workflow defines Chunks as the independently deliverable units produced by chunking a design. Each Chunk has its own specification and is driven through delivery by the scheduler. The reference must therefore identify the Chunk throughout its lifecycle, not only during specification.

For that reason, `ABC-123.1` is called a `ChunkRef`, not a SpecRef or a spec number. Specification is one phase and one artifact belonging to the Chunk; the same identity continues through test, build, gates, PRs, and status reporting.

## 3. In scope

- Define and distinguish `TaskRef`, `ChunkRef`, and their `WorkRef` union.
- Accept either reference form at branch, commit, PR, gate, and task-phases boundaries that operate on generic active work.
- Preserve the complete `WorkRef`, including leading zeroes in a chunk number.
- Derive a ChunkRef's parent TaskRef without normalizing either numeric component.
- Resolve task documents from the parent TaskRef.
- Resolve a chunk's specification from the complete ChunkRef.
- Require spec validation to identify the active chunk's specification rather than an arbitrary sibling specification.
- Continue supporting legacy TaskRef-based regular and quick workflows.
- Keep `task init` task-scoped: it accepts TaskRef and rejects ChunkRef before mutation.
- Support deriving and advancing both regular and quick routes for a ChunkRef once its branch exists.
- Update user-facing validation descriptions to use the new terminology accurately.

## 4. Explicitly out of scope

- Implementing the future scheduler.
- Adding a command that initializes or schedules a ChunkRef.
- Renaming historical branches, commits, task documents, or specification documents.
- Nested chunk references such as `ABC-123.1.2`.
- Changing phase transitions, gate ordering, commit counts, or merge handling.
- Changing the existing PR-title containment rule.
- Defining chunk sequencing or the contents of the Feature Workflow's specification-document standard.

## 5. Bootstrap note

WVR-125 must be delivered through the legacy `WVR-125` regular route because the pre-change gates cannot validate `WVR-125.1`. Its branches remain `spec/WVR-125`, `test/WVR-125`, and `build/WVR-125`, and this specification retains the legacy filename `task-WVR-125-01-spec.md`.

This is a one-time bootstrap condition, not the post-change artifact layout. Once WVR-125 lands, a new chunk such as `ABC-123.1` uses parent task document `task-ABC-123.md` and chunk specification `task-ABC-123.1-spec.md`.

## 6. Acceptance criteria

- `AAA-123` and `ABCD-1234` are valid TaskRefs.
- `AA-12.01`, `ABC-001.1`, and `ABC-002.003` are valid ChunkRefs.
- Both forms are valid WorkRefs.
- A ChunkRef reliably derives its parent TaskRef and preserves leading zeroes.
- Malformed and nested references are rejected without truncation to a valid prefix.
- Branches, commits, PR checks, gates, status, list, switch, promote, WIP, and cleanup preserve the complete active WorkRef.
- Task documents are resolved from the parent TaskRef.
- Chunk specifications are resolved from the complete ChunkRef.
- A sibling chunk's specification cannot satisfy validation for the active ChunkRef.
- Existing TaskRef-based workflows remain operational.
- `task init` rejects ChunkRef before Git or filesystem mutation.
- Regular and quick routes derive and report state correctly for a ChunkRef once its branch exists.
- Tests, build, and relevant gates pass.
