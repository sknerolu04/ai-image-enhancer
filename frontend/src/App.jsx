import { useState, useCallback } from 'react';
import DropZone from './components/DropZone';
import BeforeAfterSlider from './components/BeforeAfterSlider';
import EnhancementControls from './components/EnhancementControls';
import BatchQueue from './components/BatchQueue';
import './index.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function App() {
  const [mode, setMode] = useState('single'); // 'single' | 'batch'
  const [processMode, setProcessMode] = useState('enhance'); // NEW: 'enhance' | 'restore'

  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [enhanced, setEnhanced] = useState(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [metadata, setMetadata] = useState(null);
  const [error, setError] = useState(null);
  const [strength, setStrength] = useState('medium');
  const [scale, setScale] = useState(4);

  const onDrop = useCallback((acceptedFile) => {
    setFile(acceptedFile);
    setPreview(URL.createObjectURL(acceptedFile));
    setEnhanced(null);
    setMetadata(null);
    setError(null);
  }, []);

  const handleEnhance = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setProgress(0);

    const timer = setInterval(() => {
      setProgress(p => Math.min(p + Math.random() * 8, 90));
    }, 600);

    const formData = new FormData();
    formData.append('image', file);
    formData.append('strength', strength);
    formData.append('scale', scale);

    // 🔥 ADD THIS
    formData.append('mode', processMode);

    try {
      const res = await fetch(`${API}/enhance`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Enhancement failed');
      }

      setProgress(100);
      setEnhanced(`${API}${data.outputUrl}`);
      setMetadata(data);
    } catch (err) {
      setError(err.message);
    } finally {
      clearInterval(timer);
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!enhanced) return;
    const res = await fetch(enhanced);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `enhanced_${Date.now()}.jpg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <div className="logo">
            <span className="logo-icon">✨</span>
            <span className="logo-text">AI Image Enhancer</span>
          </div>
          <div className="mode-toggle">
            <button
              className={`toggle-btn ${mode === 'single' ? 'active' : ''}`}
              onClick={() => setMode('single')}
            >Single</button>
            <button
              className={`toggle-btn ${mode === 'batch' ? 'active' : ''}`}
              onClick={() => setMode('batch')}
            >Batch</button>
          </div>
        </div>
      </header>

      <main className="main">
        {mode === 'batch' ? (
          <BatchQueue apiUrl={API} />
        ) : (
          <>
            {/* 🔥 NEW MODE SELECTOR */}
            <div className="controls">
              <label>
                <input
                  type="radio"
                  value="enhance"
                  checked={processMode === 'enhance'}
                  onChange={(e) => setProcessMode(e.target.value)}
                />
                Enhance
              </label>

              <label>
                <input
                  type="radio"
                  value="restore"
                  checked={processMode === 'restore'}
                  onChange={(e) => setProcessMode(e.target.value)}
                />
                Restore (Old Photos)
              </label>
            </div>

            <EnhancementControls
              strength={strength}
              setStrength={setStrength}
              scale={scale}
              setScale={setScale}
            />

            {!preview && (
              <DropZone onDrop={onDrop} />
            )}

            {preview && (
              <div className="workspace">
                {enhanced ? (
                  <BeforeAfterSlider
                    before={preview}
                    after={enhanced}
                  />
                ) : (
                  <div className="preview-single">
                    <img src={preview} alt="Original" className="preview-img" />
                  </div>
                )}

                {metadata && (
                  <div className="badges">
                    {metadata.blurWarning && (
                      <span className="badge badge-warn">
                        ⚠ Very blurry image (score: {metadata.blurScore})
                      </span>
                    )}
                    {metadata.faceDetected && (
                      <span className="badge badge-info">
                        👤 Face detected
                      </span>
                    )}
                    {metadata.gfpganApplied && (
                      <span className="badge badge-success">
                        ✨ GFPGAN applied
                      </span>
                    )}
                    <span className="badge badge-default">
                      🔧 {metadata.method} · {metadata.processingTime}s
                    </span>
                  </div>
                )}

                {loading && (
                  <div className="progress-wrap">
                    <div className="progress-bar"
                      style={{ width: `${progress}%` }} />
                    <span className="progress-label">
                      Enhancing... {Math.round(progress)}%
                    </span>
                  </div>
                )}

                {error && (
                  <div className="error-box">⚠ {error}</div>
                )}

                <div className="actions">
                  <button
                    className="btn btn-secondary"
                    onClick={() => {
                      setFile(null); setPreview(null);
                      setEnhanced(null); setMetadata(null);
                    }}
                  >↺ New Image</button>

                  {!enhanced && (
                    <button
                      className="btn btn-primary"
                      onClick={handleEnhance}
                      disabled={loading}
                    >
                      {loading
                        ? 'Processing...'
                        : processMode === 'restore'
                          ? '🛠 Restore Image'
                          : '✨ Enhance Image'}
                    </button>
                  )}

                  {enhanced && (
                    <button
                      className="btn btn-success"
                      onClick={handleDownload}
                    >⬇ Download Result</button>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}