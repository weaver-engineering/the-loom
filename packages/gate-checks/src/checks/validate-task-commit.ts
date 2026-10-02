import { type GateCheckResult, type GateCheckFn } from "../types.js";
import { validateCommitMessage } from "./validate-commit-message.js";

export const requiredArgs: string[] = [];

export const fn: GateCheckFn = async (inspectors, args): Promise<GateCheckResult> => {
  const commitRef = (args["task-commit-ref"] as string) ?? "HEAD";
  const violations: string[] = [];
  const messages: string[] = [];

  let commitMessage: string;
  try {
    const msgs = await inspectors.git.commitMessages(commitRef);
    commitMessage = msgs[0] ?? "";
  } catch {
    throw new Error(
      `Invalid argument: --task-commit-ref="${commitRef}" could not be resolved`,
    );
  }

  const msgResult = validateCommitMessage(commitMessage, args["ref"] as string | undefined);
  messages.push(...msgResult.messages);
  violations.push(...msgResult.violations);
  if (!msgResult.ref) {
    return {
      check: "validate-task-commit",
      args,
      passed: false,
      messages,
      violations,
      summary: violations.join("; "),
      values: {},
    };
  }
  const ref = msgResult.ref;

  const modifiedFiles = await inspectors.git.modified(commitRef);
  const newFiles = await inspectors.git.added(commitRef);
  const deletedFiles = await inspectors.git.deleted(commitRef);

  messages.push(`${newFiles.length} file(s) added, ${modifiedFiles.length} modified, ${deletedFiles.length} deleted`);

  const testFiles = /^test\//;
  const newTests = newFiles.filter((f) => testFiles.test(f));
  const modifiedTests = modifiedFiles.filter((f) => testFiles.test(f));
  const deletedTests = deletedFiles.filter((f) => testFiles.test(f));

  messages.push(`${newTests.length} new test(s), ${modifiedTests.length} modified, ${deletedTests.length} deleted`);

  return {
    check: "validate-task-commit",
    args,
    passed: violations.length === 0,
    messages,
    violations,
    summary: violations.length === 0 ? "Valid task commit" : violations.join("; "),
    values: {
      newFiles,
      modifiedFiles,
      deletedFiles,
      newTests,
      modifiedTests,
      deletedTests,
      ref,
    },
  };
};
