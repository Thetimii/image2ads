# Image2Ad - AI-Powered Advertisement Generator

Transform your images into professional advertisements using AI. Built with Next.js, Supabase, and FAL.ai.

## Features

- 🤖 AI-powered image transformation using FAL.ai
- 👤 User authentication with Supabase Auth
- 📁 Folder-based image organization
- 💳 Stripe integration for subscriptions and billing
- ⚡ Real-time job status updates
- 🔒 Secure file storage with signed URLs
- 📱 Responsive design with Tailwind CSS

## Tech Stack

- **Frontend**: Next.js 15 (App Router), TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Supabase Edge Functions
- **Database**: Supabase (PostgreSQL with RLS)
- **Storage**: Supabase Storage
- **AI**: FAL.ai API
- **Payments**: Stripe
- **Authentication**: Supabase Auth

## Setup Instructions

### 1. Clone and Install Dependencies

```bash
git clone <repository-url>
cd website
npm install
```

### 2. Supabase Setup

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Copy your project URL and anon key
3. Run the SQL schema in `supabase/schema.sql` in your Supabase SQL editor
4. Deploy the Edge Functions:

```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link your project
supabase link --project-ref <your-project-ref>

# Deploy edge functions
supabase functions deploy stripe-webhook
supabase functions deploy run-job
```

### 3. Stripe Setup

1. Create a Stripe account at [stripe.com](https://stripe.com)
2. Create three subscription products:
   - Starter: $9.99/month (200 credits)
   - Pro: $24.99/month (600 credits)
   - Business: $79.99/month (2000 credits)
3. Copy the price IDs for each plan
4. Set up webhook endpoint pointing to your Supabase Edge Function

### 4. FAL.ai Setup

1. Sign up at [fal.ai](https://fal.ai)
2. Get your API key from the dashboard

### 5. Environment Variables

Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

Required environment variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_STARTER_PRICE_ID`
- `STRIPE_PRO_PRICE_ID`
- `STRIPE_BUSINESS_PRICE_ID`
- `FAL_API_KEY`
- `NEXT_PUBLIC_APP_URL`

### 6. Run the Application

```bash
npm run dev
```

Visit `http://localhost:3000` to see the application.

## Database Schema

The application uses the following main tables:

- **profiles**: User profiles with credits and subscription info
- **folders**: User-created folders for organizing images
- **images**: Uploaded image metadata
- **jobs**: AI generation jobs with status tracking
- **usage_events**: Credit consumption tracking

## API Routes

- `POST /api/upload-url` - Generate signed upload URLs
- `GET /api/folders` - Get user folders
- `POST /api/folders` - Create new folder
- `POST /api/generate` - Start AI generation job
- `GET /api/jobs` - Get user jobs with status
- `POST /api/stripe/create-checkout-session` - Create Stripe checkout
- `POST /api/stripe/portal` - Access billing portal

## Edge Functions

- **stripe-webhook**: Handle Stripe webhook events for subscriptions
- **run-job**: Process AI generation jobs using FAL.ai

## Features Overview

### Authentication

- Email/password signup and signin
- Automatic profile creation on signup
- Protected routes with middleware

### File Management

- Drag & drop image uploads
- Signed URL generation for secure access
- Automatic file organization by user and folder

### AI Generation

- Integration with FAL.ai for image transformation
- Real-time job status updates via Supabase Realtime
- Credit-based usage system

### Billing

- Stripe subscription management
- Multiple pricing tiers
- Customer portal for subscription management
- Automatic credit allocation

## Security Features

- Row Level Security (RLS) on all database tables
- Signed URLs for file access with expiration
- Server-side authentication checks
- Input validation with Zod schemas

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Connect your GitHub repo to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy

### Other Platforms

Ensure your platform supports:

- Next.js 15
- Node.js 18+
- Environment variables

## Development

### Code Structure

```
src/
├── app/                    # Next.js app router pages
│   ├── api/               # API route handlers
│   ├── auth/              # Auth callback
│   ├── billing/           # Billing page
│   ├── dashboard/         # Dashboard page
│   ├── folders/           # Folder detail pages
│   └── signin/            # Authentication page
├── components/            # React components (existing landing page)
├── lib/                   # Utility functions
│   ├── supabase/         # Supabase clients
│   ├── database.ts       # Database utilities
│   ├── stripe.ts         # Stripe utilities
│   ├── validations.ts    # Zod schemas
│   └── realtime.ts       # Realtime subscriptions
└── middleware.ts          # Auth middleware
```

### Key Patterns

- Server Components for data fetching
- Client Components for interactivity
- Zod validation for all inputs
- Error handling with try/catch
- TypeScript for type safety

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
