-- Requirements Estimation System - Seed Data
-- Insert catalog data from JSON

-- ============================================
-- ACTIVITIES
-- ============================================

INSERT INTO activities (code, name, description, base_days, tech_category, "group", active) VALUES
-- Power Platform
('PP_ANL_ALIGN', 'Allineamento analisi requisiti', 'Sessioni di allineamento funzionale/tecnico sul requisito in ambito Power Platform.', 0.5, 'POWER_PLATFORM', 'ANALYSIS', true),
('PP_DV_FIELD', 'Creazione campi Dataverse', 'Definizione e creazione di nuovi campi su tabelle Dataverse, incluse proprietà base e relazioni semplici.', 0.25, 'POWER_PLATFORM', 'DEV', true),
('PP_DV_FORM', 'Configurazione form Dataverse', 'Configurazione layout form, controlli e logica di base lato Dataverse.', 0.5, 'POWER_PLATFORM', 'DEV', true),
('PP_FLOW_SIMPLE', 'Power Automate Flow semplice', 'Implementazione di un flusso Power Automate con logica lineare e poche condizioni.', 0.5, 'POWER_PLATFORM', 'DEV', true),
('PP_FLOW_COMPLEX', 'Power Automate Flow complesso', 'Flusso con più condizioni, rami paralleli o integrazioni esterne.', 1.0, 'POWER_PLATFORM', 'DEV', true),
('PP_BUSINESS_RULE', 'Business Rule Dataverse', 'Configurazione di regole di business lato Dataverse (validazioni, calcoli, visibilità campi).', 0.25, 'POWER_PLATFORM', 'DEV', true),
('PP_E2E_TEST', 'Test end-to-end Power Platform', 'Test end-to-end della soluzione in ambiente di test/pre-produzione.', 1.0, 'POWER_PLATFORM', 'TEST', true),
('PP_UAT_RUN', 'Supporto UAT', 'Supporto agli utenti per esecuzione User Acceptance Test, raccolta feedback e piccoli aggiustamenti.', 1.0, 'POWER_PLATFORM', 'TEST', true),
('PP_DEPLOY', 'Deploy soluzione Power Platform', 'Preparazione e rilascio soluzione tra ambienti (dev/test/prod) con validazioni base.', 0.5, 'POWER_PLATFORM', 'OPS', true),

-- Backend
('BE_ANL_ALIGN', 'Analisi API / backend', 'Analisi requisiti specifici per endpoint, logica di business e sicurezza.', 0.5, 'BACKEND', 'ANALYSIS', true),
('BE_API_SIMPLE', 'Endpoint API semplice', 'Implementazione di un endpoint REST con logica lineare e CRUD standard.', 0.75, 'BACKEND', 'DEV', true),
('BE_API_COMPLEX', 'Endpoint API complesso', 'Endpoint con logica di business articolata, orchestrazione di più servizi o chiamate esterne.', 1.5, 'BACKEND', 'DEV', true),
('BE_DB_MIGRATION', 'Migrazione schema DB', 'Creazione o modifica di schema DB (tabelle, indici, vincoli) e relativa migrazione.', 1.0, 'BACKEND', 'DEV', true),
('BE_UNIT_TEST', 'Unit test backend', 'Implementazione di unit test per servizi o controller backend.', 0.5, 'BACKEND', 'TEST', true),
('BE_INT_TEST', 'Integration test backend', 'Test di integrazione tra componenti backend e/o servizi esterni.', 0.75, 'BACKEND', 'TEST', true),
('BE_LOGGING', 'Logging & monitoring', 'Configurazione logging, metriche base e integrazione con sistema di monitoring.', 0.5, 'BACKEND', 'OPS', true),
('BE_DEPLOY', 'Deploy backend', 'Preparazione pipeline e rilascio in ambiente di destinazione.', 0.5, 'BACKEND', 'OPS', true),

-- Frontend
('FE_ANL_UX', 'Analisi UX/UI', 'Analisi esigenze UX/UI per schermata o flusso frontend.', 0.5, 'FRONTEND', 'ANALYSIS', true),
('FE_UI_COMPONENT', 'Componente UI', 'Implementazione di un componente UI (React o equivalente) con logica base di presentazione.', 0.5, 'FRONTEND', 'DEV', true),
('FE_FORM', 'Form complesso', 'Implementazione form con validazioni, stato complesso e integrazione API.', 1.0, 'FRONTEND', 'DEV', true),
('FE_STATE_MGMT', 'Gestione stato', 'Configurazione e/o estensione di store globale (es. Redux, Zustand) o stato condiviso.', 0.75, 'FRONTEND', 'DEV', true),
('FE_API_INTEGRATION', 'Integrazione API', 'Integrazione con API esistenti, gestione errori e loading.', 0.5, 'FRONTEND', 'DEV', true),
('FE_UNIT_TEST', 'Unit test UI', 'Test unitari su componenti UI.', 0.5, 'FRONTEND', 'TEST', true),
('FE_E2E_TEST', 'E2E test frontend', 'Test end-to-end di flussi utente critici.', 0.75, 'FRONTEND', 'TEST', true),
('FE_DEPLOY', 'Deploy frontend', 'Build e pubblicazione applicazione frontend (CDN, hosting, configurazione base).', 0.5, 'FRONTEND', 'OPS', true),

