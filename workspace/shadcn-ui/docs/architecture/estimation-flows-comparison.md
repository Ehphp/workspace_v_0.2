# Confronto Flussi di Stima - Requirements Estimator

## 📊 Overview

L'applicazione espone **5 punti di interazione** per stimare i requisiti, di cui **3 utilizzano GPT** per suggerire le attività. Questo documento analizza e confronta tutti i flussi per identificare differenze e garantire consistenza.

---

## 🎯 Punti di Stima Identificati

### **A. Quick Estimate Dialog** (Standalone)
- **Posizione**: Dialog accessibile dalla Home page
- **File**: `src/components/estimation/QuickEstimate.tsx`
- **Accesso**: Pulsante "Quick Estimate" in homepage

### **B. Requirement Detail - Quick Estimate Button** (Integrato)
- **Posizione**: Pulsante nella pagina dettaglio requisito
- **File**: `src/pages/RequirementDetail.tsx` (handleQuickEstimate)
- **Accesso**: Pulsante "⚡ Quick Estimate" nell'header del requisito

### **C. Bulk Estimate Dialog** (Batch)
- **Posizione**: Dialog per stima multipla da lista
- **File**: `src/components/requirements/BulkEstimateDialog.tsx`
- **Accesso**: Pulsante "Estimate All" nella pagina Requirements

### **D. Apply Template Button** (Manuale con preset)
- **Posizione**: Nella sezione Estimation del requirement detail
- **File**: `src/components/estimation/TechnologySection.tsx`
- **Funzione**: `handleApplyTemplate` → `applyPresetDefaults`
- **NON USA GPT**: Carica solo i defaults dal preset

### **E. AI Suggest Button** (Manuale con AI)
- **Posizione**: Nella sezione Estimation del requirement detail
- **File**: `src/components/estimation/TechnologySection.tsx`
- **Funzione**: `handleAiSuggest` → `suggestActivities`
- **USA GPT**: Chiama AI per suggerire attività

---

## 🔍 Analisi Dettagliata dei Flussi

### **A. Quick Estimate Dialog** (Standalone)

#### 📝 Funzionamento:
1. Utente inserisce descrizione requisito
2. Utente seleziona technology preset
3. Click su "Calculate"
4. **CHIAMATA AI**: `suggestActivities()` → `/.netlify/functions/ai-suggest`
5. Validazione risposta AI:
   - `isValidRequirement === false` → errore
   - `activityCodes.length === 0` → errore
6. Calcolo stima con `calculateEstimation()`
7. Mostra risultato con dettaglio attività

#### 🎯 Caratteristiche:
- ✅ **USA GPT**: Sì
- ✅ **Salva su DB**: No (solo visualizzazione)
- ✅ **Drivers**: No (sempre 1.0)
- ✅ **Risks**: No (sempre 0)
- ✅ **Temperature**: 0.1 (deterministico)
- ✅ **Cache**: Sì (5 minuti)

#### 📊 Output Mostrato:
- Total Days
- Lista attività selezionate (CODE + Nome + Base Days)
- Calculation Breakdown (Base, Multiplier, Subtotal, Risk, Contingency)
- AI Reasoning (se disponibile)

---

### **B. Requirement Detail - Quick Estimate Button**

#### 📝 Funzionamento:
1. Click su "⚡ Quick Estimate"
2. **Step 1**: Auto-seleziona preset (requirement → list → first available)
3. **Step 2**: Applica preset defaults (`applyPresetDefaults`)
   - Carica default activities, drivers, risks dal preset
4. **Step 3**: **CHIAMATA AI**: `suggestActivities()` → `/.netlify/functions/ai-suggest`
5. Validazione risposta AI (come Quick Estimate Dialog)
6. Applica suggerimenti AI con `applyAiSuggestions()`
   - **SOVRASCRIVE** le attività del preset con quelle dell'AI
   - Mantiene drivers e risks dai defaults
7. **Step 4**: Switch automatico al tab "Estimation"
8. Utente può modificare manualmente e salvare

