# AI System Overview

## 📋 Panoramica

Il sistema AI suggerisce automaticamente attività rilevanti per un requisito analizzando la descrizione e il contesto tecnico.

**Modello**: GPT-4o-mini (OpenAI)  
**Temperatura**: 0.0 (massimo determinismo)  
**Endpoint**: `netlify/functions/ai-suggest.ts`  
**Status**: ✅ Produzione - Pienamente operativo

---

## 🎯 Cosa Fa il Sistema

### Input
```typescript
{
  description: "Aggiungere autenticazione utente con login e registrazione",
  preset: { tech_category: "BACKEND_API", ... },
  activities: [...],  // Catalogo attività disponibili
  drivers: [...],     // Per validazione (non usati da GPT)
  risks: [...]        // Per validazione (non usati da GPT)
}
```

### Output
```typescript
{
  isValidRequirement: true,
  activityCodes: ["REQ_ANALYSIS", "DEV_BACKEND", "TEST_UNIT"],
  reasoning: "Requisito valido: implementazione autenticazione richiede..."
}
```

---

## 🏗️ Architettura

### 1. Client-side (`src/lib/openai.ts`)

```typescript
export async function suggestActivities(input: SuggestActivitiesInput) {
  // 1. Sanitizza input
  const sanitizedDescription = sanitizePromptInput(description);
  
  // 2. Chiama Netlify Function
  const response = await fetch('/.netlify/functions/ai-suggest', {
    method: 'POST',
    body: JSON.stringify({
      description: sanitizedDescription,
      preset,
      activities,
      drivers,
      risks
    })
  });
  
  // 3. Gestisce risposta
  return await response.json();
}
```

### 2. Server-side (`netlify/functions/ai-suggest.ts`)

```typescript
// 1. Sanitizza nuovamente (defense in depth)
const sanitizedDescription = sanitizePromptInput(description);

// 2. Filtra attività: preferisce preset specifico, fallback a tech_category
const relevantActivities = preset.default_activity_codes?.length > 0
  ? activities.filter(a => preset.default_activity_codes.includes(a.code))
  : activities.filter(
      a => a.tech_category === preset.tech_category || a.tech_category === 'MULTI'
    );

// 3. Crea prompt descrittivo
const descriptiveData = createDescriptivePrompt(relevantActivities);

// 4. Chiama OpenAI con structured outputs
const response = await openai.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [
    { role: 'system', content: systemPrompt + descriptiveData },
    { role: 'user', content: sanitizedDescription }
  ],
  response_format: createActivitySchema(activityCodes),  // ← Enum constraint
  temperature: 0.0
});

// 5. Valida e restituisce
return validateAISuggestion(response);
```

---

## 🔑 Caratteristiche Chiave

### 1. Prompt Descrittivo

GPT riceve **descrizioni complete** di ogni attività:

```
CODE: PP_DV_FIELD
NAME: Creazione campi Dataverse
DESCRIPTION: Definizione e creazione di nuovi campi su tabelle Dataverse, 
             incluse proprietà base e relazioni semplici.
EFFORT: 0.25 days | GROUP: DEV
---
```

**Beneficio**: GPT capisce QUANDO usare un'attività, non solo cosa significa il codice.

### 2. Structured Outputs con Enum

```typescript
{
  type: "json_schema",
  json_schema: {
    strict: true,  // ← OpenAI garantisce aderenza
    schema: {
      properties: {
        activityCodes: {
          type: "array",
          items: {
            type: "string",
            enum: ["PP_DV_FIELD", "PP_DV_FORM", ...]  // ← Solo codici validi
          }
        }
      }
    }
  }
}
```

**Beneficio**: GPT **non può** inventare codici inesistenti.

### 3. Validazione `isValidRequirement`

GPT valuta se il requisito ha senso:

```typescript
// ✅ Valido
"Aggiungere campo email alla tabella utenti"
→ isValidRequirement: true

// ❌ Non valido
"test" 
→ isValidRequirement: false
```

**Regole AI**:
- ✅ ACCEPT: Verbo d'azione + contesto tecnico
- ❌ REJECT: Input di test, troppo vago, gibberish

### 4. Temperature 0.0

```typescript
temperature: 0.0  // Massimo determinismo
```

**Significato**: Dato lo stesso input, GPT tenta di restituire sempre la stessa risposta.

**Nota**: Determinismo al 100% NON è garantito da OpenAI, ma 0.0 massimizza la consistenza.

### 5. Caching (24h)

```typescript
const cacheKey = getCacheKey(description, presetId, activityCodes);
const cached = getCachedResponse(cacheKey);
if (cached) return cached;
```

**Benefici**:
- Performance: <100ms invece di ~1.5s
- Costi: 0 token invece di ~1650
- Consistenza: Stesso input = stessa risposta garantita

**TTL**: 24 ore

### 6. Sanitizzazione Input (4 Livelli)

