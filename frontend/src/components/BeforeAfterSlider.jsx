import { useState, useRef } from 'react';

export default function BeforeAfterSlider({ before, after }) {
  const [pos, setPos] = useState(50);
  const containerRef = useRef(null);
  const dragging = useRef(false);

  const updatePos = (clientX) => {
    const rect = containerRef.current.getBoundingClientRect();
    const pct  = Math.min(100, Math.max(0,
      ((clientX - rect.left) / rect.width) * 100));
    setPos(pct);
  };

  const onMouseMove  = e => dragging.current && updatePos(e.clientX);
  const onTouchMove  = e => updatePos(e.touches[0].clientX);

  return (
    <div
      ref={containerRef}
      className="slider-container"
      onMouseMove={onMouseMove}
      onMouseUp={() => dragging.current = false}
      onMouseLeave={() => dragging.current = false}
      onTouchMove={onTouchMove}
      onTouchEnd={() => dragging.current = false}
    >
      {/* After image (bottom layer, full width) */}
      <img src={after}  alt="Enhanced" className="slider-img" />

      {/* Before image (clipped) */}
      <div className="slider-clip" style={{ width: `${pos}%` }}>
        <img src={before} alt="Original" className="slider-img" />
      </div>

      {/* Divider handle */}
      <div
        className="slider-handle"
        style={{ left: `${pos}%` }}
        onMouseDown={() => dragging.current = true}
        onTouchStart={() => dragging.current = true}
      >
        <div className="slider-handle-icon">⇔</div>
      </div>

      <span className="slider-label slider-label-left">Before</span>
      <span className="slider-label slider-label-right">After</span>
    </div>
  );
}