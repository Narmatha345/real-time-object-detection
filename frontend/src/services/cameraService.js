// Thin wrapper around the browser camera API.

export class CameraError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code; // 'permission_denied' | 'not_found' | 'unavailable'
  }
}

export async function startCameraStream(facingMode = "environment") {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new CameraError("Camera API is not supported in this browser", "unavailable");
  }

  const constraints = {
    audio: false,
    video: {
      facingMode: { ideal: facingMode },
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
  };

  try {
    return await navigator.mediaDevices.getUserMedia(constraints);
  } catch (err) {
    if (err.name === "NotAllowedError" || err.name === "SecurityError") {
      throw new CameraError("Camera permission denied", "permission_denied");
    }
    if (err.name === "NotFoundError" || err.name === "OverconstrainedError") {
      throw new CameraError("No camera device was found", "not_found");
    }
    throw new CameraError(err.message || "Camera is unavailable", "unavailable");
  }
}

export function stopCameraStream(stream) {
  stream?.getTracks().forEach((track) => track.stop());
}

export async function hasMultipleCameras() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((d) => d.kind === "videoinput").length > 1;
  } catch {
    // Some browsers only report device labels/count after the first
    // permission grant - assume multiple cameras may exist (mobile is
    // the common case) rather than hiding the switch button outright.
    return /Mobi|Android/i.test(navigator.userAgent);
  }
}
