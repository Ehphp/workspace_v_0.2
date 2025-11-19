# Guida ai Test di Varianza AI

## Obiettivo

Misurare quanto GPT è **consistente** quando analizza lo stesso requisito più volte. Questo è importante per capire:
- Se l'AI suggerisce sempre le stesse attività per lo stesso requisito
- Quanto varia tra diverse esecuzioni
- Se requisiti semplici hanno più consistenza di quelli complessi

## File di Test

`src/test/aiVariance.test.ts`

## ⚠️ IMPORTANTE

**Questi test chiamano l'API OpenAI reale e consumano token!**
- Sono disabilitati di default (`.skip`)
- Eseguili solo quando necessario
- Ogni run costa circa 500-1000 token

## Come Eseguire i Test

### Test con API Reale (costa token!)

```bash
# 1. Apri il file src/test/aiVariance.test.ts
# 2. Rimuovi .skip dalle righe:
#    describe.skip('Single Requirement - Multiple Runs', () => {
#    diventa:
#    describe('Single Requirement - Multiple Runs', () => {

# 3. Assicurati che OPENAI_API_KEY sia configurato
# 4. Esegui:
pnpm test aiVariance
```

### Test Simulati (gratuito, no API)

```bash
# Esegue solo i test locali senza chiamare GPT
pnpm test aiVariance
```

## Test Disponibili

### 1. **Same Requirement - 5 Runs** (API reale)

Analizza lo stesso requisito 5 volte consecutive e misura:

```typescript
Requirement: "Create a user authentication system with login, registration, password reset, and email verification"

Run 1: [REQ_ANALYSIS, DEV_BACKEND, DEV_FRONTEND, TEST_UNIT]
Run 2: [REQ_ANALYSIS, DEV_BACKEND, DEV_FRONTEND, TEST_UNIT, TEST_INTEG]
Run 3: [REQ_ANALYSIS, DEV_BACKEND, DEV_FRONTEND, TEST_UNIT]
Run 4: [REQ_ANALYSIS, DESIGN_UI, DEV_BACKEND, DEV_FRONTEND, TEST_UNIT]
Run 5: [REQ_ANALYSIS, DEV_BACKEND, DEV_FRONTEND, TEST_UNIT]

Variance Analysis:
  REQ_ANALYSIS: 5/5 (100%)    ← Sempre suggerito
  DEV_BACKEND: 5/5 (100%)     ← Sempre suggerito
  DEV_FRONTEND: 5/5 (100%)    ← Sempre suggerito
  TEST_UNIT: 5/5 (100%)       ← Sempre suggerito
  DESIGN_UI: 1/5 (20%)        ← Raro
  TEST_INTEG: 1/5 (20%)       ← Raro

Average Jaccard Similarity: 87.5%
```

**Interpretazione:**
- **>80% similarity** = AI molto consistente ✅
- **60-80% similarity** = AI moderatamente consistente ⚠️
- **<60% similarity** = AI inconsistente ❌

### 2. **Simple vs Complex Requirements** (API reale)

Confronta la consistenza tra:

```typescript
// Requisito SEMPLICE
"Add a button to the homepage"
→ Expected: 2-3 activities, alta consistenza

// Requisito COMPLESSO  
"Build a complete e-commerce platform..."
→ Expected: 6-8 activities, media consistenza
```

**Ipotesi:** Requisiti semplici dovrebbero avere **più consistenza** di quelli complessi.

### 3. **Variance Simulation** (locale, no API)

Simula scenari di varianza senza chiamare l'API:

- **Alta consistenza**: AI suggerisce sempre le stesse cose
- **Media consistenza**: AI varia leggermente
- **Bassa consistenza**: AI molto variabile

## Metriche Calcolate

### Jaccard Similarity

Misura la sovrapposizione tra due set:

```
Similarity = |Intersection| / |Union|

Esempio:
Run 1: {A, B, C, D}
Run 2: {B, C, D, E}

Intersection: {B, C, D} = 3 elementi
Union: {A, B, C, D, E} = 5 elementi
Similarity: 3/5 = 60%
```

### Activity Frequency

Quante volte ogni attività appare:

```
REQ_ANALYSIS: 5/5 (100%) → Core activity
TEST_INTEG: 2/5 (40%)    → Optional activity  
DEPLOY: 0/5 (0%)         → Never suggested
```

### Driver Variance

Varianza nei valori dei driver:

```
COMPLEXITY:
  HIGH: 3/5 (60%)
  MEDIUM: 2/5 (40%)
  LOW: 0/5 (0%)
```

## Risultati Attesi

### Requisiti Semplici
- Jaccard Similarity: **>85%**
- Numero attività: **2-4**
- Varianza driver: **<20%**

### Requisiti Complessi  
- Jaccard Similarity: **65-80%**
- Numero attività: **5-8**
- Varianza driver: **20-40%**

## Se la Consistenza è Bassa (<60%)

### Possibili Cause

