export default function EnhancementControls({
  strength, setStrength, scale, setScale
}) {
  return (
    <div className="controls">
      <div className="control-group">
        <label>Enhancement Strength</label>
        <div className="btn-group">
          {['low','medium','high'].map(s => (
            <button
              key={s}
              className={`btn-option ${strength === s ? 'active' : ''}`}
              onClick={() => setStrength(s)}
            >
              {s === 'low'    ? '🔅 Low'    : ''}
              {s === 'medium' ? '⚡ Medium' : ''}
              {s === 'high'   ? '🔥 High'   : ''}
            </button>
          ))}
        </div>
      </div>

      <div className="control-group">
        <label>Upscale Factor</label>
        <div className="btn-group">
          {[2, 4].map(n => (
            <button
              key={n}
              className={`btn-option ${scale === n ? 'active' : ''}`}
              onClick={() => setScale(n)}
            >
              {n}× {n === 4 ? '(4K)' : '(HD)'}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}