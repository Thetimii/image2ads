// Legacy endpoint name kept so already-open browser tabs keep working after a
// deploy. Same handler as `generate` - the job row decides what is generated.
// Safe to delete once no traffic hits it (check function_edge_logs).
import { handleGenerate } from "../_shared/generate-handler.ts";

Deno.serve(handleGenerate);
