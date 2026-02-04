# Test Plan: AI Determinism Improvements - Phase 1

## 🎯 Obiettivo

Verificare che le modifiche al sistema AI (prompt descrittivo, rimozione driver/risks) funzionino correttamente senza breaking changes.

## ✅ Pre-requisiti

- [x] Backup codice originale completato
- [x] Modifiche implementate in `netlify/functions/ai-suggest.ts`
- [x] Documentazione aggiornata (CHANGELOG.md, README.md, AI_VARIANCE_TESTING.md)
- [ ] Ambiente locale funzionante
- [ ] OpenAI API key configurata
- [ ] Supabase connesso con dati seed

## 🧪 Test Suite

### Test 1: Funzionalità Base - AI Suggestions

#### 1.1 Test con Requirement Semplice
**Input**:
```
Description: "Aggiungere campo email al form utente"
Technology: Power Platform Basic
```

**Azioni**:
1. Aprire Home Wizard o Requirement Detail
2. Inserire descrizione
3. Selezionare preset Power Platform
4. Click "Get AI Suggestions" / "Suggest Activities with AI"

**Expected Result**:
- ✅ Chiamata API completa senza errori
- ✅ Risposta JSON valida con activityCodes
- ✅ isValidRequirement: true
- ✅ Attività suggerite: PP_DV_FIELD, PP_DV_FORM, PP_E2E_TEST (o simili)
- ✅ Reasoning presente e sensato
- ✅ Nessun codice invalido
- ✅ Console mostra "Descriptive prompt created"

**Validation Checks**:
- [ ] API non ritorna errori 400/500
- [ ] Response time < 3 secondi (senza cache)
- [ ] Cache funziona (seconda richiesta < 100ms)
- [ ] Attività selezionate automaticamente in UI

---

#### 1.2 Test con Requirement Complesso
**Input**:
```
Description: "Implementare sistema di autenticazione completo con login, registrazione, password reset, 2FA e audit log"
Technology: Backend API
```

**Expected Result**:
- ✅ isValidRequirement: true
- ✅ Attività suggerite: 6-8 attività backend (BE_ANL_ALIGN, BE_API_COMPLEX, BE_DB_MIGRATION, BE_UNIT_TEST, BE_INT_TEST, BE_LOGGING, BE_DEPLOY)
- ✅ Reasoning dettagliato che spiega la selezione

---

#### 1.3 Test con Requirement Invalido
**Input**:
```
Description: "test"
Technology: Power Platform Basic
```

**Expected Result**:
- ✅ isValidRequirement: false
- ✅ activityCodes: [] (vuoto)
- ✅ Reasoning spiega perché è invalido ("test input")

---

### Test 2: Prompt Descrittivo - Verificare Contesto Migliorato

#### 2.1 Controllo Log Console
**Azioni**:
1. Aprire DevTools Console nel browser
2. Eseguire suggerimento AI
3. Controllare log in Netlify Function

**Expected in Console/Logs**:
- ✅ "Creating descriptive prompt with full activity details..."
- ✅ "Descriptive prompt created, length: ~XXXX" (dovrebbe essere ~3000-5000 char)
- ✅ NO riferimenti a "drivers" o "risks" nel log
- ✅ System prompt length > 2000 (più lungo del precedente)

---

#### 2.2 Verificare Prompt Inviato (Debug)
**Azioni**:
1. Aggiungere temporaneamente `console.log(systemPrompt)` nel codice
2. Eseguire richiesta
3. Verificare contenuto prompt

**Expected in System Prompt**:
- ✅ Presenza di "CODE:", "NAME:", "DESCRIPTION:", "EFFORT:", "GROUP:"
- ✅ Descrizioni complete delle attività (non solo codici)
- ✅ NO "Drivers:" o "Risks:" nel prompt
- ✅ "You suggest ONLY activity codes (you NEVER suggest drivers or risks)"
- ✅ "SELECTION GUIDELINES:" section presente

---

### Test 3: Cache e Performance

#### 3.1 Cache Hit Test
**Azioni**:
1. Eseguire richiesta AI con requisito "Aggiungere campo email"
2. Ripetere STESSA richiesta entro 5 minuti

**Expected**:
- ✅ Prima richiesta: ~1-2 secondi
- ✅ Seconda richiesta: < 100ms
- ✅ Console log: "Using cached AI suggestion"
- ✅ Risposta identica alla prima

---

#### 3.2 Token Usage Check
**Azioni**:
1. Controllare log OpenAI nella Netlify Function
2. Verificare `response.usage` nella response

