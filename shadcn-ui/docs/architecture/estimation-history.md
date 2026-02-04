# Storico Stime - Documentazione

## Panoramica

Il sistema di storico stime permette di:
- **Salvare multiple versioni** di una stima per lo stesso requisito
- **Confrontare** due stime per vedere le differenze
- **Nominare scenari** per identificare facilmente le varianti (es. "Base", "Con integrazione", "Ottimistico")
- **Tracciare l'evoluzione** delle stime nel tempo

## Funzionalità Implementate

### 1. Salvataggio Stime con Scenari

Quando l'utente clicca su "Save Estimation", viene mostrato un dialog che permette di:
- Inserire un **nome scenario** personalizzato
- Il nome di default è "Default" ma può essere cambiato (es. "Base Estimate", "With Integration", "Optimistic")
- Ogni salvataggio crea una nuova entry nello storico

**Dati salvati per ogni stima:**
- Total Days (giorni totali)
- Base Days (somma giorni base attività)
- Driver Multiplier (moltiplicatore driver)
- Risk Score (punteggio rischi)
- Contingency Percent (percentuale contingency)
- Scenario Name (nome scenario)
- Created At (timestamp creazione)
- User ID (utente che ha creato la stima)

**Relazioni salvate:**
- `estimation_activities`: quali attività sono incluse + flag AI suggested
- `estimation_drivers`: valori selezionati per ogni driver
- `estimation_risks`: quali rischi sono stati selezionati

### 2. Visualizzazione Storico

Nella **tab "History"** del dettaglio requisito viene mostrato:

- Lista cronologica di tutte le stime salvate (dalla più recente)
- Per ogni stima:
  - Nome scenario
  - Data e ora di creazione
  - Giorni totali (grande e prominente)
  - Breakdown: Base Days, Multiplier, Risk Score, Contingency
  - Conteggio attività, driver e rischi utilizzati

**Stati della visualizzazione:**
- Loading: spinner durante il caricamento
- Empty: messaggio quando non ci sono stime salvate
- Lista: card per ogni stima con bordo colorato a sinistra

### 3. Confronto tra Stime

Quando ci sono almeno 2 stime salvate, nella tab History appare automaticamente una sezione di **confronto** che permette di:

**Selezionare due stime** tramite dropdown
- Prima stima (a sinistra)
- Seconda stima (a destra)

**Visualizzare differenze su:**

#### Summary (Riepilogo)
- Total Days con percentuale di variazione
- Icone indicative: ⬆️ aumento (rosso), ⬇️ diminuzione (verde), ➖ invariato (grigio)
- Breakdown comparativo di Base Days, Multiplier, Risk Score

#### Activities (Attività)
- Badge "Removed" (rosso): attività presenti nella prima stima ma non nella seconda
- Badge "Added" (blu): attività presenti nella seconda stima ma non nella prima
- Messaggio "No changes" se le attività sono identiche

#### Drivers
- Per ogni driver modificato: mostra valori vecchio → nuovo
- Esempio: `COMPLEXITY: MEDIUM → HIGH`

#### Risks (Rischi)
- Badge "Removed": rischi rimossi
- Badge "Added": rischi aggiunti
- Messaggio "No changes" se i rischi sono identici

## Architettura Tecnica

### Database Schema

Le stime vengono salvate nelle seguenti tabelle:

```sql
-- Tabella principale estimations
CREATE TABLE estimations (
    id UUID PRIMARY KEY,
    requirement_id UUID REFERENCES requirements(id),
    user_id UUID REFERENCES auth.users(id),
    total_days DECIMAL(10,2),
    base_days DECIMAL(10,2),
    driver_multiplier DECIMAL(5,3),
    risk_score INTEGER,
    contingency_percent DECIMAL(5,2),
    scenario_name VARCHAR(255),
    created_at TIMESTAMP
);

-- Tabelle di junction per le relazioni
estimation_activities (estimation_id, activity_id, is_ai_suggested)
estimation_drivers (estimation_id, driver_id, selected_value)
estimation_risks (estimation_id, risk_id)
```

### Componenti React

**RequirementDetail.tsx**
- Gestisce il caricamento dello storico: `loadEstimationHistory()`
- Mostra dialog per scenario name: `handleSaveEstimation()` → `confirmSaveEstimation()`
- Visualizza la tab History con la lista delle stime
- Include il componente di confronto quando ci sono 2+ stime

**EstimationComparison.tsx**
- Componente dedicato al confronto tra due stime
- Permette selezione tramite dropdown
- Calcola e visualizza tutte le differenze
- Mostra badge colorati e icone per le variazioni

### Flow di Salvataggio

1. Utente modifica attività/driver/rischi nella tab "Estimate"
2. Clicca su "Save Estimation"
3. Si apre dialog per inserire nome scenario
4. Conferma → salvataggio su DB:
   - Insert in `estimations`
   - Insert multipli in `estimation_activities`, `estimation_drivers`, `estimation_risks`
5. Ricarica automatico dello storico
6. Toast di conferma

## Esempi d'Uso

### Scenario 1: Stima Base vs Ottimistica

1. Crea prima stima "Base Estimate" con tutte le attività standard
2. Salva
3. Rimuovi alcune attività "nice to have"
4. Salva come "Optimistic Estimate"
5. Vai in History e confronta le due stime per vedere l'impatto

### Scenario 2: Valutazione Rischi

1. Crea stima "No Risks" senza rischi selezionati
2. Crea stima "With Integration Risks" aggiungendo rischi di integrazione
3. Confronta per vedere come cambia contingency e total days

### Scenario 3: Complessità Crescente

1. Stima "Low Complexity" con driver COMPLEXITY=LOW
2. Stima "Medium Complexity" con COMPLEXITY=MEDIUM
3. Stima "High Complexity" con COMPLEXITY=HIGH
4. Confronta per vedere progressione del multiplier

## Miglioramenti Futuri

Possibili evoluzioni:
- **Export confronto**: esportare il confronto in PDF/Excel
- **Diff visuale**: evidenziare graficamente le differenze
- **Ripristino stima**: caricare una stima vecchia come base per una nuova
- **Commenti**: permettere di aggiungere note/commenti a ogni stima
- **Approval workflow**: workflow di approvazione per le stime
- **Notifiche**: notificare stakeholder quando viene salvata una stima
- **Versioning catalogo**: tracciare quale versione del catalogo attività era in uso
- **Analytics**: statistiche su accuratezza delle stime nel tempo

## Troubleshooting

**Lo storico non si carica**
- Verifica che l'utente sia autenticato
- Controlla la console per errori SQL
- Verifica le RLS policies su Supabase

**Il confronto non funziona**
- Servono almeno 2 stime salvate
- Verifica che le stime abbiano i join corretti (activities, drivers, risks)

**Il salvataggio fallisce**
- Verifica che almeno un'attività sia selezionata
- Controlla che tutti i driver obbligatori siano valorizzati
- Verifica i log del backend per errori specifici
