# How to Run Manual API Tests

## Overview

I test automatizzati in `aiStructuredOutputs.test.ts` includono 4 test che chiamano l'API OpenAI reale. Questi test sono **skippati di default** per evitare costi, ma dovrebbero essere eseguiti manualmente **prima del deployment in produzione**.

---

## Cost Estimate

- **4 test API calls** × ~$0.01 per call = **~$0.04 total**
- Token usage: ~200-300 tokens per request (prompt + completion)
- Model: GPT-4o-mini (cheapest option)

---

## Prerequisites

1. **OpenAI API Key configurata**:
   ```bash
   # Verifica che la chiave API sia presente
   cat netlify/.env
   # Oppure
   echo $OPENAI_API_KEY
   ```

2. **Dipendenze installate**:
   ```bash
   cd workspace/shadcn-ui
   npm install
   ```

3. **Netlify Functions funzionanti**:
   ```bash
   # Test locale (opzionale)
   netlify dev
   ```

---

## How to Run

### Step 1: Enable API Tests

Apri il file di test e **rimuovi `.skip`** dalla riga 185:

```typescript
// File: src/test/aiStructuredOutputs.test.ts

// BEFORE (skipped):
describe.skip('API Integration - Real OpenAI Calls', () => {

// AFTER (enabled):
describe('API Integration - Real OpenAI Calls', () => {
```

### Step 2: Run Tests

```bash
cd workspace/shadcn-ui
npm test -- src/test/aiStructuredOutputs.test.ts
```

### Step 3: Review Results

Dovresti vedere output simile a:

```
✓ API Integration - Real OpenAI Calls (4)
  ✓ should return valid structured output for simple requirement (2000ms)
  ✓ should reject invalid requirement (1500ms)
  ✓ should handle complex requirement (2500ms)
  ✓ should never return codes outside enum (guaranteed by structured outputs) (8000ms)

Test Files  1 passed (1)
     Tests  18 passed (18)
  Duration  ~15s
```

---

## Expected Behavior

### Test 1: Simple Requirement ✅

**Input:** `"Aggiungere campo email al form utente"`

**Expected Response:**
```json
{
  "isValidRequirement": true,
  "activityCodes": ["PP_ANL_ALIGN", "PP_DV_FIELD", "PP_DV_FORM"],
  "reasoning": "Per aggiungere un campo email..."
}
```

**Validates:**
- `isValidRequirement` is `true`
- `activityCodes` is non-empty array
- All codes are from valid enum
- `reasoning` is present

---

### Test 2: Invalid Requirement ✅

**Input:** `"test"`

**Expected Response:**
```json
{
  "isValidRequirement": false,
  "activityCodes": [],
  "reasoning": "La descrizione è troppo vaga..."
}
```

**Validates:**
- `isValidRequirement` is `false`
- `activityCodes` is empty array
- `reasoning` explains why invalid

---

### Test 3: Complex Requirement ✅

**Input:** `"Implementare sistema di autenticazione completo con login, registrazione, password reset e audit log"`

**Expected Response:**
```json
{
  "isValidRequirement": true,
  "activityCodes": ["PP_ANL_ALIGN", "PP_DV_FIELD", "PP_DV_FORM", "PP_E2E_TEST", "PP_DEPLOY", "CRS_DOC"],
  "reasoning": "Sistema complesso che richiede..."
}
```

**Validates:**
- More than 3 activity codes
- All codes from valid enum
- Complex requirement handled correctly

---

### Test 4: Enum Guarantee (5 Requests) ✅

**Inputs:**
1. `"Aggiungere campo"`
2. `"Modificare form"`
3. `"Creare workflow"`
4. `"Integrare API"`
5. `"Deploy soluzione"`

**Validates:**
- **CRITICAL:** No codes outside enum across all 5 requests
- Structured outputs guarantee applied consistently
- No invented/invalid codes

---

## Troubleshooting

### Error: "OpenAI API key not found"

**Cause:** Missing `OPENAI_API_KEY` environment variable

**Solution:**
```bash
# Crea file .env in netlify/
cd workspace/shadcn-ui/netlify
echo "OPENAI_API_KEY=sk-your-key-here" > .env
```

### Error: "Request timeout"

**Cause:** API call takes >10s (default timeout)

**Solution:** Increase timeout in test:
```typescript
it('should return valid...', async () => {
  // ...
}, 15000); // 15s timeout instead of 10s
```

