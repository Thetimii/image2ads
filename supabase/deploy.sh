#!/bin/bash
set -euo pipefail

# Supabase Edge Functions deployment.
#
# Every function here is deployed with --no-verify-jwt on purpose. The
# platform's built-in JWT check only understands this project's legacy HS256 API
# keys and now rejects them with UNAUTHORIZED_LEGACY_JWT before any function
# code runs, which took down every generation endpoint at once. Auth is enforced
# inside the functions instead - see supabase/functions/utils/auth.ts.
#
# Prerequisite: INTERNAL_FUNCTION_SECRET must be set as a function secret, and
# to the same value in the Vercel project env:
#   supabase secrets set INTERNAL_FUNCTION_SECRET=...
#
# Note: Stripe webhooks are handled by the Next.js app (src/app/api/stripe/webhook),
# not a Supabase edge function. Don't reintroduce a second webhook handler here -
# Stripe will call both if two endpoints are registered, causing double credits.

echo "🚀 Deploying Supabase Edge Functions..."

if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Please install it first:"
    echo "npm install -g supabase"
    exit 1
fi

# Functions that authorize their own callers (user session token, or
# x-internal-secret for our own backends).
FUNCTIONS=(
  generate-text-image
  generate-text-image-free
  generate-image-image
  generate-image-image-free
  generate-text-video
  generate-image-video
  check-job-status
  run-job
  retarget-email-daily
  create-signed-upload-url
  convert-to-png
  kie-callback
  sweep-stuck-jobs
)

for fn in "${FUNCTIONS[@]}"; do
    echo "📦 Deploying $fn..."
    supabase functions deploy "$fn" --no-verify-jwt
    echo "✅ $fn deployed"
done

echo ""
echo "🎉 All edge functions deployed."
echo ""
echo "Verify nothing is 401ing at the gateway any more:"
echo "  select log_attributes['request.pathname'], log_attributes['response.status_code']"
echo "  from logs where source = 'function_edge_logs' order by timestamp desc limit 20;"
