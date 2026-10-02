import { type GateCheckResult, type GateCheckFn } from "../types.js";
import { fn as branchRef } from "./branch-ref.js";
import { fn as validateCommitMessage } from "./validate-commit-message.js";

export const requiredArgs: string[] = [];

export const fn: GateCheckFn = async (inspectors, args): Promise<GateCheckResult> => {
  const destinationBranch = (args["destination-branch"] as string) || "origin/main";
  const explicitRef = args["ref"] as string | undefined;
  const messages: string[] = [];
  const violations: string[] = [];

  if (explicitRef) {
    messages.push(`Using explicit --ref: "${explicitRef}"`);
  }

  const branchResult = await branchRef(inspectors, args);
  if (!branchResult.passed) {
    return {
      check: "docs-gate",
      args,
      passed: false,
      messages,
      violations: branchResult.violations,
      summary: branchResult.summary,
      values: {},
    };
  }
  const ref = explicitRef ?? (branchResult.values.ref as string);
  messages.push(...branchResult.messages);
  messages.push("Branch validated via branch-ref");

  let mergeBase: string;
  let commits: string[];
  let destCommits: string[];
  try {
    mergeBase = await inspectors.git.mergeBase("HEAD", destinationBranch);
    commits = await inspectors.git.revList(mergeBase, "HEAD");
    destCommits = await inspectors.git.revList(mergeBase, destinationBranch);
  } catch {
    throw new Error(`Invalid argument: --destination-branch="${destinationBranch}" could not be resolved`);
  }
  messages.push(`Merge base with "${destinationBranch}": ${mergeBase}`);

  if (commits.length !== 1) {
    violations.push(`Expected exactly 1 commit between HEAD and ${destinationBranch}, found ${commits.length}`);
    return {
      check: "docs-gate",
      args,
      passed: false,
      messages,
      violations,
      summary: violations.join("; "),
      values: { mergeBase, commits },
    };
  }
  messages.push(`1 commit between HEAD and ${destinationBranch}`);

  if (destCommits.length > 0) {
    violations.push(`Destination branch "${destinationBranch}" has advanced past the merge base`);
    return {
      check: "docs-gate",
      args,
      passed: false,
      messages,
      violations,
      summary: violations.join("; "),
      values: { mergeBase, commits },
    };
  }
  messages.push(`Destination branch "${destinationBranch}" has not advanced`);

  const messageResult = await validateCommitMessage(inspectors, { "commit-ref": commits[0], ref });

  return {
    check: "docs-gate",
    args,
    passed: messageResult.passed,
    messages: [...messages, ...messageResult.messages],
    violations: messageResult.violations,
    summary: messageResult.passed ? "Docs gate passed" : messageResult.summary,
    values: { commit: commits[0], ...messageResult.values },
  };
};
