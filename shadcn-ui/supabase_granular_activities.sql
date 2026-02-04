-- ============================================
-- GRANULAR ACTIVITIES - Size-Based Variants
-- ============================================
-- Questa migrazione aggiunge varianti Small/Medium/Large per le attività principali
-- per consentire stime più precise e ridurre le sovrastime

-- POWER PLATFORM - Analysis
INSERT INTO activities (code, name, description, base_days, tech_category, "group", active) VALUES
('PP_ANL_ALIGN_SM', 'Allineamento analisi requisiti (Quick)', 'Quick sync con team tecnico per chiarimenti rapidi sul requisito (15-30 min).', 0.2, 'POWER_PLATFORM', 'ANALYSIS', true),
('PP_ANL_ALIGN_LG', 'Allineamento analisi requisiti (Workshop)', 'Workshop completo con stakeholder multipli e analisi dettagliata delle dipendenze.', 1.0, 'POWER_PLATFORM', 'ANALYSIS', true);

-- POWER PLATFORM - Development (Dataverse)
INSERT INTO activities (code, name, description, base_days, tech_category, "group", active) VALUES
('PP_DV_FIELD_SM', 'Creazione campi Dataverse (1-2 campi)', 'Aggiunta di 1-2 campi semplici senza relazioni complesse.', 0.125, 'POWER_PLATFORM', 'DEV', true),
('PP_DV_FIELD_LG', 'Creazione campi Dataverse (5+ campi)', 'Definizione di schema complesso con 5+ campi, relazioni e lookup multipli.', 0.5, 'POWER_PLATFORM', 'DEV', true),

('PP_DV_FORM_SM', 'Configurazione form Dataverse (Simple)', 'Form con pochi campi e layout standard, nessuna logica custom.', 0.25, 'POWER_PLATFORM', 'DEV', true),
('PP_DV_FORM_LG', 'Configurazione form Dataverse (Complex)', 'Form con tab multipli, business rules complesse e logica di visibilità avanzata.', 1.0, 'POWER_PLATFORM', 'DEV', true);

-- POWER PLATFORM - Development (Power Automate)
INSERT INTO activities (code, name, description, base_days, tech_category, "group", active) VALUES
('PP_FLOW_SIMPLE_SM', 'Power Automate Flow (Minimal)', 'Flow lineare con 2-3 step senza condizioni (es. notifica semplice).', 0.25, 'POWER_PLATFORM', 'DEV', true),
('PP_FLOW_SIMPLE_LG', 'Power Automate Flow (Standard+)', 'Flow con più condizioni, scope e gestione errori base.', 0.75, 'POWER_PLATFORM', 'DEV', true),

('PP_FLOW_COMPLEX_SM', 'Power Automate Flow complesso (Base)', 'Flow con logica condizionale media e 1-2 integrazioni.', 0.75, 'POWER_PLATFORM', 'DEV', true),
('PP_FLOW_COMPLEX_LG', 'Power Automate Flow complesso (Advanced)', 'Flow con orchestrazione complessa, parallelismo, retry logic e multiple integrazioni.', 2.0, 'POWER_PLATFORM', 'DEV', true);

-- POWER PLATFORM - Business Rules
INSERT INTO activities (code, name, description, base_days, tech_category, "group", active) VALUES
('PP_BUSINESS_RULE_SM', 'Business Rule Dataverse (Simple)', 'Singola regola con 1-2 condizioni (es. campo required se altro campo valorizzato).', 0.125, 'POWER_PLATFORM', 'DEV', true),
('PP_BUSINESS_RULE_LG', 'Business Rule Dataverse (Complex)', 'Set di regole multiple con logica complessa e calcoli articolati.', 0.5, 'POWER_PLATFORM', 'DEV', true);

-- POWER PLATFORM - Testing
INSERT INTO activities (code, name, description, base_days, tech_category, "group", active) VALUES
('PP_E2E_TEST_SM', 'Test end-to-end Power Platform (Smoke)', 'Test di smoke base per verificare funzionalità principali.', 0.5, 'POWER_PLATFORM', 'TEST', true),
('PP_E2E_TEST_LG', 'Test end-to-end Power Platform (Full)', 'Suite completa di test con scenari multipli e edge cases.', 2.0, 'POWER_PLATFORM', 'TEST', true),

('PP_UAT_RUN_SM', 'Supporto UAT (Light)', 'Supporto minimo durante UAT con presenza a chiamata.', 0.5, 'POWER_PLATFORM', 'TEST', true),
('PP_UAT_RUN_LG', 'Supporto UAT (Full)', 'Supporto continuativo con sessioni giornaliere e fix multipli.', 2.0, 'POWER_PLATFORM', 'TEST', true);

