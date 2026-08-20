import { beforeEach, describe, expect, it, vi } from "vitest";
import { fn as branchRef } from "@weaver-engineering/gate-checks/src/checks/branch-ref.js";
import { fn as prTitle } from "@weaver-engineering/gate-checks/src/checks/pr-title.js";
import { fn as validateSpec } from "@weaver-engineering/gate-checks/src/checks/validate-spec-commit.js";
import { fn as validateTest } from "@weaver-engineering/gate-checks/src/checks/validate-test-commit.js";
import { fn as validateBuild } from "@weaver-engineering/gate-checks/src/checks/validate-build-commit.js";
import { fn as validateTask } from "@weaver-engineering/gate-checks/src/checks/validate-task-commit.js";
import { fn as testGate } from "@weaver-engineering/gate-checks/src/checks/test-gate.js";
import { fn as buildGate } from "@weaver-engineering/gate-checks/src/checks/build-gate.js";
import { fn as mainGate } from "@weaver-engineering/gate-checks/src/checks/main-gate.js";
import type { Inspectors } from "@weaver-engineering/gate-checks/dist/types.js";

const VALID_REFS = ["AAA-123", "ABCD-1234", "AA-12.01", "ABC-001.1", "ABC-002.003"];
const INVALID_REFS = [
  "abc-123", "ABC", "ABC-", "ABC-one", "ABC-001.",
  "ABC-001.alpha", "ABC-001.1.2", "ABC-001:1", ".ABC-001", "ABC-001.1-extra",
];

function inspectors(branch = "task/ABC-002.003"): Inspectors {
  return {
    git: {
      currentBranch: vi.fn().mockResolvedValue(branch),
      mergeBase: vi.fn().mockResolvedValue("base"),
      revList: vi.fn(),
      commitMessages: vi.fn(),
      lsTree: vi.fn().mockResolvedValue([]),
      diffTree: vi.fn().mockResolvedValue([]),
      added: vi.fn().mockResolvedValue([]),
      modified: vi.fn().mockResolvedValue([]),
      deleted: vi.fn().mockResolvedValue([]),
      workingTreeChanges: vi.fn().mockResolvedValue([]),
    },
    coverage: {
      runBuild: vi.fn().mockReturnValue({ success: true, output: "" }),
      runTestsWithCoverage: vi.fn(),
      getCoverage: vi.fn().mockResolvedValue(95),
      getNewLineCoverage: vi.fn().mockResolvedValue(95),
      getTestResults: vi.fn().mockResolvedValue({
        numTotalTests: 2,
        numFailedTests: 1,
        failingTestFiles: ["test/numbered.test.ts"],
      }),
    },
  } as unknown as Inspectors;
}

describe("numbered task references at gate-check validation boundaries", () => {
  it.each(VALID_REFS)("accepts and preserves valid ref %s", async (ref) => {
    const result = await branchRef(inspectors(`spec/${ref}`), {
      "head-ref": `spec/${ref}`,
      ref,
    });
    expect(result.passed).toBe(true);
    expect(result.values.ref).toBe(ref);

    const titleResult = await prTitle(inspectors(), {
      ref,
      "pr-title": `Deliver work for ${ref} now`,
    });
    expect(titleResult.passed).toBe(true);
  });

  it.each(["spec", "test", "build", "ready", "task"])(
    "accepts the complete numbered ref on %s branches",
    async (prefix) => {
      const result = await branchRef(inspectors(), {
        "head-ref": `${prefix}/ABC-002.003`,
        ref: "ABC-002.003",
      });
      expect(result.passed).toBe(true);
      expect(result.values.ref).toBe("ABC-002.003");
    },
  );

  it.each(INVALID_REFS)("rejects malformed ref %s without prefix truncation", async (ref) => {
    const result = await branchRef(inspectors(), { "head-ref": `task/${ref}` });
    expect(result.passed).toBe(false);
    expect(result.values.ref).not.toBe("ABC-001");
    expect(result.values.ref).not.toBe("ABC-001.1");
  });

  it("validates an explicit numbered ref as a complete identity and describes the new grammar", async () => {
    const mismatch = await branchRef(inspectors(), {
      "head-ref": "task/ABC-001.1",
      ref: "ABC-001.10",
    });
    expect(mismatch.passed).toBe(false);
    expect(mismatch.violations.join(" ")).toContain("ABC-001.1");
    expect(mismatch.violations.join(" ")).toContain("ABC-001.10");

    const invalid = await prTitle(inspectors(), {
      ref: "ABC-001.1.2",
      "pr-title": "ABC-001.1.2: malformed",
    });
    expect(invalid.passed).toBe(false);
    expect(invalid.violations.join(" ")).toContain("[A-Z]+-[0-9]+(?:\\.[0-9]+)?");
  });
});

