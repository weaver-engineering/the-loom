import { afterEach, describe, expect, it, vi, type Mock } from "vitest";
import { run } from "../../../packages/task-phases/src/cli.js";
import type { ExternalTools, GateCheckResult, TaskPhasesConfig } from "../../../packages/task-phases/src/types.js";

const VALID_REFS = ["AAA-123", "ABCD-1234", "AA-12.01", "ABC-001.1", "ABC-002.003"];
const INVALID_REFS = [
  "abc-123", "ABC", "ABC-", "ABC-one", "ABC-001.",
  "ABC-001.alpha", "ABC-001.1.2", "ABC-001:1", ".ABC-001", "ABC-001.1-extra",
];

const CONFIG: TaskPhasesConfig = {
  templates: { task: "templates/task.md" },
  tasks: {
    docs: "docs/tasks/",
    dirName: "task-${ref}",
    taskDocName: "task-${ref}",
    specDocNames: "task-${ref}-${nn}-spec.md",
  },
};

function gateResult(check = "build-gate"): GateCheckResult {
  return { check, passed: true, args: {}, messages: [], violations: [], summary: "ok", values: {} };
}

interface ToolSet {
  tools: ExternalTools;
  mocks: Record<string, Mock>;
}

interface CliJson {
  result: {
    canonicalBranch: string;
    currentRef: string | null;
    tasks: Array<Record<string, unknown>>;
    taskStatus: Record<string, unknown>;
    switchedTo: string;
    action: string;
  };
}

function buildTools(options: {
  current?: string;
  local?: string[];
  remote?: string[];
  listed?: string[];
  dirty?: boolean;
} = {}): ToolSet {
  const local = new Set(options.local ?? []);
  const remote = new Set(options.remote ?? []);
  const currentBranch = vi.fn().mockResolvedValue(options.current ?? "main");
  const branchExists = vi.fn().mockImplementation((name: string, opts?: { remote?: boolean }) =>
    opts?.remote === true ? remote.has(name) : local.has(name),
  );
  const createBranch = vi.fn().mockImplementation(async (name: string) => { local.add(name); });
  const createRemoteBranch = vi.fn().mockImplementation(async (name: string) => { remote.add(name); });
  const createPR = vi.fn().mockResolvedValue({ number: 125, url: "https://example.test/pr/125" });
  const mocks: Record<string, Mock> = {
    fetch: vi.fn().mockResolvedValue(undefined),
    currentBranch,
    branchExists,
    headSha: vi.fn().mockResolvedValue("same-sha"),
    mergeBase: vi.fn().mockResolvedValue("base"),
    hasCommitsBeyond: vi.fn().mockResolvedValue(true),
    headCommitTitle: vi.fn().mockResolvedValue("ABC-002.003: complete work"),
    isDirty: vi.fn().mockResolvedValue(options.dirty ?? false),
    isAncestor: vi.fn().mockResolvedValue(true),
    createBranch,
    createRemoteBranch,
    checkout: vi.fn().mockResolvedValue(undefined),
    commitAll: vi.fn().mockResolvedValue("wip-sha"),
    push: vi.fn().mockResolvedValue(undefined),
    pullFastForward: vi.fn().mockResolvedValue(undefined),
    rebase: vi.fn().mockResolvedValue({ status: "ok" }),
    deleteBranch: vi.fn().mockResolvedValue(undefined),
    listBranches: vi.fn().mockResolvedValue(options.listed ?? [...local]),
    changedFiles: vi.fn().mockResolvedValue([]),
    createPR,
    findMergedPRs: vi.fn().mockResolvedValue([]),
    findMergedPR: vi.fn().mockResolvedValue(null),
    findOpenPR: vi.fn().mockResolvedValue(null),
    gateRun: vi.fn().mockImplementation((phase: string) =>
      Promise.resolve(gateResult(phase === "spec" ? "test-gate" : phase === "test" ? "build-gate" : "main-gate")),
    ),
    loadConfig: vi.fn().mockResolvedValue(CONFIG),
    exists: vi.fn().mockImplementation((path: string) => Promise.resolve(path === "templates/task.md")),
    readFile: vi.fn().mockResolvedValue("# ${title}\n\nRef: ${ref}\n"),
    writeFile: vi.fn().mockResolvedValue(undefined),
    copyFile: vi.fn().mockResolvedValue(undefined),
    mkdir: vi.fn().mockResolvedValue(undefined),
    readDir: vi.fn().mockResolvedValue([]),
  };

  const tools = {
    git: {
      fetch: mocks.fetch, currentBranch, branchExists, headSha: mocks.headSha,
      mergeBase: mocks.mergeBase, hasCommitsBeyond: mocks.hasCommitsBeyond,
      headCommitTitle: mocks.headCommitTitle, isDirty: mocks.isDirty,
      isAncestor: mocks.isAncestor, createBranch, createRemoteBranch,
      checkout: mocks.checkout, commitAll: mocks.commitAll, push: mocks.push,
      pullFastForward: mocks.pullFastForward, rebase: mocks.rebase,
      deleteBranch: mocks.deleteBranch, listBranches: mocks.listBranches,
      changedFiles: mocks.changedFiles,
    },
    github: {
      createPR, findMergedPRs: mocks.findMergedPRs,
      findMergedPR: mocks.findMergedPR, findOpenPR: mocks.findOpenPR,
    },
    gateChecks: { run: mocks.gateRun, gateFor: vi.fn() },
    fileSystem: {
      loadConfig: mocks.loadConfig, exists: mocks.exists, readFile: mocks.readFile,
      writeFile: mocks.writeFile, copyFile: mocks.copyFile, mkdir: mocks.mkdir,
      readDir: mocks.readDir,
    },
  } as unknown as ExternalTools;
  return { tools, mocks };
}

