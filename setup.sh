#!/bin/bash
set -e
echo "🚀 Setting up AI Image Enhancer..."

# Backend
echo "📦 Installing backend dependencies..."
cd backend
npm install
pip install -r requirements.txt

# Optional Real-ESRGAN (comment out if no GPU memory available)
# pip install basicsr realesrgan facexlib gfpgan

# Create model directory
mkdir -p models

echo ""
echo "📥 Download model weights (optional but recommended):"
echo ""
echo "1. Real-ESRGAN (super-resolution):"
echo "   wget -P models/ https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth"
echo ""
echo "2. GFPGAN (face enhancement):"
echo "   wget -P models/ https://github.com/TencentARC/GFPGAN/releases/download/v1.3.4/GFPGANv1.4.pth"
echo ""

cd ../frontend
echo "📦 Installing frontend dependencies..."
npm install

echo ""
echo "✅ Setup complete!"
echo ""
echo "▶ Start backend:   cd backend && npm run dev"
echo "▶ Start frontend:  cd frontend && npm run dev"
echo "▶ Open browser:    http://localhost:5173"