const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 5001;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json());
app.use('/outputs', express.static(path.join(__dirname, 'outputs')));

// ── Directory Setup ───────────────────────────────────────────────────────────
['uploads', 'outputs'].forEach(dir => {
  const p = path.join(__dirname, dir);
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
});

// ── Multer Config ─────────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename:    (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg','.jpeg','.png','.webp','.bmp','.tiff','.heic'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error(`Unsupported file type: ${ext}`));
  }
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function runPython(args) {
  return new Promise((resolve, reject) => {
    const python = process.env.PYTHON_BIN || 'python3';
    const proc   = spawn(python, args, {
      cwd: __dirname,
      timeout: 300_000
    });

    let stdout = '', stderr = '';
    proc.stdout.on('data', d => stdout += d.toString());
    proc.stderr.on('data', d => stderr += d.toString());

    proc.on('close', code => {
      if (code === 0) {
        try {
          resolve(JSON.parse(stdout.trim()));
        } catch {
          resolve({ success: true, message: stdout.trim() });
        }
      } else {
        reject(new Error(stderr || `Python exited with code ${code}`));
      }
    });

    proc.on('error', reject);
  });
}

function cleanup(...files) {
  files.forEach(f => {
    if (f && fs.existsSync(f)) {
      fs.unlink(f, () => {});
    }
  });
}

// ── POST /enhance ─────────────────────────────────────────────────────────────
app.post('/enhance', upload.single('image'), async (req, res) => {
  const inputPath = req.file?.path;
  const outputName = `enhanced_${uuidv4()}.jpg`;
  const outputPath = path.join(__dirname, 'outputs', outputName);

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const strength = ['low','medium','high'].includes(req.body.strength)
      ? req.body.strength : 'medium';
    const scale = parseInt(req.body.scale) || 4;

    // 🔥 NEW: read mode
    const mode = req.body.mode === 'restore' ? 'restore' : 'normal';

    const args = [
      'enhance.py',
      '--input',  inputPath,
      '--output', outputPath,
      '--strength', strength,
      '--scale',  String(scale),
      '--mode',   mode,          // 🔥 ADDED
      '--json-output'
    ];

    const result = await runPython(args);

    if (!result.success) {
      cleanup(inputPath, outputPath);
      return res.status(500).json({ error: result.message });
    }

    res.json({
      success: true,
      outputUrl: `/outputs/${outputName}`,
      blurScore: result.blur_score,
      blurWarning: result.blur_warning,
      faceDetected: result.face_detected,
      gfpganApplied: result.gfpgan_applied,
      method: result.method,
      processingTime: result.processing_time
    });

    cleanup(inputPath);
    setTimeout(() => cleanup(outputPath), 10 * 60 * 1000);

  } catch (err) {
    cleanup(inputPath, outputPath);
    console.error('[enhance] Error:', err.message);
    res.status(500).json({ error: err.message || 'Processing failed' });
  }
});

// ── POST /enhance/batch ───────────────────────────────────────────────────────
app.post('/enhance/batch', upload.array('images', 10), async (req, res) => {
  if (!req.files?.length) {
    return res.status(400).json({ error: 'No images provided' });
  }

  const strength = req.body.strength || 'medium';
  const results  = [];

  for (const file of req.files) {
    const outputName = `enhanced_${uuidv4()}.jpg`;
    const outputPath = path.join(__dirname, 'outputs', outputName);
    try {
      const result = await runPython([
        'enhance.py',
        '--input',    file.path,
        '--output',   outputPath,
        '--strength', strength,
        '--json-output'
      ]);
      results.push({
        originalName: file.originalname,
        success: result.success,
        outputUrl: result.success ? `/outputs/${outputName}` : null,
        blurScore: result.blur_score,
        processingTime: result.processing_time,
        error: result.success ? null : result.message
      });
      if (result.success) {
        setTimeout(() => cleanup(outputPath), 10 * 60 * 1000);
      } else {
        cleanup(outputPath);
      }
    } catch (err) {
      results.push({
        originalName: file.originalname,
        success: false,
        error: err.message
      });
      cleanup(outputPath);
    } finally {
      cleanup(file.path);
    }
  }

  res.json({ success: true, results });
});

// ── Health Check ──────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Error Handler ─────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File too large. Maximum 10MB.' });
  }
  res.status(400).json({ error: err.message });
});

app.listen(PORT, () => {
  console.log(`🚀 Image Enhancer API running on http://localhost:${PORT}`);
});