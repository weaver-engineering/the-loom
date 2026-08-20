# WVR-125 Specification - Optional spec number in task references

## 1. Reference grammar

A task reference consists of:

1. One or more uppercase ASCII letters forming the team key.
2. A hyphen.
3. One or more decimal digits forming the task number.
4. Optionally, one dot followed by one or more decimal digits forming the spec number.

The complete reference must match:

```regex
^[A-Z]+-[0-9]+(?:\.[0-9]+)?$
```

The task number and optional spec number are opaque digit strings. Leading zeroes are valid, significant for identity, and must be preserved. Implementations must not parse them as numbers or normalize them.

### 1.1 Valid examples

| Reference | Expected result |
| --- | --- |
| `AAA-123` | accepted |
| `ABCD-1234` | accepted |
| `AA-12.01` | accepted |
| `ABC-001.1` | accepted |
| `ABC-002.003` | accepted |

### 1.2 Invalid examples

| Reference | Reason |
| --- | --- |
| `abc-123` | team key is not uppercase ASCII |
| `ABC` | task number is missing |
| `ABC-` | task number is missing |
| `ABC-one` | task number is not numeric |
| `ABC-001.` | spec number is missing |
| `ABC-001.alpha` | spec number is not numeric |
| `ABC-001.1.2` | more than one spec-number segment |
| `ABC-001:1` | colon is not the spec-number separator |
| `.ABC-001` | unexpected leading character |
| `ABC-001.1-extra` | unexpected content after the spec number |

## 2. Identity and representation

The full matched string is the task reference. For `ABC-002.003`, the reference is `ABC-002.003`, not `ABC-002`.

Every subsystem must preserve that string verbatim:

- CLI arguments and structured output
- Commit-title prefixes
- PR-title checks
- Git branch names
- Task and specification document paths
- Gate-check arguments, messages, and result values

There is no encoded or alternate branch representation. For example, the regular route for `ABC-002.003` uses `spec/ABC-002.003`, `test/ABC-002.003`, `build/ABC-002.003`, and `ready/ABC-002.003`; the quick route uses `task/ABC-002.003`.

## 3. Gate-check behavior

### 3.1 Reference and branch validation

The branch-ref check must accept the full reference after a branch prefix when it matches the grammar. If an explicit `--ref` is supplied, it must validate against the same grammar and equal the complete reference extracted from the branch.

Malformed suffixes must not be accepted by truncating to the parent portion. For example, neither `task/ABC-001.1.2` nor an explicit `ABC-001.1.2` may be treated as `ABC-001` or `ABC-001.1`.

### 3.2 Commit messages

Spec, test, build, and quick-task commit validation must extract the complete reference from the start of the commit title. Given an expected reference of `ABC-001.1`:

- `ABC-001.1: support numbered specs` has the correct prefix.
- `ABC-001: support numbered specs` does not have the correct prefix.
- `ABC-001.10: support numbered specs` does not have the correct prefix.

All existing requirements for content after the reference and for a non-empty body remain unchanged.

### 3.3 PR titles

The PR-title check must accept a numbered `--ref` and continue enforcing its existing containment rule against the complete reference. This task does not change containment into a starts-with rule.

### 3.4 Specification documents

Spec commit validation must recognize task and specification paths containing a numbered reference. For `ABC-001.1`, the conventional paths include:

```text
docs/tasks/task-ABC-001.1/task-ABC-001.1.md
docs/tasks/task-ABC-001.1/task-ABC-001.1-01-spec.md
docs/tasks/task-ABC-001.1/task-ABC-001.1-01-reference-format-spec.md
```

The existing optional sequence and descriptive slug in specification filenames remain supported. Existing restrictions on spec-commit contents remain unchanged.

### 3.5 Composite gates

Test, build, and main gates must pass the complete reference between their component checks. Their phase-specific behavior and ordering remain unchanged.

## 4. Task-phases behavior

### 4.1 Command inputs

Every task-phases entry point that accepts or dispatches on a task reference must use the grammar in section 1. This includes `init` and the bare `task <ref>` switch command. Invalid references must fail before task-specific Git or filesystem mutation.

Literal command names such as `status`, `list`, `promote`, and `wip` must continue to dispatch as commands rather than task references.

### 4.2 Branch discovery

`task list` must discover numbered references from local and remote-tracking phase branches, group branch forms belonging to the same complete reference, and report that complete reference once. It must ignore branches whose remainder is not a valid complete reference.

Branch-to-reference derivation used by status, switching, WIP commits, and promotion must preserve the numbered reference.

### 4.3 Repository state and status

Repository-state derivation must construct and query phase branches with the complete reference. Human-readable and JSON status output must report the complete reference without normalization.

All existing states, canonical-branch rules, branch-mismatch rules, and ready-check behavior remain unchanged.

### 4.4 Regular route

A numbered reference must be able to follow the existing regular lifecycle without route-specific exceptions:

```text
spec/{ref} -> test/{ref} -> build/{ref} -> ready/{ref} -> main
```

Initialization, status, list, switching, WIP handling, promotion, PR lookup/creation, cleanup, and gate invocation must use the complete reference at every step.

### 4.5 Quick route

A numbered reference must be able to follow the existing quick lifecycle without route-specific exceptions:

```text
task/{ref} -> main
```

Initialization with `--quick`, status, list, switching, WIP handling, promotion, PR lookup/creation, cleanup, and gate invocation must use the complete reference at every step.

### 4.6 Task documents

Default task and specification document expansion must substitute the complete reference, including its dot and spec number. No sanitization or numeric normalization is permitted.

## 5. Backward compatibility

Every reference valid under the previous `^[A-Z]+-[0-9]+$` grammar remains valid and retains its current branch names, document paths, commit format, task-phases output, and gate behavior.

The optional suffix changes only which additional inputs are accepted. It does not migrate existing data or rename existing branches and documents.

## 6. Required test coverage

System tests must demonstrate:

- Every valid example in section 1.1 is accepted at the validation boundaries.
- Every invalid example in section 1.2 is rejected without prefix truncation.
- Branch-ref, PR-title, and all four commit validators handle a numbered reference.
- Spec commit validation recognizes numbered task and spec document paths.
- Composite gates propagate a numbered reference correctly.
- `task init`, bare-ref switching, list discovery, status derivation, and promotion preserve a numbered reference.
- At least one numbered reference exercises the regular route's branch construction and state transitions.
- At least one numbered reference exercises the quick route's branch construction and state transitions.
- Existing unnumbered-reference tests continue to pass unchanged.

Tests should target shared validation and derivation boundaries rather than repeat the complete five-value matrix at every downstream call site. Route-level tests must still prove that no downstream branch construction or propagation path truncates or rejects the numbered form.
