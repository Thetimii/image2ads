#!/bin/bash
set -euo pipefail

# Supabase Edge Functions deployment.
#
# Every function is deployed with --no-verify-jwt on purpose: the platform's
# built-in JWT check rejects this project's legacy HS256 keys, so auth is done
# inside the functions (supabase/functions/_shared/auth.ts + kie-callback's
# signature check).
#
# Required function secrets (supabase secrets set NAME=value):
#   KIE_API_KEY               kie.ai API key
#   INTERNAL_FUNCTION_SECRET  same value as in Vercel; also signs kie.ai callback URLs
#   KIE_WEBHOOK_HMAC_KEY      optional but recommended - kie.ai/settings -> Webhook HMAC key
#
# Stripe webhooks are handled by the Next.js app (src/app/api/stripe/webhook).

if ! command -v supabase &> /dev/null; then
  echo "❌ Supabase CLI not found: npm install -g supabase"
  exit 1
fi

cd "$(dirname "$0")/.."

echo "🧪 Running backend tests..."
deno test --no-lock -A supabase/functions/_shared/backend_test.ts

FUNCTIONS=(
  generate               # single entry point for image / video / music
  check-job-status       # browser poll (mostly a DB read)
  kie-callback           # kie.ai webhook -> finishes jobs
  sweep-stuck-jobs       # backstop, woken by pg_cron only when needed
  # legacy names -> same handler as `generate`, for already-open tabs.
  # Remove once function_edge_logs shows no traffic on them.
  generate-text-image
  generate-image-image
  generate-text-video
  generate-image-video
  generate-text-music
  generate-text-image-free
  generate-image-image-free
  run-job                # old /api/generate (folder page) caller
  retarget-email-daily
  create-signed-upload-url
  convert-to-png
)

for fn in "${FUNCTIONS[@]}"; do
  echo "📦 Deploying $fn..."
  supabase functions deploy "$fn" --no-verify-jwt
done

# Orphaned experiments that no code calls.
for fn in kie-webhook poll-job-status; do
  supabase functions delete "$fn" 2>/dev/null && echo "🗑  deleted $fn" || true
done

echo "🎉 Done."
