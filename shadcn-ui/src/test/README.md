# Test Suite Documentation

## Overview

This directory contains the test suite for the Requirements Estimation System, with focus on **AI determinism improvements** (Phase 1 & 2).

---

## Test Files

### 1. `aiStructuredOutputs.test.ts` ✅ NEW

**Purpose:** Automated testing for AI Phase 1 & 2 improvements

**Coverage:**
- Structured outputs validation (Phase 2)
- Descriptive prompts verification (Phase 1)
- Schema enforcement testing
- Enum constraint validation
- Backward compatibility
- Performance benchmarks
- Error handling
- UI integration

**Test Count:** 18 (14 simulated + 4 API)

**Run:**
```bash
# Free tests only (default)
npm test -- src/test/aiStructuredOutputs.test.ts

# All tests including API calls (~$0.04)
# First remove .skip from line 185, then:
npm test -- src/test/aiStructuredOutputs.test.ts --run
```

**Status:** ✅ All tests passing

---

### 2. `aiVariance.test.ts`

**Purpose:** Measure consistency of AI suggestions across multiple calls

**Coverage:**
- Variance measurement across 10 identical requests
- Consistency scoring
- Activity suggestion stability

**Test Count:** Variable (skipped by default)

**Run:**
```bash
npm test -- src/test/aiVariance.test.ts
```

**Note:** Calls real API, costs ~$0.10 per run

---

### 3. `estimationConsistency.test.ts`

**Purpose:** Validate estimation engine consistency

**Coverage:**
- Estimation calculations
- Driver multipliers
- Risk scoring
- Total effort computation

**Test Count:** Multiple

**Run:**
```bash
npm test -- src/test/estimationConsistency.test.ts
```

---

### 4. `estimationHistory.test.tsx`

**Purpose:** Test estimation history UI component

**Coverage:**
- Component rendering
- Data display
- User interactions
- State management

**Test Count:** Multiple

**Run:**
```bash
npm test -- src/test/estimationHistory.test.tsx
```

---

### 5. `setup.ts` & `setup.test.ts`

**Purpose:** Test environment configuration

**Files:**
- `setup.ts` - Global test setup (Vitest config)
- `setup.test.ts` - Verify setup works

**Run:**
```bash
npm test -- src/test/setup.test.ts
```

---

## Test Categories

### 🆓 Free Tests (Mock/Simulated)
- Schema validation
- Type checking
- Backward compatibility
- Performance benchmarks
- Error handling
- UI integration

**Cost:** $0  
**Run Frequency:** Every commit

### 💰 Paid Tests (Real API)
- OpenAI API integration
- Real-world response validation
- Network error handling
- Rate limiting

**Cost:** ~$0.04-0.10 per run  
**Run Frequency:** Before releases

---

## Quick Start

### Run All Tests
```bash
cd workspace/shadcn-ui
npm test
```

### Run Specific Test File
```bash
npm test -- src/test/aiStructuredOutputs.test.ts
```

### Run Tests in Watch Mode
```bash
npm test -- --watch
```

### Run Tests with Coverage
```bash
npm test -- --coverage
```

---

## Test Documentation

### Main Documentation Files
1. `AUTOMATED_TEST_RESULTS.md` - Detailed test results analysis
2. `MANUAL_API_TEST_GUIDE.md` - Guide for running API tests
3. `TESTING_AUTOMATION_SUMMARY.md` - Complete testing overview
4. `AI_DETERMINISM_IMPROVEMENT_PLAN.md` - Technical roadmap

### Test Plans
1. `TEST_PLAN_AI_PHASE1.md` - Manual test plan for Phase 1
2. `TEST_MANUAL_GUIDE.md` - Manual testing procedures

---

## Writing New Tests

### Template Structure
```typescript
import { describe, it, expect } from 'vitest';

describe('Feature Name', () => {
    
    describe('Test Category', () => {
        
        it('should do something specific', () => {
            // Arrange
            const input = 'test';
            
            // Act
            const result = someFunction(input);
            
            // Assert
            expect(result).toBe('expected');
        });
        
    });
    
});
```

