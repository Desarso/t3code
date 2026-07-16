import { CommandId } from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

import { OrchestrationEngineService } from "../orchestration/Services/OrchestrationEngine.ts";
import { ProjectionSnapshotQuery } from "../orchestration/Services/ProjectionSnapshotQuery.ts";
import { ProviderSessionDirectory } from "./Services/ProviderSessionDirectory.ts";

export const ORPHANED_TURN_MESSAGE =
  "T3 restarted while this provider turn was active. The turn was interrupted; completed file changes were preserved. Send a follow-up to continue.";

export const reconcileOrphanedProviderSessions = Effect.fn("reconcileOrphanedProviderSessions")(
  function* () {
    const directory = yield* ProviderSessionDirectory;
    const snapshotQuery = yield* ProjectionSnapshotQuery;
    const orchestrationEngine = yield* OrchestrationEngineService;
    const snapshot = yield* snapshotQuery.getShellSnapshot();
    const orphanedThreads = snapshot.threads.filter(
      (thread) => thread.session?.status === "running" || thread.session?.status === "starting",
    );

    let reconciledCount = 0;
    for (const thread of orphanedThreads) {
      const session = thread.session;
      if (!session) continue;

      const binding = yield* directory.getBinding(thread.id);
      if (Option.isSome(binding) && binding.value.providerInstanceId !== undefined) {
        yield* directory.upsert({
          threadId: thread.id,
          provider: binding.value.provider,
          providerInstanceId: binding.value.providerInstanceId,
          status: "stopped",
          runtimePayload: {
            activeTurnId: null,
            lastRuntimeEvent: "provider.backend-restart-reconciled",
          },
        });
      }

      const reconciledAt = DateTime.formatIso(yield* DateTime.now);
      yield* orchestrationEngine.dispatch({
        type: "thread.session.set",
        commandId: CommandId.make(`provider:backend-restart:${thread.id}:${session.updatedAt}`),
        threadId: thread.id,
        session: {
          ...session,
          status: "interrupted",
          activeTurnId: null,
          lastError: ORPHANED_TURN_MESSAGE,
          updatedAt: reconciledAt,
        },
        createdAt: reconciledAt,
      });
      reconciledCount += 1;
    }

    if (reconciledCount > 0) {
      yield* Effect.logWarning("reconciled orphaned provider sessions after backend restart", {
        reconciledCount,
      });
    }
    return reconciledCount;
  },
);