async function invoke(tools: ExternalTools, tokens: string[]): Promise<{ code: number; output: string; json: CliJson }> {
  const chunks: string[] = [];
  const spy = vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
    chunks.push(String(chunk));
    return true;
  });
  const code = await run(["node", "cli.js", ...tokens], tools);
  spy.mockRestore();
  const output = chunks.join("");
  let json = { result: {} } as CliJson;
  if (tokens.includes("--json") && output.trim().startsWith("{")) {
    json = JSON.parse(output.trim()) as CliJson;
  }
  return { code, output, json };
}

afterEach(() => vi.restoreAllMocks());

describe("task init validates and preserves optional spec numbers", () => {
  it.each(VALID_REFS)("accepts %s and expands the complete ref into branch, path, and output", async (ref) => {
    const { tools, mocks } = buildTools();
    const result = await invoke(tools, ["init", ref, "--title", "Numbered task", "--json"]);
    expect(result.code).toBe(0);
    expect(mocks.createBranch).toHaveBeenCalledWith(`spec/${ref}`, "main");
    expect(mocks.mkdir).toHaveBeenCalledWith(`docs/tasks/task-${ref}`);
    expect(mocks.writeFile).toHaveBeenCalledWith(
      `docs/tasks/task-${ref}/task-${ref}.md`,
      `# Numbered task\n\nRef: ${ref}\n`,
    );
    expect(result.json.result.canonicalBranch).toBe(`spec/${ref}`);
  });

  it.each(INVALID_REFS)("rejects malformed init ref %s before Git or filesystem mutation", async (ref) => {
    const { tools, mocks } = buildTools();
    const result = await invoke(tools, ["init", ref, "--title", "Invalid"]);
    expect(result.code).toBe(2);
    expect(result.output).toMatch(/task ref|[A-Z]/i);
    expect(mocks.createBranch).not.toHaveBeenCalled();
    expect(mocks.createRemoteBranch).not.toHaveBeenCalled();
    expect(mocks.writeFile).not.toHaveBeenCalled();
    expect(mocks.mkdir).not.toHaveBeenCalled();
  });

  it("constructs the quick-route branch from the complete numbered ref", async () => {
    const { tools, mocks } = buildTools();
    const result = await invoke(tools, ["init", "ABC-002.003", "--quick", "--title", "Quick", "--json"]);
    expect(result.code).toBe(0);
    expect(mocks.createBranch).toHaveBeenCalledWith("task/ABC-002.003", "main");
    expect(result.json.result.canonicalBranch).toBe("task/ABC-002.003");
  });
});

