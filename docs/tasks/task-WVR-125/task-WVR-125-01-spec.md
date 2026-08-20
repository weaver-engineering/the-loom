# WVR-125 Specification - Task and chunk references

## 1. Terminology and grammar

The tooling recognizes three related reference concepts.

### 1.1 TaskRef

A `TaskRef` identifies a parent task and matches:

```regex
^[A-Z]+-[0-9]+$
```

Examples are `AAA-123`, `ABCD-1234`, and `ABC-001`.

### 1.2 ChunkRef

A `ChunkRef` identifies an independently deliverable chunk belonging to a parent task and matches:

```regex
^[A-Z]+-[0-9]+\.[0-9]+$
```

The substring before the dot is the parent `TaskRef`. The substring after the dot is the chunk number.

The task number and chunk number are opaque digit strings. Leading zeroes are valid, significant for identity, and must be preserved. Implementations must not parse or normalize either component as a number. Consequently, `ABC-123.1` and `ABC-123.01` are distinct ChunkRefs with the same parent TaskRef.

### 1.3 WorkRef

A `WorkRef` is the union accepted by tooling that operates on generic active work:

```text
WorkRef = TaskRef | ChunkRef
```

Given a TaskRef, its parent TaskRef is itself. Given a ChunkRef, its parent TaskRef is the complete substring before the dot.

### 1.4 Why ChunkRef, not SpecRef

The reference identifies the same independently deliverable unit throughout specification, test, build, PR review, gates, status reporting, and scheduling. A specification document is one artifact belonging to that unit. Naming it `SpecRef` or a spec number would incorrectly imply that the identity applies only to the specification phase.

This terminology follows the Feature Workflow, where chunking produces independently deliverable Chunks, each with its own specification, and the scheduler drives each Chunk through delivery.

### 1.5 Valid examples

| Reference | Classification | Parent TaskRef |
| --- | --- | --- |
| `AAA-123` | TaskRef and WorkRef | `AAA-123` |
| `ABCD-1234` | TaskRef and WorkRef | `ABCD-1234` |
| `AA-12.01` | ChunkRef and WorkRef | `AA-12` |
| `ABC-001.1` | ChunkRef and WorkRef | `ABC-001` |
| `ABC-002.003` | ChunkRef and WorkRef | `ABC-002` |

### 1.6 Invalid examples

| Reference | Reason |
| --- | --- |
| `abc-123` | team key is not uppercase ASCII |
| `ABC` | task number is missing |
| `ABC-` | task number is missing |
| `ABC-one` | task number is not numeric |
| `ABC-001.` | chunk number is missing |
| `ABC-001.alpha` | chunk number is not numeric |
| `ABC-001.1.2` | nested chunk references are not supported |
| `ABC-001:1` | colon is not the chunk separator |
| `.ABC-001` | unexpected leading character |
| `ABC-001.1-extra` | unexpected content after the chunk number |

No parser may accept an invalid value by truncating it to a valid prefix. For example, `ABC-001.1.2` is not `ABC-001.1`, and `ABC-001.1-extra` is not `ABC-001.1`.

## 2. Shared reference behavior

### 2.1 Ownership

Gate-checks owns the reusable runtime parsing, classification, validation, and parent-TaskRef derivation behavior. Task-phases already depends on gate-checks and must consume that public behavior rather than maintain an independent reference regex. Downstream checks and commands must not introduce private variants of the grammar.

### 2.2 Identity preservation

Every generic WorkRef boundary must preserve the complete input string verbatim:

- CLI arguments and structured output
- Git branch names
- Commit-title prefixes
- PR-title checks
- Gate arguments, messages, and result values
- Task-phases state derivation and reporting
- WIP commit prefixes

No encoded or normalized branch representation is permitted.

### 2.3 User-facing descriptions

Validation errors, check catalog descriptions, and type documentation must distinguish TaskRef, ChunkRef, and WorkRef accurately. They must not describe a ChunkRef as an optional part of TaskRef or as a spec number.

## 3. Gate-check behavior

### 3.1 Branch validation

The branch-ref check must extract and validate the complete WorkRef after the branch prefix. If an explicit `--ref` is supplied, it must be a valid WorkRef and equal the complete branch-derived WorkRef.

The existing regular and quick branch prefixes accept either WorkRef for backward compatibility and for independently addressable chunks:

```text
spec/ABC-123
spec/ABC-123.1
test/ABC-123.1
build/ABC-123.1
ready/ABC-123.1
task/ABC-123
task/ABC-123.1
```

### 3.2 Commit messages

Spec, test, build, and quick-task commit validation must extract the complete WorkRef from the start of the title. Given expected WorkRef `ABC-001.1`:

- `ABC-001.1: support chunk references` has the correct prefix.
- `ABC-001: support chunk references` does not have the correct prefix.
- `ABC-001.10: support chunk references` does not have the correct prefix.
- `ABC-001.1.2: support chunk references` is malformed and must not be treated as `ABC-001.1`.

Existing requirements for title content after the reference and for a non-empty body remain unchanged.

### 3.3 PR titles

The PR-title check must accept either WorkRef and continue enforcing its existing containment rule against the complete value. This task does not change containment into a starts-with rule.

### 3.4 TaskRef specification layout

Legacy regular workflows identified by a TaskRef retain their current validation and document layout. For example:

