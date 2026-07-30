import { memo, useEffect, useState } from "react";
import { Alert, AlertAction, AlertDescription } from "../ui/alert";
import { Button } from "../ui/button";
import { CircleAlertIcon, XIcon } from "lucide-react";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";

export function shouldRenderThreadError(error: string | null, dismissedError: string | null) {
  return error !== null && error !== dismissedError;
}

export const ThreadErrorBanner = memo(function ThreadErrorBanner({
  error,
  action,
  onDismiss,
}: {
  error: string | null;
  action?: {
    readonly label: string;
    readonly onClick: () => void;
  };
  onDismiss?: () => void;
}) {
  const [dismissedError, setDismissedError] = useState<string | null>(null);

  useEffect(() => {
    if (error === null) {
      setDismissedError(null);
    }
  }, [error]);

  if (!shouldRenderThreadError(error, dismissedError)) return null;

  const dismiss = () => {
    setDismissedError(error);
    onDismiss?.();
  };

  const runAction = () => {
    setDismissedError(error);
    action?.onClick();
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-3 pt-3">
      <Alert variant="error">
        <CircleAlertIcon />
        <AlertDescription className="min-w-0">
          <Tooltip>
            <TooltipTrigger
              render={
                <span className="line-clamp-3 min-w-0 leading-5 wrap-anywhere" tabIndex={0} />
              }
            >
              {error}
            </TooltipTrigger>
            <TooltipPopup side="top" className="max-w-96 whitespace-pre-wrap wrap-anywhere">
              {error}
            </TooltipPopup>
          </Tooltip>
        </AlertDescription>
        {action || onDismiss ? (
          <AlertAction>
            <div
              data-slot="thread-error-actions"
              className="flex min-w-0 flex-wrap items-center justify-end gap-1"
            >
              {action ? (
                <Button variant="outline" size="xs" onClick={runAction}>
                  {action.label}
                </Button>
              ) : null}
              {onDismiss ? (
                <Button variant="ghost" size="icon-xs" aria-label="Dismiss error" onClick={dismiss}>
                  <XIcon className="text-destructive" />
                </Button>
              ) : null}
            </div>
          </AlertAction>
        ) : null}
      </Alert>
    </div>
  );
});
