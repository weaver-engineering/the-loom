# Task WVR-125 - Extend task references with an optional spec number

**State:** Specified
**Phase:** specification -> test -> build -> deploy -> done
**Component:** `@weaver-engineering/gate-checks`, `@weaver-engineering/task-phases`
**Depends on:** none
**Related design docs:**
- `task-WVR-125-01-spec.md`

---

## 1. Summary

Extend the task-reference grammar with one optional dot-separated numeric spec number. Existing references remain valid, while references such as `ABC-001.1` and `ABC-002.003` must work unchanged through gate checks, branch handling, task-phases reporting, and both supported delivery routes.

## 2. Why this task, why now

A single Linear task can cover multiple independently specified units of work. The task tooling needs to distinguish those units without losing their relationship to the parent task. A dot is used because it is valid in Git branch names, unlike the originally proposed colon.

The reference must remain identical everywhere it is displayed or persisted. Encoding or translating the dot for branches, commits, or task documents would make the workflow harder to understand and cross-check.

## 3. In scope

- Accept references matching `^[A-Z]+-[0-9]+(?:\.[0-9]+)?$` in gate-checks and task-phases.
- Preserve the complete reference, including leading zeroes in either numeric component.
- Use the complete reference in commit titles, branch names, task documents, status output, PR checks, and gate arguments.
- Support the complete reference through the regular spec/test/build route.
- Support the complete reference through the quick `task/{ref}` route.
- Continue accepting all references that match the existing `[A-Z]+-[0-9]+` grammar.
- Reject malformed references consistently at task-phases entry points that accept a task reference.
- Update user-facing validation descriptions to describe the accepted grammar accurately.

## 4. Explicitly out of scope

- More than one spec-number segment, such as `ABC-001.1.2`.
- Non-numeric suffixes, such as `ABC-001.alpha`.
- Changing the existing team-key or task-number grammar.
- Encoding or translating task references between commands, Git branches, commits, documents, or output.
- Changing the existing rule that PR titles contain the task reference.
- Changing phase transitions, gate composition, or repository state derivation beyond accepting the extended reference.

## 5. Acceptance criteria

- `AAA-123`, `ABCD-1234`, `AA-12.01`, `ABC-001.1`, and `ABC-002.003` are accepted task references.
- The malformed references enumerated in the specification are rejected.
- Commit titles are parsed and checked against the complete reference rather than its parent task portion.
- `spec/{ref}`, `test/{ref}`, `build/{ref}`, `ready/{ref}`, and `task/{ref}` work with either form of reference.
- Gate checks and task-phases preserve and report the complete reference.
- A numbered reference can complete the regular route and the quick route.
- Existing unnumbered references retain their current behavior.
- Tests, build, and relevant gate checks pass.
- Both changed packages include an appropriate Changeset.
