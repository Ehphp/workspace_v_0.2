-- Migration: Add USU Technology and Activities
-- Description: Adds 'USU' to technologies and inserts 15 related activities.

-- 1. Insert USU Technology
INSERT INTO technologies (code, name, description, color, sort_order)
VALUES (
    'USU', 
    'USU', 
    'USU Service Management Technology', 
    '#ff9900', 
    40
)
ON CONFLICT (code) DO NOTHING;

-- 2. Insert USU Activities
-- Note: base_hours column stores HOURS.
-- Conversion: Effort (points) * 3 = Hours (approx).

INSERT INTO activities (code, name, description, base_hours, tech_category, "group", active)
VALUES
    -- 1) Action Plugin (Effort 8-13 -> ~32h)
    ('USU_ACTION_PLUGIN', 'Action Plugin (Jython/Java)', 'Implementare un plugin/azione custom che esegua logiche complesse su chiamata (es. recupero/elaborazione dati da servizio esterno), scritto in Jython con wrapper Java quando necessario.', 32.0, 'USU', 'DEV', true),

    -- 2) XObjSet Relation (Effort 13-20 -> ~50h)
    ('USU_XOBJ_SET', 'Creazione e collegamento XObjSet', 'Definire due XObjSet e implementare la relazione (referenza, join, sincronizzazione) con operazioni CRUD coerenti.', 50.0, 'USU', 'DEV', true),

    -- 3) Dynamic Form (Effort 5-9 -> ~21h)
    ('USU_DYN_FORM', 'Estensione Dynamic Form', 'Aggiungere campi dinamici visibili/obbligatori in funzione di valori selezionati, con validazioni lato client/server.', 21.0, 'USU', 'DEV', true),

    -- 4) Job Scheduler (Effort 8-15 -> ~35h)
    ('USU_JOB_SCHED', 'Job Scheduler (Background Job)', 'Implementare job pianificati per compiti ricorrenti (p.es. pulizia, invio report, update dati).', 35.0, 'USU', 'DEV', true),

    -- 5) API Integration (Effort 20-30 -> ~75h)
    ('USU_API_INT', 'Integrazione API esterna', 'Collegare USU a un servizio esterno per arricchire ticket (es. lookup anagrafica, meteo, ERP).', 75.0, 'USU', 'DEV', true),

    -- 6) Custom Workflow (Effort 15-25 -> ~60h)
    ('USU_WORKFLOW', 'Custom Workflow', 'Definire nuovi stati e regole di transizione (es. “Verifica Tecnica”), con automazioni e notifiche.', 60.0, 'USU', 'DEV', true),

    -- 7) Custom List View (Effort 8-13 -> ~32h)
    ('USU_LIST_VIEW', 'Custom List View Renderer', 'Modificare layout/colonne/interazioni di una list view per migliorare usabilità e filtraggio.', 32.0, 'USU', 'DEV', true),

    -- 8) Widget Dashboard (Effort 10-16 -> ~40h)
    ('USU_WIDGET', 'Widget Dashboard custom', 'Realizzare un widget KPI/grafico integrato nella dashboard (es. conteggi SLA, trend).', 40.0, 'USU', 'DEV', true),

    -- 9) Performance Optimization (Effort 8-16 -> ~36h)
    ('USU_PERF_OPT', 'Analisi e miglioramento performance', 'Profiling e ottimizzazione queries e modello dati per una vista lenta.', 36.0, 'USU', 'DEV', true),

    -- 10) PDF Template (Effort 3-6 -> ~14h)
    ('USU_PDF_TMPL', 'Template PDF custom', 'Realizzare un template PDF per stampa ticket/report con layout e logo cliente.', 14.0, 'USU', 'DEV', true),

    -- 11) KPI Tracking (Effort 7-12 -> ~29h)
    ('USU_KPI_TRACK', 'Tracciamento KPI automatico', 'Calcolo e popolamento automatico di KPI per ticket (SLA, tempo apertura-chiusura, tempo in stato).', 29.0, 'USU', 'DEV', true),

    -- 12) Rule Engine (Effort 10-18 -> ~42h)
    ('USU_RULE_ENG', 'Configurazione Motore di Regole', 'Implementare un motore / set di regole per azioni automatiche basate su condizioni (es. assegnazioni, cambi stati, notifiche).', 42.0, 'USU', 'DEV', true),

    -- 13) Jython Refactor (Effort 12-30 -> ~64h)
    ('USU_JYTHON_REF', 'Migrazione script Jython legacy', 'Revisione e refactor di script Jython legacy per uniformare stile, performance e compatibilità.', 64.0, 'USU', 'DEV', true),

    -- 14) Sandbox Environment (Effort 10-18 -> ~42h)
    ('USU_SANDBOX', 'Creazione ambiente sandbox', 'Allestire un ambiente di test con dati anonimi ma realistici per collaudo e demo.', 42.0, 'USU', 'OPS', true),

    -- 15) Documentation (Effort 5-9 -> ~21h)
    ('USU_DOCS', 'Documentazione tecnica strutturata', 'Redigere una documentazione chiara dei flussi, customizzazioni e punti di estensione usati nel progetto.', 21.0, 'USU', 'GOVERNANCE', true)

ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    base_hours = EXCLUDED.base_hours,
    tech_category = EXCLUDED.tech_category,
    "group" = EXCLUDED."group",
    active = EXCLUDED.active;
