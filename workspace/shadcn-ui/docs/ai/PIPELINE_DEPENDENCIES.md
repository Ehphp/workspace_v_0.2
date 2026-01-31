# Required Dependencies for Pipeline Implementation

## Installation Commands

### Production Dependencies

```bash
pnpm add redis ajv
```

### Dev Dependencies (Testing)

```bash
pnpm add -D @vitest/ui
```

## Package Details

### redis (^4.7.0)
- **Purpose**: Redis client for caching and rate limiting
- **Usage**: 
  - Cache preset results (`processed:preset:{hash}`)
  - Rate limiting with Lua scripts
- **Files**: 
  - `netlify/functions/lib/security/rate-limiter.ts`
  - `netlify/functions/lib/ai/pipeline/preset-pipeline.ts`

### ajv (^8.12.0)
- **Purpose**: JSON schema validation
- **Usage**: Validate AI-generated presets against strict schema
- **Files**:
  - `netlify/functions/lib/ai/validation/preset-schema.ts`
- **Features**:
  - `allErrors: true` for comprehensive validation
  - Enum constraints for `group` and `priority` fields
  - Range validation for `estimatedHours` (1-320)

### @vitest/ui (^4.0.10)
- **Purpose**: Interactive UI for running tests
- **Usage**: `pnpm test:ui` for visual test runner
- **Optional**: Only needed for development

## Environment Variables Setup

Create or update `.env`:

```bash
# OpenAI (existing)
OPENAI_API_KEY=sk-...

# Redis (new)
REDIS_URL=redis://localhost:6379

# Pipeline Feature Flags (new)
AI_ENABLED=true
AI_ENSEMBLE=true
AI_MAX_HOURS=8
AI_COMPLETENESS_THRESHOLD=0.65
AI_MIN_ACTIVITIES=5
AI_MAX_ACTIVITIES=20

# Rate Limiting (existing, now Redis-backed)
AI_RATE_LIMIT_MAX=50
AI_RATE_LIMIT_WINDOW_MS=600000
```

## Production Deployment (Netlify)

### 1. Add Redis Add-on

**Option A: Upstash Redis (Recommended)**
```bash
netlify addons:create upstash-redis
netlify env:set REDIS_URL $(netlify addons:list | grep upstash-redis | awk '{print $3}')
```

**Option B: External Redis Cloud**
1. Create Redis instance at https://redis.com/try-free/
2. Copy connection URL
3. Set in Netlify: `netlify env:set REDIS_URL "redis://..."`

### 2. Set Environment Variables

```bash
netlify env:set AI_ENABLED true
netlify env:set AI_ENSEMBLE true
netlify env:set AI_MAX_HOURS 8
netlify env:set AI_COMPLETENESS_THRESHOLD 0.65
netlify env:set AI_MIN_ACTIVITIES 5
netlify env:set AI_MAX_ACTIVITIES 20
```

### 3. Deploy

```bash
pnpm run build
netlify deploy --prod
```

## Local Development Setup

### 1. Install Redis Locally

**macOS (Homebrew)**
```bash
brew install redis
brew services start redis
```

**Linux (apt)**
```bash
sudo apt-get install redis-server
sudo systemctl start redis
```

**Windows (WSL)**
```bash
sudo apt-get install redis-server
sudo service redis-server start
```

**Docker (Cross-platform)**
```bash
docker run -d -p 6379:6379 --name redis-dev redis:7-alpine
```

### 2. Verify Redis Connection

```bash
redis-cli ping
# Expected: PONG
```

### 3. Start Development Server

```bash
pnpm run dev:netlify
```

## Troubleshooting

### Redis Connection Failed

**Error**: `Redis connection failed after 3 retries`

**Solution**:
1. Check Redis is running: `redis-cli ping`
2. Verify `REDIS_URL` in `.env`
3. Check firewall allows port 6379
4. For Docker: `docker ps` to verify container is running

### AJV Validation Errors

**Error**: `Cannot find module 'ajv'`

**Solution**:
```bash
pnpm install
# Or explicitly:
pnpm add ajv
```

### Missing Type Definitions

**Error**: `Cannot find type 'RedisClientType'`

**Solution**:
```bash
pnpm add -D @types/node
```

## Verification Checklist

After installation, verify:

- [ ] `pnpm list redis` shows redis@^4.7.0
- [ ] `pnpm list ajv` shows ajv@^8.12.0
- [ ] Redis server responds to `redis-cli ping`
- [ ] `.env` file contains all required variables
- [ ] `pnpm run dev:netlify` starts without errors
- [ ] Tests run with `pnpm test src/test/preset-pipeline.test.ts`

## Next Steps

1. Run tests to verify implementation:
   ```bash
   pnpm test src/test/preset-pipeline.test.ts
   ```

2. Test API endpoint locally:
   ```bash
   curl -X POST http://localhost:8888/.netlify/functions/ai-generate-preset \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -d '{"description":"Test project","answers":{}}'
   ```

3. Check Redis cache:
   ```bash
   redis-cli KEYS "processed:preset:*"
   redis-cli GET "processed:preset:HASH"
   ```

4. Monitor logs:
   ```bash
   # Structured JSON logs
   tail -f .netlify/functions-serve/ai-generate-preset/ai-generate-preset.log
   ```
