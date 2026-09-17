import DetectionOverlay from "./DetectionOverlay";
import { STATUS } from "../hooks/useObjectDetection";

export default function CameraView({ videoRef, status, detections, frameSize }) {
  const showPlaceholder = status === STATUS.IDLE || status === STATUS.STOPPED;

  return (
    <div className="camera-view">
      <video ref={videoRef} className="camera-video" playsInline muted autoPlay />
      {status === STATUS.RUNNING && <DetectionOverlay detections={detections} frameSize={frameSize} />}

      {showPlaceholder && (
        <div className="camera-placeholder">
          <div className="camera-placeholder-icon">📷</div>
          <p>Camera preview will appear here</p>
        </div>
      )}

      {status === STATUS.STARTING && (
        <div className="camera-placeholder">
          <div className="spinner" />
          <p>Starting camera…</p>
        </div>
      )}
    </div>
  );
}
