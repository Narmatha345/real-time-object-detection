import CameraView from "../components/CameraView";
import ControlPanel from "../components/ControlPanel";
import StatusBar from "../components/StatusBar";
import DetectionList from "../components/DetectionList";
import ErrorBanner from "../components/ErrorBanner";
import { useObjectDetection, STATUS } from "../hooks/useObjectDetection";

export default function DetectionPage() {
  const {
    videoRef,
    status,
    error,
    detections,
    frameSize,
    fps,
    confidenceThreshold,
    setConfidenceThreshold,
    canSwitchCamera,
    backendReady,
    startCamera,
    stopCamera,
    switchCamera,
    clearError,
  } = useObjectDetection(0.65);

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>AI Object Detection</h1>
        <p className="app-subtitle">Real-time YOLO detection running on your camera</p>
      </header>

      <ErrorBanner error={error} onDismiss={clearError} />

      {backendReady === false && !error && (
        <ErrorBanner error={{ type: "backend", message: "Backend unavailable" }} />
      )}

      <CameraView
        videoRef={videoRef}
        status={status}
        detections={detections}
        frameSize={frameSize}
        onSwitchCamera={switchCamera}
        canSwitchCamera={canSwitchCamera}
      />

      <DetectionList detections={detections} status={status} />

      <StatusBar status={status} fps={fps} objectCount={status === STATUS.RUNNING ? detections.length : 0} />

      <ControlPanel
        status={status}
        onStart={startCamera}
        onStop={stopCamera}
        onSwitchCamera={switchCamera}
        canSwitchCamera={canSwitchCamera}
        confidenceThreshold={confidenceThreshold}
        onConfidenceChange={setConfidenceThreshold}
      />
    </div>
  );
}
