import { describe, it, expect, vi, beforeEach } from "vitest";
import { fn } from "@weaver-engineering/gate-checks/src/checks/validate-commit-message.js";
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

const msgs = (i: Inspectors) => i.git.commitMessages as ReturnType<typeof vi.fn>;

describe("validate-commit-message", () => {
  let inspectors: Inspectors;
  beforeEach(() => { inspectors = createMockInspectors(); });

  it("passes for ref, continuing title and non-empty body", async () => {
    msgs(inspectors).mockResolvedValue(["WVR-9 Do a thing\n\nWhy it matters"]);
    const r = await fn(inspectors, {});
    expect(r.passed).toBe(true);
    expect(r.check).toBe("validate-commit-message");
    expect(r.values.ref).toBe("WVR-9");
  });

  it("defaults commit-ref to HEAD", async () => {
    msgs(inspectors).mockResolvedValue(["WVR-9 Do a thing\n\nBody"]);
    await fn(inspectors, {});
    expect(msgs(inspectors)).toHaveBeenCalledWith("HEAD");
  });

  it("fails when the title has no valid ref", async () => {
    msgs(inspectors).mockResolvedValue(["Do a thing\n\nBody"]);
    const r = await fn(inspectors, {});
    expect(r.passed).toBe(false);
    expect(r.violations[0]).toContain("valid ref");
  });

  it("fails when the ref differs from --ref", async () => {
    msgs(inspectors).mockResolvedValue(["WVR-9 Do a thing\n\nBody"]);
    const r = await fn(inspectors, { ref: "WVR-10" });
    expect(r.passed).toBe(false);
    expect(r.violations[0]).toContain("ref \"WVR-10\"");
  });

  it("fails when the title stops at the ref", async () => {
    msgs(inspectors).mockResolvedValue(["WVR-9\n\nBody"]);
    const r = await fn(inspectors, {});
    expect(r.passed).toBe(false);
    expect(r.violations).toContain("Commit message title must continue beyond the ref");
  });

  it("fails when the body is empty", async () => {
    msgs(inspectors).mockResolvedValue(["WVR-9 Do a thing"]);
    const r = await fn(inspectors, {});
    expect(r.passed).toBe(false);
    expect(r.violations).toContain("Commit message body must not be empty");
  });

  it("throws when the commit cannot be resolved", async () => {
    msgs(inspectors).mockRejectedValue(new Error("bad"));
    await expect(fn(inspectors, { "commit-ref": "nope" })).rejects.toThrow("--commit-ref");
  });
});
