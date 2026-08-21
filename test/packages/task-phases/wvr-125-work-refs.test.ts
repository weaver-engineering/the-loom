import { afterEach, describe, expect, it, vi, type Mock } from "vitest";
import { run } from "../../../packages/task-phases/src/cli.js";
import type { ExternalTools } from "../../../packages/task-phases/src/types.js";

const REF = "ABC-002.003";

interface Fixture {
  tools: ExternalTools;
  git: Record<string, Mock>;
  github: Record<string, Mock>;
  gates: Record<string, Mock>;
  fs: Record<string, Mock>;
}

function fixture(options: {
  currentBranch?: string;
  branches?: string[];
  listedBranches?: string[];
  mergedQuick?: boolean;
} = {}): Fixture {
  const branches = new Set(options.branches ?? []);
  const currentBranch = options.currentBranch ?? "main";
  const git: Record<string, Mock> = {
    fetch: vi.fn().mockResolvedValue(undefined),
    currentBranch: vi.fn().mockResolvedValue(currentBranch),
    branchExists: vi.fn().mockImplementation((name: string, opts?: { remote?: boolean }) => {
      const candidate = opts?.remote ? `origin/${name}` : name;
      return branches.has(candidate) || branches.has(name);
    }),
    listBranches: vi.fn().mockResolvedValue(options.listedBranches ?? []),
    hasCommitsBeyond: vi.fn().mockResolvedValue(true),
    headCommitTitle: vi.fn().mockResolvedValue(`${REF}: chunk work`),
    isAncestor: vi.fn().mockImplementation((ancestor: string) => !ancestor.startsWith("merge-")),
    headSha: vi.fn().mockResolvedValue("sha"),
    isDirty: vi.fn().mockResolvedValue(false),
    changedFiles: vi.fn().mockResolvedValue({ added: [], changed: [], deleted: [] }),
    createBranch: vi.fn().mockResolvedValue(undefined),
    createRemoteBranch: vi.fn().mockResolvedValue(undefined),
    checkout: vi.fn().mockResolvedValue(undefined),
    commitAll: vi.fn().mockResolvedValue("commit-sha"),
    push: vi.fn().mockResolvedValue(undefined),
    pullFastForward: vi.fn().mockResolvedValue(undefined),
    rebase: vi.fn().mockResolvedValue({ status: "ok" }),
    deleteBranch: vi.fn().mockResolvedValue(undefined),
  };
  const github: Record<string, Mock> = {
    findMergedPR: vi.fn().mockImplementation((base: string, head: string) => {
      if (options.mergedQuick && base === "main" && head === `task/${REF}`) {
        return { number: 9, url: "https://example.test/9", mergeCommitOid: "merge-quick" };
      }
      return null;
    }),
    findMergedPRs: vi.fn().mockResolvedValue([]),
    findOpenPR: vi.fn().mockResolvedValue(null),
    createPR: vi.fn().mockResolvedValue({ number: 10, url: "https://example.test/10" }),
  };
  const gates: Record<string, Mock> = {
    run: vi.fn().mockResolvedValue({
      check: "gate",
      passed: true,
      args: {},
      messages: [],
      violations: [],
      summary: "ok",
      values: {},
    }),
    gateFor: vi.fn(),
  };
  const fs: Record<string, Mock> = {
    loadConfig: vi.fn(),
    exists: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn(),
    copyFile: vi.fn(),
    mkdir: vi.fn(),
    readDir: vi.fn(),
  };
  return {
    tools: { git, github, gateChecks: gates, fileSystem: fs } as unknown as ExternalTools,
    git,
    github,
    gates,
    fs,
  };
}

interface JsonDoc {
  result: {
    switchedTo?: string;
    tasks?: Array<{ ref: string }>;
    taskStatus?: {
      ref: string;
      phase: string;
      canonicalBranch: string;
    };
    branchesDeleted?: string[];
  };
}

async function invoke(f: Fixture, args: string[]): Promise<{ code: number; output: string; doc?: JsonDoc }> {
  const chunks: string[] = [];
  const stdout = vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
    chunks.push(String(chunk));
    return true;
  });
  const code = await run(["node", "task", ...args], f.tools);
  stdout.mockRestore();
  const output = chunks.join("");
  const line = output.trim().split("\n").at(-1);
  let doc: JsonDoc | undefined;
  try {
    doc = line ? JSON.parse(line) as JsonDoc : undefined;
  } catch {
    doc = undefined;
  }
  return { code, output, doc };
}

afterEach(() => vi.restoreAllMocks());

