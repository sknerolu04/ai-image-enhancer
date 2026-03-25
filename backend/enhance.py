#!/usr/bin/env python3

import sys, os, argparse, json, time
import numpy as np
import cv2
import torch
import warnings
warnings.filterwarnings("ignore")

from pillow_heif import register_heif_opener
register_heif_opener()
from PIL import Image


def check_dependencies():
    available = {"realesrgan": False, "gfpgan": False}
    try:
        from gfpgan import GFPGANer
        available["gfpgan"] = True
    except ImportError:
        pass
    try:
        from basicsr.archs.rrdbnet_arch import RRDBNet
        from realesrgan import RealESRGANer
        available["realesrgan"] = True
    except ImportError:
        pass
    return available


def detect_faces(image_bgr):
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    cascade = cv2.CascadeClassifier(
        cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
    )
    faces = cascade.detectMultiScale(gray, 1.1, 5, minSize=(30,30))
    return len(faces) > 0


def detect_blur_score(image_bgr):
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    return cv2.Laplacian(gray, cv2.CV_64F).var()


# 🔥 UPDATED: Detail-preserving restoration
def restore_image(image):
    # 1. Light denoise
    denoised = cv2.fastNlMeansDenoisingColored(image, None, 5, 5, 7, 21)

    # 2. CLAHE contrast
    lab = cv2.cvtColor(denoised, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=1.8, tileGridSize=(8,8))
    l = clahe.apply(l)
    lab = cv2.merge((l, a, b))
    contrast = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)

    # 3. Detect face
    gray = cv2.cvtColor(contrast, cv2.COLOR_BGR2GRAY)
    face_cascade = cv2.CascadeClassifier(
        cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
    )
    faces = face_cascade.detectMultiScale(gray, 1.1, 5)

    # 4. Apply GFPGAN ONLY on face region
    result = contrast.copy()

    for (x, y, w, h) in faces:
        face = contrast[y:y+h, x:x+w]

        restored_face = face_restore(face)

        # soft blend to avoid edges
        result[y:y+h, x:x+w] = cv2.addWeighted(
            restored_face, 0.85,
            face, 0.15,
            0
        )

    # 5. Gentle sharpening (global)
    kernel = np.array([[0,-1,0],[-1,5,-1],[0,-1,0]])
    sharp = cv2.filter2D(result, -1, kernel)

    # 6. Smooth background slightly (keeps face sharp)
    background = cv2.GaussianBlur(sharp, (0,0), 1)

    final = cv2.addWeighted(sharp, 0.85, background, 0.15, 0)

    # 7. Blend original for realism
    final = cv2.addWeighted(final, 0.9, image, 0.1, 0)

    return final
def face_restore(image, model_path="models/GFPGANv1.4.pth"):
    try:
        from gfpgan import GFPGANer

        restorer = GFPGANer(
            model_path=model_path,
            upscale=1,
            arch='clean',
            channel_multiplier=2,
            bg_upsampler=None,
            device='mps' if torch.backends.mps.is_available() else 'cpu'
        )

        cropped_faces, restored_faces, restored_img = restorer.enhance(
            image,
            has_aligned=False,
            only_center_face=False,
            paste_back=True
        )

        return restored_img
    except Exception as e:
        print("GFPGAN error:", e)
        return image

def opencv_enhance(image_bgr, strength="medium"):
    params = {
        "low":    {"h": 3,  "sharp": 0.3, "scale": 2},
        "medium": {"h": 6,  "sharp": 0.6, "scale": 2},
        "high":   {"h": 10, "sharp": 1.0, "scale": 2},
    }
    p = params[strength]

    denoised = cv2.fastNlMeansDenoisingColored(
        image_bgr, None, p["h"], p["h"], 7, 21
    )

    blurred = cv2.GaussianBlur(denoised, (0,0), 3)
    sharpened = cv2.addWeighted(denoised, 1+p["sharp"], blurred, -p["sharp"], 0)

    h, w = sharpened.shape[:2]
    upscaled = cv2.resize(sharpened, (w*p["scale"], h*p["scale"]),
                          interpolation=cv2.INTER_LANCZOS4)

    return upscaled


def realesrgan_enhance(image_bgr, model_path, scale=2):
    from basicsr.archs.rrdbnet_arch import RRDBNet
    from realesrgan import RealESRGANer

    model = RRDBNet(num_in_ch=3, num_out_ch=3, num_feat=64,
                    num_block=23, num_grow_ch=32, scale=4)

    upsampler = RealESRGANer(
        scale=4,
        model_path=model_path,
        model=model,
        tile=128,
        tile_pad=10,
        pre_pad=0,
        half=False,
        device='mps' if torch.backends.mps.is_available() else 'cpu'
    )

    rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
    out, _ = upsampler.enhance(rgb, outscale=scale)

    enhanced = cv2.cvtColor(out, cv2.COLOR_RGB2BGR)

    # 🔥 LIGHT SHARPENING
    kernel = np.array([[0,-1,0],[-1,5,-1],[0,-1,0]])
    enhanced = cv2.filter2D(enhanced, -1, kernel)

    # 🔥 DETAIL ENHANCEMENT
    detail = cv2.detailEnhance(enhanced, sigma_s=10, sigma_r=0.15)
    enhanced = cv2.addWeighted(enhanced, 0.7, detail, 0.3, 0)

    return enhanced


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--input', required=True)
    parser.add_argument('--output', required=True)
    parser.add_argument('--strength', default='medium',
                        choices=['low','medium','high'])
    parser.add_argument('--scale', type=int, default=2)
    parser.add_argument('--realesrgan-model',
                        default='models/RealESRGAN_x4plus.pth')
    
    parser.add_argument('--mode', default='normal',
                        choices=['normal','restore'])

    parser.add_argument('--json-output', action='store_true')
    args = parser.parse_args()

    result = {
        "success": False,
        "method": "",
        "processing_time": 0
    }

    t0 = time.time()

    try:
        try:
            pil_img = Image.open(args.input).convert("RGB")
            image = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)
        except Exception:
            image = cv2.imread(args.input)

        if image is None:
            raise ValueError("Cannot read image")

        # 🔥 RESIZE FIX
        h, w = image.shape[:2]
        if max(h, w) > 3000:
            scale_factor = 3000 / max(h, w)
            image = cv2.resize(image, (int(w*scale_factor), int(h*scale_factor)))

        deps = check_dependencies()

        if args.mode == "restore":
            enhanced = restore_image(image)
            result["method"] = "restore"

        elif deps["realesrgan"] and os.path.exists(args.realesrgan_model):
            enhanced = realesrgan_enhance(
                image, args.realesrgan_model, args.scale)
            result["method"] = "realesrgan"
        else:
            enhanced = opencv_enhance(image, args.strength)
            result["method"] = "opencv_fallback"

        # 🔥 optimized export
        result_enc, encimg = cv2.imencode('.jpg', enhanced, [
            int(cv2.IMWRITE_JPEG_QUALITY), 88,
            int(cv2.IMWRITE_JPEG_PROGRESSIVE), 1,
            int(cv2.IMWRITE_JPEG_OPTIMIZE), 1
        ])

        with open(args.output, 'wb') as f:
            encimg.tofile(f)

        result["success"] = True

    except Exception as e:
        result["success"] = False
        result["error"] = str(e)

    result["processing_time"] = round(time.time() - t0, 2)

    if args.json_output:
        print(json.dumps(result))
    else:
        print(result)


if __name__ == "__main__":
    main()