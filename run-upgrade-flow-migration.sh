#!/bin/bash

# Migration script for new upgrade flow
# Run this to apply the database changes

echo "🚀 Starting upgrade flow migration..."
echo ""

# Check if we're in the right directory
if [ ! -f "supabase/migrations/20250113_upgrade_flow_fields.sql" ]; then
    echo "❌ Error: Migration file not found. Are you in the website directory?"
    exit 1
fi

echo "📋 This migration will:"
echo "   - Add pro_discount_expires_at field to profiles"
echo "   - Add trial_end_at field to profiles"
echo "   - Add subscription_status field (default: 'free')"
echo "   - Add plan field (default: 'free')"
echo "   - Update default credits from 2 to 3"
echo "   - Update handle_new_user() function"
echo "   - Add performance indexes"
echo ""

read -p "Do you want to continue? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Migration cancelled"
    exit 1
fi

echo ""
echo "🔄 Applying migration..."

# Apply migration using Supabase CLI
npx supabase db push

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Migration applied successfully!"
    echo ""
    echo "📝 Next steps:"
    echo "   1. Verify environment variables in .env.local"
    echo "   2. Test the new modals locally"
    echo "   3. Deploy to production with: vercel deploy --prod"
    echo "   4. Monitor Stripe webhook events"
    echo ""
else
    echo ""
    echo "❌ Migration failed. Please check the error above."
    exit 1
fi
