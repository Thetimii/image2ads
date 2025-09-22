import { useState } from 'react';
import { resizeImageFile, validateImageFile, formatFileSize } from '@/lib/client-resize';

/**
 * Example usage of client-side image resizing for upload component
 * This ensures all images are pre-processed before hitting the Edge function
 */

interface UploadExampleProps {
  onUpload: (imageData: ArrayBuffer, fileName: string) => Promise<void>;
  role: 'product' | 'background';
}

export function UploadExample({ onUpload, role }: UploadExampleProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = async (file: File) => {
    setIsProcessing(true);
    setError(null);

    try {
      // 1. Validate file first
      const validation = validateImageFile(file);
      if (!validation.valid) {
        setError(validation.error || 'Invalid file');
        return;
      }

      console.log(`Processing ${role} image:`, {
        name: file.name,
        originalSize: formatFileSize(file.size),
        type: file.type
      });

      // 2. Resize on client-side (this is the key part!)
      const resized = await resizeImageFile(file, {
        maxSide: 1024,        // Smaller for Edge safety
        quality: 0.8,         // Lower quality for smaller files  
        format: 'jpeg',       // JPEG is smaller than PNG for most images
        maxOutputSize: 2_500_000  // 2.5MB max (under 3MB Edge limit)
      });

      console.log('Resize complete:', {
        originalSize: formatFileSize(resized.originalSize),
        resizedSize: formatFileSize(resized.resizedSize),
        dimensions: `${resized.width}×${resized.height}`,
        compression: `${Math.round((1 - resized.resizedSize / resized.originalSize) * 100)}% smaller`
      });

      // 3. Upload the pre-processed image
      await onUpload(resized.arrayBuffer, file.name);

    } catch (err) {
      console.error('Upload processing error:', err);
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Drop zone */}
      <div
        className={`
          border-2 border-dashed rounded-lg p-8 text-center transition-all
          ${dragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-300'}
          ${isProcessing ? 'opacity-50 pointer-events-none' : 'hover:border-gray-400'}
        `}
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
      >
        {isProcessing ? (
          <div className="space-y-2">
            <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
            <p className="text-sm text-gray-600">Processing {role} image...</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-4xl text-gray-400">📁</div>
            <div>
              <p className="text-lg font-medium">Drop your {role} image here</p>
              <p className="text-sm text-gray-500">or click to browse</p>
            </div>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileInput}
              className="hidden"
              id={`file-input-${role}`}
            />
            <label
              htmlFor={`file-input-${role}`}
              className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700 transition-colors"
            >
              Choose File
            </label>
          </div>
        )}
      </div>

      {/* Error display */}
      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
          <button
            onClick={() => setError(null)}
            className="text-xs text-red-500 hover:text-red-700 mt-1"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Upload tips */}
      <div className="mt-4 text-xs text-gray-500 space-y-1">
        <p>• Images will be automatically resized to 1024px max</p>
        <p>• Supports JPEG, PNG, WebP, GIF formats</p>
        <p>• Maximum file size: 20MB (before processing)</p>
        <p>• Output will be under 2.5MB for Edge function compatibility</p>
        <p>• {role === 'product' ? 'Transparent PNGs work best for products' : 'JPEG format used for smaller files'}</p>
      </div>
    </div>
  );
}

/**
 * Updated upload function that expects pre-processed images
 */
export async function uploadProcessedImage(
  imageBuffer: ArrayBuffer,
  fileName: string,
  userId: string,
  folderId: string,
  role: 'product' | 'background'
) {
  // Convert ArrayBuffer to base64 for JSON transport
  const uint8Array = new Uint8Array(imageBuffer);
  const imageData = Array.from(uint8Array);

  const response = await fetch('/api/upload-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      imageData,
      originalName: fileName,
      userId,
      folderId,
      role,
      maxSide: 1280  // Already processed, but keep as guardrail
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Upload failed');
  }

  return response.json();
}

/**
 * React hook for the complete upload flow with client-side processing
 */
export function useImageUploadFlow() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    stage: 'processing' | 'uploading' | 'complete';
    message: string;
  } | null>(null);

  const uploadImage = async (
    file: File,
    userId: string,
    folderId: string,
    role: 'product' | 'background'
  ) => {
    setIsUploading(true);
    setUploadProgress({ stage: 'processing', message: 'Preparing image...' });

    try {
      // Client-side resize
      const resized = await resizeImageFile(file, {
        maxSide: 1024,
        quality: 0.8,
        format: 'jpeg',
        maxOutputSize: 2_500_000
      });

      setUploadProgress({ stage: 'uploading', message: 'Uploading to server...' });

      // Upload processed image
      const result = await uploadProcessedImage(
        resized.arrayBuffer,
        file.name,
        userId,
        folderId,
        role
      );

      setUploadProgress({ stage: 'complete', message: 'Upload complete!' });
      
      // Clear progress after success
      setTimeout(() => setUploadProgress(null), 2000);

      return result;

    } catch (error) {
      setUploadProgress(null);
      throw error;
    } finally {
      setIsUploading(false);
    }
  };

  return {
    uploadImage,
    isUploading,
    uploadProgress
  };
}