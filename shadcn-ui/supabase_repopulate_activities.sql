-- ============================================
-- Activities Catalog Repopulation
-- ============================================
-- Use this file to repopulate the global activities catalog after a temporary cleanup.
--
-- Important:
-- - This file only rebuilds rows in `activities`.
-- - It does not rebuild dependent rows in `technology_activities` or `estimation_activities`.
-- - If `activities` was emptied with DELETE/TRUNCATE, any previous foreign-key references
--   to old activity ids are not restored by this script.

BEGIN;

INSERT INTO activities (
    code,
    name,
    description,
    base_hours,
    tech_category,
    "group",
    active,
    is_custom,
    sm_multiplier,
    lg_multiplier
)
VALUES
    ('PP_ANL_ALIGN', 'Allineamento analisi requisiti', 'Sessioni di allineamento funzionale/tecnico sul requisito in ambito Power Platform.', 32.0, 'POWER_PLATFORM', 'ANALYSIS', true, false, 0.40, 2.00),
    ('PP_DV_FIELD', 'Creazione campi Dataverse', 'Definizione e creazione di nuovi campi su tabelle Dataverse, incluse proprieta base e relazioni semplici.', 16.0, 'POWER_PLATFORM', 'DEV', true, false, 0.50, 2.00),
    ('PP_DV_FORM', 'Configurazione form Dataverse', 'Configurazione layout form, controlli e logica di base lato Dataverse.', 32.0, 'POWER_PLATFORM', 'DEV', true, false, 0.50, 2.00),
    ('PP_FLOW_SIMPLE', 'Power Automate Flow semplice', 'Implementazione di un flusso Power Automate con logica lineare e poche condizioni.', 32.0, 'POWER_PLATFORM', 'DEV', true, false, 0.50, 1.50),
    ('PP_FLOW_COMPLEX', 'Power Automate Flow complesso', 'Flusso con piu condizioni, rami paralleli o integrazioni esterne.', 64.0, 'POWER_PLATFORM', 'DEV', true, false, 0.75, 2.00),
    ('PP_BUSINESS_RULE', 'Business Rule Dataverse', 'Configurazione di regole di business lato Dataverse (validazioni, calcoli, visibilita campi).', 16.0, 'POWER_PLATFORM', 'DEV', true, false, 0.50, 2.00),
    ('PP_E2E_TEST', 'Test end-to-end Power Platform', 'Test end-to-end della soluzione in ambiente di test/pre-produzione.', 64.0, 'POWER_PLATFORM', 'TEST', true, false, 0.50, 2.00),
    ('PP_UAT_RUN', 'Supporto UAT', 'Supporto agli utenti per esecuzione User Acceptance Test, raccolta feedback e piccoli aggiustamenti.', 64.0, 'POWER_PLATFORM', 'TEST', true, false, 0.50, 2.00),
    ('PP_DEPLOY', 'Deploy soluzione Power Platform', 'Preparazione e rilascio soluzione tra ambienti (dev/test/prod) con validazioni base.', 32.0, 'POWER_PLATFORM', 'OPS', true, false, 0.50, 2.00),

    ('BE_ANL_ALIGN', 'Analisi API / backend', 'Analisi requisiti specifici per endpoint, logica di business e sicurezza.', 32.0, 'BACKEND', 'ANALYSIS', true, false, 0.50, 2.00),
    ('BE_API_SIMPLE', 'Endpoint API semplice', 'Implementazione di un endpoint REST con logica lineare e CRUD standard.', 48.0, 'BACKEND', 'DEV', true, false, 0.533, 1.667),
    ('BE_API_COMPLEX', 'Endpoint API complesso', 'Endpoint con logica di business articolata, orchestrazione di piu servizi o chiamate esterne.', 96.0, 'BACKEND', 'DEV', true, false, 0.667, 2.00),
    ('BE_DB_MIGRATION', 'Migrazione schema DB', 'Creazione o modifica di schema DB (tabelle, indici, vincoli) e relativa migrazione.', 64.0, 'BACKEND', 'DEV', true, false, 0.50, 2.00),
    ('BE_UNIT_TEST', 'Unit test backend', 'Implementazione di unit test per servizi o controller backend.', 32.0, 'BACKEND', 'TEST', true, false, 0.50, 2.00),
    ('BE_INT_TEST', 'Integration test backend', 'Test di integrazione tra componenti backend e/o servizi esterni.', 48.0, 'BACKEND', 'TEST', true, false, 0.533, 2.00),
    ('BE_LOGGING', 'Logging & monitoring', 'Configurazione logging, metriche base e integrazione con sistema di monitoring.', 32.0, 'BACKEND', 'OPS', true, false, 0.50, 2.00),
    ('BE_DEPLOY', 'Deploy backend', 'Preparazione pipeline e rilascio in ambiente di destinazione.', 32.0, 'BACKEND', 'OPS', true, false, 0.50, 2.00),

    ('FE_ANL_UX', 'Analisi UX/UI', 'Analisi esigenze UX/UI per schermata o flusso frontend.', 32.0, 'FRONTEND', 'ANALYSIS', true, false, 0.50, 2.00),
    ('FE_UI_COMPONENT', 'Componente UI', 'Implementazione di un componente UI (React o equivalente) con logica base di presentazione.', 32.0, 'FRONTEND', 'DEV', true, false, 0.50, 2.00),
    ('FE_FORM', 'Form complesso', 'Implementazione form con validazioni, stato complesso e integrazione API.', 64.0, 'FRONTEND', 'DEV', true, false, 0.50, 2.00),
    ('FE_STATE_MGMT', 'Gestione stato', 'Configurazione e/o estensione di store globale (es. Redux, Zustand) o stato condiviso.', 48.0, 'FRONTEND', 'DEV', true, false, 0.533, 2.00),
    ('FE_API_INTEGRATION', 'Integrazione API', 'Integrazione con API esistenti, gestione errori e loading.', 32.0, 'FRONTEND', 'DEV', true, false, 0.50, 2.00),
    ('FE_UNIT_TEST', 'Unit test UI', 'Test unitari su componenti UI.', 32.0, 'FRONTEND', 'TEST', true, false, 0.50, 2.00),
    ('FE_E2E_TEST', 'E2E test frontend', 'Test end-to-end di flussi utente critici.', 48.0, 'FRONTEND', 'TEST', true, false, 0.533, 2.00),
    ('FE_DEPLOY', 'Deploy frontend', 'Build e pubblicazione applicazione frontend (CDN, hosting, configurazione base).', 32.0, 'FRONTEND', 'OPS', true, false, 0.50, 2.00),

    ('CRS_KICKOFF', 'Kickoff tecnico', 'Kickoff con team cross-funzionali per allineamento su scope, dipendenze e rischi.', 32.0, 'MULTI', 'GOVERNANCE', true, false, 0.50, 2.00),
    ('CRS_DOC', 'Documentazione tecnica', 'Redazione o aggiornamento documentazione tecnica fondamentale per il requisito.', 32.0, 'MULTI', 'GOVERNANCE', true, false, 0.50, 3.00),

    ('USU_ACTION_PLUGIN', 'Action Plugin (Jython/Java)', 'Implementare un plugin/azione custom che esegua logiche complesse su chiamata (es. recupero/elaborazione dati da servizio esterno), scritto in Jython con wrapper Java quando necessario.', 32.0, 'USU', 'DEV', true, false, 0.50, 2.00),
    ('USU_XOBJ_SET', 'Creazione e collegamento XObjSet', 'Definire due XObjSet e implementare la relazione (referenza, join, sincronizzazione) con operazioni CRUD coerenti.', 50.0, 'USU', 'DEV', true, false, 0.50, 2.00),
    ('USU_DYN_FORM', 'Estensione Dynamic Form', 'Aggiungere campi dinamici visibili/obbligatori in funzione di valori selezionati, con validazioni lato client/server.', 21.0, 'USU', 'DEV', true, false, 0.50, 2.00),
    ('USU_JOB_SCHED', 'Job Scheduler (Background Job)', 'Implementare job pianificati per compiti ricorrenti (p.es. pulizia, invio report, update dati).', 35.0, 'USU', 'DEV', true, false, 0.50, 2.00),
    ('USU_API_INT', 'Integrazione API esterna', 'Collegare USU a un servizio esterno per arricchire ticket (es. lookup anagrafica, meteo, ERP).', 75.0, 'USU', 'DEV', true, false, 0.50, 2.00),
    ('USU_WORKFLOW', 'Custom Workflow', 'Definire nuovi stati e regole di transizione (es. Verifica Tecnica), con automazioni e notifiche.', 60.0, 'USU', 'DEV', true, false, 0.50, 2.00),
    ('USU_LIST_VIEW', 'Custom List View Renderer', 'Modificare layout/colonne/interazioni di una list view per migliorare usabilita e filtraggio.', 32.0, 'USU', 'DEV', true, false, 0.50, 2.00),
    ('USU_WIDGET', 'Widget Dashboard custom', 'Realizzare un widget KPI/grafico integrato nella dashboard (es. conteggi SLA, trend).', 40.0, 'USU', 'DEV', true, false, 0.50, 2.00),
    ('USU_PERF_OPT', 'Analisi e miglioramento performance', 'Profiling e ottimizzazione queries e modello dati per una vista lenta.', 36.0, 'USU', 'DEV', true, false, 0.50, 2.00),
    ('USU_PDF_TMPL', 'Template PDF custom', 'Realizzare un template PDF per stampa ticket/report con layout e logo cliente.', 14.0, 'USU', 'DEV', true, false, 0.50, 2.00),
    ('USU_KPI_TRACK', 'Tracciamento KPI automatico', 'Calcolo e popolamento automatico di KPI per ticket (SLA, tempo apertura-chiusura, tempo in stato).', 29.0, 'USU', 'DEV', true, false, 0.50, 2.00),
    ('USU_RULE_ENG', 'Configurazione Motore di Regole', 'Implementare un motore / set di regole per azioni automatiche basate su condizioni (es. assegnazioni, cambi stati, notifiche).', 42.0, 'USU', 'DEV', true, false, 0.50, 2.00),
    ('USU_JYTHON_REF', 'Migrazione script Jython legacy', 'Revisione e refactor di script Jython legacy per uniformare stile, performance e compatibilita.', 64.0, 'USU', 'DEV', true, false, 0.50, 2.00),
    ('USU_SANDBOX', 'Creazione ambiente sandbox', 'Allestire un ambiente di test con dati anonimi ma realistici per collaudo e demo.', 42.0, 'USU', 'OPS', true, false, 0.50, 2.00),
    ('USU_DOCS', 'Documentazione tecnica strutturata', 'Redigere una documentazione chiara dei flussi, customizzazioni e punti di estensione usati nel progetto.', 21.0, 'USU', 'GOVERNANCE', true, false, 0.50, 2.00)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    base_hours = EXCLUDED.base_hours,
    tech_category = EXCLUDED.tech_category,
    "group" = EXCLUDED."group",
    active = EXCLUDED.active,
    is_custom = EXCLUDED.is_custom,
    sm_multiplier = EXCLUDED.sm_multiplier,
    lg_multiplier = EXCLUDED.lg_multiplier;

COMMIT;