-- POWER PLATFORM - Operations
INSERT INTO activities (code, name, description, base_days, tech_category, "group", active) VALUES
('PP_DEPLOY_SM', 'Deploy soluzione Power Platform (Dev→Test)', 'Deploy semplice da dev a test con validazioni base.', 0.25, 'POWER_PLATFORM', 'OPS', true),
('PP_DEPLOY_LG', 'Deploy soluzione Power Platform (Multi-env)', 'Deploy su ambienti multipli con validazioni complete e rollback plan.', 1.0, 'POWER_PLATFORM', 'OPS', true);

-- BACKEND - Analysis
INSERT INTO activities (code, name, description, base_days, tech_category, "group", active) VALUES
('BE_ANL_ALIGN_SM', 'Analisi API / backend (Quick)', 'Review rapida di requisiti API standard con pattern noti.', 0.25, 'BACKEND', 'ANALYSIS', true),
('BE_ANL_ALIGN_LG', 'Analisi API / backend (Deep)', 'Analisi approfondita con design pattern, sicurezza e performance.', 1.0, 'BACKEND', 'ANALYSIS', true);

-- BACKEND - Development (API)
INSERT INTO activities (code, name, description, base_days, tech_category, "group", active) VALUES
('BE_API_SIMPLE_SM', 'Endpoint API semplice (CRUD)', 'GET/POST base senza logica business, solo CRUD su singola entità.', 0.4, 'BACKEND', 'DEV', true),
('BE_API_SIMPLE_LG', 'Endpoint API semplice (Business Logic)', 'Endpoint con validazioni custom e logica business moderata.', 1.25, 'BACKEND', 'DEV', true),

('BE_API_COMPLEX_SM', 'Endpoint API complesso (Base)', 'Endpoint con orchestrazione di 2-3 servizi interni.', 1.0, 'BACKEND', 'DEV', true),
('BE_API_COMPLEX_LG', 'Endpoint API complesso (Advanced)', 'Orchestrazione complessa con chiamate esterne, saga pattern, compensazioni.', 3.0, 'BACKEND', 'DEV', true);

-- BACKEND - Database
INSERT INTO activities (code, name, description, base_days, tech_category, "group", active) VALUES
('BE_DB_MIGRATION_SM', 'Migrazione schema DB (Simple)', 'Aggiunta di 1-2 colonne o indici su tabelle esistenti.', 0.5, 'BACKEND', 'DEV', true),
('BE_DB_MIGRATION_LG', 'Migrazione schema DB (Complex)', 'Creazione tabelle multiple con relazioni, trigger, stored procedures.', 2.0, 'BACKEND', 'DEV', true);

-- BACKEND - Testing
INSERT INTO activities (code, name, description, base_days, tech_category, "group", active) VALUES
('BE_UNIT_TEST_SM', 'Unit test backend (Basic)', 'Test unitari su 1-2 metodi con mock semplici.', 0.25, 'BACKEND', 'TEST', true),
('BE_UNIT_TEST_LG', 'Unit test backend (Comprehensive)', 'Suite completa con coverage elevata e scenari complessi.', 1.0, 'BACKEND', 'TEST', true),

('BE_INT_TEST_SM', 'Integration test backend (Basic)', 'Test di integrazione su singolo scenario principale.', 0.4, 'BACKEND', 'TEST', true),
('BE_INT_TEST_LG', 'Integration test backend (Full)', 'Suite completa con test di integrazione multi-servizio.', 1.5, 'BACKEND', 'TEST', true);

-- BACKEND - Operations
INSERT INTO activities (code, name, description, base_days, tech_category, "group", active) VALUES
('BE_LOGGING_SM', 'Logging & monitoring (Basic)', 'Aggiunta di log essenziali su punti critici.', 0.25, 'BACKEND', 'OPS', true),
('BE_LOGGING_LG', 'Logging & monitoring (Advanced)', 'Setup completo con metriche custom, dashboards e alerting.', 1.0, 'BACKEND', 'OPS', true),

('BE_DEPLOY_SM', 'Deploy backend (Single env)', 'Deploy su singolo ambiente con pipeline esistente.', 0.25, 'BACKEND', 'OPS', true),
('BE_DEPLOY_LG', 'Deploy backend (Multi-env)', 'Deploy su ambienti multipli con blue-green o canary strategy.', 1.0, 'BACKEND', 'OPS', true);

-- FRONTEND - Analysis
INSERT INTO activities (code, name, description, base_days, tech_category, "group", active) VALUES
('FE_ANL_UX_SM', 'Analisi UX/UI (Quick)', 'Review rapida su mockup esistenti o pattern noti.', 0.25, 'FRONTEND', 'ANALYSIS', true),
('FE_ANL_UX_LG', 'Analisi UX/UI (Design Session)', 'Sessione di design completa con wireframe, user journey e iterazioni.', 1.0, 'FRONTEND', 'ANALYSIS', true);

