import { STATUS } from "../hooks/useObjectDetection";

export default function ControlPanel({
  status,
  onStart,
  onStop,
  onSwitchCamera,
  canSwitchCamera,
  confidenceThreshold,
  onConfidenceChange,
}) {
  const isRunning = status === STATUS.RUNNING || status === STATUS.STARTING;

  return (
    <div className="control-panel">
      <div className="control-buttons">
        {!isRunning ? (
          <button className="btn btn-primary" onClick={onStart}>
            Start Camera
          </button>
        ) : (
          <button className="btn btn-danger" onClick={onStop}>
            Stop Camera
          </button>
        )}

        {canSwitchCamera && (
          <button className="btn btn-secondary" onClick={onSwitchCamera} disabled={!isRunning} title="Switch camera">
            ⟲ Flip Camera
          </button>
        )}
      </div>

      <div className="confidence-control">
        <label htmlFor="confidence-slider">
          Confidence threshold: <span className="confidence-value">{Math.round(confidenceThreshold * 100)}%</span>
        </label>
        <input
          id="confidence-slider"
          type="range"
          min="5"
          max="95"
          step="5"
          value={Math.round(confidenceThreshold * 100)}
          onChange={(e) => onConfidenceChange(Number(e.target.value) / 100)}
        />
      </div>
    </div>
  );
}
