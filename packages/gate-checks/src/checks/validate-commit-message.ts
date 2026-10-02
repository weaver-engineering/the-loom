import { type GateCheckResult, type GateCheckFn } from "../types.js";
import { parseCommitMessage, isValidRef, commitTitleStartsWithRef, commitTitleContinuesBeyondRef } from "./helpers.js";

export const requiredArgs: string[] = [];

export interface CommitMessageValidation {
  messages: string[];
  violations: string[];
  /** The ref parsed from the title; null if the ref itself was missing/invalid/mismatched. */
  ref: string | null;
}

/**
 * The ref/title/body rules every single-commit check shares: the title starts
 * with a valid ref (or exactly `explicitRef`, if given), continues beyond it,
 * and the body is non-empty. A missing/wrong ref short-circuits (`ref: null`);
 * title and body problems accumulate.
 */
export function validateCommitMessage(message: string, explicitRef?: string): CommitMessageValidation {
  const messages: string[] = [];
  const violations: string[] = [];
  const parsed = parseCommitMessage(message);

  if (explicitRef) {
    if (parsed.ref !== explicitRef) {
      violations.push(`Commit message title must start with ref "${explicitRef}"`);
      return { messages, violations, ref: null };
    }
  } else if (!parsed.ref || !isValidRef(parsed.ref)) {
    violations.push("Commit message title must start with a valid ref matching [A-Z]+-[0-9]+");
    return { messages, violations, ref: null };
  }

  const ref = parsed.ref!;
  messages.push(`Ref "${ref}" found in commit message`);

  if (!commitTitleStartsWithRef(parsed.title, ref)) {
    violations.push(`Commit message title must start with "${ref}"`);
  } else if (!commitTitleContinuesBeyondRef(parsed.title, ref)) {
    violations.push("Commit message title must continue beyond the ref");
  } else {
    messages.push(`Commit message title valid: "${parsed.title}"`);
  }

  if (!parsed.body) {
    violations.push("Commit message body must not be empty");
  } else {
    messages.push("Commit message body present");
  }

  return { messages, violations, ref };
}

export const fn: GateCheckFn = async (inspectors, args): Promise<GateCheckResult> => {
  const commitRef = (args["commit-ref"] as string) ?? "HEAD";

  let commitMessage: string;
  try {
    const msgs = await inspectors.git.commitMessages(commitRef);
    commitMessage = msgs[0] ?? "";
  } catch {
    throw new Error(`Invalid argument: --commit-ref="${commitRef}" could not be resolved`);
  }

  const result = validateCommitMessage(commitMessage, args["ref"] as string | undefined);
  const passed = result.violations.length === 0;
  return {
    check: "validate-commit-message",
    args,
    passed,
    messages: result.messages,
    violations: result.violations,
    summary: passed ? "Valid commit message" : result.violations.join("; "),
    values: result.ref ? { ref: result.ref } : {},
  };
};
