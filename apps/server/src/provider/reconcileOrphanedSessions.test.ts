import {
  ProjectId,
  ProviderDriverKind,
  ProviderInstanceId,
  ThreadId,
  TurnId,
  type OrchestrationShellSnapshot,
} from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import { it } from "@effect/vitest";
import { describe, expect, vi } from "vite-plus/test";

import { OrchestrationEngineService } from "../orchestration/Services/OrchestrationEngine.ts";
import { ProjectionSnapshotQuery } from "../orchestration/Services/ProjectionSnapshotQuery.ts";
import { ProviderSessionDirectory } from "./Services/ProviderSessionDirectory.ts";
import {
  ORPHANED_TURN_MESSAGE,
  reconcileOrphanedProviderSessions,
} from "./reconcileOrphanedSessions.ts";

const unsupported = () => Effect.die(new Error("unsupported test operation")) as never;

function shellSnapshot(status: "running" | "ready"): OrchestrationShellSnapshot {
  const threadId = ThreadId.make(`thread-${status}`);
  const now = "2026-07-14T06:58:08.000Z";
  return {
    snapshotSequence: 1,
    updatedAt: now,
    projects: [],
    threads: [
      {
        id: threadId,
        projectId: ProjectId.make("project-1"),
        title: "Crash recovery",
        modelSelection: {
          instanceId: ProviderInstanceId.make("codex"),
          model: "gpt-5.3-codex",
        },
        interactionMode: "default",
        runtimeMode: "full-access",
        branch: null,
        worktreePath: null,
        createdAt: now,
        updatedAt: now,
        archivedAt: null,
        latestUserMessageAt: now,
        hasPendingApprovals: false,
        hasPendingUserInput: false,
        hasActionableProposedPlan: false,
        latestTurn: {
          turnId: TurnId.make(`turn-${status}`),
          state: status === "running" ? "running" : "completed",
          requestedAt: now,
          startedAt: now,
          completedAt: status === "running" ? null : now,
          assistantMessageId: null,
        },
        session: {
          threadId,
          status,
          providerName: "codex",
          providerInstanceId: ProviderInstanceId.make("codex"),
          runtimeMode: "full-access",
          activeTurnId: status === "running" ? TurnId.make(`turn-${status}`) : null,
          lastError: null,
          updatedAt: now,
        },
      },
    ],
  } as OrchestrationShellSnapshot;
}

describe("reconcileOrphanedProviderSessions", () => {
  it.effect("interrupts a projected running turn and stops its persisted runtime binding", () =>
    Effect.gen(function* () {
      const snapshot = shellSnapshot("running");
      const thread = snapshot.threads[0]!;
      const upsert = vi.fn(() => Effect.void);
      const dispatch = vi.fn(() => Effect.succeed({ sequence: 2 }));
      const directory = ProviderSessionDirectory.of({
        upsert,
        getBinding: () =>
          Effect.succeed(
            Option.some({
              threadId: thread.id,
              provider: ProviderDriverKind.make("codex"),
              providerInstanceId: ProviderInstanceId.make("codex"),
              status: "running",
            }),
          ),
        getProvider: unsupported,
        listThreadIds: unsupported,
        listBindings: unsupported,
      });
      const snapshotQuery = ProjectionSnapshotQuery.of({
        getShellSnapshot: () => Effect.succeed(snapshot),
      } as unknown as ProjectionSnapshotQuery["Service"]);
      const engine = OrchestrationEngineService.of({
        dispatch,
      } as unknown as OrchestrationEngineService["Service"]);

      const count = yield* reconcileOrphanedProviderSessions().pipe(
        Effect.provideService(ProviderSessionDirectory, directory),
        Effect.provideService(ProjectionSnapshotQuery, snapshotQuery),
        Effect.provideService(OrchestrationEngineService, engine),
      );

      expect(count).toBe(1);
      expect(upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          threadId: thread.id,
          status: "stopped",
          runtimePayload: expect.objectContaining({ activeTurnId: null }),
        }),
      );
      expect(dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "thread.session.set",
          threadId: thread.id,
          session: expect.objectContaining({
            status: "interrupted",
            activeTurnId: null,
            lastError: ORPHANED_TURN_MESSAGE,
          }),
        }),
      );
    }),
  );

  it.effect("leaves settled sessions unchanged", () =>
    Effect.gen(function* () {
      const dispatch = vi.fn(() => Effect.succeed({ sequence: 2 }));
      const directory = ProviderSessionDirectory.of({
        upsert: unsupported,
        getBinding: unsupported,
        getProvider: unsupported,
        listThreadIds: unsupported,
        listBindings: unsupported,
      });
      const snapshotQuery = ProjectionSnapshotQuery.of({
        getShellSnapshot: () => Effect.succeed(shellSnapshot("ready")),
      } as unknown as ProjectionSnapshotQuery["Service"]);
      const engine = OrchestrationEngineService.of({
        dispatch,
      } as unknown as OrchestrationEngineService["Service"]);

      const count = yield* reconcileOrphanedProviderSessions().pipe(
        Effect.provideService(ProviderSessionDirectory, directory),
        Effect.provideService(ProjectionSnapshotQuery, snapshotQuery),
        Effect.provideService(OrchestrationEngineService, engine),
      );

      expect(count).toBe(0);
      expect(dispatch).not.toHaveBeenCalled();
    }),
  );
});
