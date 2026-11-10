import { memo } from "react";
// The .error-banner rules live with the list panel that first hosted the banner.
import "./ArcList.css";

interface Props {
  message: string;
  onDismiss: () => void;
}

// The mutation-error banner. Desktop renders it inside ArcList; on mobile App renders it
// under the header instead, since the list (and so ArcList's copy) is hidden while a
// quest is open -- exactly when a failed save or toggle needs to be seen.
export const ErrorBanner = memo(function ErrorBanner({ message, onDismiss }: Props) {
  return (
    <div className="error-banner">
      <span>{message}</span>
      <button
        type="button"
        className="error-banner-close"
        onClick={onDismiss}
        aria-label="Dismiss error"
      >
        ×
      </button>
    </div>
  );
});
