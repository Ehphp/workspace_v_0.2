# Test di Consistenza AI

## 📋 Obiettivo

Misurare quanto il sistema AI è **consistente** quando analizza lo stesso requisito più volte.

**Perché è importante**:
- Verificare che l'AI suggerisca attività simili per lo stesso requisito
- Identificare variazioni problematiche
- Valutare l'impatto delle modifiche al sistema

---

## ⚠️ Importante

**Questi test chiamano l'API OpenAI reale e consumano token!**
- Disabilitati di default (`.skip`)
- Esegui solo quando necessario
- Costo: ~500-1000 token per test run

---

## 🎯 Quick Start

### Test Simulati (Gratuiti, No API)

```bash
# Esegue solo simulazioni locali
pnpm test aiVariance
```

Output mostra esempi di alta/media/bassa consistenza senza chiamare GPT.

### Test Reali (Consumano Token)

```bash
# 1. Apri src/test/aiVariance.test.ts
# 2. Rimuovi .skip da:
describe.skip('Single Requirement - Multiple Runs', () => {
# Diventa:
describe('Single Requirement - Multiple Runs', () => {

# 3. Verifica OPENAI_API_KEY configurato
# 4. Esegui:
pnpm test aiVariance
```

---

## 📊 Test Disponibili

### 1. Same Requirement - 5 Runs

Analizza lo stesso requisito 5 volte consecutive:

```typescript
Requirement: "Create user authentication system with login and registration"

Run 1: [REQ_ANALYSIS, DEV_BACKEND, DEV_FRONTEND, TEST_UNIT]
Run 2: [REQ_ANALYSIS, DEV_BACKEND, DEV_FRONTEND, TEST_UNIT, TEST_INTEG]
Run 3: [REQ_ANALYSIS, DEV_BACKEND, DEV_FRONTEND, TEST_UNIT]
Run 4: [REQ_ANALYSIS, DEV_BACKEND, DEV_FRONTEND, TEST_UNIT]
Run 5: [REQ_ANALYSIS, DEV_BACKEND, DEV_FRONTEND, TEST_UNIT]
```

**Metriche Calcolate**:
- Activity Frequency: Quante volte ogni attività appare
- Jaccard Similarity: Sovrapposizione tra run
- Average Consistency: Media delle similarity

### 2. Simple vs Complex Requirements

Confronta consistenza tra:

```typescript
// SEMPLICE
"Add a button to the homepage"
→ Expected: 2-3 activities, >85% consistency

// COMPLESSO
"Build complete e-commerce platform with payment, inventory, shipping"
→ Expected: 6-8 activities, 65-80% consistency
```

**Ipotesi**: Requisiti semplici = più consistenza.

### 3. Variance Simulation (Locale)

Mostra esempi di:
- **Alta consistenza** (>80%): AI molto stabile
- **Media consistenza** (60-80%): AI moderatamente stabile
- **Bassa consistenza** (<60%): AI variabile

---

## 📐 Metriche

### Jaccard Similarity

Misura sovrapposizione tra due set di attività:

```
Similarity = |Intersection| / |Union|

Esempio:
Run 1: {A, B, C, D}
Run 2: {B, C, D, E}

Intersection: {B, C, D} = 3
Union: {A, B, C, D, E} = 5
Similarity: 3/5 = 60%
```

**Interpretazione**:
- **>80%** = ✅ AI molto consistente
- **60-80%** = ⚠️ AI moderatamente consistente  
- **<60%** = ❌ AI inconsistente (problema!)

### Activity Frequency

Frequenza di suggerimento per ogni attività:

```
REQ_ANALYSIS: 5/5 (100%)  ← Core (sempre)
DEV_BACKEND: 5/5 (100%)   ← Core (sempre)
TEST_INTEG: 2/5 (40%)     ← Optional
DEPLOY: 0/5 (0%)          ← Mai suggerito
```

---

## 📈 Risultati Attesi

### Sistema Attuale (2025-11-21)

Con le ottimizzazioni implementate:

| Tipo Requisito | Jaccard Similarity | N° Attività | Varianza |
|----------------|-------------------|-------------|----------|
| **Semplice** | >85% | 2-4 | Bassa |
| **Standard** | 75-85% | 4-6 | Media |
| **Complesso** | 65-80% | 6-8 | Media-Alta |

### Fattori che Influenzano Consistenza

✅ **Aumentano Consistenza**:
- Temperature 0.0
- Prompt descrittivo e chiaro
- Structured outputs con enum
- Requisito ben definito
- Cache attiva (24h)

❌ **Diminuiscono Consistenza**:
- Temperature >0.0
- Prompt ambiguo
- Requisito vago
- Troppi codici attività disponibili

---

## 🔍 Analisi dei Risultati

### Esempio Output Completo

```
=== AI VARIANCE TEST ===
Requirement: "Create user authentication system..."
Runs: 5
Model: gpt-4o-mini
Temperature: 0.0

Run 1/5...
  Activities: [REQ_ANALYSIS, DEV_BACKEND, DEV_FRONTEND, TEST_UNIT]
  Count: 4
  
Run 2/5...
  Activities: [REQ_ANALYSIS, DEV_BACKEND, DEV_FRONTEND, TEST_UNIT, TEST_INTEG]
  Count: 5

[...]

=== VARIANCE ANALYSIS ===

Activity Frequency:
  REQ_ANALYSIS: 5/5 (100%)    ← Always suggested
  DEV_BACKEND: 5/5 (100%)
  DEV_FRONTEND: 5/5 (100%)
  TEST_UNIT: 5/5 (100%)
  TEST_INTEG: 1/5 (20%)       ← Sometimes

Jaccard Similarity (pairwise):
  Run 1 vs Run 2: 80%
  Run 1 vs Run 3: 100%
  Run 1 vs Run 4: 100%
  Run 1 vs Run 5: 100%
  [...]
  
Average Similarity: 87.5%
Min Similarity: 80.0%
Max Similarity: 100.0%

=== CONCLUSIONS ===
✅ AI is HIGHLY CONSISTENT (>80% similarity)
Core activities stable: REQ_ANALYSIS, DEV_BACKEND, DEV_FRONTEND, TEST_UNIT
Optional activities variable: TEST_INTEG (20%)
```

