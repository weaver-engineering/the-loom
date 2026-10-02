import { type GateCheckResult, type GateCheckFn } from "../types.js";
import { validateCommitMessage } from "./validate-commit-message.js";
import { isInterfaceFile } from "./helpers.js";

export const requiredArgs: string[] = [];

const allowedPaths = ["test/", "package.json", "pnpm-lock.yaml"];

function isAllowedPath(filePath: string): boolean {
  return allowedPaths.some((p) => filePath === p || filePath.startsWith(p)) || isInterfaceFile(filePath);
}

export const fn: GateCheckFn = async (inspectors, args): Promise<GateCheckResult> => {
  const commitRef = (args["test-commit-ref"] as string) ?? "HEAD";
  const violations: string[] = [];
  const messages: string[] = [];

  let commitMessage: string;
  try {
    const msgs = await inspectors.git.commitMessages(commitRef);
    commitMessage = msgs[0] ?? "";
  } catch {
    throw new Error(
      `Invalid argument: --test-commit-ref="${commitRef}" could not be resolved`,
    );
  }

  const msgResult = validateCommitMessage(commitMessage, args["ref"] as string | undefined);
  messages.push(...msgResult.messages);
  violations.push(...msgResult.violations);
  if (!msgResult.ref) {
    return {
      check: "validate-test-commit",
      args,
      passed: false,
      messages,
      violations,
      summary: violations.join("; "),
      values: {},
    };
  }
  const ref = msgResult.ref;

  const changedFiles = await inspectors.git.diffTree(commitRef);
  const outsideFiles = changedFiles.filter((f) => !isAllowedPath(f));

  if (outsideFiles.length > 0) {
    violations.push(`Changes outside allowed paths: ${outsideFiles.join(", ")}`);
  } else {
    messages.push("Changes within allowed paths (test/, packages/**/*.interface.ts, package.json, pnpm-lock.yaml)");
  }

  const newFiles = await inspectors.git.added(commitRef);
  const modifiedFiles = await inspectors.git.modified(commitRef);

  const newTests = newFiles.filter((f) => f.startsWith("test/"));
  const existingTests = modifiedFiles.filter((f) => f.startsWith("test/"));

  if (existingTests.length > 0) {
    violations.push(`Existing tests must not be changed: ${existingTests.join(", ")}`);
  } else {
    messages.push("No existing tests modified");
  }

  if (newTests.length === 0) {
    violations.push("At least one new test must be defined in test/");
  } else {
    messages.push(`${newTests.length} new test(s): ${newTests.join(", ")}`);
  }

  return {
    check: "validate-test-commit",
    args,
    passed: violations.length === 0,
    messages,
    violations,
    summary: violations.length === 0 ? "Valid test commit" : violations.join("; "),
    values: { existingTests, newTests, ref },
  };
};
