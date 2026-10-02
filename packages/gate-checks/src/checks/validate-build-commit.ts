import { type GateCheckResult, type GateCheckFn } from "../types.js";
import { validateCommitMessage } from "./validate-commit-message.js";
import { isInterfaceFile } from "./helpers.js";

export const requiredArgs: string[] = [];

const allowedPaths = ["apps/", "packages/", "package.json", "pnpm-lock.yaml"];

function isAllowedPath(filePath: string): boolean {
  if (isInterfaceFile(filePath)) return false;
  return allowedPaths.some((p) => filePath === p || filePath.startsWith(p));
}

export const fn: GateCheckFn = async (inspectors, args): Promise<GateCheckResult> => {
  const commitRef = (args["build-commit-ref"] as string) ?? "HEAD";
  const violations: string[] = [];
  const messages: string[] = [];

  let commitMessage: string;
  try {
    const msgs = await inspectors.git.commitMessages(commitRef);
    commitMessage = msgs[0] ?? "";
  } catch {
    throw new Error(
      `Invalid argument: --build-commit-ref="${commitRef}" could not be resolved`,
    );
  }

  const msgResult = validateCommitMessage(commitMessage, args["ref"] as string | undefined);
  messages.push(...msgResult.messages);
  violations.push(...msgResult.violations);
  if (!msgResult.ref) {
    return {
      check: "validate-build-commit",
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
    messages.push("Changes within allowed paths (apps/, packages/ excl. *.interface.ts, package.json, pnpm-lock.yaml)");
  }

  const newFiles = await inspectors.git.added(commitRef);
  const modifiedFiles = await inspectors.git.modified(commitRef);
  const deletedFiles = await inspectors.git.deleted(commitRef);

  messages.push(`${newFiles.length} file(s) added, ${modifiedFiles.length} modified, ${deletedFiles.length} deleted`);

  return {
    check: "validate-build-commit",
    args,
    passed: violations.length === 0,
    messages,
    violations,
    summary: violations.length === 0 ? "Valid build commit" : violations.join("; "),
    values: { newFiles, modifiedFiles, deletedFiles, ref },
  };
};
