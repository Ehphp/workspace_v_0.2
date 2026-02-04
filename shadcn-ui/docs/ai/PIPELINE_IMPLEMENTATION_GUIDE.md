# AI Preset Generation Pipeline - Implementation Guide

## Overview

Questo documento descrive la pipeline "skeleton → expand → validate" per la generazione di preset granulari con attività ≤8h.

## Architecture

```
User Request
    ↓
Rate Limiting (Redis)
    ↓
Cache Check (Redis: processed:preset:{hash})
    ↓ (if miss)
Stage 1: Skeleton Generation (temp=0.0)
    ↓
Stage 2: Expand Activities (temp=0.6)
    ↓
Post-Process: Score & Split
    ↓
AJV Validation
    ↓
Cache Result (7 days TTL)
    ↓
Return Preset
```

## Environment Variables

```bash
# Required
OPENAI_API_KEY=sk-...
REDIS_URL=redis://localhost:6379

# Feature Flags
AI_ENABLED=true                    # Enable/disable AI generation
AI_ENSEMBLE=true                   # Enable skeleton→expand pipeline
AI_MAX_HOURS=8                     # Max hours per activity
AI_COMPLETENESS_THRESHOLD=0.65     # Min completeness score
AI_MIN_ACTIVITIES=5                # Min activities in preset
AI_MAX_ACTIVITIES=20               # Max activities in preset

# Rate Limiting
AI_RATE_LIMIT_MAX=50              # Max requests per window
AI_RATE_LIMIT_WINDOW_MS=600000    # 10 minutes
```

## Installation

### 1. Install Dependencies

```bash
npm install redis ajv
npm install --save-dev vitest @vitest/ui
```

### 2. Setup Redis

#### Local Development
```bash
# Using Docker
docker run -d -p 6379:6379 redis:7-alpine

# Or with Homebrew (Mac)
brew install redis
brew services start redis
```

#### Production (Netlify)
Add Redis add-on or use external service (Upstash, Redis Cloud).

### 3. Configure Environment

Create `.env`:
```
OPENAI_API_KEY=your-key-here
REDIS_URL=redis://localhost:6379
AI_ENABLED=true
AI_ENSEMBLE=true
AI_MAX_HOURS=8
AI_COMPLETENESS_THRESHOLD=0.65
```

## File Structure

```
netlify/functions/
├── ai-generate-preset.ts              # Main handler (updated)
├── lib/
│   ├── ai/
│   │   ├── pipeline/
│   │   │   └── preset-pipeline.ts     # NEW: Pipeline orchestration
│   │   ├── prompts/
│   │   │   ├── skeleton.system        # NEW: Skeleton prompt
│   │   │   ├── expand.system          # NEW: Expand prompt
│   │   │   └── policy.system          # NEW: Policy/QA prompt
│   │   └── validation/
│   │       └── preset-schema.ts       # NEW: AJV schema + fallback
│   └── security/
│       └── rate-limiter.ts            # UPDATED: Redis-backed

src/types/
└── ai-validation.ts                   # UPDATED: Helper functions

src/test/
└── preset-pipeline.test.ts            # NEW: Test suite
```

## Pipeline Stages

### Stage 1: Skeleton Generation

**Purpose**: Generate minimal activity structure deterministically.

**Model Parameters**:
- Temperature: 0.0 (maximum determinism)
- Timeout: 15s
- Output: `{ title, group, estimatedHours, priority }`

**Prompt**: `prompts/skeleton.system`

### Stage 2: Expansion

**Purpose**: Enrich skeleton with detailed descriptions and technical details.

**Model Parameters**:
- Temperature: 0.6 (creative but consistent)
- Timeout: 60s
- Retries: Up to 2 attempts with temp=0.8 if completeness < threshold

**Output**: Full preset with:
- Detailed descriptions (150-300 words)
- Acceptance criteria (3-5 points)
- Technical details (files, commands, dependencies)
- Time justifications

**Prompt**: `prompts/expand.system`

### Stage 3: Post-Processing

**Operations**:
1. **Completeness Scoring**:
   ```typescript
   completeness = 0.5*coherence + 0.3*depth + 0.2*actionable
   ```
   - Coherence: Cosine similarity with project description
   - Depth: Bullet points, technical details count
   - Actionable: Has acceptance criteria

2. **Task Splitting**:
   - If `estimatedHours > AI_MAX_HOURS` → split into atomic subtasks
   - Distributes hours evenly across splits
   - Uses group-specific templates (DEV, TEST, OPS, etc.)

3. **AJV Validation**:
   - Validates full preset schema
   - On failure → use FALLBACK_PRESET

## Caching & Idempotency

### Cache Key
```typescript
const promptHash = sha256(description + JSON.stringify(answers) + category);
const cacheKey = `processed:preset:${promptHash}`;
```

### Redis Operations
```typescript
// Check cache
const cached = await redis.get(cacheKey);

// Set cache (7 days TTL)
await redis.setEx(cacheKey, 7 * 24 * 60 * 60, JSON.stringify(preset));
```

