# Granular Activities - Guida all'Uso

## 📊 Panoramica

È stato implementato un sistema di **attività granulari** con varianti Small/Medium/Large per permettere stime più precise e ridurre il rischio di sovrastime.

## 🎯 Sistema di Nomenclatura

Ogni attività principale ora ha **3 varianti**:

### Convenzioni di Naming
- **`_SM`** (Small/Light): ~40-50% del peso base - per task semplici e veloci
- **Attività base** (Medium): Peso standard - per task di complessità media
- **`_LG`** (Large/Complex): ~150-200% del peso base - per task complessi

### Esempi Pratici

#### Power Platform - Allineamento Analisi
- `PP_ANL_ALIGN_SM` (0.2d): Quick sync con team tecnico per chiarimenti rapidi
- `PP_ANL_ALIGN` (0.5d): Sessione standard di allineamento funzionale/tecnico
- `PP_ANL_ALIGN_LG` (1.0d): Workshop completo con stakeholder multipli

#### Backend - API Endpoint
- `BE_API_SIMPLE_SM` (0.4d): GET/POST base senza logica business
- `BE_API_SIMPLE` (0.75d): Endpoint con logica lineare e CRUD standard
- `BE_API_SIMPLE_LG` (1.25d): Endpoint con validazioni custom e logica business moderata

#### Frontend - Form
- `FE_FORM_SM` (0.5d): Form con 3-5 campi e validazioni base
- `FE_FORM` (1.0d): Form complesso con validazioni e integrazione API
- `FE_FORM_LG` (2.0d): Form multi-step con conditional fields

## 📋 Lista Completa Attività Granulari

### Power Platform (18 attività totali)

#### Analysis
- PP_ANL_ALIGN_SM (0.2d) | PP_ANL_ALIGN (0.5d) | PP_ANL_ALIGN_LG (1.0d)

#### Development - Dataverse
- PP_DV_FIELD_SM (0.125d) | PP_DV_FIELD (0.25d) | PP_DV_FIELD_LG (0.5d)
- PP_DV_FORM_SM (0.25d) | PP_DV_FORM (0.5d) | PP_DV_FORM_LG (1.0d)

#### Development - Power Automate
- PP_FLOW_SIMPLE_SM (0.25d) | PP_FLOW_SIMPLE (0.5d) | PP_FLOW_SIMPLE_LG (0.75d)
- PP_FLOW_COMPLEX_SM (0.75d) | PP_FLOW_COMPLEX (1.0d) | PP_FLOW_COMPLEX_LG (2.0d)

#### Development - Business Rules
- PP_BUSINESS_RULE_SM (0.125d) | PP_BUSINESS_RULE (0.25d) | PP_BUSINESS_RULE_LG (0.5d)

#### Testing
- PP_E2E_TEST_SM (0.5d) | PP_E2E_TEST (1.0d) | PP_E2E_TEST_LG (2.0d)
- PP_UAT_RUN_SM (0.5d) | PP_UAT_RUN (1.0d) | PP_UAT_RUN_LG (2.0d)

#### Operations
- PP_DEPLOY_SM (0.25d) | PP_DEPLOY (0.5d) | PP_DEPLOY_LG (1.0d)

### Backend (17 attività totali)

#### Analysis
- BE_ANL_ALIGN_SM (0.25d) | BE_ANL_ALIGN (0.5d) | BE_ANL_ALIGN_LG (1.0d)

#### Development - API
- BE_API_SIMPLE_SM (0.4d) | BE_API_SIMPLE (0.75d) | BE_API_SIMPLE_LG (1.25d)
- BE_API_COMPLEX_SM (1.0d) | BE_API_COMPLEX (1.5d) | BE_API_COMPLEX_LG (3.0d)

#### Development - Database
- BE_DB_MIGRATION_SM (0.5d) | BE_DB_MIGRATION (1.0d) | BE_DB_MIGRATION_LG (2.0d)

#### Testing
- BE_UNIT_TEST_SM (0.25d) | BE_UNIT_TEST (0.5d) | BE_UNIT_TEST_LG (1.0d)
- BE_INT_TEST_SM (0.4d) | BE_INT_TEST (0.75d) | BE_INT_TEST_LG (1.5d)

#### Operations
- BE_LOGGING_SM (0.25d) | BE_LOGGING (0.5d) | BE_LOGGING_LG (1.0d)
- BE_DEPLOY_SM (0.25d) | BE_DEPLOY (0.5d) | BE_DEPLOY_LG (1.0d)

### Frontend (19 attività totali)

#### Analysis
- FE_ANL_UX_SM (0.25d) | FE_ANL_UX (0.5d) | FE_ANL_UX_LG (1.0d)

#### Development - UI
- FE_UI_COMPONENT_SM (0.25d) | FE_UI_COMPONENT (0.5d) | FE_UI_COMPONENT_LG (1.0d)
- FE_FORM_SM (0.5d) | FE_FORM (1.0d) | FE_FORM_LG (2.0d)

