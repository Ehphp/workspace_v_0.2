# Documentazione Funzionalità Complete - Syntero

**Sistema di Stima Requisiti con AI**  
*Versione: Dicembre 2024*

---

## 📋 Sommario

1. [Panoramica del Sistema](#1-panoramica-del-sistema)
2. [Modulo Autenticazione](#2-modulo-autenticazione)
3. [Modulo Dashboard](#3-modulo-dashboard)
4. [Modulo Gestione Requisiti](#4-modulo-gestione-requisiti)
5. [Modulo Stima (Core)](#5-modulo-stima-core)
6. [Modulo Configurazione](#6-modulo-configurazione)
7. [Modulo Multi-Tenancy (Organizzazioni)](#7-modulo-multi-tenancy-organizzazioni)
8. [Funzionalità AI](#8-funzionalità-ai)
9. [Import/Export](#9-importexport)
10. [Workflow e Stati](#10-workflow-e-stati)
11. [Formula di Calcolo](#11-formula-di-calcolo)
12. [Ruoli e Permessi](#12-ruoli-e-permessi)

---

## 1. Panoramica del Sistema

### Che cos'è Syntero?

**Syntero** è una piattaforma SaaS B2B progettata per software agency che necessitano di:
- Standardizzare il processo di stima dei requisiti software
- Proteggere i margini aziendali attraverso governance strutturata
- Sfruttare l'AI per accelerare e migliorare la qualità delle stime
- Collaborare in team con ruoli e permessi definiti

### Problema Risolto

Il sistema risolve la soggettività e l'incoerenza nelle stime software, fornendo:
- Un processo guidato che combina parametri oggettivi
- Cataloghi standardizzati di attività, driver e rischi
- Supporto AI per suggerire attività basate sulla descrizione
- Tracciabilità completa della storia delle stime

### Scenario d'Uso Tipico

1. Un PM riceve un requisito funzionale (es. "Login con SPID")
2. Inserisce la descrizione nel sistema
3. Seleziona lo stack tecnologico aziendale
4. Riceve suggerimenti AI per le attività tecniche
5. Applica fattori di complessità e buffer di rischio
6. Ottiene un calcolo trasparente dei giorni-uomo necessari

---

## 2. Modulo Autenticazione

### Funzionalità Disponibili

| Funzione | Descrizione |
|----------|-------------|
| **Login** | Accesso con email e password via Supabase Auth |
| **Registrazione** | Creazione nuovo account con validazione password (min. 6 caratteri) |
| **Logout** | Disconnessione con pulizia della sessione |
| **AuthGuard** | Protezione delle route autenticate con redirect automatico a `/login` |

### Flusso di Accesso

```
Utente non autenticato → /login o /register
        ↓
   Autenticazione Supabase
        ↓
   Fetch Organizzazioni
        ↓
   Redirect a /dashboard
```

### Pagine Pubbliche (Accessibili senza login)
- `/` - Home page con Quick Estimate demo
- `/login` - Pagina di accesso
- `/register` - Pagina di registrazione
- `/how-it-works` - Pagina informativa "Come funziona"

---

## 3. Modulo Dashboard

### KPI Cards

La dashboard mostra 4 indicatori chiave di performance:

| KPI | Descrizione |
|-----|-------------|
| **Total Projects** | Numero totale di progetti/liste attivi |
| **Active Requirements** | Numero di requisiti in lavorazione |
| **Total Days** | Somma dei giorni stimati complessivi |
| **Avg Days/Req** | Media giorni per requisito |

### Funzionalità

1. **Project Cards**
   - Visualizzazione progetti in modalità **Grid** o **List**
   - Ricerca progetti per nome/descrizione
   - Ordinamento per: data aggiornamento, nome A-Z
   - Indicatori di stato per ogni progetto

2. **Recent Activity**
   - Carosello dei requisiti lavorati di recente
   - Accesso rapido per riprendere il lavoro

3. **Gestione Progetti**
   - **Crea Progetto**: Nome, descrizione, owner, technology preset
   - **Modifica Progetto**: Tutti i campi editabili
   - **Elimina Progetto**: Con conferma

4. **Filtri**
   - Toggle per mostrare/nascondere progetti archiviati
   - Ricerca testuale

---

## 4. Modulo Gestione Requisiti

### Lista Requisiti

Accessibile da: `/dashboard/:listId/requirements`

#### Funzionalità di Visualizzazione

| Funzione | Descrizione |
|----------|-------------|
| **Ricerca** | Filtro testuale su titolo e descrizione |
| **Filtro Priorità** | HIGH, MEDIUM, LOW, ALL |
| **Filtro Stato** | PROPOSED, SELECTED, SCHEDULED, DONE, ALL |
| **Ordinamento** | Data aggiornamento, priorità, nome |

#### Card Requisito

Ogni requisito mostra:
- ID requisito (es. REQ-001)
- Icona priorità colorata
- Titolo (con animazione se generato da AI)
- Badge stato
- Owner (se presente)
- Data ultimo aggiornamento
- Giorni stimati (se presente stima)

### Dettaglio Requisito

Accessibile da: `/dashboard/:listId/requirements/:reqId`

#### 3 Tab Principali

**Tab Overview**
- Informazioni complete del requisito
- Campi editabili inline: titolo, descrizione, priorità, stato, owner, tecnologia
- Visualizzazione ultima stima assegnata
- Azioni rapide: avvia stima, duplica

**Tab Estimation**
- Selezione tecnologia/preset
- Selezione attività (manuale o AI)
- Configurazione driver di complessità
- Configurazione rischi
- Calcolo in tempo reale
- Salvataggio stima

**Tab History**
- Timeline di tutte le stime effettuate
- Confronto side-by-side di due stime
- Assegnazione stima al requisito
- Paginazione (50 stime per pagina)
- Dettaglio completo per ogni stima

### Creazione Requisiti

**Creazione Manuale**
- Dialog per inserimento: titolo, descrizione, priorità, stato, owner
- Generazione automatica ID requisito (es. REQ-001)

**Bulk Estimate**
- Stima massiva di più requisiti contemporaneamente
- Selezione preset tecnologico comune
- Applicazione automatica a tutti i requisiti selezionati

---

## 5. Modulo Stima (Core)

### Wizard di Stima Avanzato (5 Step)

Il wizard guida l'utente attraverso 5 fasi per produrre una stima accurata.

#### Step 1: Requisito
- Input descrizione testuale del requisito
- Selezione priorità (HIGH, MEDIUM, LOW)
- Selezione stato iniziale
- Owner (opzionale)
- **AI: Normalizzazione automatica del testo**

#### Step 2: Tecnologia
- Selezione Technology Preset (es. "Java Backend", "React Frontend")
- Visualizzazione attività di default associate
- Visualizzazione driver predefiniti

#### Step 3: Attività
- Lista attività filtrate per tecnologia selezionata
- **Suggerimento AI**: click su "AI Suggest" per ricevere suggerimenti
- Selezione/deselezione manuale
- Raggruppamento per fase (Analysis, Dev, Test, Ops, Governance)
- Visualizzazione ore base per ogni attività

#### Step 4: Driver & Rischi

**Driver di Complessità**
- Moltiplicatori configurabili (es. 0.8x - 1.5x)
- Opzioni per driver: Basso, Medio, Alto
- Esempio: "Complessità Algoritmica" → Alto = 1.5x

**Rischi**
- Checkbox per attivare/disattivare rischi
- Ogni rischio ha un "peso" che contribuisce alla contingency
- Calcolo automatico della contingency %

#### Step 5: Risultati
- Visualizzazione breakdown completo:
  - Base Days (ore attività / 8)
  - Driver Multiplier (prodotto moltiplicatori)
  - Subtotal
  - Risk Score e Contingency %
  - **Total Days**
- Salvataggio stima con nome scenario automatico
- Generazione titolo AI (se non presente)

### Quick Estimate

Modalità accelerata per stime "ROM" (Rough Order of Magnitude).

**Funzionalità**
1. Input: solo descrizione testuale + selezione tecnologia
2. Click "Calculate Estimate"
3. AI analizza la descrizione
4. AI suggerisce attività automaticamente
5. Calcolo immediato con driver/rischi di default
6. Visualizzazione risultato con breakdown

**Caratteristiche**
- Disponibile dalla Home page (anche senza login)
- Modalità Demo per utenti non autenticati
- Ragionamento AI visibile nel risultato

---

## 6. Modulo Configurazione

Accessibile da: `/configuration`

### Gestione Attività

Pagina: `/configuration/activities`

#### Tab "Crea / Modifica"

| Campo | Descrizione |
|-------|-------------|
| **Nome** | Nome dell'attività (obbligatorio) |
| **Descrizione** | Dettagli opzionali |
| **Tecnologia** | Power Platform, Backend, Frontend, USU, Multi-stack |
| **Fase** | Analysis, Development, Testing, Operations, Governance |
| **Peso (ore)** | Ore base dell'attività |
| **Stato** | Attiva/Bozza |

#### Tab "Catalogo"

- **Filtri**: Tutte, Di sistema (OOTB), Custom
- **Filtro tecnologia**: dropdown per filtrare
- **Colonne configurabili**: codice, nome, tecnologia, fase, origine, peso
- **Azioni**:
  - Modifica (solo per le proprie custom)
  - Duplica (crea copia come nuova attività custom)

### Gestione Technology Presets

Pagina: `/configuration/presets`

#### Funzionalità

| Azione | Descrizione |
|--------|-------------|
| **Crea Preset** | Nuovo preset custom con attività e driver di default |
| **Modifica Preset** | Solo per preset custom propri |
| **Duplica Preset** | Crea copia di un preset esistente |
| **AI Wizard** | Generazione preset assistita da AI |

#### AI Wizard per Preset

Flusso in 4 fasi:
1. **Input descrizione progetto** (es. "Applicazione mobile React Native con backend Node.js")
2. **Interview AI**: domande dinamiche generate dall'AI
3. **Generazione**: creazione preset personalizzato
4. **Review & Salvataggio**

---

## 7. Modulo Multi-Tenancy (Organizzazioni)

### Tipi di Organizzazione

| Tipo | Descrizione |
|------|-------------|
| **Personal Workspace** | Spazio personale dell'utente. Transizioni libere, nessun vincolo. |
| **Team Organization** | Organizzazione collaborativa con ruoli e workflow strutturato. |

### Funzionalità Organizzazioni

**Gestione Team** (solo Team Organization)
- Visualizzazione lista membri
- Aggiunta membri tramite email
- Rimozione membri
- Modifica ruolo membri

**Switch Organizzazione**
- Dropdown nel Header per passare tra organizzazioni
- Persistenza dell'organizzazione selezionata

### Pagina Organization Settings

Accessibile da: `/organization`

- Profilo organizzazione (nome, ID)
- Lista membri con ruoli
- Azioni admin: aggiungi, rimuovi, modifica ruolo

---

## 8. Funzionalità AI

### Suggerimento Attività

**Endpoint**: `ai-suggest`

**Funzionamento**:
1. Riceve descrizione requisito + preset + lista attività disponibili
2. Analizza semanticamente il testo
3. Restituisce:
   - `isValidRequirement`: boolean
   - `activityCodes`: array di codici attività suggeriti
   - `reasoning`: spiegazione in italiano

### Generazione Titolo

**Funzionamento**:
- Analizza la descrizione del requisito
- Genera un titolo sintetico (<100 caratteri)
- Usato durante import Excel e wizard

### Normalizzazione Requisito

**Funzionamento**:
- Standardizza il linguaggio della descrizione
- Estrae informazioni chiave
- Suggerisce tecnologia se riconosciuta

### Interview Dinamica (AI Wizard)

**Endpoint**: `ai-generate-questions`

**Funzionamento**:
1. Riceve descrizione progetto
2. Genera fino a 7 domande contestuali
3. Ogni domanda ha:
   - `id`, `text`, `type` (single_choice, multiple_choice, text)
   - `options` con etichette
   - `allowOther`: permette risposte personalizzate
   - `required`: indica se obbligatoria

### Generazione Preset AI

**Endpoint**: `ai-generate-preset`

**Funzionamento**:
1. Riceve risposte dell'interview
2. Genera preset completo con:
   - Nome, descrizione, tech category
   - Attività di default suggerite
   - Driver values configurati
   - Rischi identificati

---

## 9. Import/Export

### Import da Excel

**Funzionalità**:
- Upload file Excel (.xlsx, .xls) o CSV
- Selezione foglio (per file multi-sheet)
- **Mapping automatico colonne** basato su pattern:
  - ID: "id", "req_id", "codice", "code", "requisito"
  - Titolo: "title", "titolo", "name", "nome"
  - Descrizione: "description", "descrizione", "desc", "details"
  - Priorità: "priority", "priorità", "prio"
  - Stato: "state", "stato", "status"
  - Owner: "owner", "business_owner", "responsabile"

**Validazioni**:
- ID obbligatorio per ogni riga
- Mapping automatico priorità (italiano → inglese)
- Mapping automatico stati

**Post-import**:
- Se titolo mancante/lungo: marcato per generazione AI
- Background job che genera titoli con AI

### Download Template

- Genera file Excel template con colonne corrette
- Facilitata compilazione offline

### Export (Pianificato)

> ⚠️ Funzionalità attualmente in sviluppo
- Export PDF del documento di stima
- Export CSV dei requisiti

---

## 10. Workflow e Stati

### Stati Requisito

| Stato | Descrizione |
|-------|-------------|
| **PROPOSED** | Requisito proposto, in attesa di approvazione |
| **SELECTED** | Requisito approvato/selezionato |
| **SCHEDULED** | Requisito pianificato per sviluppo |
| **DONE** | Requisito completato |

### Regole di Transizione

#### Personal Workspace
- **Nessun vincolo**: transizione libera tra qualsiasi stato

#### Team Organization

| Da → A | Chi può | Condizioni |
|--------|---------|------------|
| CREATED → PROPOSED | Tutti | - |
| PROPOSED → SELECTED | Admin, Editor | Richiede permessi |
| SELECTED → SCHEDULED | Admin, Editor | **Stima obbligatoria** |
| SCHEDULED → IN_PROGRESS | Tutti | - |
| IN_PROGRESS → DONE | Tutti | - |

---

## 11. Formula di Calcolo

### Algoritmo Deterministico

```
1. Base Days = Σ(ore attività selezionate) / 8

2. Driver Multiplier = Π(moltiplicatori driver)
   - Default: 1.0 se nessun driver selezionato

3. Subtotal = Base Days × Driver Multiplier

4. Risk Score = Σ(pesi rischi selezionati)

5. Contingency % =
   - Score 0: 0%
   - Score 1-10: 10%
   - Score 11-20: 15%
   - Score 21-30: 20%
   - Score >30: 25%

6. Contingency Days = Subtotal × Contingency %

7. Total Days = Subtotal + Contingency Days
```

### Esempio Pratico

```
Attività selezionate: 40 ore
Driver "Complessità Alta": 1.3x
Rischi selezionati: peso 15

Base Days = 40 / 8 = 5.0
Driver Multiplier = 1.3
Subtotal = 5.0 × 1.3 = 6.5
Risk Score = 15 → Contingency = 15%
Contingency Days = 6.5 × 0.15 = 0.975
Total Days = 6.5 + 0.975 = 7.475 ≈ 7.5 giorni
```

---

## 12. Ruoli e Permessi

### Ruoli Disponibili

| Ruolo | Permessi |
|-------|----------|
| **Admin** | Accesso completo: gestione membri, tutte le transizioni, configurazione |
| **Editor** | Può creare/modificare requisiti, effettuare stime, approvare |
| **Viewer** | Sola lettura: visualizza progetti, requisiti, stime |

### Matrice Permessi per Azione

| Azione | Admin | Editor | Viewer |
|--------|:-----:|:------:|:------:|
| Visualizza progetti | ✅ | ✅ | ✅ |
| Crea progetto | ✅ | ✅ | ❌ |
| Modifica progetto | ✅ | ✅ | ❌ |
| Elimina progetto | ✅ | ❌ | ❌ |
| Crea requisito | ✅ | ✅ | ❌ |
| Modifica requisito | ✅ | ✅ | ❌ |
| Effettua stima | ✅ | ✅ | ❌ |
| Approva requisito | ✅ | ✅ | ❌ |
| Pianifica requisito | ✅ | ✅ | ❌ |
| Gestisci membri team | ✅ | ❌ | ❌ |
| Modifica configurazione | ✅ | ✅ | ❌ |

### Row Level Security (RLS)

Il database implementa RLS su Supabase:
- **Liste/Progetti**: visibili solo nella propria organizzazione
- **Requisiti**: ereditano visibilità dalla lista
- **Stime**: visibili all'interno dell'organizzazione
- **Attività Custom**: modificabili solo dal creatore
- **Preset Custom**: modificabili solo dal creatore

---

## 📎 Appendice: Pagine dell'Applicazione

| Route | Pagina | Auth | Descrizione |
|-------|--------|:----:|-------------|
| `/` | Home | ❌ | Landing page con Quick Estimate |
| `/login` | Login | ❌ | Accesso utente |
| `/register` | Register | ❌ | Registrazione utente |
| `/how-it-works` | How It Works | ❌ | Guida funzionamento |
| `/dashboard` | Dashboard | ✅ | Panoramica progetti e KPI |
| `/dashboard/:id/requirements` | Requirements | ✅ | Lista requisiti del progetto |
| `/dashboard/:id/requirements/:id` | Requirement Detail | ✅ | Dettaglio e stima requisito |
| `/configuration` | Configuration Hub | ✅ | Centro configurazione |
| `/configuration/activities` | Activities | ✅ | Gestione attività |
| `/configuration/presets` | Presets | ✅ | Gestione preset tecnologici |
| `/profile` | Profile | ✅ | Profilo utente |
| `/organization` | Organization Settings | ✅ | Impostazioni organizzazione |

---

*Documento generato automaticamente dall'analisi del codice sorgente - Syntero v2024.12*
