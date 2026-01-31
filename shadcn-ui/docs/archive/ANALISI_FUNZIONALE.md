# Analisi Funzionale: Requirements Estimation System

## 1. Contesto e Obiettivi

**Scopo dell'applicazione**
Il sistema "Requirements Estimation System" (Syntero) è un'applicazione web progettata per supportare Project Manager, Tech Lead e analisti nella stima accurata, rapida e standardizzata dello sforzo di sviluppo software necessario per soddisfare specifici requisiti di business.

**Problema risolto**
Risolve il problema della soggettività e dell'incoerenza nelle stime software, fornendo un processo guidato che combina parametri oggettivi (attività standard, complessità tecnica) con il supporto dell'Intelligenza Artificiale per suggerire le attività necessarie.

**Scenario d'uso**
Un utente (es. un PM) riceve un requisito funzionale (es. "Login con SPID"). Invece di stimare "a occhio", inserisce la descrizione nel sistema, seleziona lo stack tecnologico, riceve un suggerimento automatico delle attività tecniche da svolgere, applica fattori di rischio e complessità, e ottiene un calcolo trasparente dei giorni uomo necessari.

## 2. Attori e Ruoli

Dall'analisi del codice (in particolare `supabase_schema.sql` e le rotte in `App.tsx`), emergono i seguenti attori:

*   **Utente Standard (Estimator)**:
    *   Può creare liste di requisiti e progetti.
    *   Può eseguire stime (Quick o Wizard).
    *   Può salvare e gestire le proprie stime.
    *   Vede solo i propri dati (garantito da RLS - Row Level Security).
*   **Amministratore (Admin)**:
    *   Gestisce i cataloghi centralizzati: Attività, Driver, Rischi, Preset Tecnologici.
    *   Ha accesso al pannello di amministrazione (`src/pages/Admin.tsx`).
*   **Sistema AI (Agente)**:
    *   Analizza le descrizioni testuali dei requisiti.
    *   Suggerisce attività pertinenti dal catalogo.
    *   Genera titoli sintetici per i requisiti.

## 3. Mappa dei Moduli Funzionali

### Modulo Autenticazione
*   **Funzione**: Gestione accesso sicuro.
*   **Feature**: Login, Registrazione, Logout.
*   **Tecnologia**: Supabase Auth.

### Modulo Wizard di Stima (Core)
*   **Funzione**: Processo guidato in 5 step per produrre una stima.
*   **Step**:
    1.  **Requisito**: Definizione ID, titolo e descrizione.
    2.  **Tecnologia**: Selezione dello stack (es. Java, .NET, React) che influenza le attività disponibili.
    3.  **Attività**: Selezione delle task tecniche (es. "Disegno DB", "Implementazione API"). Supportato da AI.
    4.  **Driver & Rischi**: Applicazione di moltiplicatori di complessità e buffer di rischio.
    5.  **Risultati**: Visualizzazione del calcolo finale e salvataggio.

### Modulo Quick Estimate
*   **Funzione**: Stima rapida per utenti che vogliono un ordine di grandezza immediato senza configurazioni dettagliate.
*   **Logica**: Usa l'AI per autocompilare le attività basandosi solo sulla descrizione.

### Modulo Gestione Liste e Requisiti
*   **Funzione**: Organizzazione del lavoro.
*   **Feature**:
    *   Creazione "Liste" (contenitori logici/progetti).
    *   CRUD sui Requisiti all'interno delle liste.
    *   Importazione massiva da Excel (`src/lib/excelParser.ts`).

### Modulo Amministrazione
*   **Funzione**: Manutenzione della base di conoscenza.
*   **Feature**: Gestione CRUD dei cataloghi (Attività, Driver, Rischi, Preset).

## 4. Flussi di Business Principali

### Flusso 1: Creazione Nuova Stima (Wizard)
*   **Attore**: Utente Standard
*   **Trigger**: Click su "Advanced Wizard" dalla Home o "New Estimation" da un requisito.
*   **Passi**:
    1.  Inserimento dettagli requisito.
    2.  Scelta Preset Tecnologico (es. "Backend Java").
    3.  Click su "AI Suggest" -> Il sistema chiama OpenAI (via Netlify function) per selezionare le attività pertinenti dal DB.
    4.  L'utente revisiona le attività, aggiunge/rimuove voci.
    5.  L'utente imposta i Driver (es. "Complessità: Alta") e i Rischi (es. "Requisiti vaghi").
    6.  Il sistema calcola in tempo reale: `(Giorni Base * Moltiplicatori) + Contingency`.
