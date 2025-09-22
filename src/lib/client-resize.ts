/**
 * Client-side image resizing utility to keep uploads under Edge Function memory limits
 * Resizes images to specified max dimensions before upload
 */
import { useState } from 'react';

export interface ResizeOptions {
  maxSide?: number;
  quality?: number;
  format?: 'png' | 'jpeg';
  maxOutputSize?: number; // Maximum output file size in bytes
}

export interface ResizedImageResult {
  arrayBuffer: ArrayBuffer;
  width: number;
  height: number;
  originalSize: number;
  resizedSize: number;
  format: string;
}

/**
 * Resize an image file client-side using Canvas API
 * @param file - The image file to resize
 * @param options - Resize configuration
 * @returns Promise with resized image data
 */
export async function resizeImageFile(
  file: File, 
  options: ResizeOptions = {}
): Promise<ResizedImageResult> {
  const { 
    maxSide = 1024,        // Much smaller default for Edge safety
    quality = 0.8,         // Lower quality for smaller files
    format = 'jpeg',       // JPEG is smaller than PNG for photos
    maxOutputSize = 2_500_000  // 2.5MB max output (well under 3MB Edge limit)
  } = options;

  // Check original file size
  const originalSize = file.size;
  
  // Create image element
  const img = new Image();
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    throw new Error('Canvas context not available');
  }

  // Load image
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });

  // Calculate new dimensions
  const { width: originalWidth, height: originalHeight } = img;
  const longSide = Math.max(originalWidth, originalHeight);
  
  let newWidth = originalWidth;
  let newHeight = originalHeight;
  
  if (longSide > maxSide) {
    const scale = maxSide / longSide;
    newWidth = Math.round(originalWidth * scale);
    newHeight = Math.round(originalHeight * scale);
  }

  // Set canvas size
  canvas.width = newWidth;
  canvas.height = newHeight;

  // Draw resized image
  ctx.drawImage(img, 0, 0, newWidth, newHeight);

  // Clean up object URL
  URL.revokeObjectURL(img.src);

  // Convert to blob
  const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result) {
          resolve(result);
        } else {
          reject(new Error('Failed to create blob'));
        }
      },
      mimeType,
      format === 'jpeg' ? quality : undefined
    );
  });

  // Convert to ArrayBuffer
  const arrayBuffer = await blob.arrayBuffer();

  // Check if output size is acceptable
  if (arrayBuffer.byteLength > maxOutputSize) {
    // If still too big, try with lower quality or smaller size
    const reductionFactor = Math.sqrt(maxOutputSize / arrayBuffer.byteLength);
    const newMaxSide = Math.round(Math.min(newWidth, newHeight) * reductionFactor);
    const newQuality = Math.max(0.5, quality * 0.7);
    
    console.warn(`Image still too large (${formatFileSize(arrayBuffer.byteLength)}), reducing to ${newMaxSide}px with ${Math.round(newQuality * 100)}% quality`);
    
    // Recursive call with reduced settings
    return resizeImageFile(file, {
      ...options,
      maxSide: newMaxSide,
      quality: newQuality,
      maxOutputSize
    });
  }

  return {
    arrayBuffer,
    width: newWidth,
    height: newHeight,
    originalSize,
    resizedSize: arrayBuffer.byteLength,
    format: mimeType,
  };
}

/**
 * Resize an image from a data URL or blob
 * @param imageSource - Data URL, blob, or File
 * @param options - Resize configuration
 * @returns Promise with resized image data
 */
export async function resizeImage(
  imageSource: string | Blob | File,
  options: ResizeOptions = {}
): Promise<ResizedImageResult> {
  if (imageSource instanceof File) {
    return resizeImageFile(imageSource, options);
  }

  const { 
    maxSide = 1280, 
    quality = 0.85, 
    format = 'png' 
  } = options;

  const img = new Image();
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    throw new Error('Canvas context not available');
  }

  // Handle different input types
  let imageSrc: string;
  let originalSize = 0;

  if (typeof imageSource === 'string') {
    imageSrc = imageSource;
  } else {
    imageSrc = URL.createObjectURL(imageSource);
    originalSize = imageSource.size;
  }

  // Load image
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = imageSrc;
  });

  // Calculate new dimensions
  const { width: originalWidth, height: originalHeight } = img;
  const longSide = Math.max(originalWidth, originalHeight);
  
  let newWidth = originalWidth;
  let newHeight = originalHeight;
  
  if (longSide > maxSide) {
    const scale = maxSide / longSide;
    newWidth = Math.round(originalWidth * scale);
    newHeight = Math.round(originalHeight * scale);
  }

  // Set canvas size
  canvas.width = newWidth;
  canvas.height = newHeight;

  // Draw resized image
  ctx.drawImage(img, 0, 0, newWidth, newHeight);

  // Clean up if we created an object URL
  if (typeof imageSource !== 'string') {
    URL.revokeObjectURL(imageSrc);
  }

  // Convert to blob
  const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result) {
          resolve(result);
        } else {
          reject(new Error('Failed to create blob'));
        }
      },
      mimeType,
      format === 'jpeg' ? quality : undefined
    );
  });

  // Convert to ArrayBuffer
  const arrayBuffer = await blob.arrayBuffer();

  return {
    arrayBuffer,
    width: newWidth,
    height: newHeight,
    originalSize,
    resizedSize: arrayBuffer.byteLength,
    format: mimeType,
  };
}

/**
 * Helper to format file sizes for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Validate image file before processing
 */
export function validateImageFile(file: File): { valid: boolean; error?: string } {
  // Check file type
  if (!file.type.startsWith('image/')) {
    return { valid: false, error: 'File must be an image' };
  }

  // Check supported formats
  const supportedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!supportedTypes.includes(file.type)) {
    return { valid: false, error: 'Unsupported image format. Please use JPEG, PNG, WebP, or GIF.' };
  }

  // Much stricter file size check (raw file, before processing)
  const maxRawSize = 20 * 1024 * 1024; // 20MB raw file limit (reduced from 50MB)
  if (file.size > maxRawSize) {
    return { valid: false, error: `File too large. Maximum size is ${formatFileSize(maxRawSize)}.` };
  }

  return { valid: true };
}

/**
 * React hook for image upload with automatic resizing
 */
export function useImageUpload(options: ResizeOptions = {}) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const processImage = async (file: File): Promise<ResizedImageResult | null> => {
    setIsProcessing(true);
    setError(null);

    try {
      // Validate file
      const validation = validateImageFile(file);
      if (!validation.valid) {
        setError(validation.error || 'Invalid file');
        return null;
      }

      // Resize image
      const result = await resizeImageFile(file, options);
      
      // Final size check - must be under Edge function limit
      const maxProcessedSize = 2_500_000; // 2.5MB after processing (well under 3MB limit)
      if (result.resizedSize > maxProcessedSize) {
        setError(`Processed image too large: ${formatFileSize(result.resizedSize)}. Try reducing quality or dimensions.`);
        return null;
      }

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to process image';
      setError(errorMessage);
      return null;
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    processImage,
    isProcessing,
    error,
    clearError: () => setError(null),
  };
}