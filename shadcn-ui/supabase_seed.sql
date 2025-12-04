-- Requirements Estimation System - Seed Data
-- Insert catalog data from JSON

-- ============================================
-- CLEANUP (optional - uncomment if you want to reset all data)
-- ============================================
-- DELETE FROM estimation_risks;
-- DELETE FROM estimation_drivers;
-- DELETE FROM estimation_activities;
-- DELETE FROM estimations;
-- DELETE FROM requirements;
-- DELETE FROM lists;
-- DELETE FROM technology_presets;
-- DELETE FROM risks;
-- DELETE FROM drivers;
-- DELETE FROM activities;

-- ============================================
-- ACTIVITIES
-- ============================================

-- Step 1: Update existing activities (preserves foreign key references)
-- Power Platform
UPDATE activities SET name = 'Allineamento analisi requisiti', description = 'Sessioni di allineamento funzionale/tecnico sul requisito in ambito Power Platform.', base_days = 4.0, tech_category = 'POWER_PLATFORM', "group" = 'ANALYSIS', active = true WHERE code = 'PP_ANL_ALIGN';
UPDATE activities SET name = 'Creazione campi Dataverse', description = 'Definizione e creazione di nuovi campi su tabelle Dataverse, incluse proprietà base e relazioni semplici.', base_days = 2.0, tech_category = 'POWER_PLATFORM', "group" = 'DEV', active = true WHERE code = 'PP_DV_FIELD';
UPDATE activities SET name = 'Configurazione form Dataverse', description = 'Configurazione layout form, controlli e logica di base lato Dataverse.', base_days = 4.0, tech_category = 'POWER_PLATFORM', "group" = 'DEV', active = true WHERE code = 'PP_DV_FORM';
UPDATE activities SET name = 'Power Automate Flow semplice', description = 'Implementazione di un flusso Power Automate con logica lineare e poche condizioni.', base_days = 4.0, tech_category = 'POWER_PLATFORM', "group" = 'DEV', active = true WHERE code = 'PP_FLOW_SIMPLE';
UPDATE activities SET name = 'Power Automate Flow complesso', description = 'Flusso con più condizioni, rami paralleli o integrazioni esterne.', base_days = 8.0, tech_category = 'POWER_PLATFORM', "group" = 'DEV', active = true WHERE code = 'PP_FLOW_COMPLEX';
UPDATE activities SET name = 'Business Rule Dataverse', description = 'Configurazione di regole di business lato Dataverse (validazioni, calcoli, visibilità campi).', base_days = 2.0, tech_category = 'POWER_PLATFORM', "group" = 'DEV', active = true WHERE code = 'PP_BUSINESS_RULE';
UPDATE activities SET name = 'Test end-to-end Power Platform', description = 'Test end-to-end della soluzione in ambiente di test/pre-produzione.', base_days = 8.0, tech_category = 'POWER_PLATFORM', "group" = 'TEST', active = true WHERE code = 'PP_E2E_TEST';
UPDATE activities SET name = 'Supporto UAT', description = 'Supporto agli utenti per esecuzione User Acceptance Test, raccolta feedback e piccoli aggiustamenti.', base_days = 8.0, tech_category = 'POWER_PLATFORM', "group" = 'TEST', active = true WHERE code = 'PP_UAT_RUN';
UPDATE activities SET name = 'Deploy soluzione Power Platform', description = 'Preparazione e rilascio soluzione tra ambienti (dev/test/prod) con validazioni base.', base_days = 4.0, tech_category = 'POWER_PLATFORM', "group" = 'OPS', active = true WHERE code = 'PP_DEPLOY';

