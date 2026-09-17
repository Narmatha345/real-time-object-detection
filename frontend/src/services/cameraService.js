// Thin wrapper around the browser camera API.

export class CameraError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code; // 'permission_denied' | 'not_found' | 'unavailable'
  }
}

function mapGetUserMediaError(err) {
  if (err.name === "NotAllowedError" || err.name === "SecurityError") {
    return new CameraError("Camera permission denied", "permission_denied");
  }
  if (err.name === "NotFoundError") {
    return new CameraError("No camera device was found", "not_found");
  }
  return new CameraError(err.message || "Camera is unavailable", "unavailable");
}

export async function startCameraStream(facingMode = "environment") {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new CameraError("Camera API is not supported in this browser", "unavailable");
  }

  const baseVideo = { width: { ideal: 1280 }, height: { ideal: 720 } };

  try {
    // "exact" actually forces the requested camera on phones - "ideal" is
    // only a soft preference, and browsers will often just keep whatever
    // camera is already active (usually the front one) instead of
    // switching, which is why the flip button can silently do nothing.
    return await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { ...baseVideo, facingMode: { exact: facingMode } },
    });
  } catch (err) {
    if (err.name !== "OverconstrainedError" && err.name !== "NotFoundError") {
      throw mapGetUserMediaError(err);
    }
    // No camera satisfies "exact" - e.g. a desktop webcam with no
    // front/back concept, or a phone with only one camera. Fall back to
    // a soft preference (or no facingMode at all) instead of failing.
    try {
      return await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { ...baseVideo, facingMode: { ideal: facingMode } },
      });
    } catch (err2) {
      throw mapGetUserMediaError(err2);
    }
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
