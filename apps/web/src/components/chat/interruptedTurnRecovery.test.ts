import { describe, expect, it } from "vite-plus/test";

import {
  INTERRUPTED_TURN_CONTINUE_PROMPT,
  resolveInterruptedTurnContinuation,
} from "./interruptedTurnRecovery";

describe("resolveInterruptedTurnContinuation", () => {
  it("sends an explicit follow-up when the composer is empty", () => {
    expect(
      resolveInterruptedTurnContinuation({ draftPrompt: "", hasPendingAttachments: false }),
    ).toEqual({ kind: "send", prompt: INTERRUPTED_TURN_CONTINUE_PROMPT });
  });

  it("preserves and focuses an existing draft instead of sending it automatically", () => {
    expect(
      resolveInterruptedTurnContinuation({
        draftPrompt: "My unfinished instructions",
        hasPendingAttachments: false,
      }),
    ).toEqual({ kind: "focus" });
  });

  it("does not send pending attachments automatically", () => {
    expect(
      resolveInterruptedTurnContinuation({ draftPrompt: "", hasPendingAttachments: true }),
    ).toEqual({ kind: "focus" });
  });
});