```text
docs/tasks/task-ABC-123/task-ABC-123.md
docs/tasks/task-ABC-123/task-ABC-123-01-spec.md
```

No existing task, branch, or document is renamed by this task.

### 3.5 ChunkRef specification layout

For active ChunkRef `ABC-123.1`, spec commit validation derives parent TaskRef `ABC-123` and requires:

```text
docs/tasks/task-ABC-123/task-ABC-123.md
docs/tasks/task-ABC-123/task-ABC-123.1-spec.md
```

The task directory and task document are parent-task artifacts. The specification document is a chunk artifact named with the complete ChunkRef.

Validation must require the exact active chunk specification. The presence of `task-ABC-123.2-spec.md`, or any other sibling specification, does not satisfy validation for `ABC-123.1`.

Existing restrictions requiring spec-commit changes to remain inside the derived parent task directory remain unchanged.

### 3.6 Composite gates

Test, build, and main gates must propagate the complete WorkRef between component checks. Their phase-specific ordering, commit-count requirements, destination checks, coverage behavior, and merge handling remain unchanged.

## 4. Task-phases behavior

### 4.1 Task initialization

`task init <ref>` remains task-scoped. Its positional reference must be a TaskRef, not a generic WorkRef.

A ChunkRef passed to `init`, including with `--quick`, must produce an invalid-argument result before fetch, branch creation, filesystem access, WIP handling, or any other task-specific mutation.

This task does not introduce a chunk-initialization command. An architect or future scheduler may prepare a chunk branch before task-phases derives and advances it.

### 4.2 Command dispatch and direct switching

The bare `task <ref>` switch command must dispatch for either valid WorkRef. Invalid or nested references must remain unknown/invalid commands and perform no Git action.

Literal command names such as `status`, `list`, `promote`, and `wip` must continue to dispatch as commands rather than references.

### 4.3 Branch discovery

`task list` must discover TaskRef and ChunkRef values from local and remote-tracking phase branches, group local and remote forms belonging to the same complete WorkRef, and report that WorkRef once. Malformed branch remainders must be ignored rather than truncated.

Branch-to-reference derivation used by status, switching, WIP commits, promotion, and cleanup must preserve the complete WorkRef.

### 4.4 Repository state and status

Repository-state derivation must construct and query phase branches using the complete WorkRef. Human-readable and JSON output must report the complete value without normalization.

The existing `ref` result field carries the WorkRef. This task does not require a breaking output-schema change; parent TaskRef derivation is exposed where document resolution needs it.

All existing states, canonical-branch rules, branch-mismatch rules, ready-check behavior, PR lookup behavior, and phase precedence remain unchanged.

### 4.5 Regular route

Once a `spec/{chunkRef}` branch exists, a ChunkRef must follow the existing regular lifecycle without route-specific exceptions:

```text
spec/{chunkRef} -> test/{chunkRef} -> build/{chunkRef} -> ready/{chunkRef} -> main
```

Status, list, switching, WIP handling, promotion, PR lookup and creation, cleanup, and gate invocation must use the complete ChunkRef at every step.

Legacy TaskRef regular routes continue unchanged.

### 4.6 Quick route

Once a `task/{chunkRef}` branch exists, a ChunkRef must follow the existing quick lifecycle without route-specific exceptions:

```text
task/{chunkRef} -> main
```

Status, list, switching, WIP handling, promotion, PR lookup and creation, cleanup, and gate invocation must use the complete ChunkRef at every step.

`task init --quick` remains TaskRef-only; this section concerns deriving and advancing a pre-existing chunk branch. Legacy TaskRef quick routes continue unchanged.

## 5. Backward compatibility

Every existing TaskRef remains valid and retains its current branch names, document paths, commit format, task-phases output, and gate behavior.

The change adds ChunkRef as a distinct accepted identity. It does not migrate or rename persisted data. Legacy regular specification validation continues to accept its established TaskRef-based layout.

## 6. Bootstrap for WVR-125

The pre-change gates only accept TaskRef. WVR-125 therefore uses the legacy WorkRef `WVR-125`, legacy regular branches, and legacy specification filename `task-WVR-125-01-spec.md` for its own delivery.

This bootstrap does not weaken any post-change requirement above. A later ChunkRef such as `WVR-125.1` must use the parent task directory and exact chunk specification layout defined in §3.5.

## 7. Required system-test coverage

System tests must demonstrate:

- The valid TaskRef and ChunkRef examples in §1.5 are classified correctly and preserve parent identity.
- The invalid examples in §1.6 are rejected without prefix truncation.
- Branch-ref and PR-title checks accept and preserve a ChunkRef.
- Spec, test, build, and quick-task commit validators parse the complete ChunkRef.
- Spec validation derives the parent task path and requires the exact active chunk specification.
- A sibling chunk specification cannot satisfy the active ChunkRef.
- Composite gates propagate a ChunkRef without changing their existing gate semantics.
- `task init` rejects ChunkRef before any Git or filesystem interaction.
- Bare-ref switching, list discovery, status derivation, and WIP prefixes preserve a ChunkRef.
- Promotion uses complete ChunkRef branch, gate, and PR arguments on representative regular and quick routes.
- Existing TaskRef tests continue to pass unchanged.

Tests should exercise shared validation and derivation boundaries rather than repeat the complete example matrix at every downstream call site. Route-level coverage must still prove that branch construction and propagation do not truncate or reject ChunkRef.