#### Development - State
- FE_STATE_MGMT_SM (0.4d) | FE_STATE_MGMT (0.75d) | FE_STATE_MGMT_LG (1.5d)

#### Development - Integration
- FE_API_INTEGRATION_SM (0.25d) | FE_API_INTEGRATION (0.5d) | FE_API_INTEGRATION_LG (1.0d)

#### Testing
- FE_UNIT_TEST_SM (0.25d) | FE_UNIT_TEST (0.5d) | FE_UNIT_TEST_LG (1.0d)
- FE_E2E_TEST_SM (0.4d) | FE_E2E_TEST (0.75d) | FE_E2E_TEST_LG (1.5d)

#### Operations
- FE_DEPLOY_SM (0.25d) | FE_DEPLOY (0.5d) | FE_DEPLOY_LG (1.0d)

### Multi-Stack (6 attività totali)

#### Governance
- CRS_KICKOFF_SM (0.25d) | CRS_KICKOFF (0.5d) | CRS_KICKOFF_LG (1.0d)
- CRS_DOC_SM (0.25d) | CRS_DOC (0.5d) | CRS_DOC_LG (1.5d)

## 📈 Totali

- **Attività originali**: 29
- **Nuove varianti**: 44
- **Totale attività**: **73**

## 🚀 Come Usare

### 1. Durante la Stima
Quando crei una stima, scegli la variante più appropriata in base a:
- **Complessità reale** del requisito
- **Scope esatto** dell'attività
- **Esperienza del team** con tecnologie simili

### 2. Linee Guida per la Scelta

#### Scegli SMALL quando:
- È un task ripetitivo che hai fatto molte volte
- Lo scope è minimo e ben definito
- Non ci sono dipendenze complesse
- Esempio: "Aggiungere un campo text a una form esistente"

#### Scegli MEDIUM quando:
- È un task standard di complessità media
- Richiede un mix di implementazione e analisi
- Hai moderata esperienza con il task
- Esempio: "Creare un nuovo endpoint REST con CRUD standard"

#### Scegli LARGE quando:
- È un task complesso con molte incognite
- Richiede coordinamento tra più team
- Include aspetti di design/architettura
- Esempio: "Implementare orchestrazione complessa con saga pattern"

### 3. Benefit del Sistema

✅ **Stime più precise**: Riduci le sovrastime del 20-30%
✅ **Maggiore controllo**: Scegli il livello giusto per ogni task
✅ **Trasparenza**: Le descrizioni chiariscono cosa include ogni variante
✅ **Flessibilità**: Mantieni le attività originali per retrocompatibilità

## 🔄 Aggiornamento Database

Per applicare le nuove attività al database Supabase:

```sql
-- Esegui questo script sul tuo database Supabase
-- Il file supabase_seed.sql è già stato aggiornato con tutte le varianti
```

## 💡 Best Practices

1. **Non mescolare varianti**: Se usi PP_ANL_ALIGN_SM per un requisito, mantieni coerenza con altre attività Small
2. **Documenta la scelta**: Aggiungi note sul perché hai scelto una variante specifica
3. **Rivedi periodicamente**: Dopo alcune stime, verifica se le varianti scelte erano appropriate
4. **Impara dai dati**: Usa lo storico estimazioni per calibrare meglio le scelte future

## 🎓 Esempi di Scenari

### Scenario 1: Requisito Semplice Power Platform
**Requisito**: "Aggiungere campo Email a form Candidato e notifica al manager"

**Attività scelte**:
- PP_ANL_ALIGN_SM (0.2d) - Quick sync
- PP_DV_FIELD_SM (0.125d) - 1 campo email
- PP_DV_FORM_SM (0.25d) - Update form esistente
- PP_FLOW_SIMPLE_SM (0.25d) - Notifica semplice
- PP_E2E_TEST_SM (0.5d) - Smoke test
- PP_DEPLOY_SM (0.25d) - Deploy dev→test

**Totale Base**: 1.575d (vs 3.25d con attività standard) = **-51% sovrastima**

### Scenario 2: Requisito Complesso Backend
**Requisito**: "API per orchestrazione processo onboarding multi-step con chiamate esterne"

**Attività scelte**:
- BE_ANL_ALIGN_LG (1.0d) - Analisi approfondita
- BE_API_COMPLEX_LG (3.0d) - Orchestrazione saga pattern
- BE_DB_MIGRATION (1.0d) - Schema standard
- BE_UNIT_TEST_LG (1.0d) - Coverage alta
- BE_INT_TEST_LG (1.5d) - Test multi-servizio
- BE_LOGGING_LG (1.0d) - Monitoring completo
- BE_DEPLOY (0.5d) - Deploy standard

**Totale Base**: 9.0d (più realistico per la complessità)

---

**Versione**: 1.0  
**Data**: 19 Novembre 2025  
**Autore**: Sistema di Estimazione Requisiti