Vedi **`ai-input-validation.md`** per dettagli completi.

```
User Input
  ↓
[1] Client sanitization (sanitizePromptInput)
  ↓
[2] Server sanitization (defense in depth)
  ↓
[3] AI validation (isValidRequirement)
  ↓
[4] Post-validation (Zod + cross-reference)
  ↓
Validated Output
```

---

## 📍 Punti di Chiamata

### 1. Wizard di Stima (Step 3)
**File**: `src/components/wizard/WizardStep3.tsx`  
**Quando**: Utente inserisce descrizione requisito  
**Usa**: `suggestActivities()` da `openai.ts`

### 2. Dettaglio Requisito
**File**: `src/pages/RequirementDetail.tsx`  
**Quando**: Click su bottone "AI Suggest"  
**Usa**: `suggestActivities()` da `openai.ts`

### 3. Stima Massiva (Bulk)
**File**: `src/components/requirements/BulkEstimateDialog.tsx`  
**Quando**: Stima multipla di requisiti  
**Usa**: Direct fetch a `/.netlify/functions/ai-suggest`

### 4. Generazione Titolo
**File**: `src/components/wizard/WizardStep5.tsx`  
**Quando**: Utente clicca "Generate Title"  
**Usa**: `generateTitleFromDescription()` da `openai.ts`

---

## 🔄 Flow Completo

```
1. User inserisce descrizione
   ↓
2. Client: sanitizePromptInput()
   ↓
3. Client → Server: POST /.netlify/functions/ai-suggest
   ↓
4. Server: sanitizePromptInput() (defense in depth)
   ↓
5. Server: Filtra attività per tech_category
   ↓
6. Server: Crea prompt descrittivo
   ↓
7. Server: Check cache (24h TTL)
   ↓
8. [Cache MISS] Server → OpenAI: GPT call
   ↓
9. OpenAI: Valida con structured outputs
   ↓
10. OpenAI → Server: JSON garantito valido
    ↓
11. Server: validateAISuggestion() (Zod + cross-ref)
    ↓
12. Server: Cache result
    ↓
13. Server → Client: { isValidRequirement, activityCodes, reasoning }
    ↓
14. Client: Mostra suggerimenti a utente
    ↓
15. User: Accetta/Modifica suggerimenti
```

---

## 📊 Performance & Metriche

### Tempi di Risposta

| Scenario | Tempo | Note |
|----------|-------|------|
| **Cache Hit** | <100ms | 60%+ dei casi |
| **Cache Miss** | ~1.5s | Chiamata OpenAI reale |
| **Timeout** | 30s | Molto raro |

### Token Usage

| Componente | Token | Costo |
|------------|-------|-------|
| **System Prompt** | ~800 | Include descrizioni attività |
| **User Prompt** | ~200 | Descrizione requisito (max 1000 char) |
| **Completion** | ~150 | Response con reasoning |
| **TOTAL** | ~1650 | ~$0.0005 per richiesta |

### Costi Mensili Stimati

```
Assunzioni:
- 100 utenti attivi/mese
- 5 estimations/utente/mese
- 10 requisiti/estimation
- Cache hit rate: 60%

Calcolo:
100 users × 5 est × 10 req = 5000 richieste/mese
5000 × 40% miss rate = 2000 chiamate API reali
2000 × $0.0005 = $1/mese

Costo: ~$1-2/mese
```

---

## 🛡️ Sicurezza

### API Key

```env
# Server-side ONLY
OPENAI_API_KEY=sk-xxx

# Client NON ha accesso
```

**Protezione**: API key vive solo in Netlify Functions (server-side).

### Input Sanitization

```typescript
sanitizePromptInput(text: string) {
  return text
    .replace(/[<>]/g, '')           // Remove HTML
    .replace(/[{}]/g, '')            // Remove JSON
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control chars
    .slice(0, 5000)                  // Limit length
    .trim();
}
```

**Applicato**: Client + Server (defense in depth).

### Validazione Response

```typescript
// 1. Schema validation (Zod)
const parsed = AIActivitySuggestionSchema.parse(rawData);

// 2. Cross-reference con DB
const validCodes = parsed.activityCodes.filter(code =>
  availableActivityCodes.includes(code)
);

// 3. Return solo codici validi
return { ...parsed, activityCodes: validCodes };
```

---

## 🧪 Testing

### Test Automatici

```bash
# Test schema validation
pnpm test aiStructuredOutputs

# Test variance (simulated)
pnpm test aiVariance
```

### Test Manuali

Vedi **`ai-variance-testing.md`** per:
- Test consistenza con API reale
- Metriche Jaccard similarity
- Test requisiti semplici vs complessi

---

## ⚠️ Limitazioni Note

### 1. Determinismo Non Garantito al 100%

