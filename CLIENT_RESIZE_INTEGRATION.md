# Client-Side Image Resizing Integration Guide

## 🎯 Problem Solved

Your Edge function was hitting the ~150MB memory limit because:

- Large images (4000×3000) decode to ~48MB raw RGBA
- Plus buffers + resizing + PNG encoding = 200-250MB total
- Supabase kills the worker at ~268MB

## ✅ Solution: Pre-resize on Client

**Before**: Browser uploads 4000×3000 JPEG → Edge function decodes full size → OOM  
**After**: Browser resizes to 1280×1280 → Edge function processes small image → Success

---

## 🔧 How to Integrate

### 1. Update Your Upload Components

Replace any file upload handling with the client-side resize:

```tsx
import { resizeImageFile } from "@/lib/client-resize";

// OLD WAY (causes Edge function OOM):
const handleFile = async (file: File) => {
  const formData = new FormData();
  formData.append("files", file); // Raw large file!
  formData.append("folderId", folderId);

  await fetch("/api/upload-png", {
    method: "POST",
    body: formData,
  });
};

// NEW WAY (Edge-safe):
const handleFile = async (file: File) => {
  // 1. Resize on client-side first
  const resized = await resizeImageFile(file, {
    maxSide: 1280,
    quality: 0.85,
    format: "png",
  });

  // 2. Create blob from resized data
  const blob = new Blob([resized.arrayBuffer], { type: "image/png" });

  // 3. Upload the small, pre-processed image
  const formData = new FormData();
  formData.append("files", blob, file.name);
  formData.append("folderId", folderId);

  await fetch("/api/upload-png", {
    method: "POST",
    body: formData,
  });
};
```

### 2. Update Your Edge Function (Already Done)

Your `convert-to-png` function now has a size check:

```ts
if (src.byteLength > 10_000_000) {
  return json(
    {
      error: "File too large. Please upload max 10MB or resize before upload.",
    },
    400
  );
}
```

### 3. Add User Feedback

Show users what's happening:

```tsx
const [isProcessing, setIsProcessing] = useState(false);
const [progress, setProgress] = useState("");

const handleFile = async (file: File) => {
  setIsProcessing(true);

  try {
    setProgress("Preparing image...");
    const resized = await resizeImageFile(file, { maxSide: 1280 });

    setProgress("Uploading...");
    // ... upload logic

    setProgress("Complete!");
  } finally {
    setIsProcessing(false);
  }
};
```

---

## 📊 Expected Results

### Memory Usage (Before vs After)

| Image Size            | Before (Raw Upload)            | After (Client Resize) |
| --------------------- | ------------------------------ | --------------------- |
| 4000×3000 JPEG (8MB)  | ~250MB Edge memory             | ~15MB Edge memory     |
| 6000×4000 JPEG (12MB) | ~400MB Edge memory → **CRASH** | ~15MB Edge memory     |
| 2000×1500 JPEG (3MB)  | ~60MB Edge memory              | ~8MB Edge memory      |

### File Sizes

- Original: 4000×3000 JPEG = ~8MB
- Client resized: 1280×960 PNG = ~2-4MB
- Edge processed: Same ~2-4MB (just normalized)

---

## 🔄 Quick Migration Checklist

1. **✅ Add client-side resize utility** (`/src/lib/client-resize.ts`)
2. **✅ Update Edge function with size check** (`convert-to-png/index.ts`)
3. **🔄 Update upload components** (replace raw file uploads)
4. **📋 Test with large images** (upload 4000×3000+ photos)
5. **🚀 Deploy and monitor** (check Edge function logs)

---

## 🧪 Testing

Test with progressively larger images:

- ✅ 1000×1000 (baseline)
- ✅ 2000×2000 (should work)
- ✅ 4000×3000 (the problematic size)
- ✅ 6000×4000 (would crash before, safe now)

Monitor Supabase Edge Function logs for memory usage.

---

## 💡 Pro Tips

### For Background Images

```tsx
// Backgrounds can be slightly larger/lower quality since they're not the focus
const resized = await resizeImageFile(file, {
  maxSide: 1280,
  quality: 0.75, // Lower quality = smaller file
  format: "jpeg", // JPEG for photos (smaller than PNG)
});
```

### For Product Images

```tsx
// Products need crisp quality, especially if transparent
const resized = await resizeImageFile(file, {
  maxSide: 1280,
  quality: 0.9, // Higher quality for products
  format: "png", // PNG preserves transparency
});
```

### Batch Uploads

```tsx
// Process multiple files in parallel (but upload sequentially)
const resizedFiles = await Promise.all(
  files.map((file) => resizeImageFile(file, options))
);

// Then upload one by one to avoid overwhelming the Edge function
for (const resized of resizedFiles) {
  await uploadToEdge(resized);
}
```

This approach moves the heavy lifting to the client (unlimited browser memory) and keeps your Edge function fast and stable! 🚀