-- Multi-stack
('CRS_KICKOFF', 'Kickoff tecnico', 'Kickoff con team cross-funzionali per allineamento su scope, dipendenze e rischi.', 0.5, 'MULTI', 'GOVERNANCE', true),
('CRS_DOC', 'Documentazione tecnica', 'Redazione o aggiornamento documentazione tecnica fondamentale per il requisito.', 0.5, 'MULTI', 'GOVERNANCE', true);

-- ============================================
-- DRIVERS
-- ============================================

INSERT INTO drivers (code, name, description, options) VALUES
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
 ]'::jsonb);

-- ============================================
-- RISKS
-- ============================================

INSERT INTO risks (code, name, description, weight) VALUES
('R_INTEG_EXT', 'Integrazione con sistemi esterni', 'Il requisito prevede integrazioni con servizi o sistemi esterni non pienamente sotto il nostro controllo.', 5),
('R_PERF', 'Performance critical', 'Requisiti stringenti di prestazioni (latenza, throughput, carico elevato).', 5),
('R_AUDIT', 'Audit / Tracciabilità', 'Necessità di tracciare in modo dettagliato le operazioni per scopi di audit o compliance.', 4),
('R_MIGRATION', 'Migrazione dati legacy', 'Migrazione o trasformazione di dati esistenti da sistemi legacy.', 6),
('R_LEGACY', 'Dipendenza da legacy', 'Dipendenza forte da sistemi legacy, librerie obsolete o codice non manutenuto.', 4),
('R_SCOPE_CHANGE', 'Scope instabile', 'Scope del requisito percepito come instabile o soggetto a molti cambiamenti.', 3),
('R_SECURITY', 'Requisiti di sicurezza', 'Presenza di requisiti di sicurezza avanzati (autenticazione forte, cifratura, audit).', 5),
('R_DEPENDENCIES', 'Dipendenze critiche', 'Dipendenze da altri team, progetti o componenti che possono causare blocchi.', 4);

-- ============================================
-- TECHNOLOGY PRESETS
-- ============================================

INSERT INTO technology_presets (code, name, description, tech_category, default_driver_values, default_risks, default_activity_codes) VALUES
('TECH_PP_BASIC', 'Power Platform – Basic', 'Preset generico per requisiti Power Platform standard.', 'POWER_PLATFORM',
 '{"COMPLEXITY": "MEDIUM", "ENVIRONMENTS": "TWO", "REUSE": "MEDIUM", "STAKEHOLDERS": "TWO_THREE", "REGULATION": "MEDIUM"}'::jsonb,
 '["R_INTEG_EXT"]'::jsonb,
 '["PP_ANL_ALIGN", "PP_DV_FIELD", "PP_DV_FORM", "PP_FLOW_SIMPLE", "PP_E2E_TEST", "PP_DEPLOY"]'::jsonb),

('TECH_PP_HR', 'Power Platform – HR module', 'Preset per requisiti in ambito HR su Power Platform (candidature, notifiche, workflow).', 'POWER_PLATFORM',
 '{"COMPLEXITY": "MEDIUM", "ENVIRONMENTS": "THREE_PLUS", "REUSE": "HIGH", "STAKEHOLDERS": "TWO_THREE", "REGULATION": "HEAVY"}'::jsonb,
 '["R_AUDIT", "R_INTEG_EXT"]'::jsonb,
 '["PP_ANL_ALIGN", "PP_DV_FIELD", "PP_DV_FORM", "PP_FLOW_COMPLEX", "PP_BUSINESS_RULE", "PP_E2E_TEST", "PP_UAT_RUN", "PP_DEPLOY"]'::jsonb),

('TECH_BACKEND_API', 'Backend – REST API', 'Preset per implementazione o estensione di API REST backend.', 'BACKEND',
 '{"COMPLEXITY": "MEDIUM", "ENVIRONMENTS": "TWO", "REUSE": "MEDIUM", "STAKEHOLDERS": "TWO_THREE", "REGULATION": "MEDIUM"}'::jsonb,
 '["R_INTEG_EXT", "R_SECURITY"]'::jsonb,
 '["BE_ANL_ALIGN", "BE_API_SIMPLE", "BE_DB_MIGRATION", "BE_UNIT_TEST", "BE_INT_TEST", "BE_LOGGING", "BE_DEPLOY"]'::jsonb),

('TECH_FRONTEND_REACT', 'Frontend – React SPA', 'Preset per sviluppo di schermate o componenti in una Single Page Application React.', 'FRONTEND',
 '{"COMPLEXITY": "MEDIUM", "ENVIRONMENTS": "ONE", "REUSE": "HIGH", "STAKEHOLDERS": "TWO_THREE", "REGULATION": "NONE"}'::jsonb,
 '["R_SCOPE_CHANGE"]'::jsonb,
 '["FE_ANL_UX", "FE_UI_COMPONENT", "FE_FORM", "FE_API_INTEGRATION", "FE_UNIT_TEST", "FE_E2E_TEST", "FE_DEPLOY"]'::jsonb);