describe("numbered refs in all commit validators", () => {
  let mock: Inspectors;

  beforeEach(() => {
    mock = inspectors();
    vi.mocked(mock.git.commitMessages).mockResolvedValue([
      "ABC-001.1: preserve numbered identity\n\nExercises the complete reference.",
    ]);
    vi.mocked(mock.git.lsTree).mockResolvedValue([
      "docs/tasks/task-ABC-001.1/task-ABC-001.1.md",
      "docs/tasks/task-ABC-001.1/task-ABC-001.1-01-spec.md",
      "docs/tasks/task-ABC-001.1/task-ABC-001.1-02-reference-format-spec.md",
    ]);
  });

  it("accepts numbered task and both supported numbered specification paths", async () => {
    vi.mocked(mock.git.diffTree).mockResolvedValue([
      "docs/tasks/task-ABC-001.1/task-ABC-001.1-01-spec.md",
    ]);
    const result = await validateSpec(mock, { ref: "ABC-001.1" });
    expect(result.passed).toBe(true);
    expect(result.values.ref).toBe("ABC-001.1");
    expect(result.values.task).toBe("docs/tasks/task-ABC-001.1/task-ABC-001.1.md");
    expect(result.values.specs).toEqual([
      "docs/tasks/task-ABC-001.1/task-ABC-001.1-01-spec.md",
      "docs/tasks/task-ABC-001.1/task-ABC-001.1-02-reference-format-spec.md",
    ]);
  });

  it("accepts the complete ref in test, build, and quick-task commit titles", async () => {
    vi.mocked(mock.git.diffTree).mockResolvedValue(["test/numbered.test.ts"]);
    vi.mocked(mock.git.added).mockResolvedValue(["test/numbered.test.ts"]);
    const testResult = await validateTest(mock, { ref: "ABC-001.1" });
    expect(testResult.passed).toBe(true);
    expect(testResult.values.ref).toBe("ABC-001.1");

    vi.mocked(mock.git.diffTree).mockResolvedValue(["packages/example/src/index.ts"]);
    vi.mocked(mock.git.added).mockResolvedValue([]);
    const buildResult = await validateBuild(mock, { ref: "ABC-001.1" });
    expect(buildResult.passed).toBe(true);
    expect(buildResult.values.ref).toBe("ABC-001.1");

    const taskResult = await validateTask(mock, { ref: "ABC-001.1" });
    expect(taskResult.passed).toBe(true);
    expect(taskResult.values.ref).toBe("ABC-001.1");
  });

  it.each(["ABC-001", "ABC-001.10"])(
    "does not accept commit prefix %s for expected ABC-001.1",
    async (prefix) => {
      vi.mocked(mock.git.commitMessages).mockResolvedValue([
        `${prefix}: wrong identity\n\nBody`,
      ]);
      const result = await validateTask(mock, { ref: "ABC-001.1" });
      expect(result.passed).toBe(false);
      expect(result.violations.join(" ")).toContain("ABC-001.1");
    },
  );
});

function compositeInspectors(branch: string, commits: string[]): Inspectors {
  const mock = inspectors(branch);
  vi.mocked(mock.git.revList)
    .mockResolvedValueOnce(commits)
    .mockResolvedValueOnce([]);
  vi.mocked(mock.git.commitMessages).mockImplementation(async (sha: string) => [
    `ABC-002.003: ${sha}\n\nComplete numbered reference body`,
  ]);
  vi.mocked(mock.git.lsTree).mockResolvedValue([
    "docs/tasks/task-ABC-002.003/task-ABC-002.003.md",
    "docs/tasks/task-ABC-002.003/task-ABC-002.003-01-spec.md",
  ]);
  vi.mocked(mock.git.diffTree).mockImplementation(async (sha: string) => {
    if (sha === "spec") return ["docs/tasks/task-ABC-002.003/task-ABC-002.003-01-spec.md"];
    if (sha === "test") return ["test/numbered.test.ts"];
    return ["packages/example/src/index.ts"];
  });
  vi.mocked(mock.git.added).mockImplementation(async (sha: string) =>
    sha === "test" ? ["test/numbered.test.ts"] : [],
  );
  vi.mocked(mock.coverage.runTestsWithCoverage).mockImplementation(() => {
    if (branch.startsWith("build/")) throw new Error("expected new test failure");
  });
  if (!branch.startsWith("build/")) {
    vi.mocked(mock.coverage.getTestResults).mockResolvedValue({
      numTotalTests: 2,
      numFailedTests: 0,
      failingTestFiles: [],
    });
  }
  return mock;
}

describe("composite gates propagate the complete numbered reference", () => {
  it("passes it through the test gate", async () => {
    const result = await testGate(compositeInspectors("spec/ABC-002.003", ["spec"]), {
      ref: "ABC-002.003",
      "destination-branch": "main",
    });
    expect(result.passed).toBe(true);
    expect(result.values.ref).toBe("ABC-002.003");
  });

  it("passes it through the build gate", async () => {
    const result = await buildGate(
      compositeInspectors("test/ABC-002.003", ["test", "spec"]),
      { ref: "ABC-002.003", "destination-branch": "main" },
    );
    expect(result.passed).toBe(true);
    expect(result.values.ref).toBe("ABC-002.003");
  });

  it("passes it through the regular and quick main-gate routes", async () => {
    const regular = await mainGate(
      compositeInspectors("ready/ABC-002.003", ["build", "test", "spec"]),
      { ref: "ABC-002.003", "destination-branch": "main" },
    );
    expect(regular.passed).toBe(true);
    expect(regular.values.ref).toBe("ABC-002.003");

    const quickMock = compositeInspectors("task/ABC-002.003", ["task"]);
    vi.mocked(quickMock.git.modified).mockResolvedValue(["packages/example/src/index.ts"]);
    const quick = await mainGate(quickMock, {
      ref: "ABC-002.003",
      "destination-branch": "main",
    });
    expect(quick.passed).toBe(true);
    expect(quick.values.ref).toBe("ABC-002.003");
  });
});