-- FRONTEND - Development (UI)
INSERT INTO activities (code, name, description, base_days, tech_category, "group", active) VALUES
('FE_UI_COMPONENT_SM', 'Componente UI (Atomic)', 'Componente atomico semplice (button, input, label) con styling base.', 0.25, 'FRONTEND', 'DEV', true),
('FE_UI_COMPONENT_LG', 'Componente UI (Complex)', 'Componente complesso con stato interno, interazioni multiple e animazioni.', 1.0, 'FRONTEND', 'DEV', true),

('FE_FORM_SM', 'Form (Simple)', 'Form con 3-5 campi e validazioni base.', 0.5, 'FRONTEND', 'DEV', true),
('FE_FORM_LG', 'Form (Complex)', 'Form multi-step con validazioni complesse, conditional fields e gestione errori avanzata.', 2.0, 'FRONTEND', 'DEV', true);

-- FRONTEND - State Management
INSERT INTO activities (code, name, description, base_days, tech_category, "group", active) VALUES
('FE_STATE_MGMT_SM', 'Gestione stato (Simple)', 'Aggiunta di singolo slice/store per entità semplice.', 0.4, 'FRONTEND', 'DEV', true),
('FE_STATE_MGMT_LG', 'Gestione stato (Complex)', 'Setup store complesso con normalizzazione, middleware e side effects.', 1.5, 'FRONTEND', 'DEV', true);

-- FRONTEND - API Integration
INSERT INTO activities (code, name, description, base_days, tech_category, "group", active) VALUES
('FE_API_INTEGRATION_SM', 'Integrazione API (Single)', 'Integrazione con singolo endpoint e gestione base errori/loading.', 0.25, 'FRONTEND', 'DEV', true),
('FE_API_INTEGRATION_LG', 'Integrazione API (Multiple)', 'Integrazione con API multiple, polling, retry logic e error boundaries.', 1.0, 'FRONTEND', 'DEV', true);

-- FRONTEND - Testing
INSERT INTO activities (code, name, description, base_days, tech_category, "group", active) VALUES
('FE_UNIT_TEST_SM', 'Unit test UI (Basic)', 'Test di render e props base su 1-2 componenti.', 0.25, 'FRONTEND', 'TEST', true),
('FE_UNIT_TEST_LG', 'Unit test UI (Comprehensive)', 'Suite completa con test di interazioni, hooks e edge cases.', 1.0, 'FRONTEND', 'TEST', true),

('FE_E2E_TEST_SM', 'E2E test frontend (Happy path)', 'Test E2E del flusso principale senza scenari alternativi.', 0.4, 'FRONTEND', 'TEST', true),
('FE_E2E_TEST_LG', 'E2E test frontend (Full coverage)', 'Suite E2E completa con scenari multipli, error cases e validazioni.', 1.5, 'FRONTEND', 'TEST', true);

-- FRONTEND - Operations
INSERT INTO activities (code, name, description, base_days, tech_category, "group", active) VALUES
('FE_DEPLOY_SM', 'Deploy frontend (Simple)', 'Build e deploy su singolo ambiente con configurazione esistente.', 0.25, 'FRONTEND', 'OPS', true),
('FE_DEPLOY_LG', 'Deploy frontend (Advanced)', 'Deploy multi-ambiente con CDN, cache invalidation e feature flags.', 1.0, 'FRONTEND', 'OPS', true);

-- MULTI-STACK - Governance
INSERT INTO activities (code, name, description, base_days, tech_category, "group", active) VALUES
('CRS_KICKOFF_SM', 'Kickoff tecnico (Quick)', 'Kickoff rapido per allineamento su requisito standard.', 0.25, 'MULTI', 'GOVERNANCE', true),
('CRS_KICKOFF_LG', 'Kickoff tecnico (Workshop)', 'Workshop completo con analisi rischi, dipendenze e plan dettagliato.', 1.0, 'MULTI', 'GOVERNANCE', true),

('CRS_DOC_SM', 'Documentazione tecnica (Basic)', 'Documentazione essenziale (README, commenti inline).', 0.25, 'MULTI', 'GOVERNANCE', true),
('CRS_DOC_LG', 'Documentazione tecnica (Comprehensive)', 'Documentazione completa: architettura, API docs, runbook, diagrammi.', 1.5, 'MULTI', 'GOVERNANCE', true);

-- ============================================
-- RIEPILOGO MODIFICHE
-- ============================================
-- Attività originali mantenute (peso MEDIUM):
-- - PP_ANL_ALIGN (0.5d), PP_DV_FIELD (0.25d), PP_DV_FORM (0.5d), etc.
--
-- Nuove varianti aggiunte:
-- - _SM (Small): ~40-50% del peso originale
-- - _LG (Large): ~150-200% del peso originale
--
-- Totale attività: 29 originali + 44 varianti = 73 attività
-- Questo permette stime molto più precise e riduce il rischio di sovrastime.
