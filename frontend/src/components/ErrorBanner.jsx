const FRIENDLY_MESSAGES = {
  permission_denied: "Camera permission required. Please allow camera access and try again.",
  not_found: "No camera was found on this device.",
  unavailable: "Camera is unavailable right now.",
};

function resolveMessage(error) {
  if (!error) return "";
  if (error.type === "camera") return FRIENDLY_MESSAGES[error.code] || FRIENDLY_MESSAGES.unavailable;
  if (error.type === "backend") return "Backend unavailable. Check that the API server is running.";
  if (error.type === "model") return "Model failed to load on the server. Check the backend logs.";
  if (error.type === "inference") return "Detection failed on that frame. Retrying…";
  return error.message || "Something went wrong.";
}

export default function ErrorBanner({ error, onDismiss }) {
  if (!error) return null;

  return (
    <div className="error-banner" role="alert">
      <span>{resolveMessage(error)}</span>
      {onDismiss && (
        <button className="error-dismiss" onClick={onDismiss} aria-label="Dismiss">
          ✕
        </button>
      )}
    </div>
  );
}
