# Deployment Configuration Summary

## Required Environment Variables

### Production Environment (.env.production.local)

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Stripe
STRIPE_SECRET_KEY=sk_live_your-live-secret-key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_your-live-publishable-key
STRIPE_WEBHOOK_SECRET=whsec_your-webhook-secret
STRIPE_STARTER_PRICE_ID=price_your-starter-price-id
STRIPE_PRO_PRICE_ID=price_your-pro-price-id
STRIPE_BUSINESS_PRICE_ID=price_your-business-price-id

# FAL.ai
FAL_API_KEY=your-fal-api-key

# App
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

## Supabase Setup Checklist

1. ✅ Create Supabase project
2. ✅ Run schema.sql in SQL editor
3. ✅ Set up storage buckets (uploads, results)
4. ✅ Deploy edge functions:
   ```bash
   supabase functions deploy stripe-webhook
   supabase functions deploy run-job
   ```
5. ✅ Set edge function environment variables:
   ```bash
   supabase secrets set STRIPE_SECRET_KEY=your-key
   supabase secrets set STRIPE_WEBHOOK_SECRET=your-secret
   supabase secrets set FAL_API_KEY=your-key
   ```

## Stripe Setup Checklist

1. ✅ Create products and pricing
2. ✅ Set up webhook endpoint: https://your-project.supabase.co/functions/v1/stripe-webhook
3. ✅ Configure webhook events:
   - checkout.session.completed
   - customer.subscription.updated
   - customer.subscription.deleted
4. ✅ Test with Stripe CLI:
   ```bash
   stripe listen --forward-to https://your-project.supabase.co/functions/v1/stripe-webhook
   ```

## FAL.ai Setup Checklist

1. ✅ Create account at fal.ai
2. ✅ Get API key from dashboard
3. ✅ Test API access

## Vercel Deployment

1. ✅ Connect GitHub repository
2. ✅ Set environment variables in Vercel dashboard
3. ✅ Deploy

## Security Checklist

- ✅ RLS policies enabled on all tables
- ✅ Service role key kept secure
- ✅ Stripe webhook secret configured
- ✅ File uploads restricted by user
- ✅ Signed URLs with expiration
- ✅ Input validation with Zod

## Testing Checklist

- ✅ User registration/login
- ✅ Folder creation
- ✅ Image upload
- ✅ AI generation job
- ✅ Stripe subscription flow
- ✅ Billing portal access
- ✅ Real-time job updates

## Monitoring

- Monitor Supabase dashboard for errors
- Check Stripe dashboard for payment issues
- Monitor FAL.ai usage and costs
- Set up Vercel analytics for performance