### Error: "Rate limit exceeded"

**Cause:** Too many requests to OpenAI API

**Solution:** Wait 60s and retry, or reduce test count

### Error: "Insufficient credits"

**Cause:** OpenAI account has no credits

**Solution:** Add credits to OpenAI account at https://platform.openai.com/account/billing

---

## Interpreting Results

### ✅ All Tests Pass

**Meaning:** Phase 2 implementation is working correctly:
- Structured outputs enforcing schema
- Enum constraint preventing invalid codes
- Valid/invalid requirement detection working
- Complex requirements handled

**Next Step:** Deploy to production

---

### ❌ Test Failures

#### Test 1/2/3 Fails: Single Requirement Issue

**Likely Cause:** API issue, network error, or prompt change

**Debug Steps:**
1. Check Netlify Functions logs
2. Verify API key is valid
3. Test with Postman/curl directly
4. Check OpenAI API status page

#### Test 4 Fails: Enum Constraint Violated

**Likely Cause:** 🚨 **CRITICAL** - Structured outputs not working

**Debug Steps:**
1. Verify OpenAI SDK version (6.9.0+)
2. Check `response_format` in `ai-suggest.ts`:
   ```typescript
   response_format: {
     type: "json_schema",
     json_schema: {
       name: "activity_suggestion",
       strict: true,  // ← Must be true
       schema: createActivitySchema(validActivityCodes)
     }
   }
   ```
3. Verify `createActivitySchema()` returns valid JSON schema
4. Test with single request first

---

## Post-Test Actions

### If All Tests Pass ✅

1. **Re-skip API Tests** (to avoid future costs):
   ```typescript
   describe.skip('API Integration - Real OpenAI Calls', () => {
   ```

2. **Document Results**:
   ```bash
   # Add to AUTOMATED_TEST_RESULTS.md:
   # "Manual API tests executed on [DATE] - All passed ✅"
   ```

3. **Deploy to Production**:
   ```bash
   cd workspace/shadcn-ui
   npm run build
   netlify deploy --prod
   ```

4. **Monitor Production**:
   - Check Netlify Functions logs
   - Verify no schema validation errors
   - Collect user feedback

### If Tests Fail ❌

1. **DO NOT DEPLOY** to production
2. Debug using steps above
3. Review Phase 2 implementation in `ai-suggest.ts`
4. Check OpenAI API documentation for breaking changes
5. Re-run tests after fixes

---

## Best Practices

### Before Production Deployment

- [ ] Run manual API tests at least once
- [ ] Verify all 4 tests pass
- [ ] Test with diverse requirement types
- [ ] Check response times (<3s expected)
- [ ] Verify reasoning is in Italian

### After Deployment

- [ ] Monitor Netlify Functions logs (first 24h)
- [ ] Check for schema validation errors
- [ ] Collect user feedback on suggestions
- [ ] Track API latency metrics

### Cost Management

- Skip API tests during development (use simulated tests)
- Run API tests only before major releases
- Limit test iterations to 1-2 runs
- Use GPT-4o-mini (cheapest model)

---

## Alternative: Manual Curl Testing

Se preferisci testare l'API direttamente senza Vitest:

```bash
# Test locale con Netlify Dev
cd workspace/shadcn-ui
netlify dev

# In altra terminale, testa l'endpoint:
curl -X POST http://localhost:8888/.netlify/functions/ai-suggest \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Aggiungere campo email",
    "activities": [{"id": "1", "code": "PP_DV_FIELD", "name": "Campo", ...}],
    "drivers": [],
    "risks": [],
    "preset": {"tech_category": "POWER_PLATFORM"}
  }'
```

---

## Summary

| Test Type | Count | Cost | Run Frequency | Required? |
|-----------|-------|------|---------------|-----------|
| Simulated | 14 | Free | Every commit | Yes |
| API Tests | 4 | ~$0.04 | Before releases | Recommended |
| Manual Curl | N/A | ~$0.01/req | Debug only | Optional |

**Total Cost:** ~$0.04 per full test suite execution

**Recommendation:** Run API tests **1x before production deployment**, then rely on simulated tests for day-to-day development.

---

**Generated:** Manual Testing Guide for AI Structured Outputs  
**Version:** Phase 2 Complete  
**Last Updated:** 2024