-- Backend
UPDATE activities SET name = 'Analisi API / backend', description = 'Analisi requisiti specifici per endpoint, logica di business e sicurezza.', base_days = 4.0, tech_category = 'BACKEND', "group" = 'ANALYSIS', active = true WHERE code = 'BE_ANL_ALIGN';
UPDATE activities SET name = 'Endpoint API semplice', description = 'Implementazione di un endpoint REST con logica lineare e CRUD standard.', base_days = 6.0, tech_category = 'BACKEND', "group" = 'DEV', active = true WHERE code = 'BE_API_SIMPLE';
UPDATE activities SET name = 'Endpoint API complesso', description = 'Endpoint con logica di business articolata, orchestrazione di più servizi o chiamate esterne.', base_days = 12.0, tech_category = 'BACKEND', "group" = 'DEV', active = true WHERE code = 'BE_API_COMPLEX';
UPDATE activities SET name = 'Migrazione schema DB', description = 'Creazione o modifica di schema DB (tabelle, indici, vincoli) e relativa migrazione.', base_days = 8.0, tech_category = 'BACKEND', "group" = 'DEV', active = true WHERE code = 'BE_DB_MIGRATION';
UPDATE activities SET name = 'Unit test backend', description = 'Implementazione di unit test per servizi o controller backend.', base_days = 4.0, tech_category = 'BACKEND', "group" = 'TEST', active = true WHERE code = 'BE_UNIT_TEST';
UPDATE activities SET name = 'Integration test backend', description = 'Test di integrazione tra componenti backend e/o servizi esterni.', base_days = 6.0, tech_category = 'BACKEND', "group" = 'TEST', active = true WHERE code = 'BE_INT_TEST';
UPDATE activities SET name = 'Logging & monitoring', description = 'Configurazione logging, metriche base e integrazione con sistema di monitoring.', base_days = 4.0, tech_category = 'BACKEND', "group" = 'OPS', active = true WHERE code = 'BE_LOGGING';
UPDATE activities SET name = 'Deploy backend', description = 'Preparazione pipeline e rilascio in ambiente di destinazione.', base_days = 4.0, tech_category = 'BACKEND', "group" = 'OPS', active = true WHERE code = 'BE_DEPLOY';

-- Frontend
UPDATE activities SET name = 'Analisi UX/UI', description = 'Analisi esigenze UX/UI per schermata o flusso frontend.', base_days = 4.0, tech_category = 'FRONTEND', "group" = 'ANALYSIS', active = true WHERE code = 'FE_ANL_UX';
UPDATE activities SET name = 'Componente UI', description = 'Implementazione di un componente UI (React o equivalente) con logica base di presentazione.', base_days = 4.0, tech_category = 'FRONTEND', "group" = 'DEV', active = true WHERE code = 'FE_UI_COMPONENT';
UPDATE activities SET name = 'Form complesso', description = 'Implementazione form con validazioni, stato complesso e integrazione API.', base_days = 8.0, tech_category = 'FRONTEND', "group" = 'DEV', active = true WHERE code = 'FE_FORM';
UPDATE activities SET name = 'Gestione stato', description = 'Configurazione e/o estensione di store globale (es. Redux, Zustand) o stato condiviso.', base_days = 6.0, tech_category = 'FRONTEND', "group" = 'DEV', active = true WHERE code = 'FE_STATE_MGMT';
UPDATE activities SET name = 'Integrazione API', description = 'Integrazione con API esistenti, gestione errori e loading.', base_days = 4.0, tech_category = 'FRONTEND', "group" = 'DEV', active = true WHERE code = 'FE_API_INTEGRATION';
UPDATE activities SET name = 'Unit test UI', description = 'Test unitari su componenti UI.', base_days = 4.0, tech_category = 'FRONTEND', "group" = 'TEST', active = true WHERE code = 'FE_UNIT_TEST';
UPDATE activities SET name = 'E2E test frontend', description = 'Test end-to-end di flussi utente critici.', base_days = 6.0, tech_category = 'FRONTEND', "group" = 'TEST', active = true WHERE code = 'FE_E2E_TEST';
UPDATE activities SET name = 'Deploy frontend', description = 'Build e pubblicazione applicazione frontend (CDN, hosting, configurazione base).', base_days = 4.0, tech_category = 'FRONTEND', "group" = 'OPS', active = true WHERE code = 'FE_DEPLOY';

-- Multi-stack
UPDATE activities SET name = 'Kickoff tecnico', description = 'Kickoff con team cross-funzionali per allineamento su scope, dipendenze e rischi.', base_days = 4.0, tech_category = 'MULTI', "group" = 'GOVERNANCE', active = true WHERE code = 'CRS_KICKOFF';
UPDATE activities SET name = 'Documentazione tecnica', description = 'Redazione o aggiornamento documentazione tecnica fondamentale per il requisito.', base_days = 4.0, tech_category = 'MULTI', "group" = 'GOVERNANCE', active = true WHERE code = 'CRS_DOC';

