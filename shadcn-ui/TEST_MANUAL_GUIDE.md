# Test Plan - Estimation Consistency Fix

## 🧪 Test Manual Guide

**Server Status**: ✅ Running on http://localhost:63887  
**Date**: 19 Novembre 2025  
**Tester**: _____________________

---

## 📋 Pre-Test Checklist

- [x] Server dev running (localhost:63887)
- [x] Netlify function `ai-suggest` loaded
- [ ] Browser cache cleared (Ctrl+Shift+Del)
- [ ] Logged into application
- [ ] Test requirement created/available

---

## 🎯 TEST 1: Consistenza tra Flussi

**Obiettivo**: Verificare che tutti i flussi AI producano lo stesso risultato

### Setup
1. Creare o usare requisito esistente con ID: `REQ-001`
2. Descrizione requisito: **"dv"** (o altro requisito breve)
3. Preset: **"Power Platform - Standard"**
4. **IMPORTANTE**: Annotare timestamp di ogni test per verificare cache

### Test 1A: Quick Estimate Dialog (Homepage)

**Steps**:
1. Vai a homepage (http://localhost:63887)
2. Click su "Quick Estimate"
3. Inserisci:
   - Description: `dv`
   - Technology: `Power Platform - Standard`
4. Click "Calculate"
5. Attendere risposta AI

**Risultati da Annotare**:
```
Test 1A - Quick Estimate Dialog
Timestamp: __:__:__
Total Days: _____ days
Activities Count: _____ 
Activity Codes: [_________, _________, _________]
Driver Multiplier: _____ (expected: 1.0)
Risk Score: _____ (expected: 0)
Contingency: _____ % (expected: 10%)
AI Reasoning: _________________________________
```

**Expected Result**: ~3.3 days (può variare leggermente)

---

### Test 1B: Quick Estimate Button (Requirement Detail)

**Steps**:
1. Vai a Requirements → Lista → Apri requisito "REQ-001" (o simile)
2. Verifica che:
   - Description = "dv"
   - Tech preset = "Power Platform - Standard"
3. Click su pulsante "⚡ Quick Estimate" nell'header
4. Attendere completamento
5. Vai al tab "Estimation"
6. Verifica selezioni applicate

**Risultati da Annotare**:
```
Test 1B - Quick Estimate Button
Timestamp: __:__:__
Tab switched to: Estimation (✓/✗)
Activities Selected: _____ 
Activity Codes: [_________, _________, _________]
Drivers Selected: _____ (expected: 0)
Risks Selected: _____ (expected: 0)
Total Days (right panel): _____ days
Driver Multiplier: _____ (expected: 1.0)
Risk Score: _____ (expected: 0)
```

**Expected Result**: 
- Same activities as Test 1A ✅
- NO drivers selected ✅
- NO risks selected ✅
- Total Days ≈ Test 1A (variance < 5%) ✅

---

### Test 1C: Bulk Estimate (Requirements List)

**Steps**:
1. Vai a Requirements
2. Seleziona lista con requisito "REQ-001"
3. Click "Estimate All"
4. Conferma stima bulk
5. Attendere completamento
6. Verificare risultato salvato

**Risultati da Annotare**:
```
Test 1C - Bulk Estimate
Timestamp: __:__:__
Requirements Estimated: _____
Success Count: _____
Failed Count: _____
REQ-001 Total Days: _____ days
REQ-001 Activity Codes: [_________, _________, _________]
```

**Expected Result**:
- Same total days as Test 1A/1B ✅
- Status: Success ✅

---

### ✅ Test 1 - Validation

Calcola variance:
```
Max = max(Test1A, Test1B, Test1C)
Min = min(Test1A, Test1B, Test1C)
Variance = ((Max - Min) / Min) * 100

Expected: Variance < 5%
Actual: Variance = _____%

Result: PASS / FAIL
```

---

## 🔄 TEST 2: Cache Consistency (24 ore)

**Obiettivo**: Verificare che la cache funzioni correttamente

### Test 2A: Prima Stima (Cache Miss)

**Steps**:
1. **CLEAR BROWSER CACHE** (importante!)
2. Restart Netlify functions (Ctrl+C → riavvia server)
3. Esegui Quick Estimate Dialog con:
   - Description: `"Aggiornare la lettera con aggiunta frase"`
   - Preset: `Power Platform - Standard`

**Risultati**:
```
Test 2A - Cache Miss
Timestamp: __:__:__
Total Days: _____ days
Activity Codes: [_________, _________, _________]
Console log: "Using cached AI suggestion" (YES/NO): _____
Expected: NO (cache miss)
```

---

### Test 2B: Seconda Stima (Cache Hit)

**Steps**:
1. **NON** cancellare cache
2. **NON** riavviare server
3. Esegui Quick Estimate Dialog con:
   - Description: `"Aggiornare la lettera con aggiunta frase"` (IDENTICA)
   - Preset: `Power Platform - Standard` (IDENTICO)

**Risultati**:
```
Test 2B - Cache Hit (entro 5 min da 2A)
Timestamp: __:__:__
Total Days: _____ days
Activity Codes: [_________, _________, _________]
Console log: "Using cached AI suggestion" (YES/NO): _____
Expected: YES (cache hit)
```

**Validation**:
```
Test 2A Result: _____ days, [_____, _____, _____]
Test 2B Result: _____ days, [_____, _____, _____]

Are they identical? YES / NO
Expected: YES (exact match)

Result: PASS / FAIL
```

---

### Test 2C: Cache Invalidation

**Steps**:
1. Restart Netlify functions (Ctrl+C → `pnpm run dev:netlify`)
2. Attendere "Loaded function ai-suggest"
3. Esegui Quick Estimate Dialog (stessa descrizione)

**Risultati**:
```
Test 2C - After Restart (Cache cleared)
Timestamp: __:__:__
Total Days: _____ days
Activity Codes: [_________, _________, _________]
Console log: "Using cached AI suggestion" (YES/NO): _____
Expected: NO (cache cleared)
```

**Validation**:
```
Test 2A Result: _____ days
Test 2C Result: _____ days

Difference: _____ days
Variance %: ((|A - C| / A) * 100) = _____%

Expected: Variance < 10% (small AI variation acceptable)
Result: PASS / FAIL
```

---

## 🎲 TEST 3: AI Determinism (Temperature 0.0)

**Obiettivo**: Verificare che temperature 0.0 riduca variabilità

### Test 3 - Multiple Runs

**Steps**:
1. Per ogni iterazione:
   - Restart Netlify functions (svuota cache)
   - Quick Estimate con descrizione: `"Create user login form"`
   - Annotare risultato

**Risultati**:
```
Run 1:
Timestamp: __:__:__
Total Days: _____ days
Activity Codes: [_________, _________, _________]

Run 2:
Timestamp: __:__:__
Total Days: _____ days
Activity Codes: [_________, _________, _________]

Run 3:
Timestamp: __:__:__
Total Days: _____ days
Activity Codes: [_________, _________, _________]

Run 4:
Timestamp: __:__:__
Total Days: _____ days
Activity Codes: [_________, _________, _________]

Run 5:
Timestamp: __:__:__
Total Days: _____ days
Activity Codes: [_________, _________, _________]
```

**Validation**:
```
Unique Total Days values: _____ (Expected: ≤ 2)
Unique Activity Sets: _____ (Expected: ≤ 2)

Most common result:
- Total Days: _____ days (appeared ____ times)
- Activities: [_____, _____, _____]

Result: PASS / FAIL
Explanation: ________________________________
```

---

## 🔍 TEST 4: Regression - Apply Template & AI Suggest

**Obiettivo**: Verificare che Apply Template e AI Suggest funzionino ancora correttamente

### Test 4A: Apply Template

**Steps**:
1. Apri requisito dettaglio
2. Tab Estimation
3. Seleziona preset: "Power Platform - Standard"
4. Click "Apply Template"
5. Verificare selezioni applicate

**Risultati**:
```
Test 4A - Apply Template
Activities Selected: _____ (Expected: > 0)
Drivers Selected: _____ (Expected: > 0)
Risks Selected: _____ (Expected: > 0)
Total Days: _____ days

Result: PASS / FAIL
```

---

### Test 4B: AI Suggest

**Steps**:
1. Stesso requisito di Test 4A
2. Click "AI Suggest"
3. Attendere risposta
4. Verificare che:
   - Activities sostituite con AI suggestions
   - Drivers MANTENUTI (non modificati)
   - Risks MANTENUTI (non modificati)

**Risultati**:
```
Test 4B - AI Suggest
Activities: Changed (YES/NO): _____
Drivers: Preserved (YES/NO): _____ (Expected: YES)
Risks: Preserved (YES/NO): _____ (Expected: YES)
Total Days: _____ days

Result: PASS / FAIL
```

---

## 📊 TEST SUMMARY

### Results Table

| Test ID | Test Name | Expected | Actual | Status |
|---------|-----------|----------|--------|--------|
| 1A | Quick Estimate Dialog | ~3.3d | _____ | ⬜ |
| 1B | Quick Estimate Button | ≈1A | _____ | ⬜ |
| 1C | Bulk Estimate | ≈1A | _____ | ⬜ |
| 1 Variance | Consistency | <5% | ____% | ⬜ |
| 2A | Cache Miss | NO cache | _____ | ⬜ |
| 2B | Cache Hit | YES cache | _____ | ⬜ |
| 2C | Cache Invalidation | <10% var | ____% | ⬜ |
| 3 | AI Determinism | ≤2 unique | _____ | ⬜ |
| 4A | Apply Template | Works | _____ | ⬜ |
| 4B | AI Suggest | Works | _____ | ⬜ |

### Overall Status

- ✅ Tests Passed: ____ / 10
- ❌ Tests Failed: ____ / 10
- ⚠️ Tests Skipped: ____ / 10

**Final Result**: PASS / FAIL / PARTIAL

---

## 🐛 Issues Found

| Issue # | Test | Description | Severity | Action Required |
|---------|------|-------------|----------|-----------------|
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |

---

## 📝 Notes & Observations

```
[Spazio per annotazioni libere]








```

---

## ✅ Sign-off

- **Tested by**: ____________________
- **Date**: ___ / ___ / 2025
- **Time spent**: _____ minutes
- **Recommendation**: DEPLOY / DO NOT DEPLOY / NEEDS FIX

**Next Steps**:
1. [ ] Review issues found
2. [ ] Create GitHub issues for bugs
3. [ ] Update documentation if needed
4. [ ] Deploy to staging
5. [ ] Production deployment (after staging OK)

---

**Test Plan Version**: 1.0  
**Last Updated**: 19 November 2025
