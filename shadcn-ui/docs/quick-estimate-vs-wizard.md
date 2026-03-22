# Quick Estimate vs Requirement Wizard

> Confronto repo-aware tra il flusso attualmente usato da Quick Estimate e quello usato dal Requirement Wizard.

---

## 1. Risposta breve

Sì: il documento precedente confrontava due versioni del Quick Estimate, non Quick Estimate vs Wizard.

Il confronto corretto è questo:

- Il **Quick Estimate attuale** usa una pipeline AI molto simile a quella del wizard sul piano degli endpoint e degli artefatti.
- Il **Wizard** aggiunge però tre cose che il Quick Estimate non ha:
  - **review esplicita** degli artefatti AI step-by-step
  - **intervista utente completa** quando il planner decide `ASK`
  - **persistenza strutturata** finale di requirement, artefatti, decisioni e stima

Quindi oggi non sono identici.
Condividono gran parte della pipeline AI, ma il wizard resta il flusso completo e governato dall'utente.

---

## 2. File principali coinvolti

### Quick Estimate

| File | Ruolo |
|---|---|
| `src/components/estimation/QuickEstimate.tsx` | dialog principale del quick estimate |
| `src/hooks/useQuickEstimationV2.ts` | orchestratore client-side della pipeline AI |
| `src/components/estimation/quick-estimate/QuickEstimateProgress.tsx` | UX di avanzamento live |
| `src/components/estimation/quick-estimate/QuickEstimateResultV2.tsx` | rendering del risultato finale |
| `src/lib/requirement-understanding-api.ts` | client API step 1 |
| `src/lib/impact-map-api.ts` | client API step 2 |
| `src/lib/estimation-blueprint-api.ts` | client API step 3 |
| `src/lib/requirement-interview-api.ts` | client API step 4-5 |
| `src/lib/estimation-utils.ts` | finalizzazione deterministica |

### Requirement Wizard

| File | Ruolo |
|---|---|
| `src/components/requirements/RequirementWizard.tsx` | orchestrazione step UI + salvataggio finale |
| `src/hooks/useWizardState.ts` | stato persistito del wizard in localStorage |
| `src/components/requirements/wizard/WizardStep1.tsx` | requirement input |
| `src/components/requirements/wizard/WizardStep2.tsx` | technology selection |
| `src/components/requirements/wizard/WizardStepUnderstanding.tsx` | review requirement understanding |
| `src/components/requirements/wizard/WizardStepImpactMap.tsx` | review impact map |
| `src/components/requirements/wizard/WizardStepBlueprint.tsx` | review blueprint |
| `src/components/requirements/wizard/WizardStepInterview.tsx` | planner + interview + estimate |
| `src/hooks/useRequirementInterview.ts` | stato e azioni dell'intervista |
| `src/lib/requirement-interview-api.ts` | client API planner + estimation |
| `src/lib/api.ts` | persistenza requirement / artifacts / estimation |
| `src/lib/domain-save.ts` | orchestration del salvataggio dominio |

---

## 3. Flow map end-to-end

### Quick Estimate attuale

```text
User apre dialog Quick Estimate
  -> inserisce descrizione + tech preset
  -> useQuickEstimationV2.calculate()
      -> loadMasterData()
      -> generateRequirementUnderstanding()
      -> generateImpactMap()
      -> generateEstimationBlueprint()
      -> generateInterviewQuestions()      // planner ASK/SKIP + preEstimate
      -> generateEstimateFromInterview()   // answers = {}
      -> interviewFinalizeEstimation()
  -> mostra risultato arricchito
  -> nessun salvataggio strutturato automatico
```

### Requirement Wizard

```text
User apre Requirement Wizard
  -> Step 1: inserisce requirement base
  -> Step 2: seleziona technology
  -> Step 3: generateRequirementUnderstanding() + review + confirm/regenerate
  -> Step 4: generateImpactMap() + review + confirm/regenerate
  -> Step 5: generateEstimationBlueprint() + review + confirm/regenerate
  -> Step 6: generateInterviewQuestions()
      -> se decision = SKIP: generateEstimateFromInterview()
      -> se decision = ASK: utente risponde alle domande, poi generateEstimateFromInterview()
  -> Step 7: review drivers & risks
  -> Step 8: risultati finali
  -> Save:
      -> createRequirement()
      -> saveRequirementUnderstanding()
      -> saveImpactMap()
      -> saveEstimationBlueprint()
      -> orchestrateWizardDomainSave()
      -> saveEstimation()
      -> finalizeWizardSnapshot()
```

---

## 4. Cosa condividono davvero

## Pipeline AI condivisa

Quick Estimate e Wizard oggi condividono questi blocchi logici:

- `generateRequirementUnderstanding()`
- `generateImpactMap()`
- `generateEstimationBlueprint()`
- `generateInterviewQuestions()`
- `generateEstimateFromInterview()`
- finalizzazione deterministica tramite flusso interview-based

In pratica il Quick Estimate attuale è una **compressione automatizzata** del backbone AI del wizard.

## Artefatti condivisi

Entrambi possono usare gli stessi artefatti:

- `RequirementUnderstanding`
- `ImpactMap`
- `EstimationBlueprint`
- `PreEstimate`
- `plannerDecision` (`ASK` / `SKIP`)
- `activities`, `suggestedDrivers`, `suggestedRisks`, `confidenceScore`

## Endpoint condivisi

| Endpoint | Quick Estimate | Wizard |
|---|---|---|
| `ai-requirement-understanding` | sì | sì |
| `ai-impact-map` | sì | sì |
| `ai-estimation-blueprint` | sì | sì |
| `ai-requirement-interview` | sì | sì |
| `ai-estimate-from-interview` | sì | sì |

