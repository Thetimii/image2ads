// deno-lint-ignore-file no-explicit-any
/**
 * Kie.ai API Client
 * Shared utilities for interacting with Kie.ai's API
 */

const KIE_BASE_URL = "https://api.kie.ai/api/v1/jobs";

interface CreateTaskResponse {
  code: number;
  msg: string;
  data: {
    taskId: string;
  };
}

interface TaskResult {
  code: number;
  msg: string;
  data: {
    taskId: string;
    status: "pending" | "processing" | "success" | "failed";
    resultJson?: {
      resultUrls?: string[];
    };
    failMsg?: string;
  };
}

/**
 * Create a new task on Kie.ai
 * @param model - Model to use (e.g., "google/nano-banana", "veo3_fast", "suno-v3.5")
 * @param input - Model-specific input parameters
 * @param apiKey - Kie.ai API key
 * @returns taskId for polling
 */
export async function createKieTask(
  model: string,
  input: Record<string, any>,
  apiKey: string
): Promise<string> {
  // Veo 3.1 models use a different endpoint and payload structure
  const isVeoModel = model === "veo3" || model === "veo3_fast";
  
  let endpoint: string;
  let payload: any;
  
  if (isVeoModel) {
    // Veo 3.1 uses /api/v1/veo/generate endpoint with flat payload structure
    endpoint = "https://api.kie.ai/api/v1/veo/generate";
    payload = {
      model,
      ...input, // Spread input directly (prompt, imageUrls, aspectRatio, generationType, etc.)
    };
  } else {
    // Legacy models use /api/v1/jobs/createTask endpoint with nested structure
    endpoint = `${KIE_BASE_URL}/createTask`;
    payload = {
      model,
      input,
    };
  }
  
  console.log('[kieClient] 🚀 EXACT PAYLOAD BEING SENT TO KIE.AI:', JSON.stringify(payload, null, 2));
  console.log('[kieClient] 📍 Endpoint:', endpoint);
  
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[kieClient] ❌ KIE.AI ERROR RESPONSE:', errorText);
    throw new Error(`Kie.ai createTask failed: ${response.status} - ${errorText}`);
  }

  const result: CreateTaskResponse = await response.json();
  
  if (result.code !== 200 || !result.data?.taskId) {
    throw new Error(`Kie.ai task creation failed: ${result.msg || "Unknown error"}`);
  }

  return result.data.taskId;
}

/**
 * Poll Kie.ai for task status and results using v1/generate/record-info endpoint
 * @param taskId - Task ID from createTask
 * @param apiKey - Kie.ai API key
 * @param maxAttempts - Maximum polling attempts (default: 120 = 10 minutes with 5s delay)
 * @param delayMs - Delay between polls in milliseconds (default: 5000 = 5s)
 * @returns Object with audioUrl and imageUrl of the generated result
 */
