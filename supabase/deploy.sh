#!/bin/bash

# Supabase Edge Functions Deployment Script
# This script helps deploy the edge functions with proper environment setup

echo "🚀 Deploying Supabase Edge Functions..."

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Please install it first:"
    echo "npm install -g supabase"
    exit 1
fi

# Check if logged in
if ! supabase status &> /dev/null; then
    echo "❌ Not logged in to Supabase. Please run:"
    echo "supabase login"
    exit 1
fi

# Note: Stripe webhooks are handled by the Next.js app (src/app/api/stripe/webhook),
# not a Supabase edge function. Don't reintroduce a second webhook handler here -
# Stripe will call both if two endpoints are registered, causing double credits.

# Deploy run-job function
echo "📦 Deploying run-job function..."
supabase functions deploy run-job

if [ $? -eq 0 ]; then
    echo "✅ run-job deployed successfully"
else
    echo "❌ Failed to deploy run-job"
    exit 1
fi

echo ""
echo "🎉 All edge functions deployed successfully!"
echo ""
echo "Next steps:"
echo "1. Set up environment variables in Supabase dashboard:"
echo "   - STRIPE_SECRET_KEY"
echo "   - STRIPE_WEBHOOK_SECRET"
echo "   - FAL_API_KEY"
echo ""
echo "2. Configure Stripe webhook URL:"
echo "   https://your-project.supabase.co/functions/v1/stripe-webhook"
echo ""
echo "3. Test the functions in your Supabase dashboard"