*   **Output**: Una stima salvata collegata al requisito.

### Flusso 2: Importazione Requisiti da Excel
*   **Attore**: Utente Standard
*   **Trigger**: Upload file Excel nella pagina Lista.
*   **Passi**:
    1.  Parsing del file Excel (client-side).
    2.  Mapping automatico delle colonne (ID, Titolo, Priorità, ecc.) basato su header noti.
    3.  Validazione dei dati (es. ID obbligatorio).
    4.  Salvataggio massivo su Supabase.
*   **Output**: Popolamento della lista requisiti.

## 5. Modello Dati Funzionale

Le entità principali (`supabase_schema.sql`) riflettono il dominio della stima software:

*   **Activities (Attività)**: L'unità base di lavoro (es. "Creazione tabella DB"). Ha un costo base in giorni (`base_days`) e appartiene a una categoria tecnica e fase (Analisi, Dev, Test).
*   **Drivers**: Fattori moltiplicativi che alterano lo sforzo (es. "Complessità Algoritmica"). Hanno opzioni (Basso, Medio, Alto) con relativi moltiplicatori.
*   **Risks (Rischi)**: Fattori additivi di incertezza. Ogni rischio ha un "peso" che contribuisce al calcolo della contingency.
*   **Technology Presets**: Configurazioni predefinite (es. "Full Stack React/Node") che preselezionano attività e driver di default per velocizzare l'input.
*   **Lists & Requirements**: Struttura gerarchica per organizzare le stime. Una Lista contiene N Requisiti.
*   **Estimations**: L'oggetto che collega un Requisito a un set di scelte (Attività scelte, Valori Driver, Rischi attivati) e storicizza il risultato calcolato.

## 6. Regole di Business e Validazioni

**Logica di Calcolo (`src/lib/estimationEngine.ts`)**
1.  **Base Days**: Somma dei giorni delle attività selezionate.
2.  **Driver Multiplier**: Prodotto dei moltiplicatori dei driver selezionati (default 1.0).
3.  **Subtotal**: `Base Days * Driver Multiplier`.
4.  **Risk Score**: Somma dei pesi dei rischi selezionati.
5.  **Contingency %**:
    *   Score 0-10 -> +10%
    *   Score 11-20 -> +15%
    *   Score 21-30 -> +20%
    *   Score >30 -> +25%
6.  **Total Days**: `Subtotal * (1 + Contingency %)`.

**Validazioni**
*   **Frontend**:
    *   Obbligatorietà descrizione per l'AI.
    *   Validazione formato file Excel.
    *   Prevenzione salvataggio stima senza attività selezionate.
*   **Backend (RLS)**:
    *   Un utente può vedere/modificare solo le proprie liste e stime.
    *   I cataloghi (Attività, ecc.) sono in sola lettura per gli utenti standard.

## 7. Integrazioni Esterne

*   **OpenAI API**:
    *   Usata per: Suggerimento attività (`suggestActivities`) e generazione titoli (`generateTitleFromDescription`).
    *   Implementazione: Chiamata via Serverless Function (Netlify) per nascondere l'API Key.
*   **Supabase**:
    *   Usato per: Database (PostgreSQL), Auth, Realtime.

## 8. Configurabilità

*   **Technology Presets**: Il sistema è altamente configurabile tramite i preset. Un admin può creare un preset "Legacy Mainframe" con attività e pesi specifici, cambiando radicalmente il comportamento di stima per quel contesto senza toccare il codice.
*   **Custom Activities**: Gli utenti possono definire attività "custom" se quelle a catalogo non bastano (flag `is_custom` su tabella activities).

## 9. Limiti e Punti Aperti

*   **Export**: Il codice menziona "PDF/CSV Export: Planned for future implementation", quindi attualmente manca una funzione di export ufficiale del documento di stima.
*   **Multi-utenza collaborativa**: L'RLS è stretto sull'owner (`auth.uid() = user_id`). Non sembra esserci ancora un concetto di "Team" o condivisione progetto tra più utenti.
*   **Versioning**: Le stime vengono salvate, ma non è esplicito un meccanismo di versionamento del *catalogo*. Se un admin cambia il peso di un'attività, le stime passate potrebbero ricalcolarsi se riaperte (da verificare comportamento storico vs live).