### Best Practices
1. **Descriptive Names:** Use clear, action-oriented test names
2. **Single Assertion:** One concept per test (when possible)
3. **Mock Data:** Use realistic mock data matching production schema
4. **Comments:** Explain WHY, not WHAT
5. **Skip Expensive Tests:** Use `.skip` for tests that cost money
6. **Italian Support:** Test with Italian text when applicable

---

## Test Data

### Mock Activities (Power Platform)
```typescript
const mockActivities: Activity[] = [
    { code: 'PP_ANL_ALIGN', name: 'Allineamento analisi', ... },
    { code: 'PP_DV_FIELD', name: 'Creazione campi', ... },
    { code: 'PP_DV_FORM', name: 'Configurazione form', ... },
    // ... more activities
];
```

### Mock Drivers
```typescript
const mockDrivers: Driver[] = [
    { code: 'COMPLEXITY', name: 'Complessità', options: [...] },
];
```

### Mock Risks
```typescript
const mockRisks: Risk[] = [
    { code: 'INTEGRATION', name: 'Rischi Integrazione', ... },
];
```

---

## CI/CD Integration

### GitHub Actions (Future)
```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - run: npm install
      - run: npm test -- --run
```

### Pre-commit Hook (Future)
```bash
# .husky/pre-commit
npm test -- --run
```

---

## Troubleshooting

### Test Fails: "Cannot find module"
**Solution:** Run `npm install`

### Test Fails: "OpenAI API key not found"
**Solution:** Check `netlify/.env` has `OPENAI_API_KEY`

### Test Fails: "Timeout"
**Solution:** Increase timeout in test:
```typescript
it('test name', async () => {
    // ...
}, 15000); // 15s instead of 10s
```

### Test Skipped: "API Integration"
**Solution:** Remove `.skip` from describe block (costs ~$0.04)

---

## Test Metrics

### Current Coverage
- **Schema Validation:** ✅ 100%
- **API Integration:** ⏸️ Skipped (available)
- **Backward Compatibility:** ✅ 100%
- **Performance:** ✅ 100%
- **Error Handling:** ✅ 100%
- **UI Integration:** ✅ 100%

### Test Statistics
- **Total Test Files:** 5
- **Total Test Cases:** ~40+
- **Automated Tests:** 18 (AI Phase 2)
- **Execution Time:** ~1-2s (simulated), ~15s (with API)
- **Cost per Run:** $0 (simulated), ~$0.04 (with API)

---

## Roadmap

### Phase 1 & 2 ✅ COMPLETE
- [x] Descriptive prompts
- [x] Structured outputs
- [x] Enum validation
- [x] Automated tests

### Phase 3 (Future)
- [ ] Deterministic seeding
- [ ] Canvas API integration
- [ ] Full determinism guarantee

### Testing Improvements (Future)
- [ ] Increase code coverage to 90%+
- [ ] Add integration tests with Supabase
- [ ] Performance regression tests
- [ ] CI/CD pipeline integration
- [ ] Visual regression testing (UI)

---

## Resources

### Internal Docs
- [AI Determinism Plan](../AI_DETERMINISM_IMPROVEMENT_PLAN.md)
- [Test Results](../AUTOMATED_TEST_RESULTS.md)
- [Manual Test Guide](../MANUAL_API_TEST_GUIDE.md)

### External Resources
- [Vitest Documentation](https://vitest.dev/)
- [OpenAI Structured Outputs](https://platform.openai.com/docs/guides/structured-outputs)
- [TypeScript Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)

---

## Contact

For questions about testing:
1. Review documentation in `*.md` files
2. Check test comments for specific test logic
3. Run tests locally to reproduce issues

---

**Last Updated:** 2025-11-28  
**Test Framework:** Vitest  
**Status:** ✅ All Tests Passing  
**Coverage:** Phase 1 & 2 Complete