### Come Interpretare

| Avg Similarity | Interpretazione | Azione |
|---------------|-----------------|--------|
| **>85%** | ✅ Eccellente | Nessuna azione |
| **75-85%** | ✅ Buono | Monitor |
| **60-75%** | ⚠️ Accettabile | Investigare |
| **<60%** | ❌ Problema | Fix necessario |

---

## 🛠️ Troubleshooting

### Consistenza Bassa (<60%)

**Possibili Cause**:

1. **Temperature troppo alta**
   - Verifica: `netlify/functions/ai-suggest.ts` → `temperature: 0.0`
   - Fix: Abbassa a 0.0

2. **Requisito ambiguo**
   - Esempio: "make it better" (troppo vago)
   - Fix: Riformula con verbo d'azione + contesto

3. **Prompt modificato**
   - Verifica: Confronta prompt con versione baseline
   - Fix: Ripristina prompt standard

4. **Cache disabilitata**
   - Effetto: Ogni richiesta = nuova chiamata API
   - Note: Cache migliora consistenza nella stessa finestra 24h

### Test Non Parte

```bash
# Verifica API key
echo $env:OPENAI_API_KEY  # Windows PowerShell

# Verifica che .skip sia rimosso
# In src/test/aiVariance.test.ts
```

### Rate Limit Error

```typescript
// Aumenta delay tra chiamate (in test file)
await new Promise(resolve => setTimeout(resolve, 2000)); // 2s
```

### Timeout Error

```typescript
// Aumenta timeout test
it('should test variance', async () => {
  // ...
}, 120000); // 120 secondi
```

---

## ✅ Best Practices

### 1. Quando Eseguire Test

Esegui test variance quando:
- ✅ Modifichi prompt GPT
- ✅ Cambi temperature
- ✅ Aggiorni modello OpenAI
- ✅ Noti risultati strani in produzione
- ✅ Dopo deploy major

**Non eseguire**:
- ❌ In CI/CD automatico (costa token)
- ❌ Troppo frequentemente (spreco)

### 2. Conserva Risultati

Salva log per confronti futuri:

```bash
pnpm test aiVariance > test-results-$(date +%Y%m%d).txt
```

### 3. Confronta Nel Tempo

```bash
# Prima della modifica
pnpm test aiVariance > before.txt

# Dopo la modifica
pnpm test aiVariance > after.txt

# Confronta
diff before.txt after.txt
```

### 4. Monitora Costi

```
5 runs × ~1000 token/run = ~5000 token/test
A $0.0015/1k token = ~$0.0075 per test completo
```

---

## 🎓 Esempi Pratici

### Test Dopo Modifica Prompt

```typescript
// Scenario: Hai modificato il system prompt
// Goal: Verificare che consistency non peggiori

// 1. Esegui test con prompt vecchio (baseline)
const baselineResults = await runVarianceTest();
// Avg Similarity: 85%

// 2. Applica modifica prompt

// 3. Esegui test con prompt nuovo
const newResults = await runVarianceTest();
// Avg Similarity: 83%

// 4. Confronta
if (newResults.avgSimilarity < baselineResults.avgSimilarity - 5) {
  console.warn('⚠️ Consistency degraded! Review changes.');
}
```

### Test Requisiti Edge Case

```typescript
// Test con requisiti problematici
const edgeCases = [
  "test",                    // Input di test
  "make it better",          // Troppo vago
  "aaaaaa",                  // Gibberish
  "requisito molto complesso con tante feature", // Complesso
];

for (const req of edgeCases) {
  const result = await testVariance(req);
  console.log(`${req}: ${result.similarity}%`);
}
```

---

## 📚 Riferimenti

- **`ai-system-overview.md`** - Come funziona il sistema AI
- **`ai-input-validation.md`** - Validazione e sicurezza
- **`src/test/aiVariance.test.ts`** - Codice test

---

## ❓ FAQ

**Q: Quanto è normale la varianza?**  
A: 70-85% è accettabile per requisiti standard. <60% indica problema.

**Q: Devo eseguire questi test spesso?**  
A: No, solo quando modifichi AI o noti anomalie.

**Q: Posso automatizzare in CI/CD?**  
A: No, costano troppi token. Solo manualmente quando serve.

**Q: Come miglioro la consistenza?**  
A: Temperature 0.0, prompt chiaro, requisiti ben definiti.

**Q: Cache influenza risultati?**  
A: Sì, nella stessa finestra 24h la cache garantisce consistenza 100%.

**Q: Cosa significa "varianza accettabile"?**  
A: Attività core (REQ_ANALYSIS, DEV_*) sempre presenti, attività opzionali (TEST_INTEG, DEPLOY) possono variare.

---

**Versione**: 1.0  
**Data Creazione**: 2025-11-21  
**Ultima Modifica**: 2025-11-21  
**Maintainer**: Development Team
