import { useRef } from "react";
import DetectionOverlay from "./DetectionOverlay";
import { STATUS } from "../hooks/useObjectDetection";

const SWIPE_MIN_DISTANCE = 50; // px
const SWIPE_MAX_VERTICAL_DRIFT = 60; // px - keeps vertical scrolls from triggering a flip

export default function CameraView({ videoRef, status, detections, frameSize, onSwitchCamera, canSwitchCamera }) {
  const showPlaceholder = status === STATUS.IDLE || status === STATUS.STOPPED;
  const canFlip = canSwitchCamera && status === STATUS.RUNNING;
  const touchStart = useRef(null);

  const handleTouchStart = (e) => {
    if (!canFlip) return;
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  };

  const handleTouchEnd = (e) => {
    if (!canFlip || !touchStart.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.current.x;
    const dy = t.clientY - touchStart.current.y;
    touchStart.current = null;
    if (Math.abs(dx) >= SWIPE_MIN_DISTANCE && Math.abs(dy) <= SWIPE_MAX_VERTICAL_DRIFT) {
      onSwitchCamera?.();
    }
  };

  return (
    <div className="camera-view" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <video ref={videoRef} className="camera-video" playsInline muted autoPlay />
      {status === STATUS.RUNNING && <DetectionOverlay detections={detections} frameSize={frameSize} />}

      {canFlip && (
        <button className="flip-icon-btn" onClick={onSwitchCamera} aria-label="Switch camera" title="Swipe or tap to switch camera">
          ⟲
        </button>
      )}

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
