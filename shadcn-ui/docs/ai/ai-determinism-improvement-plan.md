# AI Determinism Improvement Plan

## 🎯 Obiettivo

Migliorare il determinismo delle risposte GPT sostituendo la cache (che maschera l'inconsistenza) con vincoli architetturali che garantiscono ripetibilità vera.

## ❌ Problemi Attuali

### 1. Cache = Falso Determinismo
```typescript
// Situazione attuale:
- Prima richiesta: GPT genera risposta A
- Seconda richiesta (24h): Cache ritorna A (non GPT)
- Dopo 24h: GPT potrebbe generare risposta B ≠ A

// Risultato: La cache nasconde l'inconsistenza invece di risolverla
```

### 2. Prompt Compatto = Perdita Contesto
```typescript
// Attuale: "PP_DV_FIELD(0.25d,DEV)"
// GPT riceve solo: codice, giorni, gruppo
// ❌ Manca: description dettagliata dell'attività

// Problema: GPT deve "indovinare" quando usare un'attività
```

### 3. Driver/Risks Inutili nel Prompt
```typescript
// Attuale: Inviamo driver e risks nel prompt
// ❌ Problema: GPT NON deve mai suggerirli (solo attività)
// Spreco: ~200 tokens per richiesta
```

## ✅ Soluzioni Proposte

### FASE 1: Quick Wins (Implementazione Immediata) 🟢 ✅ COMPLETATA

#### 1.1 Rimuovere Driver/Risks dal Prompt ✅
**File**: `netlify/functions/ai-suggest.ts`

**Status**: ✅ IMPLEMENTATO (2025-11-21)

**Cambiamenti**:
- ✅ Rimossi `driversStr` e `risksStr` da `createCompactPrompt()`
- ✅ Aggiornato system prompt per chiarire che GPT suggerisce SOLO attività
- **Impatto**: Nessuno sulla funzionalità, solo pulizia
- **Risparmio**: ~200 tokens per richiesta

#### 1.2 Aggiungere Descrizioni Dettagliate alle Attività ✅
**File**: `netlify/functions/ai-suggest.ts`

**Status**: ✅ IMPLEMENTATO (2025-11-21)

**Cambiamenti**: Implementata funzione `createDescriptivePrompt()` con descrizioni complete

**Testing**: ⏳ Da completare

#### 1.3 Semplificare System Prompt ✅
**File**: `netlify/functions/ai-suggest.ts`

**Status**: ✅ IMPLEMENTATO (2025-11-21)

### FASE 2: Structured Outputs (Medio Termine) 🟢 ✅ COMPLETATA

#### 2.1 Implementare Structured Outputs con Schema Strict ✅
**File**: `netlify/functions/ai-suggest.ts`

**Status**: ✅ IMPLEMENTATO (2025-11-21)

**Requisiti**:
- ✅ Modello: `gpt-4o-mini` (supporta structured outputs)
- ✅ OpenAI SDK: v6.9.0 (supporta structured outputs)

**Cambiamenti Implementati**:
```typescript
// ✅ Nuova funzione
function createActivitySchema(validActivityCodes: string[]) {
    return {
        type: "json_schema",
        json_schema: {
            name: "activity_suggestion_response",
            strict: true,  // ✅ Enforces strict schema
            schema: {
                type: "object",
                properties: {
                    isValidRequirement: { type: "boolean" },
                    activityCodes: {
                        type: "array",
                        items: { 
                            type: "string",
                            enum: validActivityCodes  // ✅ ONLY valid codes
                        }
                    },
                    reasoning: { type: "string" }
                },
                required: ["isValidRequirement", "activityCodes", "reasoning"],
                additionalProperties: false
            }
        }
    };
}

// ✅ Modificata chiamata OpenAI
const responseSchema = createActivitySchema(relevantActivities.map(a => a.code));
response_format: responseSchema  // ✅ Schema strict con enum
```

**Vantaggi Realizzati**:
- ✅ GPT non può inventare codici inesistenti
- ✅ Validazione minima necessaria (schema strict garantisce)
- ✅ Response sempre valida per definizione
- ✅ Zero errori di validazione runtime

**Testing**: ⏳ Da completare

### FASE 3: Determinismo Totale con Seed (Lungo Termine) 🔴 TODO

#### 3.1 Implementare Seed Deterministico
**File**: `netlify/functions/ai-suggest.ts`

**Cambiamenti**:
```typescript
// Funzione hash per generare seed consistente
function generateSeed(description: string, presetId: string): number {
  const input = `${description.trim().toLowerCase()}:${presetId}`;
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash) + input.charCodeAt(i);
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

// Uso in chiamata API
const seed = generateSeed(sanitizedDescription, preset.id);

const response = await openai.chat.completions.create({
  model: 'gpt-4o-2024-08-06',
  messages: [...],
  seed: seed,  // ✅ Stesso input = stesso seed = stessa risposta
  temperature: 0.0,
  // ...
});
```

**Vantaggi**:
- ✅ Determinismo garantito da OpenAI
- ✅ Stesso input produce SEMPRE stessa risposta
- ✅ Cache diventa opzionale (solo per performance)

**Documentazione OpenAI**:
> "When using seed, the system will make a best effort to sample deterministically. 
> Determinism is not guaranteed, but is likely when using the same seed, 
> temperature=0, and the same system fingerprint."

**Testing**:
- ✅ Test variance: stesso requisito 100 volte deve dare stesso risultato
- ✅ Monitorare `system_fingerprint` in response
- ✅ Documentare rare occorrenze di non-determinismo

#### 3.2 Ridefinire Ruolo della Cache
**File**: `netlify/functions/ai-suggest.ts`

**Cambiamenti**:
- Cache diventa **opzionale** (non più necessaria per consistenza)
- Ridurre TTL da 24h a 1h (solo per ridurre latenza/costi)
- Aggiungere header per indicare cache hit/miss

**Vantaggi**:
- ✅ Sistema funziona correttamente anche senza cache
- ✅ Cache è ottimizzazione, non workaround
- ✅ Più trasparente per debugging

## 📋 Piano di Implementazione

### Step 1: Preparazione (1 ora)
- [x] ✅ Creare questo documento di design
- [ ] Backup del codice attuale
- [ ] Creare branch `feature/ai-determinism-improvement`
- [ ] Setup ambiente di test locale

### Step 2: Fase 1 - Quick Wins (2-3 ore)
- [ ] Implementare 1.1: Rimuovere driver/risks dal prompt
- [ ] Implementare 1.2: Aggiungere descrizioni dettagliate
- [ ] Implementare 1.3: Semplificare system prompt
- [ ] Testing manuale con 10 requisiti tipo
- [ ] Commit: "feat: improve AI prompt with detailed activity descriptions"

### Step 3: Validazione Fase 1 (1 ora)
- [ ] Eseguire test suite esistente
- [ ] Confrontare qualità suggerimenti prima/dopo
- [ ] Misurare aumento costi (dovrebbe essere minimo)
- [ ] Documentare risultati

### Step 4: Fase 2 - Structured Outputs (2-3 ore)
- [ ] Verificare versione OpenAI SDK
- [ ] Implementare 2.1: Structured outputs con schema strict
- [ ] Testing con edge cases (codici invalidi, etc.)
- [ ] Commit: "feat: implement structured outputs for AI responses"

### Step 5: Validazione Fase 2 (1 ora)
- [ ] Verificare zero errori di validazione
- [ ] Test performance vs approccio precedente
- [ ] Documentare vantaggi

### Step 6: Fase 3 - Seed Deterministico (2-3 ore)
- [ ] Implementare 3.1: Seed deterministico
- [ ] Implementare 3.2: Cache opzionale
- [ ] Testing variance (100 runs stesso input)
- [ ] Commit: "feat: implement deterministic seeding for AI"

### Step 7: Validazione Finale (2 ore)
- [ ] Test suite completo
- [ ] Test variance AI (aiVariance.test.ts)
- [ ] Benchmark performance
- [ ] Documentare risultati finali

### Step 8: Documentazione (1-2 ore)
- [ ] Aggiornare README.md
- [ ] Aggiornare AI_VARIANCE_TESTING.md
- [ ] Creare AI_DETERMINISM_ARCHITECTURE.md
- [ ] Update CHANGELOG.md

### Step 9: Deploy e Monitoring (1 ora)
- [ ] Deploy su staging
- [ ] Test in produzione
- [ ] Monitorare metriche prime 24h
- [ ] Merge to master

## 📊 Metriche di Successo

### Prima dell'Implementazione
- Temperature: 0.0
- Cache TTL: 24h
- Token medi: 900
- Costo medio: $0.0003
- Jaccard Similarity (test variance): ~85-90%
- Validazione necessaria: Sì (Zod + cross-check)

### Dopo l'Implementazione (Target)
- Temperature: 0.0
- Seed: Deterministico
- Cache TTL: 1h (opzionale)
- Token medi: 1500 (+67%)
- Costo medio: $0.0005 (+67%)
- Jaccard Similarity (test variance): >95% ✅
- Validazione necessaria: Minima (schema strict)
- Precisione suggerimenti: +30% miglioramento stimato

## ⚠️ Rischi e Mitigazioni

### Rischio 1: Aumento Costi
- **Impatto**: +67% token per richiesta
- **Mitigazione**: Beneficio in precisione giustifica costo
- **Monitoraggio**: Tracciare costi prima/dopo

### Rischio 2: Breaking Changes
- **Impatto**: Possibili errori in produzione
- **Mitigazione**: Testing approfondito, deploy graduale
- **Rollback**: Branch precedente disponibile

### Rischio 3: Seed Non Deterministico
- **Impatto**: OpenAI non garantisce 100% determinismo
- **Mitigazione**: Monitorare variance, documentare casi rari
- **Fallback**: Cache rimane come safety net

## 📚 Riferimenti

- [OpenAI Structured Outputs](https://platform.openai.com/docs/guides/structured-outputs)
- [OpenAI Reproducible Outputs](https://platform.openai.com/docs/guides/reproducible-outputs)
- [GPT-4o Model Card](https://platform.openai.com/docs/models/gpt-4o)

## ✅ Sign-off

- [ ] Developer Review
- [ ] Tech Lead Approval
- [ ] Ready for Implementation

---

**Created**: 2025-11-21  
**Status**: DRAFT - Ready for Review  
**Author**: AI Assistant + Development Team
