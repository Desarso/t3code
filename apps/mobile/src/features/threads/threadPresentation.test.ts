import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/shell";
import { describe, expect, it } from "@effect/vitest";

import { resolveThreadStatus } from "./threadPresentation";

function runningThread(activeTurnId: string | null): EnvironmentThreadShell {
  return {
    hasPendingApprovals: false,
    hasPendingUserInput: false,
    hasActionableProposedPlan: false,
    interactionMode: "default",
    latestTurn: null,
    session: {
      status: "running",
      activeTurnId,
    },
  } as unknown as EnvironmentThreadShell;
}

describe("resolveThreadStatus", () => {
  it("does not show Working for a stale running session without an active turn", () => {
    expect(resolveThreadStatus(runningThread(null))).toBeNull();
  });

  it("shows Working while the provider reports an active turn", () => {
    expect(resolveThreadStatus(runningThread("turn-1"))?.kind).toBe("working");
  });
});
