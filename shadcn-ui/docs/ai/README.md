# AI System Documentation

## 📁 Struttura Documentazione

Questa cartella contiene la documentazione completa del sistema AI per suggerimenti di attività.

### 📄 File Disponibili

| File | Descrizione | Quando Leggerlo |
|------|-------------|-----------------|
| **ai-system-overview.md** | Panoramica completa del sistema AI implementato | ⭐ Inizia da qui |
| **ai-input-validation.md** | Validazione e sanitizzazione input (4 livelli) | Quando lavori su sicurezza/input |
| **ai-variance-testing.md** | Test di consistenza AI e come eseguirli | Quando vuoi testare le risposte AI |

### ❌ File Rimossi (Pulizia 2025-11-21)

- `ai-determinism-improvement-plan.md` - Roadmap con fasi non implementate
- `ai-phase1-implementation-summary.md` - Storico implementazione (consolidato in overview)
- `ai-phase2-implementation-summary.md` - Storico implementazione (consolidato in overview)
- `ai-variance-quickstart.md` - Duplicato (consolidato in ai-variance-testing.md)

---

## 🎯 Quick Start

### Voglio capire come funziona il sistema AI
→ Leggi **`ai-system-overview.md`**

### Voglio validare/sanitizzare input utente
→ Leggi **`ai-input-validation.md`** sezione "4 Livelli di Protezione"

### Voglio testare la consistenza delle risposte AI
→ Leggi **`ai-variance-testing.md`** e segui le istruzioni

### Voglio aggiungere un nuovo punto di chiamata AI
→ Leggi **`ai-input-validation.md`** sezione "Checklist Implementazione"

---

## ✅ Stato Attuale (2025-11-21)

### Implementato e Funzionante

- ✅ **Prompt Descrittivo**: GPT riceve descrizioni complete delle attività
- ✅ **Structured Outputs**: Schema strict con enum constraint
- ✅ **Validazione Input**: 4 livelli (client, server, AI, post-validation)
- ✅ **Sanitizzazione**: Protezione da injection attacks
- ✅ **Uniformazione**: Tutte le chiamate AI usano la stessa logica
- ✅ **Temperature 0.0**: Massimo determinismo
- ✅ **Caching**: 24h TTL per performance
- ✅ **isValidRequirement**: GPT valida la validità dei requisiti

### Punti di Chiamata AI

Tutti uniformati e validati:

1. `src/lib/openai.ts` → `suggestActivities()`
2. `src/lib/openai.ts` → `generateTitleFromDescription()`
3. `src/components/requirements/BulkEstimateDialog.tsx`
4. `src/pages/RequirementDetail.tsx`
5. `src/components/wizard/WizardStep3.tsx`
6. `src/components/wizard/WizardStep5.tsx`

---

## 📊 Metriche Chiave

| Metrica | Valore | Target |
|---------|--------|--------|
| **Validation Errors** | 0% | <1% |
| **Invalid Codes** | 0 (impossibile con enum) | 0 |
| **Response Time (cached)** | <100ms | <200ms |
| **Response Time (no cache)** | ~1.5s | <2s |
| **Token per Richiesta** | ~1650 | <2000 |
| **Costo per Richiesta** | $0.0005 | <$0.001 |

---

## 🔧 Manutenzione

### Aggiornare la Documentazione

Quando modifichi il sistema AI:

1. Aggiorna **`ai-system-overview.md`** con le nuove feature
2. Se aggiungi validazione, aggiorna **`ai-input-validation.md`**
3. Se cambi comportamento, riesegui test in **`ai-variance-testing.md`**
4. Aggiorna questo README.md con nuovi file/sezioni

### Aggiungere Nuovi Test

I test AI sono in `src/test/`:
- `aiStructuredOutputs.test.ts` - Test schema validation
- `aiVariance.test.ts` - Test consistenza risposte

---

## 📚 Riferimenti Esterni

- [OpenAI Structured Outputs](https://platform.openai.com/docs/guides/structured-outputs)
- [OpenAI Best Practices](https://platform.openai.com/docs/guides/production-best-practices)
- [OWASP Input Validation](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)

---

**Maintainer**: Development Team  
**Last Update**: 2025-11-21  
**Next Review**: 2025-12-21
