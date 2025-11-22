# Analisi Funzionale — Requirements Estimation System

## Contesto e obiettivi

- Scopo principale: fornire uno spazio di lavoro per la raccolta e la stima dei requisiti software, con due modalità principali:
  - Quick Estimate: stime rapide e pubbliche (senza login) con suggerimenti AI.
  - Advanced 5-step Wizard: esperienza completa con attività, driver, rischi, salvataggio e storico.
- Problema risolto: ridurre l'attrito e l'ambiguità nel processo di stima (tempi, attività), garantire consistenza con un motore deterministico e offrire tracciabilità e confronto delle stime.
- Target utenti: analisti funzionali, PM, developer, stakeholder tecnici e utenti aziendali che devono ottenere stime ripetibili e auditate.

> Riferimenti: `README.md` (overview), `src/lib/estimationEngine.ts` (motore di calcolo), `netlify/functions/ai-suggest.ts` (proxy AI).

---

## Attori e ruoli

- Visitatori / Anonimi
  - Possono usare Quick Estimate e Wizard in modalità pubblica.
  - Possono generare titoli e ricevere suggerimenti AI.
  - File: `src/components/estimation/QuickEstimate.tsx`, `src/pages/Home.tsx`.

- Utenti autenticati (authenticated users)
  - Creano e gestiscono `lists` (progetti), `requirements`, salvano `estimations`, importano requisiti.
  - Possono creare attività `is_custom` e gestirle dal pannello Admin.
  - File: `src/pages/Lists.tsx`, `src/components/requirements/ImportRequirementsDialog.tsx`, `src/pages/AdminActivities.tsx`.

- Power User / Admin (ruolo implicito)
  - Pannello di gestione per preset tecnologici e attività custom; N.B. non esiste un ruolo `admin` esplicito nelle policy RLS: il controllo è basato su `created_by` e `is_custom`.
  - File: `src/pages/Admin.tsx`, `src/pages/Presets.tsx`.

- Sistema (serverless functions)
  - Netlify function `ai-suggest.ts` per proxy OpenAI e validazione di input/response.
  - Serve per generare titoli e suggerimenti di attività (structured outputs con enum per validare codes).
  - File: `netlify/functions/ai-suggest.ts`.

---

## Mappa dei moduli / Aree funzionali

- Autenticazione: Supabase Auth usato per login/sessioni e protezione dati.
  - File: `src/lib/supabase.ts`, `src/hooks/useAuth.ts`.

- Catalogo (master data): attività, driver, rischi, presets tecnologici e pivot di default.
  - File: `supabase_schema.sql`, `src/lib/mockData.ts`, `src/pages/Presets.tsx`.

- AI Integration: client wrapper (`openai.ts`) e Netlify function (`ai-suggest.ts`) con 4 livelli di validazione.
  - File: `src/lib/openai.ts`, `netlify/functions/ai-suggest.ts`, `src/types/ai-validation.ts`.

- Wizard & UI: componenti per wizard 5-step e Quick Estimate, import CSV/Excel, dettaglio requisito e storico.
  - File: `src/components/wizard/*`, `src/components/estimation/QuickEstimate.tsx`, `src/pages/RequirementDetail.tsx`.

- Calculation Engine: motore deterministico per calcolo giorni e percentuali di contingency.
  - File: `src/lib/estimationEngine.ts`.

- Import / Export: import excel con mapping e validazione; export CSV/PDF previsto come Phase 2.
  - File: `src/lib/excelParser.ts`, `src/components/requirements/ImportRequirementsDialog.tsx`.

- Estimation History & Comparison: salvataggio atomico, timeline, confronto tra stime.
  - File: `supabase_save_estimation_rpc.sql`, `src/hooks/useEstimationHistory.ts`, `src/components/estimation/EstimationComparison.tsx`.

---

## Flussi di business principali (end-to-end)

### 1) Quick Estimate (anonimo)
- Attori: Visitor
- Trigger: apertura Quick Estimate, inserimento descrizione + scelta preset
- Passi principali:
  1. Carica master data (activities/drivers/risks) o mock dati.
  2. Chiama `suggestActivities()` (client) → Netlify `ai-suggest` (server) → OpenAI.
  3. Validazione struttura e confronto delle enum; fallback a preset default se AI rifiuta/nessuna attività.
  4. Calcolo con `calculateEstimation({activities, drivers: [], risks: []})`.
- Output: risultato stima con baseDays, subtotal, riskScore, contingency e totale.
- File: `src/components/estimation/QuickEstimate.tsx`, `src/lib/openai.ts`.

### 2) Wizard 5-step + Save Estimation
- Attori: Authenticated user
- Trigger: sequela di wizard e clic su Save Estimation
- Passi principali:
  1. Raccolta dati: title, description, preset, activities (AI-assisted), drivers, risks.
  2. Calcolo `calculateEstimation` (client side) per visualizzazione e verifica.
  3. Apertura dialog per scenario name → supabase.rpc('save_estimation_atomic', payload).
  4. `save_estimation_atomic` inserisce `estimations` e join tables `estimation_activities`, `estimation_drivers`, `estimation_risks` in una transazione.
- Output: nuovo record in `estimations` e relativo storico.
- File: `src/pages/RequirementDetail.tsx`, `supabase_save_estimation_rpc.sql`.

