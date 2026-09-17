export default function DetectionList({ detections, status }) {
  if (status !== "running") return null;

  if (detections.length === 0) {
    return (
      <div className="detection-list detection-list-empty">
        <p>No supported objects detected</p>
      </div>
    );
  }

  return (
    <ul className="detection-list">
      {detections.map((det, idx) => (
        <li key={`${det.class}-${idx}`} className="detection-chip">
          <span className="detection-chip-name">{det.class}</span>
          <span className="detection-chip-confidence">{det.confidence_percent}%</span>
        </li>
      ))}
    </ul>
  );
}