1. **Temperature troppo alta** nel prompt GPT
   - Soluzione: ridurre da 0.7 a 0.3

2. **Prompt troppo generico**
   - Soluzione: aggiungere più contesto e vincoli

3. **Mancanza di esempi**
   - Soluzione: aggiungere few-shot examples

4. **Requisito ambiguo**
   - Soluzione: riformulare il requisito in modo più chiaro

### Come Migliorare

```typescript
// PRIMA (temperatura alta, prompt generico)
temperature: 0.8
prompt: "Suggest activities for this requirement"

// DOPO (temperatura bassa, prompt specifico)
temperature: 0.3
prompt: `You must suggest activities from this exact list.
Always include: REQ_ANALYSIS
For backend work, include: DEV_BACKEND
For frontend work, include: DEV_FRONTEND
Always include at least one TEST_ activity.

Requirement: ${description}`
```

## Analisi dei Risultati Reali

### Quando Esegui il Test

1. **Controlla la console** per vedere l'output dettagliato
2. **Copia i risultati** e salvali per confronto futuro
3. **Calcola statistiche** su più esecuzioni

### Esempio Output

```
=== AI VARIANCE TEST ===
Requirement: "Create user authentication system..."
Runs: 5

Run 1/5...
  Activities: [REQ_ANALYSIS, DEV_BACKEND, DEV_FRONTEND, TEST_UNIT]
  Drivers: {"COMPLEXITY":"HIGH","INTEGRATION":"FEW"}
  Risks: [R_TECH, R_INTEG]
  Reasoning: This requires backend API development...

Run 2/5...
  Activities: [REQ_ANALYSIS, DEV_BACKEND, DEV_FRONTEND, TEST_UNIT, TEST_INTEG]
  Drivers: {"COMPLEXITY":"HIGH","INTEGRATION":"MANY"}
  Risks: [R_TECH, R_INTEG]
  Reasoning: Authentication involves complex backend logic...

[... più runs ...]

=== VARIANCE ANALYSIS ===

Activities Variance:
  REQ_ANALYSIS: 5/5 (100%)
  DEV_BACKEND: 5/5 (100%)
  DEV_FRONTEND: 5/5 (100%)
  TEST_UNIT: 5/5 (100%)
  TEST_INTEG: 1/5 (20%)

Average Jaccard Similarity: 87.5%
Min Similarity: 80.0%
Max Similarity: 100.0%

Drivers Variance:
  COMPLEXITY:
    HIGH: 5/5 (100%)
    MEDIUM: 0/5 (0%)
  INTEGRATION:
    FEW: 3/5 (60%)
    MANY: 2/5 (40%)

Risks Variance:
  R_TECH: 5/5 (100%)
  R_INTEG: 4/5 (80%)
  R_PERF: 0/5 (0%)

=== CONCLUSIONS ===
✅ AI is HIGHLY CONSISTENT (>80% similarity)
```

## Best Practices

### 1. Test Periodici

Esegui questi test:
- ✅ Dopo modifiche al prompt GPT
- ✅ Dopo aggiornamenti al modello OpenAI
- ✅ Quando noti risultati strani in produzione

### 2. Conserva i Risultati

Salva i log per confrontare nel tempo:

```bash
pnpm test aiVariance > test-results-2025-11-19.txt
```

### 3. Test A/B

Confronta diverse versioni del prompt:

```typescript
// Version A (temperatura 0.3)
const resultA = await testWithPromptV1();

// Version B (temperatura 0.7)  
const resultB = await testWithPromptV2();

console.log('Version A consistency:', resultA.similarity);
console.log('Version B consistency:', resultB.similarity);
```

### 4. Monitora i Costi

Ogni test costa token:
- 5 runs × 1000 token/run = ~5000 token
- A $0.03/1k token = ~$0.15 per test completo

## Troubleshooting

### Test non parte
```bash
# Verifica che OPENAI_API_KEY sia configurato
echo $env:OPENAI_API_KEY  # Windows PowerShell
```

### Rate Limit Error
```typescript
// Aumenta il delay tra le chiamate
await new Promise(resolve => setTimeout(resolve, 2000)); // 2 secondi
```

### Timeout Error
```typescript
// Aumenta il timeout del test
it('should test variance', async () => {
  // ...
}, 120000); // 120 secondi invece di 60
```

## Domande Frequenti

**Q: Quanto è normale la varianza?**  
A: Per requisiti standard, 70-85% di similarity è accettabile. <60% indica un problema.

**Q: Devo eseguire questi test spesso?**  
A: No, solo quando modifichi il sistema di AI o noti comportamenti strani.

**Q: Posso usare questi test in CI/CD?**  
A: No, consumano troppi token. Usali solo manualmente quando necessario.

**Q: Come riduco la varianza?**  
A: Abbassa la temperature (0.3-0.5), rendi il prompt più specifico, aggiungi vincoli chiari.

---

**Autore**: AI Variance Testing Suite  
**Data**: 19 Novembre 2025  
**Versione**: 1.0
