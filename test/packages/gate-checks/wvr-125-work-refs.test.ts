import { describe, expect, it, vi, type Mock } from "vitest";
import { fn as branchRef } from "../../../packages/gate-checks/src/checks/branch-ref.js";
import { fn as prTitle } from "../../../packages/gate-checks/src/checks/pr-title.js";
import { fn as validateSpecCommit } from "../../../packages/gate-checks/src/checks/validate-spec-commit.js";
import { fn as validateTestCommit } from "../../../packages/gate-checks/src/checks/validate-test-commit.js";
import { fn as validateBuildCommit } from "../../../packages/gate-checks/src/checks/validate-build-commit.js";
import { fn as validateTaskCommit } from "../../../packages/gate-checks/src/checks/validate-task-commit.js";
import { fn as testGate } from "../../../packages/gate-checks/src/checks/test-gate.js";
import { fn as buildGate } from "../../../packages/gate-checks/src/checks/build-gate.js";
import { fn as mainGate } from "../../../packages/gate-checks/src/checks/main-gate.js";
import type { Inspectors } from "../../../packages/gate-checks/src/types.js";

const CHUNK_REF = "ABC-002.003";
const TASK_DOC = "docs/tasks/task-ABC-002/task-ABC-002.md";
const CHUNK_SPEC = "docs/tasks/task-ABC-002/task-ABC-002.003-spec.md";
const NEW_TEST = "test/packages/example/chunk.test.ts";

