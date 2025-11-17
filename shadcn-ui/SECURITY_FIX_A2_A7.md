# Security Fix: OpenAI API Key Migration (A2 + A7)

## ✅ Completed - November 16, 2025

### Problem
The OpenAI API key was exposed in client-side code using `dangerouslyAllowBrowser: true`, making it vulnerable to theft and abuse.

### Solution
Implemented Netlify Functions as a secure backend proxy to protect the API key server-side.

## Changes Made

### 1. Created Netlify Function (`netlify/functions/ai-suggest.ts`)
- Server-side endpoint that handles OpenAI API calls
- Validates input parameters
- Returns AI suggestions to frontend
- API key stored securely in server environment

### 2. Updated Frontend Client (`src/lib/openai.ts`)
- Removed direct OpenAI SDK initialization
- Removed `dangerouslyAllowBrowser: true`
- Now calls `/.netlify/functions/ai-suggest` endpoint
- Graceful fallback to preset defaults on error

### 3. Added Netlify Configuration (`netlify.toml`)
- Build settings for pnpm
- Function directory configuration
- SPA routing redirects
- Security headers
- Asset caching rules

### 4. Updated Environment Variables
- **Removed**: `VITE_OPENAI_API_KEY` (client-side exposure)
- **Added**: `OPENAI_API_KEY` (server-side only, no VITE_ prefix)
- Updated `.env.example` with clear instructions
- Updated `DEPLOYMENT.md` with deployment instructions

### 5. Improved Error Handling (`WizardStep3.tsx`)
- Simplified AI suggestion flow
- Always attempts server-side AI call first
- Falls back to preset defaults on any error
- Better error logging

## Deployment Instructions

### For Netlify:
1. Push code to GitHub
2. Connect repository to Netlify
3. Set environment variable: `OPENAI_API_KEY=sk-proj-your-key` (NO VITE_ prefix)
4. Deploy - Functions are automatically detected

### For Vercel:
1. Create `api/ai-suggest.ts` with similar logic (Vercel Edge Function format)
2. Set environment variable: `OPENAI_API_KEY=sk-proj-your-key`
3. Deploy

### For Local Development:
1. Add `OPENAI_API_KEY=sk-proj-your-key` to `.env` (optional, for testing AI)
2. Install Netlify CLI: `pnpm add -D netlify-cli`
3. Run: `netlify dev` (instead of `vite dev`)
4. Access app at `http://localhost:8888`

## Security Improvements

✅ API key never exposed in browser bundle  
✅ API key not in source control  
✅ Server-side validation of requests  
✅ CORS properly configured  
✅ Graceful degradation if AI unavailable  

## Testing

### Test AI Functionality:
1. Deploy to Netlify with `OPENAI_API_KEY` configured
2. Use wizard Step 3
3. Click "Get AI Suggestions"
4. Should see AI-suggested activities with badges

### Test Fallback:
1. Remove `OPENAI_API_KEY` from deployment
2. Use wizard Step 3
3. Click "Get AI Suggestions"
4. Should still work using preset defaults

## Cost Impact

**Before**: Exposed key could be stolen → unlimited fraudulent usage  
**After**: Protected key → only legitimate app usage  

Estimated cost per estimation: **$0.001 - $0.01** (GPT-4o-mini)

## Next Steps

- Consider adding rate limiting in Netlify Function
- Add usage analytics/monitoring
- Implement A1 (Save estimation to database)
