import { useEffect, useRef } from "react";

// Colors are picked deterministically per class name so the same object
// keeps the same box color across frames instead of flickering colors.
const PALETTE = ["#22d3ee", "#a3e635", "#fbbf24", "#f472b6", "#818cf8", "#34d399", "#fb7185", "#60a5fa"];

function colorForClass(className) {
  let hash = 0;
  for (let i = 0; i < className.length; i++) hash = (hash * 31 + className.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

export default function DetectionOverlay({ detections, frameSize }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !frameSize.width || !frameSize.height) return;

    if (canvas.width !== frameSize.width || canvas.height !== frameSize.height) {
      canvas.width = frameSize.width;
      canvas.height = frameSize.height;
    }

    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const lineWidth = Math.max(2, Math.round(canvas.width / 240));
    const fontSize = Math.max(14, Math.round(canvas.width / 32));
    ctx.lineWidth = lineWidth;
    ctx.font = `600 ${fontSize}px Inter, system-ui, sans-serif`;
    ctx.textBaseline = "bottom";

    detections.forEach((det) => {
      const { x1, y1, x2, y2 } = det.bbox;
      const color = colorForClass(det.class);
      const label = `${det.class} ${det.confidence_percent}%`;

      ctx.strokeStyle = color;
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);

      const textWidth = ctx.measureText(label).width;
      const padding = 6;
      const labelHeight = fontSize + padding;
      const labelY = y1 > labelHeight ? y1 - labelHeight : y1;

      ctx.fillStyle = color;
      ctx.fillRect(x1 - lineWidth / 2, labelY, textWidth + padding * 2, labelHeight);

      ctx.fillStyle = "#0b0f14";
      ctx.fillText(label, x1 + padding - lineWidth / 2, labelY + labelHeight - padding / 2);
    });
  }, [detections, frameSize]);

  return <canvas ref={canvasRef} className="detection-overlay" />;
}
