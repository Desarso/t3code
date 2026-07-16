import { ProviderDriverKind, ProviderInstanceId, type ServerProvider } from "@t3tools/contracts";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vite-plus/test";

import { isTransientProviderCapacityMessage, ProviderStatusBanner } from "./ProviderStatusBanner";

const capacityStatus = {
  instanceId: ProviderInstanceId.make("codex"),
  driver: ProviderDriverKind.make("codex"),
  enabled: true,
  installed: true,
  version: "0.144.3",
  status: "error",
  auth: { status: "authenticated" },
  checkedAt: "2026-07-14T19:49:15.664Z",
  message: "Selected model is at capacity. Please try a different model.",
  models: [],
  slashCommands: [],
  skills: [],
} as ServerProvider;

describe("ProviderStatusBanner", () => {
  it("classifies model-capacity failures as transient", () => {
    expect(isTransientProviderCapacityMessage(capacityStatus.message)).toBe(true);
    expect(isTransientProviderCapacityMessage("Authentication failed.")).toBe(false);
  });

  it("renders a dismiss action for a provider error", () => {
    const markup = renderToStaticMarkup(
      <ProviderStatusBanner status={capacityStatus} onDismiss={vi.fn()} />,
    );

    expect(markup).toContain("Selected model is at capacity");
    expect(markup).toContain('aria-label="Dismiss provider status"');
  });
});
