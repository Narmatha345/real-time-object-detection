import { STATUS } from "../hooks/useObjectDetection";

const STATUS_LABEL = {
  [STATUS.IDLE]: "Idle",
  [STATUS.STARTING]: "Starting…",
  [STATUS.RUNNING]: "Detecting",
  [STATUS.STOPPED]: "Stopped",
  [STATUS.ERROR]: "Error",
};

export default function StatusBar({ status, fps, objectCount }) {
  return (
    <div className="status-bar">
      <div className="status-item">
        <span className={`status-dot status-dot-${status}`} />
        AI Status: <strong>{STATUS_LABEL[status] ?? status}</strong>
      </div>
      <div className="status-item">
        Objects detected: <strong>{objectCount}</strong>
      </div>
      <div className="status-item">
        FPS: <strong>{fps}</strong>
      </div>
    </div>
  );
}
