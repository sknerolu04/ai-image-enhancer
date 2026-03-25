import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';

export default function BatchQueue({ apiUrl }) {
  const [files, setFiles]     = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [strength, setStrength] = useState('medium');

  const onDrop = useCallback(accepted => {
    setFiles(prev => [...prev, ...accepted]);
    setResults([]);
  }, []);

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    maxFiles: 10
  });

  const handleBatch = async () => {
    if (!files.length) return;
    setLoading(true);
    const formData = new FormData();
    files.forEach(f => formData.append('images', f));
    formData.append('strength', strength);

    try {
      const res  = await fetch(`${apiUrl}/enhance/batch`, {
        method: 'POST', body: formData
      });
      const data = await res.json();
      setResults(data.results || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="batch-container">
      <div {...getRootProps()} className="dropzone">
        <input {...getInputProps()} />
        <p className="dropzone-title">Drop up to 10 images for batch processing</p>
      </div>

      {files.length > 0 && (
        <>
          <div className="batch-list">
            {files.map((f, i) => (
              <div key={i} className="batch-item">
                <img
                  src={URL.createObjectURL(f)}
                  alt={f.name}
                  className="batch-thumb"
                />
                <span>{f.name}</span>

                {results[i] && (
                  <span className={`badge ${results[i].success ? 'badge-success' : 'badge-warn'}`}>
                    {results[i].success
                      ? `✓ ${results[i].processingTime}s`
                      : `✗ ${results[i].error}`}
                  </span>
                )}

                {results[i]?.outputUrl && (
                  <a
                    href={`${apiUrl}${results[i].outputUrl}`}
                    download
                    className="btn btn-success btn-sm"
                  >
                    ⬇
                  </a>
                )}
              </div>
            ))}
          </div>

          <div className="actions">
            <select
              value={strength}
              onChange={e => setStrength(e.target.value)}
              className="select"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>

            <button
              className="btn btn-primary"
              onClick={handleBatch}
              disabled={loading}
            >
              {loading ? 'Processing batch...' : `✨ Enhance All (${files.length})`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}