**Causa**: OpenAI non garantisce determinismo assoluto anche con temperature 0.0  
**Impatto**: Stesso requisito può produrre suggerimenti leggermente diversi  
**Mitigazione**: Cache (24h) garantisce consistenza nella stessa finestra temporale

### 2. Costi Crescenti con Utilizzo

**Causa**: Ogni cache miss = chiamata API  
**Impatto**: Costi crescono linearmente con nuovi requisiti unici  
**Mitigazione**: Cache hit rate tipicamente >60%

### 3. Dipendenza Esterna

**Causa**: Sistema dipende da OpenAI  
**Impatto**: Se OpenAI down, AI suggestions non funzionano  
**Mitigazione**: Fallback automatico a preset defaults

### 4. Lingua Prompt

**Causa**: System prompt in inglese, user input spesso italiano  
**Impatto**: Possibile confusione per GPT  
**Mitigazione**: GPT gestisce bene mix di lingue

---

## 🔧 Configurazione

### Variabili Ambiente

```env
# .env (locale)
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxx
OPENAI_API_KEY=sk-xxx  # Server-side ONLY

# Netlify/Vercel (production)
OPENAI_API_KEY=sk-xxx  # In environment variables dashboard
```

### Parametri Tuning

```typescript
// netlify/functions/ai-suggest.ts

// Temperature (0.0 = massimo determinismo)
temperature: 0.0

// Max tokens response
max_tokens: 500

// Cache TTL (millisecondi)
const CACHE_TTL = 24 * 60 * 60 * 1000  // 24h

// User input max length
const MAX_DESCRIPTION_LENGTH = 1000  // In systemPrompt
```

---

## 📈 Monitoraggio

### Log da Controllare

```typescript
// Successo
console.log('✅ Using cached AI suggestion');
console.log('✅ Structured output received and validated by OpenAI');

// Errori
console.error('❌ AI API Error:', errorData);
console.error('Failed to generate AI suggestions');
```

### Metriche da Tracciare

- **Cache hit rate**: Target >60%
- **API error rate**: Target <1%
- **Average response time**: Target <2s
- **Token usage mensile**: Monitorare trend
- **Costo mensile**: Confrontare con budget

---

## 🔄 Manutenzione

### Quando Aggiungere Nuove Attività

1. Aggiungi attività al database
2. **Nessuna modifica codice necessaria** - sistema le carica automaticamente
3. Verifica che attività abbia `description` popolata
4. Testa con requisito appropriato

### Quando Modificare Prompt

```typescript
// netlify/functions/ai-suggest.ts

const systemPrompt = `You are an expert...`;
```

**Attenzione**: Modifiche al prompt possono cambiare comportamento AI.  
**Best practice**: Testa con `testMode=true` prima di deploy.

### Quando Cambiare Temperature

**Non raccomandato** - 0.0 è ottimale per determinismo.

Se necessario per sperimentazione:
```typescript
const temperature = testMode ? 0.7 : 0.0;
```

---

## 📞 Troubleshooting

### Problema: AI non suggerisce attività

**Causa 1**: Requisito non valido
```json
{ "isValidRequirement": false, "activityCodes": [] }
```
**Soluzione**: Aggiungi verbo d'azione + contesto tecnico

**Causa 2**: Nessuna attività compatibile con tech_category
**Soluzione**: Verifica che preset abbia attività associate

### Problema: Suggerimenti sempre diversi

**Causa 1**: Cache non funziona
**Soluzione**: Verifica che descrizione sia identica (sanitizzazione applicata)

**Causa 2**: Temperature >0.0
**Soluzione**: Verifica configurazione

### Problema: Errore "API key not configured"

**Causa**: `OPENAI_API_KEY` non impostata
**Soluzione**: Configura in Netlify/Vercel dashboard

### Problema: Timeout 30s

**Causa**: OpenAI lento o sovraccarico
**Soluzione**: Retry automatico gestito dal client

---

## 📚 Documenti Correlati

- **`ai-input-validation.md`** - Dettagli validazione e sanitizzazione
- **`ai-variance-testing.md`** - Test consistenza AI
- **`README.md`** - Indice documentazione

---

## 🎓 Best Practices

### Per Developer

1. **Sempre sanitizza input** prima di inviare ad AI
2. **Usa funzioni esistenti** (`suggestActivities()`) invece di chiamare direttamente
3. **Gestisci fallback** a preset defaults in caso di errore
4. **Logga tutto** per debug e monitoring

### Per Utenti

1. **Descrizioni chiare**: "Aggiungere campo email" meglio di "modifica"
2. **Verbo d'azione**: "Creare", "Modificare", "Eliminare", ecc.
3. **Contesto tecnico**: Specifica cosa stai modificando
4. **Evita test input**: "test", "aaa", ecc. vengono rifiutati

---

**Versione Documento**: 1.0  
**Data Creazione**: 2025-11-21  
**Ultima Modifica**: 2025-11-21  
**Maintainer**: Development Team
