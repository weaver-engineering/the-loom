import { type GateCheckResult, type GateCheckFn } from "../types.js";
import { validateCommitMessage } from "./validate-commit-message.js";

export const requiredArgs: string[] = [];

export const fn: GateCheckFn = async (inspectors, args): Promise<GateCheckResult> => {
  const commitRef = (args["spec-commit-ref"] as string) ?? "HEAD";
  const violations: string[] = [];
  const messages: string[] = [];

  let commitMessage: string;
  try {
    const msgs = await inspectors.git.commitMessages(commitRef);
    commitMessage = msgs[0] ?? "";
  } catch {
    throw new Error(
      `Invalid argument: --spec-commit-ref="${commitRef}" could not be resolved`,
    );
  }

  const msgResult = validateCommitMessage(commitMessage, args["ref"] as string | undefined);
  messages.push(...msgResult.messages);
  violations.push(...msgResult.violations);
  if (!msgResult.ref) {
    return {
      check: "validate-spec-commit",
      args,
      passed: false,
      messages,
      violations,
      summary: violations.join("; "),
      values: {},
    };
  }
  const ref = msgResult.ref;

  const taskDir = `docs/tasks/task-${ref}`;
  const taskFile = `${taskDir}/task-${ref}.md`;
  const specPattern = /^task-[A-Z]+-[0-9]+(-[0-9]+)?(-[a-z][a-z0-9-]*)?-spec\.md$/;

  let taskFiles: string[];
  try {
    taskFiles = await inspectors.git.lsTree(commitRef, taskDir);
  } catch {
    taskFiles = [];
  }

  if (taskFiles.length === 0) {
    violations.push(`Task directory "${taskDir}" does not exist`);
  } else {
    messages.push(`Task directory "${taskDir}" found with ${taskFiles.length} files`);
  }

  const taskFileExists = taskFiles.includes(taskFile);
  if (!taskFileExists) {
    violations.push(`Task file "${taskFile}" does not exist`);
  } else {
    messages.push(`Task file "${taskFile}" present`);
  }

  const specFiles = taskFiles.filter((f) => {
    const basename = f.replace(`${taskDir}/`, "");
    return specPattern.test(basename);
  });

  if (specFiles.length === 0) {
    violations.push("No specification files found");
  } else {
    messages.push(`${specFiles.length} specification file(s) found: ${specFiles.join(", ")}`);
  }

  const changedFiles = await inspectors.git.diffTree(commitRef);
  const changesOutside = changedFiles.filter((f) => !f.startsWith(taskDir));

  if (changesOutside.length > 0) {
    violations.push(`Changes outside task directory: ${changesOutside.join(", ")}`);
  } else {
    messages.push("No changes outside task directory");
  }

  return {
    check: "validate-spec-commit",
    args,
    passed: violations.length === 0,
    messages,
    violations,
    summary: violations.length === 0 ? "Valid spec commit" : violations.join("; "),
    values: { task: taskFile, specs: specFiles, ref },
  };
};