**Expected**:
- ✅ Prompt tokens: ~1200-1800 (aumentati rispetto a ~600-900 precedenti)
- ✅ Completion tokens: ~100-200
- ✅ Total tokens: ~1500-2000 per richiesta
- ⚠️ Costo stimato: ~$0.0005 per richiesta (vs ~$0.0003 prima)

---

### Test 4: Backward Compatibility

#### 4.1 Test Import Excel con AI Title Generation
**Azioni**:
1. Import Excel senza colonna "title"
2. Sistema dovrebbe generare titoli con AI

**Expected**:
- ✅ Funzione `generateTitleFromDescription()` funziona correttamente
- ✅ Titoli generati sono sensati
- ✅ Nessun errore durante import

---

#### 4.2 Test Bulk Estimation
**Azioni**:
1. Selezionare 3-5 requisiti
2. Click "Bulk Estimate"
3. Sistema esegue AI suggestions in parallelo

**Expected**:
- ✅ Tutte le richieste completano senza errori
- ✅ Ogni requisito ha attività suggerite
- ✅ Nessun timeout
- ✅ Progress indicator funziona

---

### Test 5: Edge Cases

#### 5.1 Requisito in Italiano
**Input**: "Creare una dashboard per visualizzare KPI vendite con grafici interattivi"

**Expected**:
- ✅ GPT comprende descrizione italiana
- ✅ Attività suggerite appropriate
- ✅ Reasoning in formato comprensibile

---

#### 5.2 Requisito molto breve
**Input**: "Fix bug login"

**Expected**:
- ✅ isValidRequirement: true (è valido anche se breve)
- ✅ Attività suggerite: alcune attività di analisi/fix/test
- ✅ Reasoning menziona che il requisito è breve ma valido

---

#### 5.3 Requisito molto lungo (>1000 char)
**Input**: [Testo lungo con descrizione dettagliata di 1500+ caratteri]

**Expected**:
- ✅ Sistema tronca descrizione a 1000 char (come da codice)
- ✅ Suggerimenti comunque sensati
- ✅ Nessun errore di truncation

---

### Test 6: Error Handling

#### 6.1 OpenAI API Failure
**Simulation**: Disabilitare temporaneamente OPENAI_API_KEY

**Expected**:
- ✅ Fallback a preset defaults
- ✅ Messaggio di errore user-friendly
- ✅ Sistema non crasha
- ✅ Reasoning: "Using preset defaults due to AI service error"

---

#### 6.2 Timeout
**Simulation**: Impostare timeout molto basso nella chiamata OpenAI

**Expected**:
- ✅ Timeout gestito gracefully
- ✅ Fallback a defaults
- ✅ Toast error notification

---

### Test 7: Regression Tests - Feature Esistenti

#### 7.1 Wizard Home (No Login)
- [ ] Step 1-5 del wizard funzionano
- [ ] AI suggestions funzionano allo Step 3
- [ ] Calcolo finale corretto

#### 7.2 Requirement Detail Page
- [ ] Estimation tab funziona
- [ ] History tab funziona
- [ ] Comparison tool funziona
- [ ] Save estimation funziona con scenario name

#### 7.3 Requirements List Page
- [ ] CRUD operations funzionano
- [ ] Import Excel funziona
- [ ] Export Excel/PDF funziona
- [ ] Bulk estimate funziona

---

## 📊 Metriche di Successo

### Performance
- [ ] Response time AI < 3s (prima richiesta)
- [ ] Response time cache < 100ms (richieste successive)
- [ ] Nessun aumento latenza percepibile da utente

### Qualità
- [ ] Zero errori di validazione (codici invalidi)
- [ ] Reasoning più chiaro e dettagliato
- [ ] Attività suggerite più appropriate al contesto

### Costi
- [ ] Token usage aumentato ~67% (accettabile)
- [ ] Costo per richiesta ~$0.0005 (accettabile)
- [ ] Cache riduce costi su richieste ripetute

---

## 🐛 Bug Tracking

### Issues Trovati
| # | Descrizione | Severity | Status | Fix |
|---|-------------|----------|--------|-----|
| 1 | ... | ... | ... | ... |

---

## ✅ Sign-off

### Test Execution
- [ ] Tutti i test eseguiti
- [ ] Nessun blocking issue
- [ ] Performance accettabile
- [ ] Ready for production

### Approvals
- [ ] Developer: _____________
- [ ] QA: _____________
- [ ] Tech Lead: _____________

---

**Data Creazione**: 2025-11-21  
**Versione**: 1.0  
**Ultima Modifica**: 2025-11-21