describe("numbered refs survive task discovery, status, switching, and WIP", () => {
  it("discovers local and remote forms once, ignores malformed branches, and reports the full ref", async () => {
    const ref = "ABC-002.003";
    const { tools } = buildTools({
      current: `test/${ref}`,
      local: [`test/${ref}`, `spec/${ref}`],
      remote: [`test/${ref}`, `spec/${ref}`],
      listed: [`test/${ref}`, `origin/test/${ref}`, "task/ABC-002.003.4", "task/ABC-002.003-extra"],
    });
    const result = await invoke(tools, ["list", "--json"]);
    expect(result.code).toBe(0);
    expect(result.json.result.currentRef).toBe(ref);
    expect(result.json.result.tasks).toHaveLength(1);
    expect(result.json.result.tasks[0]).toMatchObject({ ref, canonicalBranch: `test/${ref}` });
  });

  it("derives and reports status with leading zeroes unchanged", async () => {
    const ref = "AA-12.01";
    const { tools } = buildTools({ current: `test/${ref}`, local: [`test/${ref}`, `spec/${ref}`] });
    const result = await invoke(tools, ["status", "--json"]);
    expect(result.code).toBe(0);
    expect(result.json.result.taskStatus).toMatchObject({
      ref,
      phase: "test",
      canonicalBranch: `test/${ref}`,
    });
  });

  it("bare-ref switching checks out the complete numbered canonical branch", async () => {
    const ref = "ABC-001.1";
    const { tools, mocks } = buildTools({
      current: "task/OTHER-9",
      local: [`test/${ref}`, `spec/${ref}`],
    });
    const result = await invoke(tools, [ref, "--json"]);
    expect(result.code).toBe(0);
    expect(mocks.checkout).toHaveBeenCalledWith(`test/${ref}`);
    expect(result.json.result.switchedTo).toBe(`test/${ref}`);
  });

  it.each(INVALID_REFS)("rejects malformed bare ref %s before any Git action", async (ref) => {
    const { tools, mocks } = buildTools();
    const result = await invoke(tools, [ref]);
    expect(result.code).toBe(2);
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.checkout).not.toHaveBeenCalled();
  });

  it.each(INVALID_REFS)("rejects malformed status --ref %s before any Git action", async (ref) => {
    const { tools, mocks } = buildTools();
    const result = await invoke(tools, ["status", "--ref", ref, "--json"]);
    expect(result.code).toBe(2);
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.checkout).not.toHaveBeenCalled();
  });

  it("uses the complete numbered ref in a WIP commit", async () => {
    const ref = "ABC-002.003";
    const { tools, mocks } = buildTools({ current: `task/${ref}`, local: [`task/${ref}`], dirty: true });
    const result = await invoke(tools, ["wip", "pause", "details", "--json"]);
    expect(result.code).toBe(0);
    expect(mocks.commitAll).toHaveBeenCalledWith(`${ref}: pause - WIP`, "details");
  });
});

describe("numbered refs complete regular and quick promotion paths", () => {
  it("promotes a ready regular-route test branch using complete branch, gate, and PR arguments", async () => {
    const ref = "ABC-002.003";
    const { tools, mocks } = buildTools({ current: `test/${ref}`, local: [`test/${ref}`, `spec/${ref}`] });
    const result = await invoke(tools, ["promote", "ship numbered spec", "full identity", "--json"]);
    expect(result.code).toBe(0);
    expect(mocks.gateRun).toHaveBeenCalledWith("test", { ref });
    expect(mocks.createRemoteBranch).toHaveBeenCalledWith(`build/${ref}`, "origin/main");
    expect(mocks.push).toHaveBeenCalledWith(`test/${ref}`);
    expect(mocks.createPR).toHaveBeenCalledWith(
      `build/${ref}`,
      `test/${ref}`,
      { title: `${ref}: ship numbered spec`, body: "full identity" },
    );
    expect(result.json.result.action).toBe("pr-raised");
  });

  it("promotes a ready quick-route branch directly to main without truncation", async () => {
    const ref = "AA-12.01";
    const { tools, mocks } = buildTools({ current: `task/${ref}`, local: [`task/${ref}`] });
    const result = await invoke(tools, ["promote", "quick ship", "keep .01", "--json"]);
    expect(result.code).toBe(0);
    expect(mocks.gateRun).toHaveBeenCalledWith("quick", { ref });
    expect(mocks.push).toHaveBeenCalledWith(`task/${ref}`);
    expect(mocks.createPR).toHaveBeenCalledWith(
      "main",
      `task/${ref}`,
      { title: `${ref}: quick ship`, body: "keep .01" },
    );
    expect(result.json.result.action).toBe("pr-raised");
  });
});