#### 🎯 Caratteristiche:
- ✅ **USA GPT**: Sì
- ✅ **Salva su DB**: Sì (ma richiede conferma utente)
- ✅ **Drivers**: Sì (da preset defaults, modificabili)
- ✅ **Risks**: Sì (da preset defaults, modificabili)
- ✅ **Temperature**: 0.1 (deterministico)
- ✅ **Cache**: Sì (5 minuti)
- ⚠️ **Ibrido**: Combina preset defaults + AI suggestions

#### 📊 Output Mostrato:
- Estimation panel con selezioni attive
- Possibilità di modificare prima di salvare

---

### **C. Bulk Estimate Dialog**

#### 📝 Funzionamento:
1. Selezione multipla requisiti dalla lista
2. Click su "Estimate All"
3. **Pre-caricamento**: Carica activities, drivers, risks UNA SOLA VOLTA
4. Per ogni requisito:
   - Determina tech_preset_id (requirement → list default)
   - **CHIAMATA AI**: Fetch diretto a `/.netlify/functions/ai-suggest`
   - Validazione risposta AI
   - Calcolo stima con solo attività (no drivers, no risks)
   - **SALVA AUTOMATICAMENTE** su DB
5. Batch di 3 requisiti in parallelo (MAX_CONCURRENT = 3)

#### 🎯 Caratteristiche:
- ✅ **USA GPT**: Sì
- ✅ **Salva su DB**: Sì (automatico, non richiede conferma)
- ✅ **Drivers**: No (sempre 1.0)
- ✅ **Risks**: No (sempre 0)
- ✅ **Temperature**: 0.1 (deterministico)
- ✅ **Cache**: Sì (5 minuti)
- 🚀 **Ottimizzato**: Pre-carica dati una volta sola

#### 📊 Output Salvato su DB:
```typescript
{
  total_days: totalDays,
  base_days: baseDays,
  driver_multiplier: 1.0,  // ← SEMPRE 1.0
  risk_score: 0,           // ← SEMPRE 0
  contingency_percent: 10, // ← SEMPRE 10%
  scenario_name: 'AI Generated',
  selected_activities: activityCodes,
  selected_drivers: {},    // ← VUOTO
  selected_risks: [],      // ← VUOTO
  ai_reasoning: reasoning
}
```

---

### **D. Apply Template Button**

#### 📝 Funzionamento:
1. Utente seleziona technology preset
2. Click su "Apply Template"
3. **NO AI CALL**: Usa solo `applyPresetDefaults()`
4. Carica dal preset:
   - `default_activity_codes` → attività
   - `default_driver_values` → drivers
   - `default_risks` → risks
5. Applica le selezioni all'UI
6. Calcolo automatico con `calculateEstimation()`
7. Utente deve salvare manualmente

#### 🎯 Caratteristiche:
- ❌ **USA GPT**: No
- ✅ **Salva su DB**: Sì (ma richiede conferma utente)
- ✅ **Drivers**: Sì (da preset defaults)
- ✅ **Risks**: Sì (da preset defaults)
- 🎨 **Deterministico**: 100% (nessuna variabilità)

---

### **E. AI Suggest Button**

#### 📝 Funzionamento:
1. Utente seleziona technology preset
2. Click su "AI Suggest"
3. **CHIAMATA AI**: `suggestActivities()` → `/.netlify/functions/ai-suggest`
4. Validazione risposta AI
5. Applica suggerimenti con `applyAiSuggestions()`
   - **SOVRASCRIVE** attività correnti
   - **NON TOCCA** drivers e risks esistenti
6. Calcolo automatico con `calculateEstimation()`
7. Utente deve salvare manualmente

