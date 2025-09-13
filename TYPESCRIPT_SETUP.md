# TypeScript Configuration Guide

## Overview

This project uses a dual TypeScript setup to handle both Next.js frontend code and Deno Edge Functions properly.

## Project Structure

```
├── src/                    # Next.js TypeScript code
├── supabase/
│   ├── functions/         # Deno Edge Functions
│   ├── deno.json         # Deno configuration
│   ├── tsconfig.json     # Edge Functions TypeScript config
│   ├── types.d.ts        # Deno type definitions
│   └── deploy.sh         # Deployment script
├── tsconfig.json         # Main Next.js TypeScript config
└── .vscode/settings.json # VS Code configuration
```

## TypeScript Errors in Edge Functions

The TypeScript errors you see in the Edge Functions are **expected and normal**. Here's why:

### Expected Errors in Edge Functions:

- ❌ `Cannot find module 'https://deno.land/std@0.168.0/http/server.ts'`
- ❌ `Cannot find name 'Deno'`
- ❌ `Parameter 'request' implicitly has an 'any' type`

These errors occur because:

1. **Different Runtime**: Edge Functions run on Deno, not Node.js
2. **ESM Imports**: Deno uses URL-based imports that VS Code doesn't recognize
3. **Global Objects**: `Deno` global is not available in Node.js environment

## Solutions Implemented

### 1. Separate TypeScript Configurations

- **Main `tsconfig.json`**: For Next.js code, excludes Edge Functions
- **`supabase/tsconfig.json`**: For Edge Functions with Deno-specific settings

### 2. VS Code Configuration

The `.vscode/settings.json` configures:

- Deno support for `supabase/functions` directory
- TypeScript validation for the main project
- Proper file associations

### 3. Type Definitions

`supabase/types.d.ts` provides type definitions for Deno-specific modules to reduce errors.

### 4. Deno Configuration

`supabase/deno.json` configures Deno-specific compiler options and formatting.

## Working with Edge Functions

### Development

1. **Ignore TypeScript errors** in Edge Functions during development
2. **Test functionality** by deploying to Supabase
3. **Use Supabase CLI** for type checking: `supabase functions serve`

### Deployment

Use the provided deployment script:

```bash
cd supabase
./deploy.sh
```

Or deploy manually:

```bash
supabase functions deploy stripe-webhook
supabase functions deploy run-job
```

### Testing Edge Functions

```bash
# Start local development server
supabase start

# Serve functions locally
supabase functions serve

# Test with curl
curl -X POST http://localhost:54321/functions/v1/run-job \
  -H "Content-Type: application/json" \
  -d '{"jobId": "test-job-id"}'
```

## IDE Configuration

### VS Code Extensions (Recommended)

- **Deno for VS Code**: Provides Deno support
- **TypeScript Importer**: Auto-imports for TypeScript
- **Prettier**: Code formatting

### VS Code Settings

The project includes VS Code settings that:

- Enable Deno for Edge Functions directory only
- Keep TypeScript validation for main project
- Configure proper file associations

## Troubleshooting

### If you see persistent TypeScript errors:

1. **Restart TypeScript Server**:

   - `Cmd+Shift+P` → "TypeScript: Restart TS Server"

2. **Check file paths**:

   - Ensure Edge Functions are in `supabase/functions/`
   - Ensure main code is in `src/`

3. **Verify configurations**:
   - Main `tsconfig.json` excludes `supabase/functions`
   - VS Code settings enable Deno for Edge Functions

### Common Issues

**Issue**: TypeScript errors in Edge Functions
**Solution**: These are expected - Edge Functions run on Deno, not Node.js

**Issue**: Imports not working in main project
**Solution**: Check `@/*` path mapping in main `tsconfig.json`

**Issue**: Deno not recognized in VS Code
**Solution**: Install "Deno for VS Code" extension and check settings

## Best Practices

1. **Separate Concerns**: Keep Edge Function logic separate from Next.js code
2. **Type Safety**: Use proper types in Next.js code, accept looser typing in Edge Functions
3. **Testing**: Test Edge Functions by deploying, not just type checking
4. **Documentation**: Document Edge Function APIs for frontend integration

## Production Deployment

Edge Functions are deployed separately from the Next.js app:

1. **Deploy Edge Functions**: `supabase functions deploy`
2. **Deploy Next.js**: `vercel deploy` (or your platform)
3. **Configure Environment**: Set secrets in Supabase dashboard

The TypeScript errors in development don't affect production functionality since Edge Functions are executed in the Deno runtime on Supabase servers.
