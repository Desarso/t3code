export const INTERRUPTED_TURN_CONTINUE_PROMPT =
  "Continue from where you left off. Review the existing work first and do not repeat completed actions.";

export function resolveInterruptedTurnContinuation(input: {
  readonly draftPrompt: string;
  readonly hasPendingAttachments: boolean;
}): { readonly kind: "focus" } | { readonly kind: "send"; readonly prompt: string } {
  if (input.draftPrompt.trim().length > 0 || input.hasPendingAttachments) {
    return { kind: "focus" };
  }
  return { kind: "send", prompt: INTERRUPTED_TURN_CONTINUE_PROMPT };
}
