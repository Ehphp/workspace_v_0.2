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
UPDATE activities SET name = 'Allineamento analisi requisiti', description = 'Sessioni di allineamento funzionale/tecnico sul requisito in ambito Power Platform.', base_hours = 32.0, tech_category = 'POWER_PLATFORM', "group" = 'ANALYSIS', active = true WHERE code = 'PP_ANL_ALIGN';
UPDATE activities SET name = 'Creazione campi Dataverse', description = 'Definizione e creazione di nuovi campi su tabelle Dataverse, incluse proprietà base e relazioni semplici.', base_hours = 16.0, tech_category = 'POWER_PLATFORM', "group" = 'DEV', active = true WHERE code = 'PP_DV_FIELD';
UPDATE activities SET name = 'Configurazione form Dataverse', description = 'Configurazione layout form, controlli e logica di base lato Dataverse.', base_hours = 32.0, tech_category = 'POWER_PLATFORM', "group" = 'DEV', active = true WHERE code = 'PP_DV_FORM';
UPDATE activities SET name = 'Power Automate Flow semplice', description = 'Implementazione di un flusso Power Automate con logica lineare e poche condizioni.', base_hours = 32.0, tech_category = 'POWER_PLATFORM', "group" = 'DEV', active = true WHERE code = 'PP_FLOW_SIMPLE';
UPDATE activities SET name = 'Power Automate Flow complesso', description = 'Flusso con più condizioni, rami paralleli o integrazioni esterne.', base_hours = 64.0, tech_category = 'POWER_PLATFORM', "group" = 'DEV', active = true WHERE code = 'PP_FLOW_COMPLEX';
UPDATE activities SET name = 'Business Rule Dataverse', description = 'Configurazione di regole di business lato Dataverse (validazioni, calcoli, visibilità campi).', base_hours = 16.0, tech_category = 'POWER_PLATFORM', "group" = 'DEV', active = true WHERE code = 'PP_BUSINESS_RULE';
UPDATE activities SET name = 'Test end-to-end Power Platform', description = 'Test end-to-end della soluzione in ambiente di test/pre-produzione.', base_hours = 64.0, tech_category = 'POWER_PLATFORM', "group" = 'TEST', active = true WHERE code = 'PP_E2E_TEST';
UPDATE activities SET name = 'Supporto UAT', description = 'Supporto agli utenti per esecuzione User Acceptance Test, raccolta feedback e piccoli aggiustamenti.', base_hours = 64.0, tech_category = 'POWER_PLATFORM', "group" = 'TEST', active = true WHERE code = 'PP_UAT_RUN';
UPDATE activities SET name = 'Deploy soluzione Power Platform', description = 'Preparazione e rilascio soluzione tra ambienti (dev/test/prod) con validazioni base.', base_hours = 32.0, tech_category = 'POWER_PLATFORM', "group" = 'OPS', active = true WHERE code = 'PP_DEPLOY';

-- Backend
UPDATE activities SET name = 'Analisi API / backend', description = 'Analisi requisiti specifici per endpoint, logica di business e sicurezza.', base_hours = 32.0, tech_category = 'BACKEND', "group" = 'ANALYSIS', active = true WHERE code = 'BE_ANL_ALIGN';
UPDATE activities SET name = 'Endpoint API semplice', description = 'Implementazione di un endpoint REST con logica lineare e CRUD standard.', base_hours = 48.0, tech_category = 'BACKEND', "group" = 'DEV', active = true WHERE code = 'BE_API_SIMPLE';
UPDATE activities SET name = 'Endpoint API complesso', description = 'Endpoint con logica di business articolata, orchestrazione di più servizi o chiamate esterne.', base_hours = 96.0, tech_category = 'BACKEND', "group" = 'DEV', active = true WHERE code = 'BE_API_COMPLEX';
UPDATE activities SET name = 'Migrazione schema DB', description = 'Creazione o modifica di schema DB (tabelle, indici, vincoli) e relativa migrazione.', base_hours = 64.0, tech_category = 'BACKEND', "group" = 'DEV', active = true WHERE code = 'BE_DB_MIGRATION';
UPDATE activities SET name = 'Unit test backend', description = 'Implementazione di unit test per servizi o controller backend.', base_hours = 32.0, tech_category = 'BACKEND', "group" = 'TEST', active = true WHERE code = 'BE_UNIT_TEST';
UPDATE activities SET name = 'Integration test backend', description = 'Test di integrazione tra componenti backend e/o servizi esterni.', base_hours = 48.0, tech_category = 'BACKEND', "group" = 'TEST', active = true WHERE code = 'BE_INT_TEST';
UPDATE activities SET name = 'Logging & monitoring', description = 'Configurazione logging, metriche base e integrazione con sistema di monitoring.', base_hours = 32.0, tech_category = 'BACKEND', "group" = 'OPS', active = true WHERE code = 'BE_LOGGING';
UPDATE activities SET name = 'Deploy backend', description = 'Preparazione pipeline e rilascio in ambiente di destinazione.', base_hours = 32.0, tech_category = 'BACKEND', "group" = 'OPS', active = true WHERE code = 'BE_DEPLOY';

