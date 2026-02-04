# Analisi Funzionale Aggiornata: Requirements Estimation System

## 1. Visione e Obiettivi

**Scopo del Sistema**
Il "Requirements Estimation System" (Syntero) è una piattaforma evoluta per la stima dei costi e dei tempi di sviluppo software. L'obiettivo è trasformare un processo tipicamente soggettivo e destrutturato in un flusso di lavoro guidato, oggettivo e supportato dall'Intelligenza Artificiale.

**Valore per il Business**
*   **Standardizzazione**: Uniforma il metodo di stima attraverso cataloghi condivisi di attività e driver.
*   **Efficienza**: Riduce i tempi di stima grazie ai preset tecnologici e ai suggerimenti AI.
*   **Trasparenza**: Fornisce un dettaglio granulare di come si arriva al "numero finale" (giorni uomo), facilitando la negoziazione con gli stakeholder.

## 2. Architettura Funzionale

Il sistema si articola in moduli interconnessi accessibili tramite una Dashboard centrale.

### 2.1 Dashboard Esecutiva (Nuova)
Il punto di ingresso principale per l'utente autenticato.
*   **KPI Cards**: Visualizzazione immediata di metriche chiave (Progetti Totali, Requisiti Attivi, Giorni Totali Stimati).
*   **Project Cards**: Accesso rapido ai progetti (Liste) con indicatori di stato.
*   **Recent Requirements**: Carosello dei requisiti lavorati di recente per una ripresa rapida delle attività.
*   **Tech Stack Usage**: Visualizzazione (Treemap) dell'utilizzo delle tecnologie nei progetti.

### 2.2 Modulo di Stima (Wizard & Quick)
Il cuore dell'applicazione, offre due modalità di stima:

*   **Advanced Wizard (5 Step)**:
    1.  **Dettaglio Requisito**: Definizione del perimetro funzionale.
    2.  **Stack Tecnologico**: Selezione del Preset (es. "Java Backend", "React Frontend") che configura automaticamente le attività base.
    3.  **Attività (AI Powered)**: Selezione puntuale dei task tecnici. L'AI analizza la descrizione e suggerisce le attività più pertinenti dal catalogo.
    4.  **Driver & Rischi**: Applicazione di moltiplicatori di complessità (es. "Integrazioni Legacy") e buffer di rischio.
    5.  **Review & Save**: Calcolo finale con breakdown dei costi.

*   **Quick Estimate**:
    *   Modalità accelerata per stime "ROM" (Rough Order of Magnitude).
    *   L'AI inferisce automaticamente attività e complessità dalla sola descrizione testuale.

### 2.3 Modulo Configurazione (Ex Admin)
Permette la personalizzazione profonda del sistema senza interventi sul codice.
*   **Activities Management**: Creazione e modifica delle attività elementari (es. "Disegno API", "Unit Test").
*   **Technology Presets**: Gestione dei "pacchetti" tecnologici.
    *   *Novità*: Supporto per **Preset Custom**. Gli utenti possono creare i propri preset clonando quelli di sistema o partendo da zero, definendo set di attività e driver predefiniti.
*   **Drivers & Risks**: Configurazione dei fattori moltiplicativi e dei rischi standard.

### 2.4 Modulo Gestione Requisiti
*   **Liste (Progetti)**: Contenitori logici per raggruppare i requisiti.
*   **Import Excel**: Funzionalità per il caricamento massivo di backlog da file Excel esistenti.
*   **Dettaglio Requisito**: Pagina dedicata alla visualizzazione e modifica di tutte le informazioni di un requisito, inclusa la storia delle stime.

## 3. Attori e Sicurezza

Il sistema utilizza un modello di sicurezza **Row Level Security (RLS)** su Supabase.

*   **Utente Standard (Estimator)**:
    *   Accesso completo ai propri dati (Liste, Requisiti, Stime).
    *   Accesso in lettura ai cataloghi di sistema (Attività, Preset OOTB).
    *   Possibilità di creare ed estendere i cataloghi con versioni "Custom" (es. Attività personalizzate, Preset privati).
*   **Sistema (System/Admin)**:
    *   Gestisce i cataloghi globali condivisi da tutti gli utenti.

## 4. Flussi Operativi Chiave

### Flusso di Stima Standard
1.  L'utente crea una **Lista** (Progetto).
2.  Aggiunge un **Requisito** (manualmente o via Excel).
3.  Avvia il **Wizard di Stima**.
4.  Seleziona un **Technology Preset** (es. "Microservices Java").
5.  Richiede il supporto **AI** per identificare le attività mancanti.
6.  Aggiusta i **Driver** di complessità (Basso/Medio/Alto).
7.  Salva la stima.

### Flusso di Personalizzazione (Custom Preset)
1.  L'utente accede a **Configuration > Presets**.
2.  Crea un nuovo Preset (es. "My Custom Stack") o ne clona uno esistente.
3.  Definisce le attività di default e i valori dei driver tipici per quel stack.
4.  Il nuovo preset diventa immediatamente disponibile nel Wizard di stima per i futuri requisiti.

## 5. Stack Tecnologico

*   **Frontend**: React, TypeScript, Tailwind CSS, Shadcn UI (Design System moderno e responsivo).
*   **Backend**: Supabase (PostgreSQL, Auth, Edge Functions).
*   **AI**: Integrazione con OpenAI per l'analisi semantica dei requisiti.