function inspectors(overrides: Record<string, Mock> = {}): Inspectors {
  const git = {
    currentBranch: vi.fn().mockResolvedValue(`test/${CHUNK_REF}`),
    mergeBase: vi.fn().mockResolvedValue("base"),
    revList: vi.fn().mockResolvedValue([]),
    commitMessages: vi.fn().mockResolvedValue([`${CHUNK_REF}: exercise work refs\n\nBody`]),
    lsTree: vi.fn().mockResolvedValue([TASK_DOC, CHUNK_SPEC]),
    diffTree: vi.fn().mockResolvedValue([CHUNK_SPEC]),
    added: vi.fn().mockResolvedValue([]),
    modified: vi.fn().mockResolvedValue([]),
    deleted: vi.fn().mockResolvedValue([]),
    workingTreeChanges: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
  const coverage = {
    runBuild: vi.fn().mockReturnValue({ success: true, output: "" }),
    runTestsWithCoverage: vi.fn(),
    getCoverage: vi.fn().mockResolvedValue(95),
    getNewLineCoverage: vi.fn().mockResolvedValue(100),
    getTestResults: vi.fn().mockResolvedValue({
      numTotalTests: 1,
      numFailedTests: 0,
      failingTestFiles: [],
    }),
  };
  return { git, coverage } as unknown as Inspectors;
}

describe("WVR-125 TaskRef, ChunkRef, and WorkRef grammar", () => {
  it.each([
    ["AAA-123", "AAA-123"],
    ["ABCD-1234", "ABCD-1234"],
    ["AA-12.01", "AA-12.01"],
    ["ABC-001.1", "ABC-001.1"],
    [CHUNK_REF, CHUNK_REF],
  ])("accepts and preserves WorkRef %s", async (ref, expected) => {
    const result = await branchRef(inspectors(), { "head-ref": `spec/${ref}` });
    expect(result.passed).toBe(true);
    expect(result.values.ref).toBe(expected);
  });

  it.each([
    "abc-123",
    "ABC",
    "ABC-",
    "ABC-one",
    "ABC-001.",
    "ABC-001.alpha",
    "ABC-001.1.2",
    "ABC-001:1",
    ".ABC-001",
    "ABC-001.1-extra",
  ])("rejects malformed WorkRef %s without prefix truncation", async (ref) => {
    const result = await branchRef(inspectors(), { "head-ref": `test/${ref}` });
    expect(result.passed).toBe(false);
    expect(result.values.ref).not.toBe("ABC-001.1");
  });

  it("requires an explicit WorkRef to equal the complete branch WorkRef", async () => {
    const result = await branchRef(inspectors(), {
      "head-ref": `test/${CHUNK_REF}`,
      ref: "ABC-002",
    });
    expect(result.passed).toBe(false);
    expect(result.violations.join("\n")).toContain("Ref mismatch");
  });
});

describe("WVR-125 gate-check WorkRef boundaries", () => {
  it("accepts a complete ChunkRef in the existing PR-title containment rule", async () => {
    const result = await prTitle(inspectors(), {
      ref: CHUNK_REF,
      "pr-title": `Build Gate for ${CHUNK_REF}`,
    });
    expect(result.passed).toBe(true);
  });

  it.each([
    ["spec", validateSpecCommit, "spec-commit-ref", [CHUNK_SPEC]],
    ["test", validateTestCommit, "test-commit-ref", [NEW_TEST]],
    ["build", validateBuildCommit, "build-commit-ref", ["packages/example/src/index.ts"]],
    ["quick", validateTaskCommit, "task-commit-ref", ["packages/example/src/index.ts"]],
  ])("the %s commit validator parses the complete ChunkRef", async (_phase, validator, arg, files) => {
    const added = arg === "test-commit-ref" ? files : [];
    const result = await validator(
      inspectors({
        diffTree: vi.fn().mockResolvedValue(files),
        added: vi.fn().mockResolvedValue(added),
      }),
      { [arg]: "commit", ref: CHUNK_REF },
    );
    expect(result.passed).toBe(true);
    expect(result.values.ref).toBe(CHUNK_REF);
  });

  it.each(["ABC-002: truncated", "ABC-002.0030: neighbour", "ABC-002.003.1: nested"])(
    "does not accept %s for the active chunk",
    async (title) => {
      const result = await validateBuildCommit(
        inspectors({
          commitMessages: vi.fn().mockResolvedValue([`${title}\n\nBody`]),
          diffTree: vi.fn().mockResolvedValue(["packages/example/src/index.ts"]),
        }),
        { "build-commit-ref": "commit", ref: CHUNK_REF },
      );
      expect(result.passed).toBe(false);
    },
  );

  it("derives the parent TaskRef directory and requires the exact chunk specification", async () => {
    const git = inspectors().git;
    const result = await validateSpecCommit({ git, coverage: inspectors().coverage }, {
      "spec-commit-ref": "spec",
      ref: CHUNK_REF,
    });
    expect(result.passed).toBe(true);
    expect(result.values.task).toBe(TASK_DOC);
    expect(result.values.specs).toEqual([CHUNK_SPEC]);
    expect(git.lsTree).toHaveBeenCalledWith("spec", "docs/tasks/task-ABC-002");
  });

  it("does not let a sibling chunk specification satisfy the active ChunkRef", async () => {
    const sibling = "docs/tasks/task-ABC-002/task-ABC-002.004-spec.md";
    const result = await validateSpecCommit(
      inspectors({
        lsTree: vi.fn().mockResolvedValue([TASK_DOC, sibling]),
        diffTree: vi.fn().mockResolvedValue([sibling]),
      }),
      { "spec-commit-ref": "spec", ref: CHUNK_REF },
    );
    expect(result.passed).toBe(false);
    expect(result.values.specs ?? []).not.toContain(sibling);
  });
});

function compositeInspectors(
  branch: string,
  commits: string[],
  messages: Record<string, string>,
  testsFail: boolean,
): Inspectors {
  const fixture = inspectors({
    currentBranch: vi.fn().mockResolvedValue(branch),
    revList: vi
      .fn()
      .mockResolvedValueOnce(commits)
      .mockResolvedValueOnce([]),
    commitMessages: vi.fn().mockImplementation((ref: string) => [messages[ref]]),
    diffTree: vi.fn().mockImplementation((ref: string) => {
      if (ref === "spec") return [CHUNK_SPEC];
      if (ref === "test") return [NEW_TEST];
      return ["packages/example/src/index.ts"];
    }),
    added: vi.fn().mockImplementation((ref: string) => (ref === "test" ? [NEW_TEST] : [])),
  });
  const runTests = fixture.coverage.runTestsWithCoverage as Mock;
  if (testsFail) runTests.mockImplementation(() => { throw new Error("expected failure"); });
  (fixture.coverage.getTestResults as Mock).mockResolvedValue({
    numTotalTests: 1,
    numFailedTests: testsFail ? 1 : 0,
    failingTestFiles: testsFail ? [NEW_TEST] : [],
  });
  return fixture;
}

describe("WVR-125 composite gates propagate complete WorkRefs", () => {
  it("test-gate carries the ChunkRef into spec validation", async () => {
    const result = await testGate(
      compositeInspectors(`spec/${CHUNK_REF}`, ["spec"], {
        spec: `${CHUNK_REF}: specify chunks\n\nBody`,
      }, false),
      { ref: CHUNK_REF, "destination-branch": "main" },
    );
    expect(result.passed).toBe(true);
    expect(result.values.ref).toBe(CHUNK_REF);
  });

  it("build-gate carries the ChunkRef through spec and test validation", async () => {
    const result = await buildGate(
      compositeInspectors(`test/${CHUNK_REF}`, ["test", "spec"], {
        spec: `${CHUNK_REF}: specify chunks\n\nBody`,
        test: `${CHUNK_REF}: test chunks\n\nBody`,
      }, true),
      { ref: CHUNK_REF, "destination-branch": "main" },
    );
    expect(result.passed).toBe(true);
    expect(result.values.ref).toBe(CHUNK_REF);
  });

  it("main-gate carries a quick-route ChunkRef into task commit validation", async () => {
    const result = await mainGate(
      compositeInspectors(`task/${CHUNK_REF}`, ["task"], {
        task: `${CHUNK_REF}: quick chunk\n\nBody`,
      }, false),
      { ref: CHUNK_REF, "head-ref": `task/${CHUNK_REF}`, "destination-branch": "main" },
    );
    expect(result.passed).toBe(true);
    expect(result.values.ref).toBe(CHUNK_REF);
  });
});
