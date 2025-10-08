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
 * @param model - Model to use (e.g., "google/nano-banana", "sora-2-text-to-video")
 * @param input - Model-specific input parameters
 * @param apiKey - Kie.ai API key
 * @returns taskId for polling
 */
export async function createKieTask(
  model: string,
  input: Record<string, any>,
  apiKey: string
): Promise<string> {
  const response = await fetch(`${KIE_BASE_URL}/createTask`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Kie.ai createTask failed: ${response.status} - ${errorText}`);
  }

  const result: CreateTaskResponse = await response.json();
  
  if (result.code !== 200 || !result.data?.taskId) {
    throw new Error(`Kie.ai task creation failed: ${result.msg || "Unknown error"}`);
  }

  return result.data.taskId;
}

/**
 * Poll Kie.ai for task status and results
 * @param taskId - Task ID from createTask
 * @param apiKey - Kie.ai API key
 * @param maxAttempts - Maximum polling attempts (default: 60)
 * @param delayMs - Delay between polls in milliseconds (default: 5000 = 5s)
 * @returns URL of the generated result
 */
export async function pollKieResult(
  taskId: string,
  apiKey: string,
  maxAttempts = 60,
  delayMs = 5000
): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const response = await fetch(`${KIE_BASE_URL}/recordInfo?taskId=${taskId}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Kie.ai polling failed: ${response.status} - ${errorText}`);
    }

    const result: TaskResult = await response.json();

    if (result.code !== 200) {
      throw new Error(`Kie.ai polling error: ${result.msg || "Unknown error"}`);
    }

    const { status, resultJson, failMsg } = result.data;

    if (status === "success") {
      const resultUrl = resultJson?.resultUrls?.[0];
      if (!resultUrl) {
        throw new Error("Task succeeded but no result URL found");
      }
      return resultUrl;
    }

    if (status === "failed") {
      throw new Error(`Kie.ai task failed: ${failMsg || "Unknown error"}`);
    }

    // Still pending or processing, wait and retry
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  throw new Error(`Kie.ai task timed out after ${maxAttempts} attempts`);
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
