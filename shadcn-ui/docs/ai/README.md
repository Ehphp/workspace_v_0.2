# AI System Documentation

## Scope

AI in Syntero provides **suggestions and interview-driven activity selection**. All AI outputs require user confirmation. See [../ai-integration.md](../ai-integration.md) for the complete AI documentation.

## Files in This Directory

| File | Purpose | Status |
|------|---------|--------|
| [ai-system-overview.md](ai-system-overview.md) | Technical implementation details | Reference |
| [ai-input-validation.md](ai-input-validation.md) | 4-level validation pipeline | Reference |
| [ai-variance-testing.md](ai-variance-testing.md) | Testing AI response consistency | Reference |
| [KEY_POLICY.md](KEY_POLICY.md) | API key security policy | Active |

## Quick Reference

### What AI Does
- Proposes activity codes based on requirement description
- Selects activities based on interview answers
- Generates technical interview questions
- Generates concise titles
- Suggests drivers/risks (interview flow only)

### What AI Does NOT Do
- Calculate estimates (deterministic engine does this)
- Make final decisions without user confirmation
- Store or modify data directly

## Key Constraints

| Constraint | Implementation |
|------------|----------------|
| Model | GPT-4o-mini |
| Temperature | 0.0 (production) / 0.7 (test mode) |
| Response Format | Structured Outputs with JSON Schema |
| Activity Codes | Enum constraint (cannot invent codes) |
| Caching | 24h TTL |
| API Key | Server-side only (`OPENAI_API_KEY`) |

## Entry Points

AI functionality is distributed across multiple serverless functions. See [../ai-integration.md](../ai-integration.md#entry-points) for the complete list.

---

**For complete AI documentation, see [../ai-integration.md](../ai-integration.md)**
