# Test di Varianza AI - Quick Start

## ✅ Test Configurati e Funzionanti

Ho creato un sistema di test completo per misurare la **consistenza delle risposte di GPT** quando analizza lo stesso requisito più volte.

## 📁 File Creati

1. **`src/test/aiVariance.test.ts`** - Test suite completa
2. **`AI_VARIANCE_TESTING.md`** - Documentazione dettagliata

## 🎯 Cosa Testa

### Test Simulati (Gratuiti) ✅
```bash
pnpm test aiVariance
```

Questi test **non chiamano l'API** e mostrano:
- Esempi di alta/media/bassa consistenza
- Metriche attese per requisiti semplici vs complessi
- Come interpretare i risultati

### Test Reali (Consumano Token) ⚠️

Per attivare i test che chiamano GPT:

1. Apri `src/test/aiVariance.test.ts`
2. Rimuovi `.skip` da:
   ```typescript
   describe.skip('Single Requirement - Multiple Runs', () => {
   ```
   Diventa:
   ```typescript
   describe('Single Requirement - Multiple Runs', () => {
   ```
3. Esegui: `pnpm test aiVariance`

## 📊 Cosa Misura

### 1. Consistenza delle Attività
```
REQ_ANALYSIS: 5/5 (100%)    ← Sempre suggerito
DEV_BACKEND: 5/5 (100%)     ← Sempre suggerito  
TEST_INTEG: 2/5 (40%)       ← A volte suggerito
DEPLOY: 0/5 (0%)            ← Mai suggerito
```

### 2. Jaccard Similarity
Misura la sovrapposizione tra due set di attività:
- **>80%** = AI molto consistente ✅
- **60-80%** = AI moderatamente consistente ⚠️
- **<60%** = AI inconsistente ❌

### 3. Varianza dei Driver
```
COMPLEXITY:
  HIGH: 3/5 (60%)
  MEDIUM: 2/5 (40%)
  LOW: 0/5 (0%)
```

### 4. Varianza dei Rischi
```
R_TECH: 5/5 (100%)    ← Sempre identificato
R_INTEG: 3/5 (60%)    ← Spesso identificato
R_PERF: 0/5 (0%)      ← Mai identificato
```

## 🚀 Esempio di Output

```
=== AI VARIANCE TEST ===
Requirement: "Create a user authentication system..."
Runs: 5

Run 1/5...
  Activities: [REQ_ANALYSIS, DEV_BACKEND, DEV_FRONTEND, TEST_UNIT]
  
Run 2/5...
  Activities: [REQ_ANALYSIS, DEV_BACKEND, DEV_FRONTEND, TEST_UNIT, TEST_INTEG]
  
[...]

=== VARIANCE ANALYSIS ===

Activities Variance:
  REQ_ANALYSIS: 5/5 (100%)
  DEV_BACKEND: 5/5 (100%)
  DEV_FRONTEND: 5/5 (100%)
  TEST_UNIT: 5/5 (100%)
  TEST_INTEG: 1/5 (20%)

Average Jaccard Similarity: 87.5%

=== CONCLUSIONS ===
✅ AI is HIGHLY CONSISTENT (>80% similarity)
```

## 💡 Quando Usare

Esegui questi test:
- ✅ Dopo modifiche al prompt di GPT
- ✅ Dopo aggiornamenti al modello OpenAI
- ✅ Quando noti risultati strani in produzione
- ✅ Per confrontare versioni diverse del prompt (A/B testing)

## 📈 Metriche Attese

### Requisiti Semplici
- Jaccard Similarity: **>85%**
- Numero attività: **2-4**
- Varianza driver: **<20%**

### Requisiti Complessi
- Jaccard Similarity: **65-80%**
- Numero attività: **5-8**
- Varianza driver: **20-40%**

## 🔧 Se la Consistenza è Bassa

Se ottieni <60% di similarity:

1. **Abbassa la temperature** nel prompt (es. da 0.7 a 0.3)
2. **Rendi il prompt più specifico** con vincoli chiari
3. **Aggiungi few-shot examples** nel prompt
4. **Verifica che il requisito non sia ambiguo**

## 💰 Costi Stimati

Ogni test con API reale:
- 5 runs × 1000 token/run = ~5000 token
- A $0.03/1k token = **~$0.15 per test completo**

## 📖 Documentazione Completa

Vedi `AI_VARIANCE_TESTING.md` per:
- Guida dettagliata all'uso
- Interpretazione dei risultati
- Best practices
- Troubleshooting
- FAQ

## ✨ Esempio Rapido

```bash
# Test simulati (gratuiti)
pnpm test aiVariance

# Output:
# ✓ should simulate AI variance patterns
# ✓ should calculate expected variance metrics
# 2 passed | 2 skipped (4)
```

---

**Pronto all'uso!** I test simulati mostrano come interpretare i risultati. Quando sei pronto per testare l'AI reale, rimuovi `.skip` e esegui i test.
