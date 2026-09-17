import { useCallback, useEffect, useRef, useState } from "react";
import { CameraError, hasMultipleCameras, startCameraStream, stopCameraStream } from "../services/cameraService";
import { DetectionSocket } from "../services/detectionSocket";
import { fetchHealth } from "../services/api";

const CAPTURE_MAX_DIMENSION = 640;
const JPEG_QUALITY = 0.75;
const FPS_SAMPLE_SIZE = 20;

export const STATUS = {
  IDLE: "idle",
  STARTING: "starting",
  RUNNING: "running",
  STOPPED: "stopped",
  ERROR: "error",
};

export function useObjectDetection(defaultConfidence = 0.5) {
  const [status, setStatus] = useState(STATUS.IDLE);
  const [error, setError] = useState(null);
  const [detections, setDetections] = useState([]);
  const [frameSize, setFrameSize] = useState({ width: 0, height: 0 });
  const [fps, setFps] = useState(0);
  const [confidenceThreshold, setConfidenceThreshold] = useState(defaultConfidence);
  const [facingMode, setFacingMode] = useState("environment");
  const [canSwitchCamera, setCanSwitchCamera] = useState(false);
  const [backendReady, setBackendReady] = useState(null); // null = unknown yet

  const videoRef = useRef(null);
  const captureCanvasRef = useRef(document.createElement("canvas"));
  const streamRef = useRef(null);
  const socketRef = useRef(null);
  const rafRef = useRef(null);
  const frameIdRef = useRef(0);
  const frameTimestampsRef = useRef([]);
  const confidenceRef = useRef(defaultConfidence);
  const runningRef = useRef(false);

  useEffect(() => {
    confidenceRef.current = confidenceThreshold;
  }, [confidenceThreshold]);

  // Ping the backend once on mount so we can show a friendly banner
  // ("Backend unavailable" / "Model loading error") before the user
  // even presses Start.
  useEffect(() => {
    let cancelled = false;
    fetchHealth()
      .then((health) => {
        if (cancelled) return;
        setBackendReady(health.model_loaded);
        if (!health.model_loaded) {
          setError({ type: "model", message: health.model_error || "Model failed to load on the server" });
        }
      })
      .catch(() => {
        if (!cancelled) setBackendReady(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const recordFrameTiming = useCallback(() => {
    const now = performance.now();
    const timestamps = frameTimestampsRef.current;
    timestamps.push(now);
    if (timestamps.length > FPS_SAMPLE_SIZE) timestamps.shift();
    if (timestamps.length >= 2) {
      const elapsedSec = (timestamps[timestamps.length - 1] - timestamps[0]) / 1000;
      setFps(elapsedSec > 0 ? Math.round(((timestamps.length - 1) / elapsedSec) * 10) / 10 : 0);
    }
  }, []);

  const captureLoop = useCallback(() => {
    if (!runningRef.current) return;

    const video = videoRef.current;
    const socket = socketRef.current;

    if (video && socket && video.videoWidth && socket.canSendFrame()) {
      const scale = Math.min(1, CAPTURE_MAX_DIMENSION / Math.max(video.videoWidth, video.videoHeight));
      const w = Math.round(video.videoWidth * scale);
      const h = Math.round(video.videoHeight * scale);

      const canvas = captureCanvasRef.current;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0, w, h);
      const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);

      frameIdRef.current += 1;
      socket.sendFrame(dataUrl, confidenceRef.current, frameIdRef.current);
    }

    rafRef.current = requestAnimationFrame(captureLoop);
  }, []);

  const stopCamera = useCallback(() => {
    runningRef.current = false;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;

    socketRef.current?.close();
    socketRef.current = null;

    if (streamRef.current) {
      stopCameraStream(streamRef.current);
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;

    setDetections([]);
    setFps(0);
    frameTimestampsRef.current = [];
    setStatus((prev) => (prev === STATUS.ERROR ? prev : STATUS.STOPPED));
  }, []);

  const startCamera = useCallback(
    async (requestedFacingMode = facingMode) => {
      setError(null);
      setStatus(STATUS.STARTING);

      let stream;
      try {
        stream = await startCameraStream(requestedFacingMode);
      } catch (err) {
        const camErr = err instanceof CameraError ? err : new CameraError(err.message, "unavailable");
        setError({ type: "camera", code: camErr.code, message: camErr.message });
        setStatus(STATUS.ERROR);
        return;
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }

      setCanSwitchCamera(await hasMultipleCameras());

      const socket = new DetectionSocket({
        onOpen: () => {
          runningRef.current = true;
          setStatus(STATUS.RUNNING);
          rafRef.current = requestAnimationFrame(captureLoop);
        },
        onResult: (data) => {
          setDetections(data.detections || []);
          setFrameSize({ width: data.frame_width, height: data.frame_height });
          recordFrameTiming();
        },
        onError: (message) => {
          setError({ type: "inference", message });
        },
        onClose: () => {
          if (runningRef.current) {
            // Socket dropped unexpectedly while the camera was running.
            setError({ type: "backend", message: "Lost connection to the detection server" });
            setStatus(STATUS.ERROR);
            runningRef.current = false;
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
          }
        },
      });
      socketRef.current = socket;
      socket.connect();
    },
    [captureLoop, facingMode, recordFrameTiming]
  );

  const switchCamera = useCallback(async () => {
    const nextFacingMode = facingMode === "environment" ? "user" : "environment";
    setFacingMode(nextFacingMode);
    if (status === STATUS.RUNNING) {
      stopCamera();
      await startCamera(nextFacingMode);
    }
  }, [facingMode, startCamera, status, stopCamera]);

  useEffect(() => () => stopCamera(), [stopCamera]);

  return {
    videoRef,
    status,
    error,
    detections,
    frameSize,
    fps,
    confidenceThreshold,
    setConfidenceThreshold,
    facingMode,
    canSwitchCamera,
    backendReady,
    startCamera,
    stopCamera,
    switchCamera,
    clearError: () => setError(null),
  };
}