-- Step 2: Insert NEW granular activities (only the variants - skip if already exist)
INSERT INTO activities (code, name, description, base_days, tech_category, "group", active) 
SELECT * FROM (VALUES
-- ============================================
-- GRANULAR ACTIVITIES - Size-Based Variants
-- ============================================

-- POWER PLATFORM - Analysis (varianti)
('PP_ANL_ALIGN_SM', 'Allineamento analisi requisiti (Quick)', 'Quick sync con team tecnico per chiarimenti rapidi sul requisito (15-30 min).', 1.6, 'POWER_PLATFORM', 'ANALYSIS', true),
('PP_ANL_ALIGN_LG', 'Allineamento analisi requisiti (Workshop)', 'Workshop completo con stakeholder multipli e analisi dettagliata delle dipendenze.', 8.0, 'POWER_PLATFORM', 'ANALYSIS', true),

-- POWER PLATFORM - Development (Dataverse - varianti)
('PP_DV_FIELD_SM', 'Creazione campi Dataverse (1-2 campi)', 'Aggiunta di 1-2 campi semplici senza relazioni complesse.', 1.0, 'POWER_PLATFORM', 'DEV', true),
('PP_DV_FIELD_LG', 'Creazione campi Dataverse (5+ campi)', 'Definizione di schema complesso con 5+ campi, relazioni e lookup multipli.', 4.0, 'POWER_PLATFORM', 'DEV', true),
('PP_DV_FORM_SM', 'Configurazione form Dataverse (Simple)', 'Form con pochi campi e layout standard, nessuna logica custom.', 2.0, 'POWER_PLATFORM', 'DEV', true),
('PP_DV_FORM_LG', 'Configurazione form Dataverse (Complex)', 'Form con tab multipli, business rules complesse e logica di visibilità avanzata.', 8.0, 'POWER_PLATFORM', 'DEV', true),

-- POWER PLATFORM - Development (Power Automate - varianti)
('PP_FLOW_SIMPLE_SM', 'Power Automate Flow (Minimal)', 'Flow lineare con 2-3 step senza condizioni (es. notifica semplice).', 2.0, 'POWER_PLATFORM', 'DEV', true),
('PP_FLOW_SIMPLE_LG', 'Power Automate Flow (Standard+)', 'Flow con più condizioni, scope e gestione errori base.', 6.0, 'POWER_PLATFORM', 'DEV', true),
('PP_FLOW_COMPLEX_SM', 'Power Automate Flow complesso (Base)', 'Flow con logica condizionale media e 1-2 integrazioni.', 6.0, 'POWER_PLATFORM', 'DEV', true),
('PP_FLOW_COMPLEX_LG', 'Power Automate Flow complesso (Advanced)', 'Flow con orchestrazione complessa, parallelismo, retry logic e multiple integrazioni.', 16.0, 'POWER_PLATFORM', 'DEV', true),

-- POWER PLATFORM - Business Rules (varianti)
('PP_BUSINESS_RULE_SM', 'Business Rule Dataverse (Simple)', 'Singola regola con 1-2 condizioni (es. campo required se altro campo valorizzato).', 1.0, 'POWER_PLATFORM', 'DEV', true),
('PP_BUSINESS_RULE_LG', 'Business Rule Dataverse (Complex)', 'Set di regole multiple con logica complessa e calcoli articolati.', 4.0, 'POWER_PLATFORM', 'DEV', true),

-- POWER PLATFORM - Testing (varianti)
('PP_E2E_TEST_SM', 'Test end-to-end Power Platform (Smoke)', 'Test di smoke base per verificare funzionalità principali.', 4.0, 'POWER_PLATFORM', 'TEST', true),
('PP_E2E_TEST_LG', 'Test end-to-end Power Platform (Full)', 'Suite completa di test con scenari multipli e edge cases.', 16.0, 'POWER_PLATFORM', 'TEST', true),
('PP_UAT_RUN_SM', 'Supporto UAT (Light)', 'Supporto minimo durante UAT con presenza a chiamata.', 4.0, 'POWER_PLATFORM', 'TEST', true),
('PP_UAT_RUN_LG', 'Supporto UAT (Full)', 'Supporto continuativo con sessioni giornaliere e fix multipli.', 16.0, 'POWER_PLATFORM', 'TEST', true),

-- POWER PLATFORM - Operations (varianti)
('PP_DEPLOY_SM', 'Deploy soluzione Power Platform (Dev→Test)', 'Deploy semplice da dev a test con validazioni base.', 2.0, 'POWER_PLATFORM', 'OPS', true),
('PP_DEPLOY_LG', 'Deploy soluzione Power Platform (Multi-env)', 'Deploy su ambienti multipli con validazioni complete e rollback plan.', 8.0, 'POWER_PLATFORM', 'OPS', true),

-- BACKEND - Analysis (varianti)
('BE_ANL_ALIGN_SM', 'Analisi API / backend (Quick)', 'Review rapida di requisiti API standard con pattern noti.', 2.0, 'BACKEND', 'ANALYSIS', true),
('BE_ANL_ALIGN_LG', 'Analisi API / backend (Deep)', 'Analisi approfondita con design pattern, sicurezza e performance.', 8.0, 'BACKEND', 'ANALYSIS', true),

-- BACKEND - Development (API - varianti)
('BE_API_SIMPLE_SM', 'Endpoint API semplice (CRUD)', 'GET/POST base senza logica business, solo CRUD su singola entità.', 3.2, 'BACKEND', 'DEV', true),
('BE_API_SIMPLE_LG', 'Endpoint API semplice (Business Logic)', 'Endpoint con validazioni custom e logica business moderata.', 10.0, 'BACKEND', 'DEV', true),
('BE_API_COMPLEX_SM', 'Endpoint API complesso (Base)', 'Endpoint con orchestrazione di 2-3 servizi interni.', 8.0, 'BACKEND', 'DEV', true),
('BE_API_COMPLEX_LG', 'Endpoint API complesso (Advanced)', 'Orchestrazione complessa con chiamate esterne, saga pattern, compensazioni.', 24.0, 'BACKEND', 'DEV', true),

-- BACKEND - Database (varianti)
('BE_DB_MIGRATION_SM', 'Migrazione schema DB (Simple)', 'Aggiunta di 1-2 colonne o indici su tabelle esistenti.', 4.0, 'BACKEND', 'DEV', true),
('BE_DB_MIGRATION_LG', 'Migrazione schema DB (Complex)', 'Creazione tabelle multiple con relazioni, trigger, stored procedures.', 16.0, 'BACKEND', 'DEV', true),

-- BACKEND - Testing (varianti)
('BE_UNIT_TEST_SM', 'Unit test backend (Basic)', 'Test unitari su 1-2 metodi con mock semplici.', 2.0, 'BACKEND', 'TEST', true),
('BE_UNIT_TEST_LG', 'Unit test backend (Comprehensive)', 'Suite completa con coverage elevata e scenari complessi.', 8.0, 'BACKEND', 'TEST', true),
('BE_INT_TEST_SM', 'Integration test backend (Basic)', 'Test di integrazione su singolo scenario principale.', 3.2, 'BACKEND', 'TEST', true),
('BE_INT_TEST_LG', 'Integration test backend (Full)', 'Suite completa con test di integrazione multi-servizio.', 12.0, 'BACKEND', 'TEST', true),

-- BACKEND - Operations (varianti)
('BE_LOGGING_SM', 'Logging & monitoring (Basic)', 'Aggiunta di log essenziali su punti critici.', 2.0, 'BACKEND', 'OPS', true),
('BE_LOGGING_LG', 'Logging & monitoring (Advanced)', 'Setup completo con metriche custom, dashboards e alerting.', 8.0, 'BACKEND', 'OPS', true),
('BE_DEPLOY_SM', 'Deploy backend (Single env)', 'Deploy su singolo ambiente con pipeline esistente.', 2.0, 'BACKEND', 'OPS', true),
('BE_DEPLOY_LG', 'Deploy backend (Multi-env)', 'Deploy su ambienti multipli con blue-green o canary strategy.', 8.0, 'BACKEND', 'OPS', true),

-- FRONTEND - Analysis (varianti)
('FE_ANL_UX_SM', 'Analisi UX/UI (Quick)', 'Review rapida su mockup esistenti o pattern noti.', 2.0, 'FRONTEND', 'ANALYSIS', true),
('FE_ANL_UX_LG', 'Analisi UX/UI (Design Session)', 'Sessione di design completa con wireframe, user journey e iterazioni.', 8.0, 'FRONTEND', 'ANALYSIS', true),

-- FRONTEND - Development (UI - varianti)
('FE_UI_COMPONENT_SM', 'Componente UI (Atomic)', 'Componente atomico semplice (button, input, label) con styling base.', 2.0, 'FRONTEND', 'DEV', true),
('FE_UI_COMPONENT_LG', 'Componente UI (Complex)', 'Componente complesso con stato interno, interazioni multiple e animazioni.', 8.0, 'FRONTEND', 'DEV', true),
('FE_FORM_SM', 'Form (Simple)', 'Form con 3-5 campi e validazioni base.', 4.0, 'FRONTEND', 'DEV', true),
('FE_FORM_LG', 'Form (Complex)', 'Form multi-step con validazioni complesse, conditional fields e gestione errori avanzata.', 16.0, 'FRONTEND', 'DEV', true),

-- FRONTEND - State Management (varianti)
('FE_STATE_MGMT_SM', 'Gestione stato (Simple)', 'Aggiunta di singolo slice/store per entità semplice.', 3.2, 'FRONTEND', 'DEV', true),
('FE_STATE_MGMT_LG', 'Gestione stato (Complex)', 'Setup store complesso con normalizzazione, middleware e side effects.', 12.0, 'FRONTEND', 'DEV', true),

-- FRONTEND - API Integration (varianti)
('FE_API_INTEGRATION_SM', 'Integrazione API (Single)', 'Integrazione con singolo endpoint e gestione base errori/loading.', 2.0, 'FRONTEND', 'DEV', true),
('FE_API_INTEGRATION_LG', 'Integrazione API (Multiple)', 'Integrazione con API multiple, polling, retry logic e error boundaries.', 8.0, 'FRONTEND', 'DEV', true),

-- FRONTEND - Testing (varianti)
('FE_UNIT_TEST_SM', 'Unit test UI (Basic)', 'Test di render e props base su 1-2 componenti.', 2.0, 'FRONTEND', 'TEST', true),
('FE_UNIT_TEST_LG', 'Unit test UI (Comprehensive)', 'Suite completa con test di interazioni, hooks e edge cases.', 8.0, 'FRONTEND', 'TEST', true),
('FE_E2E_TEST_SM', 'E2E test frontend (Happy path)', 'Test E2E del flusso principale senza scenari alternativi.', 3.2, 'FRONTEND', 'TEST', true),
('FE_E2E_TEST_LG', 'E2E test frontend (Full coverage)', 'Suite E2E completa con scenari multipli, error cases e validazioni.', 12.0, 'FRONTEND', 'TEST', true),

-- FRONTEND - Operations (varianti)
('FE_DEPLOY_SM', 'Deploy frontend (Simple)', 'Build e deploy su singolo ambiente con configurazione esistente.', 2.0, 'FRONTEND', 'OPS', true),
('FE_DEPLOY_LG', 'Deploy frontend (Advanced)', 'Deploy multi-ambiente con CDN, cache invalidation e feature flags.', 8.0, 'FRONTEND', 'OPS', true),

-- MULTI-STACK - Governance (varianti)
('CRS_KICKOFF_SM', 'Kickoff tecnico (Quick)', 'Kickoff rapido per allineamento su requisito standard.', 2.0, 'MULTI', 'GOVERNANCE', true),
('CRS_KICKOFF_LG', 'Kickoff tecnico (Workshop)', 'Workshop completo con analisi rischi, dipendenze e plan dettagliato.', 8.0, 'MULTI', 'GOVERNANCE', true),
('CRS_DOC_SM', 'Documentazione tecnica (Basic)', 'Documentazione essenziale (README, commenti inline).', 2.0, 'MULTI', 'GOVERNANCE', true),
('CRS_DOC_LG', 'Documentazione tecnica (Comprehensive)', 'Documentazione completa: architettura, API docs, runbook, diagrammi.', 12.0, 'MULTI', 'GOVERNANCE', true)
) AS t(code, name, description, base_days, tech_category, "group", active)
WHERE NOT EXISTS (
    SELECT 1 FROM activities WHERE activities.code = t.code
);