-- Frontend
UPDATE activities SET name = 'Analisi UX/UI', description = 'Analisi esigenze UX/UI per schermata o flusso frontend.', base_hours = 32.0, tech_category = 'FRONTEND', "group" = 'ANALYSIS', active = true WHERE code = 'FE_ANL_UX';
UPDATE activities SET name = 'Componente UI', description = 'Implementazione di un componente UI (React o equivalente) con logica base di presentazione.', base_hours = 32.0, tech_category = 'FRONTEND', "group" = 'DEV', active = true WHERE code = 'FE_UI_COMPONENT';
UPDATE activities SET name = 'Form complesso', description = 'Implementazione form con validazioni, stato complesso e integrazione API.', base_hours = 64.0, tech_category = 'FRONTEND', "group" = 'DEV', active = true WHERE code = 'FE_FORM';
UPDATE activities SET name = 'Gestione stato', description = 'Configurazione e/o estensione di store globale (es. Redux, Zustand) o stato condiviso.', base_hours = 48.0, tech_category = 'FRONTEND', "group" = 'DEV', active = true WHERE code = 'FE_STATE_MGMT';
UPDATE activities SET name = 'Integrazione API', description = 'Integrazione con API esistenti, gestione errori e loading.', base_hours = 32.0, tech_category = 'FRONTEND', "group" = 'DEV', active = true WHERE code = 'FE_API_INTEGRATION';
UPDATE activities SET name = 'Unit test UI', description = 'Test unitari su componenti UI.', base_hours = 32.0, tech_category = 'FRONTEND', "group" = 'TEST', active = true WHERE code = 'FE_UNIT_TEST';
UPDATE activities SET name = 'E2E test frontend', description = 'Test end-to-end di flussi utente critici.', base_hours = 48.0, tech_category = 'FRONTEND', "group" = 'TEST', active = true WHERE code = 'FE_E2E_TEST';
UPDATE activities SET name = 'Deploy frontend', description = 'Build e pubblicazione applicazione frontend (CDN, hosting, configurazione base).', base_hours = 32.0, tech_category = 'FRONTEND', "group" = 'OPS', active = true WHERE code = 'FE_DEPLOY';

-- Multi-stack
UPDATE activities SET name = 'Kickoff tecnico', description = 'Kickoff con team cross-funzionali per allineamento su scope, dipendenze e rischi.', base_hours = 32.0, tech_category = 'MULTI', "group" = 'GOVERNANCE', active = true WHERE code = 'CRS_KICKOFF';
UPDATE activities SET name = 'Documentazione tecnica', description = 'Redazione o aggiornamento documentazione tecnica fondamentale per il requisito.', base_hours = 32.0, tech_category = 'MULTI', "group" = 'GOVERNANCE', active = true WHERE code = 'CRS_DOC';

