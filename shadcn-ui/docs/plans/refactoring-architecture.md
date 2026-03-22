# AI Suggest Function - Refactored Architecture

## Overview
Il file `ai-suggest.ts` è stato refactorizzato per separare le responsabilità in moduli riutilizzabili, migliorando manutenibilità, testabilità e organizzazione del codice.

## New Structure

```
netlify/functions/
├── ai-suggest.ts                    # Handler principale (orchestrazione)
└── lib/
    ├── auth/
    │   └── auth-validator.ts        # Validazione token Supabase
    ├── security/
    │   ├── cors.ts                  # Gestione CORS e origin allowlist
    │   └── rate-limiter.ts          # Rate limiting in-memory
    ├── ai/
    │   ├── openai-client.ts         # Client OpenAI configurato
    │   ├── ai-cache.ts              # Cache management (24h TTL)
    │   ├── prompt-builder.ts        # Creazione prompt e JSON schema
    │   └── actions/
    │       ├── suggest-activities.ts # Suggerimento attività
    │       ├── generate-title.ts     # Generazione titolo
    │       └── normalize-requirement.ts # Normalizzazione requisiti
    └── validation/
        └── requirement-validator.ts  # Validazione deterministica
```

## Module Responsibilities

### Auth Module (`lib/auth/`)
- **auth-validator.ts**: Gestisce validazione token Supabase
  - `validateAuthToken()`: Valida bearer token
  - `logAuthDebugInfo()`: Log informazioni debug environment
  - Configurazione Supabase client server-side

### Security Module (`lib/security/`)
- **cors.ts**: Gestione CORS
  - `getAllowedOrigin()`: Determina origin da includere in header
  - `isOriginAllowed()`: Verifica se origin è in allowlist
  - `getCorsHeaders()`: Restituisce headers CORS completi
  
- **rate-limiter.ts**: Rate limiting
  - `checkRateLimit()`: Verifica limiti richieste per key (user/IP)
  - Map in-memory con finestra temporale configurabile

### AI Module (`lib/ai/`)
- **openai-client.ts**: Client OpenAI
  - `getOpenAIClient()`: Restituisce istanza client (singleton)
  - `isOpenAIConfigured()`: Verifica presenza API key

- **ai-cache.ts**: Cache management
  - `getCacheKey()`: Genera chiave cache univoca
  - `getCachedResponse()`: Recupera risposta cached
  - `setCachedResponse()`: Salva risposta in cache
  - `clearCache()`: Pulizia cache

- **prompt-builder.ts**: Creazione prompt e schema
  - `createDescriptivePrompt()`: Prompt dettagliato per suggerimenti
  - `createActivitySchema()`: JSON schema strict con enum validation
  - `createNormalizationSchema()`: Schema per normalizzazione
  - `createActivitySuggestionSystemPrompt()`: System prompt completo
  - `createNormalizationSystemPrompt()`: System prompt normalizzazione
  - Type definitions condivise (Activity, Driver, Risk)

### AI Actions Module (`lib/ai/actions/`)
- **suggest-activities.ts**: Logica suggerimento attività
  - `suggestActivities()`: Suggerisce attività per requisito
  - Gestisce validazione, cache, chiamata OpenAI, post-processing

- **generate-title.ts**: Generazione titoli
  - `generateTitle()`: Genera titolo conciso da descrizione
  - Cache automatica

- **normalize-requirement.ts**: Normalizzazione requisiti
  - `normalizeRequirement()`: Normalizza e valida descrizione
  - Restituisce descrizione pulita + metadati

### Validation Module (`lib/validation/`)
- **requirement-validator.ts**: Validazione deterministica
  - `validateRequirementDescription()`: Validazione pre-AI
  - `sanitizeAndValidate()`: Sanitizzazione + validazione combinata
  - Regole: lunghezza minima, pattern test, target tecnici, etc.

## Main Handler (`ai-suggest.ts`)