-- ============================================
-- DRIVERS
-- ============================================

-- Update or insert drivers
INSERT INTO drivers (code, name, description, options) 
SELECT * FROM (VALUES
('COMPLEXITY', 'Complexity', 'Livello di complessità funzionale/tecnica del requisito.', 
 '[
   {"value": "LOW", "label": "Low", "multiplier": 0.8},
   {"value": "MEDIUM", "label": "Medium", "multiplier": 1.0},
   {"value": "HIGH", "label": "High", "multiplier": 1.3}
 ]'::jsonb),

('ENVIRONMENTS', 'Number of environments', 'Numero di ambienti coinvolti (dev/test/preprod/prod...).',
 '[
   {"value": "ONE", "label": "1 environment", "multiplier": 1.0},
   {"value": "TWO", "label": "2 environments", "multiplier": 1.2},
   {"value": "THREE_PLUS", "label": "3+ environments", "multiplier": 1.3}
 ]'::jsonb),

('REUSE', 'Reuse level', 'Quanto riutilizzo di componenti esistenti è possibile.',
 '[
   {"value": "HIGH", "label": "High reuse", "multiplier": 0.8},
   {"value": "MEDIUM", "label": "Medium reuse", "multiplier": 1.0},
   {"value": "LOW", "label": "Low reuse", "multiplier": 1.2}
 ]'::jsonb),

('STAKEHOLDERS', 'Stakeholders', 'Numero di team o stakeholder coinvolti.',
 '[
   {"value": "ONE_TEAM", "label": "1 team", "multiplier": 1.0},
   {"value": "TWO_THREE", "label": "2–3 team", "multiplier": 1.2},
   {"value": "FOUR_PLUS", "label": "4+ team", "multiplier": 1.5}
 ]'::jsonb),

('REGULATION', 'Regulation / Compliance', 'Impatto di normative, compliance o audit esterni.',
 '[
   {"value": "NONE", "label": "No regulation", "multiplier": 1.0},
   {"value": "MEDIUM", "label": "Medium", "multiplier": 1.1},
   {"value": "HEAVY", "label": "Heavy", "multiplier": 1.25}
 ]'::jsonb)
) AS t(code, name, description, options)
ON CONFLICT (code) 
DO UPDATE SET 
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  options = EXCLUDED.options;

