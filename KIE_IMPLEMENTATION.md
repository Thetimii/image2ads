# Kie.ai Integration - Implementation Guide

## ✅ Completed Backend Implementation

### 📦 What's Been Created:

#### 1. **Shared Kie.ai Client** (`/supabase/functions/utils/kieClient.ts`)

- `createKieTask()` - Submit generation tasks to Kie.ai
- `pollKieResult()` - Poll for task completion with automatic retries
- `downloadFile()` - Download generated assets from Kie.ai URLs

#### 2. **Edge Functions** (4 new endpoints)

**Text-to-Image** (`/supabase/functions/generate-text-image/index.ts`)

- Model: `google/nano-banana`
- Input: Text prompt + image size
- Output: PNG image
- Cost: 1 credit per generation

**Image-to-Image** (`/supabase/functions/generate-image-image/index.ts`)

- Model: `google/nano-banana-edit`
- Input: Text prompt + reference image + image size
- Output: PNG image
- Cost: 1 credit per generation

**Text-to-Video** (`/supabase/functions/generate-text-video/index.ts`)

- Model: `sora-2-text-to-video`
- Input: Text prompt + aspect ratio
- Output: MP4 video
- Cost: 1 credit per generation

**Image-to-Video** (`/supabase/functions/generate-image-video/index.ts`)

- Model: `sora-2-image-to-video`
- Input: Text prompt + reference image + aspect ratio
- Output: MP4 video
- Cost: 1 credit per generation

#### 3. **Database Migration** (`/supabase/migrations/20251008_add_kie_columns_to_jobs.sql`)

Added columns to `jobs` table:

- `task_id` - Stores Kie.ai task ID for polling
- `result_type` - Differentiates 'image' vs 'video' outputs
- `source_image_url` - Stores reference image URL for image-based workflows

---

## 🚀 Deployment Steps

### Step 1: Apply Database Migration

You mentioned you'll add this manually to Supabase. The SQL is:

```sql
ALTER TABLE jobs ADD COLUMN task_id text;
ALTER TABLE jobs ADD COLUMN result_type text DEFAULT 'image';
ALTER TABLE jobs ADD COLUMN source_image_url text;
```

### Step 2: Add Environment Variable

Add `KIE_API_KEY` to your Supabase Edge Functions secrets:

```bash
supabase secrets set KIE_API_KEY=your_kie_api_key_here
```

Or in Supabase Dashboard:

1. Go to Project Settings → Edge Functions
2. Add new secret: `KIE_API_KEY` = `your_key`

### Step 3: Deploy Edge Functions

```bash
cd /Users/timsager/Desktop/image2ad/website

# Deploy all functions
supabase functions deploy generate-text-image
supabase functions deploy generate-image-image
supabase functions deploy generate-text-video
supabase functions deploy generate-image-video
```

---

## 🎨 UI Integration (Next Phase)

### Required Routes:

1. `/generate/text-to-image` - Text → Image generation form
2. `/generate/image-to-image` - Image → Image editing form
3. `/generate/text-to-video` - Text → Video generation form
4. `/generate/image-to-video` - Image → Video animation form

### Sidebar Navigation:

```tsx
const sidebarTabs = [
  {
    id: "text-to-image",
    label: "📝 Text to Image",
    route: "/generate/text-to-image",
  },
  {
    id: "image-to-image",
    label: "🖼️ Image to Image",
    route: "/generate/image-to-image",
  },
  {
    id: "text-to-video",
    label: "🎥 Text to Video",
    route: "/generate/text-to-video",
  },
  {
    id: "image-to-video",
    label: "📸 Image to Video",
    route: "/generate/image-to-video",
  },
  { id: "library", label: "📚 Library", route: "/library" },
];
```

---

## 📋 How Each Function Works

### Common Flow (All Functions):

1. **Receive job ID** via POST request
2. **Validate job** exists in database
3. **Check credits** using `consume_credit` RPC
4. **Update status** to "processing"
5. **Create Kie.ai task** with appropriate model and parameters
6. **Store task_id** in jobs table
7. **Poll for result** (every 5s, up to 5-10 minutes)
8. **Download result** from Kie.ai CDN
9. **Upload to Supabase storage** (`results` bucket)
10. **Update job** with result_url and status "completed"
11. **Log usage** in usage_events table
12. **Save metadata** for library display

### Model Selection Logic:

- **Landscape**: `model: "sora-2-text-to-video-landscape"` → aspect_ratio: "landscape"
- **Portrait**: `model: "sora-2-text-to-video-portrait"` → aspect_ratio: "portrait"
- **Square**: Default → `1:1` for images, `landscape` for videos

---

## 🔐 Security & Credits

### Credit System:

- All functions consume **1 credit** per generation (temporary rule)
- Credits deducted **before** API call to prevent double-charging on retries
- Failed jobs do **not** consume credits (credit deduction happens before processing)

### CORS Configuration:

Allows requests from:

- `https://image2ad.com`
- `https://www.image2ad.com`
- `http://localhost:3000`
- `http://localhost:5173`

### Storage Structure:

```
/results/
  └── {user_id}/
      ├── text-to-image/{job_id}-{timestamp}.png
      ├── image-to-image/{job_id}-{timestamp}.png
      ├── text-to-video/{job_id}-{timestamp}.mp4
      └── image-to-video/{job_id}-{timestamp}.mp4
```

---

## 🧪 Testing

### Test Text-to-Image:

```bash
curl -X POST https://your-project.supabase.co/functions/v1/generate-text-image \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{"jobId": "test-job-id"}'
```

### Expected Response:

```json
{
  "success": true,
  "jobId": "test-job-id",
  "result_path": "{user_id}/text-to-image/{job_id}-{timestamp}.png"
}
```

---

## 📝 Next Steps

### Phase 4: UI Enhancements

- [ ] Create 4 generation pages
- [ ] Add sidebar navigation with tabs
- [ ] Implement image upload for image-based workflows
- [ ] Add aspect ratio / image size selectors
- [ ] Show video player for video results
- [ ] Add loading states with progress indicators
- [ ] Implement real-time updates for job status

### Phase 5: Cleanup

- [ ] You'll delete `/supabase/functions/run-job` manually
- [ ] Update any frontend API calls to use new endpoints

---

## 🎯 Current Status

✅ **Backend Complete:**

- Kie.ai client library
- 4 edge functions for all generation types
- Database migration ready
- Credit system integrated
- Storage structure defined

⏳ **Pending:**

- Database migration (you'll apply manually)
- KIE_API_KEY environment variable (needs your key)
- Edge function deployment
- UI implementation

---

## 💡 Key Differences from Old System

### Old (`run-job`):

- Single endpoint for all generation types
- OpenAI GPT-Image-1 API
- Image-only outputs
- Synchronous generation

### New (Kie.ai):

- 4 specialized endpoints
- Multiple models (Nano Banana + Sora 2)
- Both image AND video outputs
- Asynchronous with polling
- Task-based workflow with task_id tracking
