// Thin wrapper around the /ws/detect WebSocket.
//
// The stream is request/response: we only ever send the next frame after
// the previous result (or an error) has come back. That single rule is
// what keeps the pipeline real-time instead of laggy - frames never pile
// up faster than the backend can actually process them.
import { getWebSocketUrl } from "./api";

export class DetectionSocket {
  constructor({ onResult, onError, onClose, onOpen }) {
    this.onResult = onResult;
    this.onError = onError;
    this.onClose = onClose;
    this.onOpen = onOpen;
    this.ws = null;
    this.ready = false;
    this.awaitingResponse = false;
  }

  connect() {
    this.ws = new WebSocket(getWebSocketUrl());

    this.ws.onopen = () => {
      this.ready = true;
      this.onOpen?.();
    };

    this.ws.onmessage = (event) => {
      this.awaitingResponse = false;
      try {
        const data = JSON.parse(event.data);
        if (data.error) {
          this.onError?.(data.error);
        } else {
          this.onResult?.(data);
        }
      } catch (err) {
        this.onError?.("Received malformed response from server");
      }
    };

    this.ws.onerror = () => {
      this.onError?.("Connection to detection server failed");
    };

    this.ws.onclose = () => {
      this.ready = false;
      this.onClose?.();
    };
  }

  canSendFrame() {
    return this.ready && !this.awaitingResponse;
  }

  sendFrame(imageDataUrl, confidenceThreshold, frameId) {
    if (!this.canSendFrame()) return false;
    this.awaitingResponse = true;
    this.ws.send(
      JSON.stringify({
        image: imageDataUrl,
        confidence_threshold: confidenceThreshold,
        frame_id: frameId,
      })
    );
    return true;
  }

  close() {
    this.ready = false;
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
  }
}