export async function pollKieResult(
  taskId: string,
  apiKey: string,
  maxAttempts = 120, // 120 attempts * 5s = 10 minutes max (good for videos)
  delayMs = 5000
): Promise<{ audioUrl: string; imageUrl?: string }> {
  // Correct endpoint for Suno API is /api/v1/generate/record-info
  const endpoint = `https://api.kie.ai/api/v1/generate/record-info?taskId=${taskId}`;
  
  let consecutiveErrors = 0;
  const maxConsecutiveErrors = 3; // Allow 3 consecutive errors before giving up

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await fetch(endpoint, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
        },
      });

      // Handle timeout errors (522) and server errors (5xx) with retries
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[pollKieResult] Attempt ${attempt + 1}/${maxAttempts} failed: ${response.status}`);
        
        // 5xx errors (including 522 timeout) are temporary - retry with backoff
        if (response.status >= 500 && response.status < 600) {
          consecutiveErrors++;
          console.warn(`[pollKieResult] Server error ${response.status}, consecutive errors: ${consecutiveErrors}/${maxConsecutiveErrors}`);
          
          // If we've had too many consecutive errors, give up
          if (consecutiveErrors >= maxConsecutiveErrors) {
            throw new Error(`Kie.ai service unavailable after ${consecutiveErrors} consecutive errors: ${response.status}`);
          }
          
          // Use exponential backoff for server errors
          const backoffDelay = delayMs * Math.pow(2, consecutiveErrors - 1);
          console.log(`[pollKieResult] Waiting ${backoffDelay}ms before retry due to server error...`);
          await new Promise((resolve) => setTimeout(resolve, backoffDelay));
          continue; // Skip to next attempt
        }
        
        // For other errors (4xx), throw immediately
        throw new Error(`Kie.ai polling failed: ${response.status} - ${errorText}`);
      }

      // Reset consecutive error counter on successful response
      consecutiveErrors = 0;

      const result = await response.json();
    
      // Log full response for debugging
      console.log(`[pollKieResult] Attempt ${attempt + 1}/${maxAttempts} - Full response:`, JSON.stringify(result, null, 2));
      
      if (result.code !== 200) {
        throw new Error(`Kie.ai polling error: ${result.msg || "Unknown error"}`);
      }

      const data = result.data;
      const status = data?.status;

      console.log(`[pollKieResult] Attempt ${attempt + 1}/${maxAttempts}: Status = ${status}`);

      // Check for success status (SUCCESS means all tracks completed)
      if (status === "SUCCESS") {
        // Get the first audio URL from sunoData array
        const sunoData = data?.response?.sunoData || [];
        const trackWithAudio = sunoData.find((track: any) => track.audioUrl && track.audioUrl.trim() !== '');
        
        if (!trackWithAudio?.audioUrl) {
          console.error(`[pollKieResult] Success response missing audioUrl:`, data);
          throw new Error("Task succeeded but no audio URL found in response");
        }
        
        console.log(`[pollKieResult] Task succeeded! Audio URL:`, trackWithAudio.audioUrl);
        console.log(`[pollKieResult] Cover image URL:`, trackWithAudio.imageUrl);
        
        return {
          audioUrl: trackWithAudio.audioUrl,
          imageUrl: trackWithAudio.imageUrl
        };
      }

      // Check for first track success (FIRST_SUCCESS means first track is ready)
      if (status === "FIRST_SUCCESS") {
        // Find the first track with a non-empty audioUrl
        const sunoData = data?.response?.sunoData || [];
        const trackWithAudio = sunoData.find((track: any) => track.audioUrl && track.audioUrl.trim() !== '');
        
        if (!trackWithAudio?.audioUrl) {
          console.error(`[pollKieResult] First success response missing audioUrl:`, data);
          throw new Error("First track succeeded but no audio URL found in response");
        }
        
        console.log(`[pollKieResult] First track succeeded! Audio URL:`, trackWithAudio.audioUrl);
        console.log(`[pollKieResult] Cover image URL:`, trackWithAudio.imageUrl);
        
        return {
          audioUrl: trackWithAudio.audioUrl,
          imageUrl: trackWithAudio.imageUrl
        };
      }

      // Check for failure statuses
      if (status === "CREATE_TASK_FAILED" || status === "GENERATE_AUDIO_FAILED" || status === "SENSITIVE_WORD_ERROR") {
        const errorMsg = data?.errorMessage || "Unknown error";
        console.error(`[pollKieResult] Task failed with status ${status}:`, errorMsg);
        throw new Error(`Kie.ai task failed: ${errorMsg}`);
      }

      // Still pending or processing - wait and retry
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      
    } catch (error) {
      // If this is a fetch error (network issue), treat it like a 5xx error
      if (error instanceof TypeError && error.message.includes('fetch')) {
        consecutiveErrors++;
        console.warn(`[pollKieResult] Network error, consecutive errors: ${consecutiveErrors}/${maxConsecutiveErrors}`);
        
        if (consecutiveErrors >= maxConsecutiveErrors) {
          throw new Error(`Network error after ${consecutiveErrors} consecutive attempts`);
        }
        
        // Use exponential backoff for network errors
        const backoffDelay = delayMs * Math.pow(2, consecutiveErrors - 1);
        console.log(`[pollKieResult] Waiting ${backoffDelay}ms before retry due to network error...`);
        await new Promise((resolve) => setTimeout(resolve, backoffDelay));
        continue;
      }
      
      // For any other error, rethrow
      throw error;
    }
  }

  throw new Error(`Kie.ai task timed out after ${maxAttempts} attempts (${maxAttempts * delayMs / 1000}s)`);
}

/**
 * Download a file from a URL and return as Uint8Array
 * @param url - URL to download from
 * @returns File contents as Uint8Array
 */
export async function downloadFile(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Failed to download file: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}
