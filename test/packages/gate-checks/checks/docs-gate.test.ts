import { describe, it, expect, vi, beforeEach } from "vitest";
import { fn } from "@weaver-engineering/gate-checks/src/checks/docs-gate.js";
import type { GitInspector } from "@weaver-engineering/gate-checks/dist/git-interface.js";
import type { CoverageInspector } from "@weaver-engineering/gate-checks/dist/coverage-interface.js";
import type { Inspectors } from "@weaver-engineering/gate-checks/dist/types.js";

function createMockInspectors(): Inspectors {
  return {
    git: {
      mergeBase: vi.fn(),
      diffTree: vi.fn(),
      lsTree: vi.fn(),
      commitMessages: vi.fn(),
      added: vi.fn(),
      modified: vi.fn(),
      deleted: vi.fn(),
      revList: vi.fn(),
      currentBranch: vi.fn().mockResolvedValue("task/WVR-9"),
    } as unknown as GitInspector,
    coverage: {} as unknown as CoverageInspector,
  };
}

const mock = (f: unknown) => f as ReturnType<typeof vi.fn>;

describe("docs-gate", () => {
  let inspectors: Inspectors;
  beforeEach(() => {
    inspectors = createMockInspectors();
    mock(inspectors.git.mergeBase).mockResolvedValue("base");
  });

  function commits(head: string[], dest: string[]) {
    mock(inspectors.git.revList).mockResolvedValueOnce(head).mockResolvedValueOnce(dest);
  }

  it("passes for one commit, destination not advanced, valid message", async () => {
    commits(["sha"], []);
    mock(inspectors.git.commitMessages).mockResolvedValue(["WVR-9 Do a thing\n\nBody"]);
    const r = await fn(inspectors, {});
    expect(r.passed).toBe(true);
    expect(r.check).toBe("docs-gate");
    expect(r.values.commit).toBe("sha");
    expect(mock(inspectors.git.mergeBase)).toHaveBeenCalledWith("HEAD", "origin/main");
    expect(mock(inspectors.git.commitMessages)).toHaveBeenCalledWith("sha");
  });

  it("does not touch paths, coverage or build", async () => {
    commits(["sha"], []);
    mock(inspectors.git.commitMessages).mockResolvedValue(["WVR-9 Do a thing\n\nBody"]);
    await fn(inspectors, {});
    expect(mock(inspectors.git.lsTree)).not.toHaveBeenCalled();
    expect(mock(inspectors.git.diffTree)).not.toHaveBeenCalled();
  });

  it("uses --head-ref and --destination-branch", async () => {
    commits(["sha"], []);
    mock(inspectors.git.commitMessages).mockResolvedValue(["WVR-7 Do a thing\n\nBody"]);
    const r = await fn(inspectors, { "head-ref": "docs/WVR-7", "destination-branch": "main" });
    expect(r.passed).toBe(true);
    expect(mock(inspectors.git.mergeBase)).toHaveBeenCalledWith("HEAD", "main");
  });

  it("fails when branch-ref fails", async () => {
    mock(inspectors.git.currentBranch).mockResolvedValue("invalid");
    const r = await fn(inspectors, {});
    expect(r.passed).toBe(false);
    expect(r.check).toBe("docs-gate");
  });

  it.each([[0], [2]])("fails with %i commits ahead", async (n) => {
    commits(Array.from({ length: n }, (_, i) => `s${i}`), []);
    const r = await fn(inspectors, {});
    expect(r.passed).toBe(false);
    expect(r.violations[0]).toContain(`found ${n}`);
  });

  it("fails when the destination has advanced", async () => {
    commits(["sha"], ["newer"]);
    const r = await fn(inspectors, {});
    expect(r.passed).toBe(false);
    expect(r.violations[0]).toContain("has advanced");
  });

  it("fails on a message with empty body", async () => {
    commits(["sha"], []);
    mock(inspectors.git.commitMessages).mockResolvedValue(["WVR-9 Do a thing"]);
    const r = await fn(inspectors, {});
    expect(r.passed).toBe(false);
    expect(r.violations).toContain("Commit message body must not be empty");
  });

  it("fails when commit ref disagrees with the branch ref", async () => {
    commits(["sha"], []);
    mock(inspectors.git.commitMessages).mockResolvedValue(["WVR-10 Do a thing\n\nBody"]);
    const r = await fn(inspectors, {});
    expect(r.passed).toBe(false);
    expect(r.violations[0]).toContain("ref \"WVR-9\"");
  });

  it("throws when the destination branch cannot be resolved", async () => {
    mock(inspectors.git.mergeBase).mockRejectedValue(new Error("bad"));
    await expect(fn(inspectors, { "destination-branch": "nope" })).rejects.toThrow("--destination-branch");
  });
});