### Idempotency Guarantee
- Same input (description + answers + category) → same output
- Cached for 7 days
- No duplicate OpenAI calls for identical requests

## Metrics & Logging

### Structured Logs (JSON)
```json
{
  "timestamp": "2025-12-09T10:30:00.000Z",
  "level": "info",
  "event": "pipeline_success",
  "requestId": "uuid",
  "userId": "user-123",
  "generationTimeMs": 8234,
  "activityCount": 12,
  "averageCompleteness": 0.78,
  "cached": false,
  "attempts": 1,
  "modelPasses": ["skeleton", "expand_temp0.6"]
}
```

### Metrics Counters
```typescript
{
  preset_generation_attempts_total: 100,
  preset_generation_success_total: 87,
  preset_generation_fallback_total: 13,
  preset_cache_hits_total: 45
}
```

## Testing

### Run Tests
```bash
npm test src/test/preset-pipeline.test.ts
```

### Test Coverage

#### Unit Tests
- ✅ `splitTask`: Activity splitting (12h → 2x6h)
- ✅ `postProcessAndScore`: Completeness calculation
- ✅ Schema validation with AJV

#### Integration Tests
- ✅ Full pipeline with mocked OpenAI
- ✅ Low completeness → retry with temp=0.8
- ✅ Retry failure → fallback preset
- ✅ Idempotency (cache hit on second request)

### Mock Example
```typescript
mockOpenAI.chat.completions.create
  .mockResolvedValueOnce({ /* skeleton response */ })
  .mockResolvedValueOnce({ /* expand response */ });
```

## Acceptance Criteria

Pipeline is considered successful when:

1. ✅ All unit tests pass
2. ✅ Integration tests pass with OpenAI mocked
3. ✅ Activities count: `AI_MIN_ACTIVITIES` ≤ count ≤ `AI_MAX_ACTIVITIES`
4. ✅ Every activity: `estimatedHours ≤ AI_MAX_HOURS`
5. ✅ Average completeness ≥ `AI_COMPLETENESS_THRESHOLD` OR fallback used
6. ✅ Redis cache keys set on success
7. ✅ `AI_ENABLED=false` returns catalog fallback without OpenAI call
8. ✅ Idempotency: Same request twice → second is cached (no OpenAI call)

## Troubleshooting

### Common Issues

#### 1. Redis Connection Error
```
Error: Redis connection failed
```
**Solution**: Check `REDIS_URL`, ensure Redis is running.

#### 2. Completeness Too Low
```
warn: completeness_threshold_failed, averageCompleteness: 0.45
```
**Solution**: Pipeline automatically retries with temp=0.8, then falls back to FALLBACK_PRESET.

#### 3. Activities Exceed MAX_HOURS
```
warn: oversized_activities_detected
```
**Solution**: Post-process automatically splits tasks using `splitTask()`.

#### 4. AJV Validation Failure
```
error: validation_failed, errors: ["activities[0].group: must be one of [...]"]
```
**Solution**: Check prompt outputs, ensure enum constraints match schema.

## Performance Benchmarks

| Stage | Avg Time | Max Time |
|-------|----------|----------|
| Cache Check | 5ms | 20ms |
| Skeleton (temp=0.0) | 3s | 8s |
| Expand (temp=0.6) | 8s | 25s |
| Post-Process | 100ms | 500ms |
| Validation | 10ms | 50ms |
| **Total (cache miss)** | **11s** | **35s** |
| **Total (cache hit)** | **50ms** | **200ms** |

## Migration from Old System

### Before (Catalog Selection)
```typescript
// AI selected from predefined catalog
activities: ["AUTH_JWT", "API_REST", "TEST_UNIT"]
```

### After (Custom Generation)
```typescript
// AI generates project-specific activities
activities: [
  {
    title: "Implement JWT validation middleware with Auth0",
    estimatedHours: 4,
    description: "...",
    acceptanceCriteria: [...]
  }
]
```

### Breaking Changes
- ❌ Removed: `generatePreset()` from `lib/ai/actions/generate-preset.ts`
- ❌ Removed: Supabase catalog loading
- ✅ Added: `generatePresetPipeline()` in `lib/ai/pipeline/preset-pipeline.ts`
- ✅ Changed: `checkRateLimit()` now returns `Promise<RateLimitResult>`

## Rollback Plan

If pipeline causes issues:

1. Set `AI_ENABLED=false` → Uses FALLBACK_PRESET
2. Set `AI_ENSEMBLE=false` → Uses direct generation (single-pass)
3. Revert to commit before pipeline implementation

## Future Enhancements

- [ ] Replace placeholder `encodeText()` with proper embedding model (OpenAI ada-002)
- [ ] Add vector similarity search for activity deduplication
- [ ] Implement distributed metrics (Prometheus, DataDog)
- [ ] Add A/B testing for temperature values
- [ ] Create admin dashboard for pipeline monitoring

## Support

For issues or questions:
- Check logs: `netlify dev` console output
- Review metrics: `getMetrics()` endpoint
- Test locally with: `AI_ENABLED=true npm test`