Il file principale ora è ridotto a ~230 righe (da ~690) e si occupa solo di:
1. **Routing**: Determina quale action eseguire
2. **Orchestrazione**: Chiama i moduli appropriati
3. **Error handling**: Gestione errori globali
4. **Response formatting**: Formattazione risposte HTTP

### Flow Example (suggest-activities)
```typescript
Request → CORS check → Auth validation → Rate limit check →
  Parse body → Sanitize input → Call suggestActivities() →
  Format response → Return
```

## Benefits

### 1. Separation of Concerns
- Ogni modulo ha una responsabilità specifica e ben definita
- Facile individuare dove modificare una funzionalità

### 2. Testability
- Funzioni pure facilmente testabili in isolamento
- Mock semplici per dipendenze esterne
- Test unitari per ogni modulo

### 3. Reusability
- Moduli condivisi tra function diverse
- Es: `auth-validator` può essere usato in altre Netlify Functions
- `prompt-builder` riutilizzabile per nuove AI actions

### 4. Maintainability
- Riduzione drastica linee codice nel file principale
- Più facile localizzare bug e implementare fix
- Modifiche localizzate, meno regressioni

### 5. Type Safety
- Interfacce condivise tra moduli
- Type checking rigoroso su tutti i confini
- Autocomplete e IntelliSense migliorati

## Migration Notes

### Breaking Changes
Nessuna! L'API pubblica rimane identica:
- Stessi endpoint
- Stessi parametri request
- Stesse risposte

### Internal Changes
- Tutte le funzioni helper sono ora in moduli separati
- Import path aggiornati
- Nessun cambiamento logico, solo riorganizzazione

## Future Improvements

### Potential Enhancements
1. **Unit Tests**: Aggiungere test per ogni modulo
2. **Shared Types**: Creare `lib/types/` per interfacce comuni
3. **Config Module**: Centralizzare configurazione environment
4. **Logging Module**: Logger strutturato con livelli
5. **Metrics Module**: Tracciamento metriche e performance

### Possible New Actions
Con la struttura modulare, aggiungere nuove AI actions è semplice:
1. Creare file in `lib/ai/actions/new-action.ts`
2. Implementare logica action (con accesso a cache, client, prompt-builder)
3. Aggiungere route in `ai-suggest.ts`
4. Done!

## Development Guidelines

### Adding New AI Action
```typescript
// 1. Create lib/ai/actions/my-action.ts
export interface MyActionRequest {
    input: string;
}

export interface MyActionResponse {
    output: string;
}

export async function myAction(request: MyActionRequest): Promise<MyActionResponse> {
    // Use shared modules
    const openai = getOpenAIClient();
    const cached = getCachedResponse(cacheKey);
    
    // Your logic here
    
    return { output: result };
}

// 2. Update ai-suggest.ts
import { myAction } from './lib/ai/actions/my-action';

// In handler:
if (action === 'my-action') {
    const result = await myAction({ input: body.input });
    return { statusCode: 200, headers, body: JSON.stringify(result) };
}
```

### Running Tests
```bash
# Unit tests (future)
npm test

# Integration tests (current)
npm run dev:netlify
# Test via Postman/curl
```

## Performance

### Before Refactoring
- Single file: ~690 lines
- All logic in one place
- Hard to profile individual components

### After Refactoring
- Main handler: ~230 lines (-67%)
- Modular functions: easier to profile
- Cache hits più evidenti nei log
- Rate limiting isolato e monitorabile

## Documentation

### Module Documentation
Each module includes:
- JSDoc comments for public functions
- Type definitions with descriptions
- Usage examples in comments

### API Documentation
See existing `docs/ai/` for:
- `ai-system-overview.md`: Overall architecture
- `ai-input-validation.md`: Validation pipeline
- `ai-variance-testing.md`: Testing strategies

## Questions?

For questions or clarifications:
1. Check module source code (well commented)
2. Review existing `docs/ai/` documentation
3. Run tests to see examples in action

---

**Last Updated**: 2024-12-05  
**Author**: GitHub Copilot (AI Refactoring)  
**Version**: 1.0
