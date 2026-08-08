import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vite-plus/test";

import { shouldRenderThreadError, ThreadErrorBanner } from "./ThreadErrorBanner";

describe("ThreadErrorBanner", () => {
  it("keeps a dismissed persisted error hidden until the upstream error clears or changes", () => {
    expect(shouldRenderThreadError("Interrupted", null)).toBe(true);
    expect(shouldRenderThreadError("Interrupted", "Interrupted")).toBe(false);
    expect(shouldRenderThreadError("A different failure", "Interrupted")).toBe(true);
    expect(shouldRenderThreadError(null, "Interrupted")).toBe(false);
  });

  it("offers an explicit continue action for an interrupted turn", () => {
    const markup = renderToStaticMarkup(
      <ThreadErrorBanner
        error="The provider turn was interrupted."
        action={{ label: "Continue", onClick: vi.fn() }}
      />,
    );

    expect(markup).toContain("The provider turn was interrupted.");
    expect(markup).toContain(">Continue</button>");
    expect(markup).toContain('data-slot="thread-error-actions"');
    expect(markup).toContain("wrap-anywhere");
  });

  it("aligns the warning and dismiss icons with the first line of a multi-line error", () => {
    const markup = renderToStaticMarkup(
      <ThreadErrorBanner
        error={"The first error line\ncontinues on a second line"}
        onDismiss={() => {}}
      />,
    );

    expect(markup).toContain('role="alert"');
    expect(markup).toContain('aria-label="Dismiss error"');
    expect(markup).not.toContain("controlAlignment");
    expect(markup).toContain("flex gap-2 items-start");
    expect(markup).toContain("min-h-7 pt-1 sm:min-h-6 sm:pt-0.5");
    expect(markup).toContain("h-lh w-4");
    expect(markup).toContain("h-lh self-start");
  });
});