-- ============================================
-- RISKS
-- ============================================

-- Update or insert risks
INSERT INTO risks (code, name, description, weight) 
SELECT * FROM (VALUES
('R_INTEG_EXT', 'Integrazione con sistemi esterni', 'Il requisito prevede integrazioni con servizi o sistemi esterni non pienamente sotto il nostro controllo.', 5),
('R_PERF', 'Performance critical', 'Requisiti stringenti di prestazioni (latenza, throughput, carico elevato).', 5),
('R_AUDIT', 'Audit / Tracciabilità', 'Necessità di tracciare in modo dettagliato le operazioni per scopi di audit o compliance.', 4),
('R_MIGRATION', 'Migrazione dati legacy', 'Migrazione o trasformazione di dati esistenti da sistemi legacy.', 6),
('R_LEGACY', 'Dipendenza da legacy', 'Dipendenza forte da sistemi legacy, librerie obsolete o codice non manutenuto.', 4),
('R_SCOPE_CHANGE', 'Scope instabile', 'Scope del requisito percepito come instabile o soggetto a molti cambiamenti.', 3),
('R_SECURITY', 'Requisiti di sicurezza', 'Presenza di requisiti di sicurezza avanzati (autenticazione forte, cifratura, audit).', 5),
('R_DEPENDENCIES', 'Dipendenze critiche', 'Dipendenze da altri team, progetti o componenti che possono causare blocchi.', 4)
) AS t(code, name, description, weight)
ON CONFLICT (code) 
DO UPDATE SET 
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  weight = EXCLUDED.weight;