---

## 5. Dove divergono davvero

## A. Review umana

### Quick Estimate

- gli artefatti vengono generati e **auto-accettati implicitamente**
- l'utente non conferma understanding / impact map / blueprint
- non c'è possibilità di rigenerare singoli artefatti durante il flusso

### Wizard

- ogni artefatto ha una **review step dedicata**
- l'utente può:
  - confermare
  - rigenerare
  - tornare indietro
  - procedere anche senza conferma in alcuni casi per backward compatibility

Questa è la differenza di governance principale.

## B. Intervista tecnica

### Quick Estimate

- chiama sempre `generateInterviewQuestions()` per ottenere `decision` e `preEstimate`
- poi chiama `generateEstimateFromInterview()` con `answers: {}`
- anche se il planner decide `ASK`, il quick estimate prosegue comunque in modalità rapida
- in quel caso imposta una logica di **escalation recommendation**, ma non apre un'intervista reale

### Wizard

- se il planner decide `ASK`, l'utente entra nel flusso di domande reali
- le risposte vengono raccolte in `useRequirementInterview`
- solo dopo le risposte si esegue `generateEstimateFromInterview()`
- se il planner decide `SKIP`, il wizard salta direttamente alla stima

Questa è la differenza di accuratezza più importante.

## C. Persistenza

### Quick Estimate

- il risultato resta nel dialog/componente
- non crea requirement
- non salva artefatti AI
- non salva estimation snapshot
- non costruisce la chain dominio `analysis -> decision -> estimation`

### Wizard

alla conferma finale salva:

- requirement base
- requirement understanding
- impact map
- estimation blueprint
- domain analysis/decision chain
- estimation finale
- snapshot finale del wizard

Questa è la differenza di tracciabilità e auditability.

## D. Stato applicativo

### Quick Estimate

- stato volatile nel hook `useQuickEstimationV2`
- reset/abort semplici
- niente resume cross-session

### Wizard

- stato in `useWizardState`
- persistenza su `localStorage`
- resume naturale del flusso se il dialog viene riaperto nella stessa sessione client

## E. UX

### Quick Estimate

- ottimizzato per velocità percepita
- una singola schermata input -> running -> result
- progress UI live ma non editabile

### Wizard

- ottimizzato per controllo e verifica
- step multipli espliciti
- review, conferme, backtracking, save finale

---

## 6. Confronto step-by-step

| Aspetto | Quick Estimate | Wizard |
|---|---|---|
| Input requirement | sì | sì |
| Selezione tecnologia | sì | sì |
| Requirement Understanding | sì, auto-run | sì, review step dedicata |
| Impact Map | sì, auto-run | sì, review step dedicata |
| Blueprint | sì, auto-run | sì, review step dedicata |
| Interview planner | sì | sì |
| Domande utente reali | no | sì, quando `ASK` |
| Stima AI finale | sì | sì |
| Driver/risk review | no esplicita | sì |
| Escalation suggestion | sì | non serve: il wizard è già il percorso completo |
| Persistenza requirement | no | sì |
| Persistenza artifacts | no | sì |
| Persistenza estimation | no | sì |
| Audit trail dominio | no | sì |

---

## 7. Deterministic engine: stesso o no?

La risposta corretta è: **parzialmente sì**.

### Uguale nel principio

Entrambi arrivano a una stima che passa dal layer deterministico di calcolo, non da un numero libero generato dal modello.

### Diverso nel contesto di input

Nel wizard, gli input al calcolo finale sono potenzialmente più ricchi perché possono includere:

- artefatti confermati dall'utente
- risposte vere all'intervista
- driver e rischi revisionati

Nel quick estimate, gli input sono più deboli perché:

- gli artefatti non sono confermati
- non ci sono vere interview answers
- la pipeline forza il completamento rapido

Quindi il motore di base è coerente, ma il **grado di informazione a monte** non è lo stesso.

---

## 8. Impatto su accuratezza, costo e tempo

| Metrica | Quick Estimate | Wizard |
|---|---|---|
| Tempo utente | basso | medio-alto |
| Tempo AI | medio | medio-alto |
| Accuratezza potenziale | buona | più alta |
| Governabilità | bassa | alta |
| Tracciabilità | bassa | alta |
| Costo cognitivo utente | basso | alto |
| Costo AI backend | simile backbone, ma wizard può aumentare con ASK e save chain | più alto complessivamente |

Nota importante:
Il backbone AI tra Quick Estimate e Wizard è oggi molto più vicino di quanto fosse prima, ma il wizard continua a essere il percorso affidabile per requisiti ambigui o ad alto impatto.

---

## 9. Conclusione pratica

Se la domanda è:

**"Quick Estimate usa la stessa logica del wizard?"**

La risposta più precisa è:

- **Sì, in gran parte per la pipeline AI backbone attuale**
- **No, per tutto ciò che riguarda review umana, interview reale, persistenza e governance**

Formula ancora più netta:

- il **Quick Estimate** è un **wizard compresso e auto-confermato**
- il **Requirement Wizard** è il **flusso completo, verificabile e persistibile**

---

## 10. Raccomandazione architetturale

Se l'obiettivo è tenere allineati i due percorsi senza duplicare logica, il punto corretto non è forzare il wizard dentro il quick estimate UI, ma mantenere:

- **backbone AI condiviso**
- **UI e controllo diversi per use case diversi**

Quindi:

- Quick Estimate = fast lane
- Wizard = governed lane

Questo è coerente con lo stato attuale del repo.
