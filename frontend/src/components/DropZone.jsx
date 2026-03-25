import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';

export default function DropZone({ onDrop }) {
  const onDropCb = useCallback(files => {
    if (files[0]) onDrop(files[0]);
  }, [onDrop]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: onDropCb,
    accept: { 'image/*': ['.jpg','.jpeg','.png','.webp','.bmp'] },
    maxFiles: 1
  });

  return (
    <div {...getRootProps()} className={`dropzone ${isDragActive ? 'active' : ''}`}>
      <input {...getInputProps()} />
      <div className="dropzone-icon">📁</div>
      <p className="dropzone-title">
        {isDragActive ? 'Drop your image here' : 'Drag & drop an image'}
      </p>
      <p className="dropzone-sub">or click to browse — JPG, PNG, WebP (max 10MB)</p>
    </div>
  );
}