-- ============================================
-- TECHNOLOGY PRESETS
-- ============================================

-- Update or insert technology presets
-- Nota: I preset ora usano le varianti granulari (SM/LG) per stime più precise
INSERT INTO technology_presets (code, name, description, tech_category, default_driver_values, default_risks, default_activity_codes) 
SELECT * FROM (VALUES
-- Power Platform - Preset LIGHT (per task semplici e veloci)
('TECH_PP_LIGHT', 'Power Platform – Light', 'Preset per requisiti PP semplici e veloci (es. aggiungere campo, notifica base).', 'POWER_PLATFORM',
 '{"COMPLEXITY": "LOW", "ENVIRONMENTS": "ONE", "REUSE": "HIGH", "STAKEHOLDERS": "ONE_TEAM", "REGULATION": "NONE"}'::jsonb,
 '[]'::jsonb,
 '["PP_ANL_ALIGN_SM", "PP_DV_FIELD_SM", "PP_DV_FORM_SM", "PP_FLOW_SIMPLE_SM", "PP_E2E_TEST_SM", "PP_DEPLOY_SM"]'::jsonb),

-- Power Platform - Preset STANDARD (bilanciato)
('TECH_PP_BASIC', 'Power Platform – Standard', 'Preset generico per requisiti Power Platform di complessità media.', 'POWER_PLATFORM',
 '{"COMPLEXITY": "MEDIUM", "ENVIRONMENTS": "TWO", "REUSE": "MEDIUM", "STAKEHOLDERS": "TWO_THREE", "REGULATION": "MEDIUM"}'::jsonb,
 '["R_INTEG_EXT"]'::jsonb,
 '["PP_ANL_ALIGN", "PP_DV_FIELD", "PP_DV_FORM", "PP_FLOW_SIMPLE", "PP_E2E_TEST", "PP_DEPLOY"]'::jsonb),

-- Power Platform - Preset COMPLEX (per progetti articolati)
('TECH_PP_HR', 'Power Platform – Complex (HR)', 'Preset per requisiti complessi in ambito HR con workflow articolati e compliance.', 'POWER_PLATFORM',
 '{"COMPLEXITY": "HIGH", "ENVIRONMENTS": "THREE_PLUS", "REUSE": "MEDIUM", "STAKEHOLDERS": "TWO_THREE", "REGULATION": "HEAVY"}'::jsonb,
 '["R_AUDIT", "R_INTEG_EXT", "R_SECURITY"]'::jsonb,
 '["PP_ANL_ALIGN_LG", "PP_DV_FIELD", "PP_DV_FORM_LG", "PP_FLOW_COMPLEX", "PP_BUSINESS_RULE_LG", "PP_E2E_TEST_LG", "PP_UAT_RUN_LG", "PP_DEPLOY_LG"]'::jsonb),

-- Backend - Preset LIGHT (CRUD semplice)
('TECH_BACKEND_SIMPLE', 'Backend – Simple CRUD', 'Preset per endpoint API semplici con CRUD standard.', 'BACKEND',
 '{"COMPLEXITY": "LOW", "ENVIRONMENTS": "ONE", "REUSE": "HIGH", "STAKEHOLDERS": "ONE_TEAM", "REGULATION": "NONE"}'::jsonb,
 '[]'::jsonb,
 '["BE_ANL_ALIGN_SM", "BE_API_SIMPLE_SM", "BE_DB_MIGRATION_SM", "BE_UNIT_TEST_SM", "BE_INT_TEST_SM", "BE_LOGGING_SM", "BE_DEPLOY_SM"]'::jsonb),

-- Backend - Preset STANDARD
('TECH_BACKEND_API', 'Backend – Standard API', 'Preset per implementazione API REST con logica business moderata.', 'BACKEND',
 '{"COMPLEXITY": "MEDIUM", "ENVIRONMENTS": "TWO", "REUSE": "MEDIUM", "STAKEHOLDERS": "TWO_THREE", "REGULATION": "MEDIUM"}'::jsonb,
 '["R_INTEG_EXT", "R_SECURITY"]'::jsonb,
 '["BE_ANL_ALIGN", "BE_API_SIMPLE", "BE_DB_MIGRATION", "BE_UNIT_TEST", "BE_INT_TEST", "BE_LOGGING", "BE_DEPLOY"]'::jsonb),

-- Backend - Preset COMPLEX (orchestrazione)
('TECH_BACKEND_COMPLEX', 'Backend – Complex Orchestration', 'Preset per API complesse con orchestrazione, saga pattern e integrazioni esterne.', 'BACKEND',
 '{"COMPLEXITY": "HIGH", "ENVIRONMENTS": "THREE_PLUS", "REUSE": "LOW", "STAKEHOLDERS": "FOUR_PLUS", "REGULATION": "HEAVY"}'::jsonb,
 '["R_INTEG_EXT", "R_SECURITY", "R_PERF", "R_DEPENDENCIES"]'::jsonb,
 '["BE_ANL_ALIGN_LG", "BE_API_COMPLEX_LG", "BE_DB_MIGRATION_LG", "BE_UNIT_TEST_LG", "BE_INT_TEST_LG", "BE_LOGGING_LG", "BE_DEPLOY_LG"]'::jsonb),

-- Frontend - Preset LIGHT (componente semplice)
('TECH_FRONTEND_SIMPLE', 'Frontend – Simple Component', 'Preset per componenti UI semplici senza stato complesso.', 'FRONTEND',
 '{"COMPLEXITY": "LOW", "ENVIRONMENTS": "ONE", "REUSE": "HIGH", "STAKEHOLDERS": "ONE_TEAM", "REGULATION": "NONE"}'::jsonb,
 '[]'::jsonb,
 '["FE_ANL_UX_SM", "FE_UI_COMPONENT_SM", "FE_API_INTEGRATION_SM", "FE_UNIT_TEST_SM", "FE_E2E_TEST_SM", "FE_DEPLOY_SM"]'::jsonb),

-- Frontend - Preset STANDARD
('TECH_FRONTEND_REACT', 'Frontend – Standard SPA', 'Preset per schermate React con form e integrazione API standard.', 'FRONTEND',
 '{"COMPLEXITY": "MEDIUM", "ENVIRONMENTS": "TWO", "REUSE": "HIGH", "STAKEHOLDERS": "TWO_THREE", "REGULATION": "NONE"}'::jsonb,
 '["R_SCOPE_CHANGE"]'::jsonb,
 '["FE_ANL_UX", "FE_UI_COMPONENT", "FE_FORM", "FE_API_INTEGRATION", "FE_UNIT_TEST", "FE_E2E_TEST", "FE_DEPLOY"]'::jsonb),

-- Frontend - Preset COMPLEX (feature completa)
('TECH_FRONTEND_COMPLEX', 'Frontend – Complex Feature', 'Preset per feature complesse con form multi-step, state management avanzato.', 'FRONTEND',
 '{"COMPLEXITY": "HIGH", "ENVIRONMENTS": "TWO", "REUSE": "MEDIUM", "STAKEHOLDERS": "TWO_THREE", "REGULATION": "MEDIUM"}'::jsonb,
 '["R_SCOPE_CHANGE", "R_DEPENDENCIES"]'::jsonb,
 '["FE_ANL_UX_LG", "FE_UI_COMPONENT_LG", "FE_FORM_LG", "FE_STATE_MGMT_LG", "FE_API_INTEGRATION_LG", "FE_UNIT_TEST_LG", "FE_E2E_TEST_LG", "FE_DEPLOY"]'::jsonb)
) AS t(code, name, description, tech_category, default_driver_values, default_risks, default_activity_codes)
ON CONFLICT (code) 
DO UPDATE SET 
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  tech_category = EXCLUDED.tech_category,
  default_driver_values = EXCLUDED.default_driver_values,
  default_risks = EXCLUDED.default_risks,
  default_activity_codes = EXCLUDED.default_activity_codes;