describe("WVR-125 task init remains TaskRef-only", () => {
  it.each([false, true])("rejects a ChunkRef before any dependency interaction (quick=%s)", async (quick) => {
    const f = fixture();
    const args = ["init", REF, "--title", "must not scaffold", "--json"];
    if (quick) args.splice(2, 0, "--quick");
    const result = await invoke(f, args);
    expect(result.code).toBe(2);
    expect(result.output).toContain("TaskRef");
    for (const dependency of [f.git, f.github, f.gates, f.fs]) {
      for (const mock of Object.values(dependency)) expect(mock).not.toHaveBeenCalled();
    }
  });
});

describe("WVR-125 task-phases derives and preserves ChunkRefs", () => {
  it("dispatches a bare ChunkRef and switches to its complete canonical branch", async () => {
    const f = fixture({ branches: [`spec/${REF}`] });
    const result = await invoke(f, [REF, "--json"]);
    expect(result.code).toBe(0);
    expect(f.git.checkout).toHaveBeenCalledWith(`spec/${REF}`);
    expect(result.doc?.result.switchedTo).toBe(`spec/${REF}`);
  });

  it.each(["ABC-002.003.1", "ABC-002.003-extra"])(
    "rejects malformed bare ref %s before Git interaction",
    async (ref) => {
      const f = fixture();
      const result = await invoke(f, [ref]);
      expect(result.code).toBe(2);
      expect(f.git.fetch).not.toHaveBeenCalled();
    },
  );

  it("lists local and remote forms once and ignores malformed branch remainders", async () => {
    const f = fixture({
      branches: [`origin/test/${REF}`],
      listedBranches: [
        `test/${REF}`,
        `origin/test/${REF}`,
        `origin/test/${REF}.1`,
        `origin/spec/${REF}-extra`,
      ],
    });
    const result = await invoke(f, ["list", "--json"]);
    expect(result.code).toBe(0);
    expect(result.doc?.result.tasks?.map((task) => task.ref)).toEqual([REF]);
  });

  it("reports status with the complete ChunkRef and branch", async () => {
    const f = fixture({ currentBranch: `test/${REF}`, branches: [`test/${REF}`] });
    const result = await invoke(f, ["status", "--json"]);
    expect(result.code).toBe(0);
    expect(result.doc?.result.taskStatus).toMatchObject({
      ref: REF,
      phase: "test",
      canonicalBranch: `test/${REF}`,
    });
  });

  it("uses the complete ChunkRef in WIP commit title and push", async () => {
    const f = fixture({ currentBranch: `build/${REF}` });
    f.git.isDirty.mockResolvedValue(true);
    const result = await invoke(f, ["wip", "checkpoint", "details", "--json"]);
    expect(result.code).toBe(0);
    expect(f.git.commitAll).toHaveBeenCalledWith(`${REF}: checkpoint - WIP`, "details");
    expect(f.git.push).toHaveBeenCalledWith(`build/${REF}`);
  });
});

describe("WVR-125 promotion propagates complete ChunkRefs", () => {
  it("uses complete regular-route branch, gate, and PR arguments", async () => {
    const f = fixture({
      currentBranch: `test/${REF}`,
      branches: [`test/${REF}`, `spec/${REF}`, `origin/build/${REF}`],
    });
    const result = await invoke(f, ["promote", "chunk tests", "coverage", "--json"]);
    expect(result.code).toBe(0);
    expect(f.gates.run).toHaveBeenCalledWith("test", { ref: REF });
    expect(f.git.push).toHaveBeenCalledWith(`test/${REF}`);
    expect(f.github.createPR).toHaveBeenCalledWith(
      `build/${REF}`,
      `test/${REF}`,
      expect.objectContaining({ title: `${REF}: chunk tests`, body: "coverage" }),
    );
  });

  it("uses complete quick-route branch, gate, and PR arguments", async () => {
    const f = fixture({ currentBranch: `task/${REF}`, branches: [`task/${REF}`] });
    const result = await invoke(f, ["promote", "quick chunk", "coverage", "--json"]);
    expect(result.code).toBe(0);
    expect(f.gates.run).toHaveBeenCalledWith("quick", { ref: REF });
    expect(f.git.push).toHaveBeenCalledWith(`task/${REF}`);
    expect(f.github.createPR).toHaveBeenCalledWith(
      "main",
      `task/${REF}`,
      expect.objectContaining({ title: `${REF}: quick chunk`, body: "coverage" }),
    );
  });

  it("cleans up the complete quick-route ChunkRef after merge", async () => {
    const f = fixture({
      currentBranch: `task/${REF}`,
      branches: [`task/${REF}`],
      mergedQuick: true,
    });
    const result = await invoke(f, ["promote", "--json"]);
    expect(result.code).toBe(0);
    expect(f.git.deleteBranch).toHaveBeenCalledWith(`task/${REF}`);
    expect(result.doc?.result.branchesDeleted).toEqual([`task/${REF}`]);
  });
});