-- Step 2: Set non-default multipliers for outlier activities
UPDATE activities SET sm_multiplier = 0.40 WHERE code = 'PP_ANL_ALIGN';
UPDATE activities SET lg_multiplier = 1.50 WHERE code = 'PP_FLOW_SIMPLE';
UPDATE activities SET sm_multiplier = 0.75 WHERE code = 'PP_FLOW_COMPLEX';
UPDATE activities SET sm_multiplier = 0.533, lg_multiplier = 1.667 WHERE code = 'BE_API_SIMPLE';
UPDATE activities SET sm_multiplier = 0.667 WHERE code = 'BE_API_COMPLEX';
UPDATE activities SET sm_multiplier = 0.533 WHERE code = 'BE_INT_TEST';
UPDATE activities SET sm_multiplier = 0.533 WHERE code = 'FE_STATE_MGMT';
UPDATE activities SET sm_multiplier = 0.533 WHERE code = 'FE_E2E_TEST';
UPDATE activities SET lg_multiplier = 3.00 WHERE code = 'CRS_DOC';

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
-- Presets now use base codes only + complexity_tier for effort scaling
INSERT INTO technology_presets (code, name, description, tech_category, default_driver_values, default_risks, default_activity_codes, complexity_tier) 
SELECT * FROM (VALUES
-- Power Platform - Preset LIGHT (per task semplici e veloci)
('TECH_PP_LIGHT', 'Power Platform – Light', 'Preset per requisiti PP semplici e veloci (es. aggiungere campo, notifica base).', 'POWER_PLATFORM',
 '{"COMPLEXITY": "LOW", "ENVIRONMENTS": "ONE", "REUSE": "HIGH", "STAKEHOLDERS": "ONE_TEAM", "REGULATION": "NONE"}'::jsonb,
 '[]'::jsonb,
 '["PP_ANL_ALIGN", "PP_DV_FIELD", "PP_DV_FORM", "PP_FLOW_SIMPLE", "PP_E2E_TEST", "PP_DEPLOY"]'::jsonb,
 'LIGHT'),

-- Power Platform - Preset STANDARD (bilanciato)
('TECH_PP_BASIC', 'Power Platform – Standard', 'Preset generico per requisiti Power Platform di complessità media.', 'POWER_PLATFORM',
 '{"COMPLEXITY": "MEDIUM", "ENVIRONMENTS": "TWO", "REUSE": "MEDIUM", "STAKEHOLDERS": "TWO_THREE", "REGULATION": "MEDIUM"}'::jsonb,
 '["R_INTEG_EXT"]'::jsonb,
 '["PP_ANL_ALIGN", "PP_DV_FIELD", "PP_DV_FORM", "PP_FLOW_SIMPLE", "PP_E2E_TEST", "PP_DEPLOY"]'::jsonb,
 'STANDARD'),

-- Power Platform - Preset COMPLEX (per progetti articolati)
('TECH_PP_HR', 'Power Platform – Complex (HR)', 'Preset per requisiti complessi in ambito HR con workflow articolati e compliance.', 'POWER_PLATFORM',
 '{"COMPLEXITY": "HIGH", "ENVIRONMENTS": "THREE_PLUS", "REUSE": "MEDIUM", "STAKEHOLDERS": "TWO_THREE", "REGULATION": "HEAVY"}'::jsonb,
 '["R_AUDIT", "R_INTEG_EXT", "R_SECURITY"]'::jsonb,
 '["PP_ANL_ALIGN", "PP_DV_FIELD", "PP_DV_FORM", "PP_FLOW_COMPLEX", "PP_BUSINESS_RULE", "PP_E2E_TEST", "PP_UAT_RUN", "PP_DEPLOY"]'::jsonb,
 'COMPLEX'),

-- Backend - Preset LIGHT (CRUD semplice)
('TECH_BACKEND_SIMPLE', 'Backend – Simple CRUD', 'Preset per endpoint API semplici con CRUD standard.', 'BACKEND',
 '{"COMPLEXITY": "LOW", "ENVIRONMENTS": "ONE", "REUSE": "HIGH", "STAKEHOLDERS": "ONE_TEAM", "REGULATION": "NONE"}'::jsonb,
 '[]'::jsonb,
 '["BE_ANL_ALIGN", "BE_API_SIMPLE", "BE_DB_MIGRATION", "BE_UNIT_TEST", "BE_INT_TEST", "BE_LOGGING", "BE_DEPLOY"]'::jsonb,
 'LIGHT'),

-- Backend - Preset STANDARD
('TECH_BACKEND_API', 'Backend – Standard API', 'Preset per implementazione API REST con logica business moderata.', 'BACKEND',
 '{"COMPLEXITY": "MEDIUM", "ENVIRONMENTS": "TWO", "REUSE": "MEDIUM", "STAKEHOLDERS": "TWO_THREE", "REGULATION": "MEDIUM"}'::jsonb,
 '["R_INTEG_EXT", "R_SECURITY"]'::jsonb,
 '["BE_ANL_ALIGN", "BE_API_SIMPLE", "BE_DB_MIGRATION", "BE_UNIT_TEST", "BE_INT_TEST", "BE_LOGGING", "BE_DEPLOY"]'::jsonb,
 'STANDARD'),

-- Backend - Preset COMPLEX (orchestrazione)
('TECH_BACKEND_COMPLEX', 'Backend – Complex Orchestration', 'Preset per API complesse con orchestrazione, saga pattern e integrazioni esterne.', 'BACKEND',
 '{"COMPLEXITY": "HIGH", "ENVIRONMENTS": "THREE_PLUS", "REUSE": "LOW", "STAKEHOLDERS": "FOUR_PLUS", "REGULATION": "HEAVY"}'::jsonb,
 '["R_INTEG_EXT", "R_SECURITY", "R_PERF", "R_DEPENDENCIES"]'::jsonb,
 '["BE_ANL_ALIGN", "BE_API_COMPLEX", "BE_DB_MIGRATION", "BE_UNIT_TEST", "BE_INT_TEST", "BE_LOGGING", "BE_DEPLOY"]'::jsonb,
 'COMPLEX'),

-- Frontend - Preset LIGHT (componente semplice)
('TECH_FRONTEND_SIMPLE', 'Frontend – Simple Component', 'Preset per componenti UI semplici senza stato complesso.', 'FRONTEND',
 '{"COMPLEXITY": "LOW", "ENVIRONMENTS": "ONE", "REUSE": "HIGH", "STAKEHOLDERS": "ONE_TEAM", "REGULATION": "NONE"}'::jsonb,
 '[]'::jsonb,
 '["FE_ANL_UX", "FE_UI_COMPONENT", "FE_API_INTEGRATION", "FE_UNIT_TEST", "FE_E2E_TEST", "FE_DEPLOY"]'::jsonb,
 'LIGHT'),

-- Frontend - Preset STANDARD
('TECH_FRONTEND_REACT', 'Frontend – Standard SPA', 'Preset per schermate React con form e integrazione API standard.', 'FRONTEND',
 '{"COMPLEXITY": "MEDIUM", "ENVIRONMENTS": "TWO", "REUSE": "HIGH", "STAKEHOLDERS": "TWO_THREE", "REGULATION": "NONE"}'::jsonb,
 '["R_SCOPE_CHANGE"]'::jsonb,
 '["FE_ANL_UX", "FE_UI_COMPONENT", "FE_FORM", "FE_API_INTEGRATION", "FE_UNIT_TEST", "FE_E2E_TEST", "FE_DEPLOY"]'::jsonb,
 'STANDARD'),

-- Frontend - Preset COMPLEX (feature completa)
('TECH_FRONTEND_COMPLEX', 'Frontend – Complex Feature', 'Preset per feature complesse con form multi-step, state management avanzato.', 'FRONTEND',
 '{"COMPLEXITY": "HIGH", "ENVIRONMENTS": "TWO", "REUSE": "MEDIUM", "STAKEHOLDERS": "TWO_THREE", "REGULATION": "MEDIUM"}'::jsonb,
 '["R_SCOPE_CHANGE", "R_DEPENDENCIES"]'::jsonb,
 '["FE_ANL_UX", "FE_UI_COMPONENT", "FE_FORM", "FE_STATE_MGMT", "FE_API_INTEGRATION", "FE_UNIT_TEST", "FE_E2E_TEST", "FE_DEPLOY"]'::jsonb,
 'COMPLEX')
) AS t(code, name, description, tech_category, default_driver_values, default_risks, default_activity_codes, complexity_tier)
ON CONFLICT (code) 
DO UPDATE SET 
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  tech_category = EXCLUDED.tech_category,
  default_driver_values = EXCLUDED.default_driver_values,
  default_risks = EXCLUDED.default_risks,
  default_activity_codes = EXCLUDED.default_activity_codes;