#### 🎯 Caratteristiche:
- ✅ **USA GPT**: Sì
- ✅ **Salva su DB**: Sì (ma richiede conferma utente)
- ✅ **Drivers**: Mantiene esistenti (non modificati dall'AI)
- ✅ **Risks**: Mantiene esistenti (non modificati dall'AI)
- ✅ **Temperature**: 0.1 (deterministico)
- ✅ **Cache**: Sì (5 minuti)

---

## ⚖️ Tabella Comparativa

| Funzione | USA GPT | Salva Auto | Activities | Drivers | Risks | Temperature | Cache |
|----------|---------|------------|------------|---------|-------|-------------|-------|
| **A. Quick Estimate Dialog** | ✅ | ❌ | AI | No (1.0) | No (0) | 0.1 | ✅ |
| **B. Quick Estimate Button** | ✅ | ⚠️ Manuale | AI + Preset | Preset | Preset | 0.1 | ✅ |
| **C. Bulk Estimate** | ✅ | ✅ | AI | No (1.0) | No (0) | 0.1 | ✅ |
| **D. Apply Template** | ❌ | ⚠️ Manuale | Preset | Preset | Preset | N/A | N/A |
| **E. AI Suggest** | ✅ | ⚠️ Manuale | AI | Mantiene | Mantiene | 0.1 | ✅ |

---

## 🔴 PROBLEMI CRITICI IDENTIFICATI

### **1. Inconsistenza Drivers e Risks**

**Problema**: Gli stessi requisiti ricevono stime diverse a seconda del flusso usato.

#### Esempio:
Requisito: "Aggiornare la lettera con aggiunta frase"

**Flusso A (Quick Estimate Dialog)**:
```
Activities: [DOCUP, TSTRE, DEPLS]
Drivers: 1.0 (none)
Risks: 0 (none)
Contingency: 10%
→ Total: 3.3 days
```

**Flusso B (Quick Estimate Button)**:
```
Activities: [DOCUP, TSTRE, DEPLS]  ← STESSE attività AI
Drivers: 1.58x (da preset defaults!)  ← DIVERSO
Risks: 5 (da preset defaults!)       ← DIVERSO
Contingency: 10%
→ Total: 5.7 days  ← 73% PIÙ ALTO!
```

**Flusso C (Bulk Estimate)**:
```
Activities: [DOCUP, TSTRE, DEPLS]
Drivers: 1.0 (none)
Risks: 0 (none)
Contingency: 10%
→ Total: 3.3 days
```

### **2. Variabilità AI (Minore)**

Anche con temperature 0.1, GPT può dare risposte diverse dopo cache expiry:
- Cache hit: stessa risposta
- Cache miss: risposta leggermente diversa (±1-2 attività)

### **3. Flusso Ibrido Non Documentato**

Il Quick Estimate Button (B) è un **ibrido non intuitivo**:
1. Applica preset defaults (con drivers e risks)
2. Poi sovrascrive solo le attività con AI
3. Risultato: **activities da AI + drivers/risks da preset**

Questo comportamento non è esplicitamente comunicato all'utente.

---

## ✅ LOGICA COMUNE (Corretta)

### **1. Chiamata AI Unificata**

Tutti i flussi che usano AI chiamano la stessa funzione:
```typescript
suggestActivities({
  description: requirement.description,
  preset: selectedPreset,
  activities: allActivities,
  drivers: allDrivers,
  risks: allRisks
})
```

### **2. System Prompt Identico**

```typescript
// netlify/functions/ai-suggest.ts (linea ~250)
const systemPrompt = `Expert estimation assistant for ${preset.name}...
FIRST: Evaluate if the requirement description is valid...
IF VALID: Suggest relevant activity codes.
IMPORTANT: Return ONLY activity codes. Drivers and risks will be selected manually.
Return JSON: {"isValidRequirement": true/false, "activityCodes": ["CODE"], "reasoning": "..."}`;
```

### **3. Validation Identica**

```typescript
// Tutti i flussi validano:
if (!suggestions.isValidRequirement) {
  // Errore: requisito non valido
}
if (!suggestions.activityCodes || suggestions.activityCodes.length === 0) {
  // Errore: nessuna attività suggerita
}
```

### **4. Calculation Engine Identico**

```typescript
// Tutti usano:
calculateEstimation({
  activities: selectedActivities,
  drivers: selectedDrivers,
  risks: selectedRisks
})
```

---

## 🎯 RACCOMANDAZIONI

### **1. Uniformare i Flussi AI (CRITICO)**

Tre opzioni:

#### **Opzione A: Solo Attività AI (Attuale A, C)**
```typescript
// Quick Estimate e Bulk Estimate
activities: AI suggested
drivers: none (1.0)
risks: none (0)
```

**Pro**: Veloce, deterministico, facile da capire
**Contro**: Stima basilare

#### **Opzione B: AI + Preset Defaults (Attuale B)**
```typescript
// Quick Estimate Button
activities: AI suggested
drivers: from preset defaults
risks: from preset defaults
```

**Pro**: Stima più completa
**Contro**: Comportamento ibrido confuso

#### **Opzione C: AI Completa (Futuro)**
```typescript
// Tutti i flussi
activities: AI suggested
drivers: AI suggested  ← NUOVO
risks: AI suggested    ← NUOVO
```

**Pro**: Massima automazione
**Contro**: Richiede modifica prompt e validazione

### **2. Abbassare Temperature a 0.0**

```typescript
// netlify/functions/ai-suggest.ts
const temperature = testMode ? 0.7 : 0.0; // era 0.1
```

Migliora consistenza AI eliminando quasi tutta la variabilità.

### **3. Estendere Cache Lifetime**

```typescript
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 ore invece di 5 minuti
```

Garantisce che lo stesso requisito dia sempre lo stesso risultato nella stessa giornata.

### **4. Documentare Comportamento Ibrido**

Aggiungere alert/tooltip che spiega:
```
⚠️ Quick Estimate applica:
- Attività: suggerite da AI
- Drivers & Risks: defaults dal preset
```

### **5. Aggiungere Modalità "AI Only"**

Permettere all'utente di scegliere:
- [ ] Apply preset defaults (drivers & risks)
- [ ] Use AI suggestions only (activities, no drivers/risks)

---

## 📊 IMPLEMENTAZIONE CONSIGLIATA

### **Step 1: Fix Immediato - Consistenza**

Modificare Quick Estimate Button (B) per comportarsi come A e C:

```typescript
// RequirementDetail.tsx - handleQuickEstimate
// RIMUOVERE: applyPresetDefaults(presetToUse)
// MANTENERE: solo applyAiSuggestions con AI activities

applyAiSuggestions(
  suggestedActivityIds,
  undefined,  // NO drivers
  undefined   // NO risks
);
```

### **Step 2: Migliorare Determinismo**

```typescript
// netlify/functions/ai-suggest.ts
const temperature = 0.0;
const CACHE_TTL = 24 * 60 * 60 * 1000;
```

### **Step 3: UI Feedback**

Aggiungere badge/indicatori:
- 🤖 **AI**: Attività suggerite da AI
- 📋 **Preset**: Defaults dal template
- ✏️ **Manual**: Modificate dall'utente

---

## 🧪 TEST DI VALIDAZIONE

Per verificare consistenza, testare:

```
Requisito: "Aggiornare la lettera con aggiunta frase"
Preset: "Power Platform - Standard"

Risultati attesi (DOPO fix):
- Quick Estimate Dialog: 3.3 days
- Quick Estimate Button: 3.3 days
- Bulk Estimate: 3.3 days
- Apply Template: X days (dipende da preset, OK se diverso)
- AI Suggest: 3.3 days
```

---

## 📌 CONCLUSIONI

1. **3 flussi usano GPT** (A, B, E) + 1 batch (C)
2. **Logica AI identica** in tutti i punti
3. **Problema critico**: Inconsistenza drivers/risks
4. **Soluzione**: Uniformare flusso B agli altri
5. **Miglioramento**: Temperature 0.0 + cache 24h

---

**Documento creato**: 19 Novembre 2025
**Autore**: GitHub Copilot
**Versione**: 1.0