### 3) Import Requirements (Excel/CSV)
- Attori: Authenticated user
- Trigger: Upload file + mapping
- Passi principali:
  1. parseExcelFile (client) → detect headers, suggested mapping.
  2. mapDataToRequirements + validateRequirements per riga (client side).
  3. Duplicate detection: `select req_id from requirements where list_id = X`.
  4. For each valid row: if missing title → call `generateTitleFromDescription()` (AI).
  5. Insert rows in `requirements` table per riga valida; show progress.
- Output: nuove righe di `requirements` nella lista.
- File: `src/components/requirements/ImportRequirementsDialog.tsx`, `src/lib/excelParser.ts`.

---

## Modello dati funzionale (entità principali)

- Activities: attività atomic per la stima (code, name, base_days, tech_category, group)
- Drivers: driver con `options` {value,label,multiplier} usati per calcolare il moltiplicatore
- Risks: rischi con `weight` sommati nel `risk_score`
- Technology presets: `default_activity_codes`, `default_driver_values`, `default_risks`
- Lists: progetti legati all'utente (owner), con `tech_preset_id` ereditato da `requirements`
- Requirements: requisiti in un list_id con `req_id`, `title`, `description`, `state`, `priority`.
- Estimations: salvataggi storici collegati a un requirement_id, contiene base & total & driver, e `scenario_name`.
- Junctions: `estimation_activities`, `estimation_drivers`, `estimation_risks`.

> Schema e indici: `supabase_schema.sql`.

---

## Regole di Business & Validazioni

- Validazioni frontend: Zod schema per forms (`src/lib/validation.ts`), `sanitizePromptInput`, min length description, etc.
- Validazioni backend: Netlify `ai-suggest` riapplica sanitizzazione e validazione deterministica, enforce rate limit & enum structured outputs.
- DB: RLS su user-data (lists, requirements, estimations) e policies sui cataloghi (activities read-only public but `is_custom` editable by its creator).
- Salvataggio atomic: `save_estimation_atomic` RPC esegue tutto in transazione; fallisce con exception su invalid data or no activities.

---

## Integrazioni esterne

- OpenAI via `ai-suggest` Netlify function (structured outputs, caching, rate-limiting).
  - File: `netlify/functions/ai-suggest.ts`, `src/lib/openai.ts`.
- Supabase: Auth, RLS, DB, RPC; client is used across app.
  - Files: `src/lib/supabase.ts`, `supabase_schema.sql`, `supabase_save_estimation_rpc.sql`.
- XLSX library: `xlsx` for parsing import files.
  - File: `src/lib/excelParser.ts`.

---

## Configurabilità e parametri

- Environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `OPENAI_API_KEY` (server only), `AI_REQUIRE_AUTH`, `AI_ALLOWED_ORIGINS`, `AI_RATE_LIMIT_MAX`, `AI_RATE_LIMIT_WINDOW_MS`.
- Feature toggles: `testMode` for AI calls, demo fallback to `MOCK_*` data when DB not available.
- Presets/pivot ordering: `technology_preset_activities.position`.

---

## Limiti, assunzioni e punti aperti

- Assunzione: non esiste un ruoli admin centralizzato (admin UI è accessibile a tutti gli authenticated users); potrebbe essere desiderabile aggiungerlo.
- Limiti: AI suggerisce solo attività (non drivers/risk); export PDF/CSV non ancora implementato.
- Punti aperti:
  - Aggiungere versioning per il catalogo attività (per la consistenza nella storia delle stime).
  - Distributed cache or rate limiting for AI in serverless environments.
  - Policy RBAC esplicite se serve un ruolo di admin centralizzato.

---

## Documentazione & File utili

- Diagrammi (ERD/Sequence): `docs/diagrams/ERD.mmd`, `docs/diagrams/sequences.mmd`, `docs/diagrams/index.html`
- Schema DB: `supabase_schema.sql` (cartella radice `workspace/shadcn-ui`)
- AI function: `netlify/functions/ai-suggest.ts`
- Calcolo: `src/lib/estimationEngine.ts`
- Wizard: `src/components/wizard/*`
- Quick Estimate: `src/components/estimation/QuickEstimate.tsx`
- Import/Parser: `src/lib/excelParser.ts`, `src/components/requirements/ImportRequirementsDialog.tsx`
- Save Estimation RPC: `supabase_save_estimation_rpc.sql`

---

## Versione breve (Executive Summary)

Syntero è un workspace per la stima dei requisiti con:
- Quick Estimate pubblica + 5-step Wizard autenticata;
- Motore deterministico per stime (attività, driver, rischi, contingency);
- AI per suggerire attività e generare titoli, attraverso Netlify function per evitare esposizione delle chiavi OpenAI;
- Storia delle stime con salvataggi atomici, versione scenari e confronto tra stime;
- Catalogo attività customizzabile e gestione di preset tecnologici.

---

### Ultimo controllo
- Per modifiche, aggiorna i file di riferimento nel repository (`src/` e `netlify/functions`) e rivedi i doc `docs/architecture`.
- Diagrammi interattivi: `docs/diagrams/index.html`.

*Creato automaticamente su richiesta.*
