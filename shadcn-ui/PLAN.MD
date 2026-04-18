Sì, sono d'accordo sull'ordine generale — pulizia → observability → decisioni empiriche è la sequenza che massimizza il ROI e minimizza il rischio. Ma
  voglio aggiungere due correzioni prima di darti il piano:

  1. Serve una Fase 0 di safety net. Senza una baseline di comportamento registrata (input/output di N requisiti reali) ogni cleanup è cieco: non sai se
  stai rompendo qualcosa finché un utente non si lamenta.
  2. Nella Fase 1 sarei conservativo sul "dividere per responsabilità". Cancellare codice morto e sciogliere gli zombie (tipo candidate-builder.ts) è
  sicuro. Ridisegnare i confini dei moduli prima di avere i dati di observability rischia di enshrine-are le boundary sbagliate. Il split semantico vero lo
  farei in Fase 3, sulla base di quello che vedi "pulsare" davvero.

  Con queste due premesse, ecco il piano.

  ---
  Piano di refactor — Engine di stima

  Lavorare su branch dedicato (refactor/estimation-pipeline) con commit piccoli e revertibili. Un comportamento = un commit. Mai due cose insieme.

  ---
  Fase 0 — Safety net (1 giornata)

  Obiettivo: poter dire in ogni momento "il comportamento di oggi è uguale a quello di ieri su N casi di riferimento".

  ┌──────┬───────────────────────────────────────────────────────────────────────────────────────────────────────────────────┬──────────────────────────┐
  │ Step │                                                      Azione                                                       │       Accettazione       │
  ├──────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼──────────────────────────┤
  │ 0.1  │ Scegli 10–15 requisiti reali rappresentativi (coprono: LOW/MED/HIGH complexity, con/senza blueprint, con/senza    │ JSON con description,    │
  │      │ impact-map). Esportali in un file test/fixtures/estimation-baseline.json                                          │ answers, project context │
  ├──────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼──────────────────────────┤
  │      │ Scrivi test/characterization/estimation-pipeline.test.ts che chiama il handler (o una sua versione in-process) su │ Test verde su master     │
  │ 0.2  │  ogni fixture e snapshotta: selectedActivities[].code, totalDays, driverMultiplier, contingencyPercent,           │ attuale, rigirabile in   │
  │      │ candidateSet.top10Codes                                                                                           │ ~30s                     │
  ├──────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼──────────────────────────┤
  │ 0.3  │ Committa gli snapshot come golden files. CI li rigira ad ogni commit. Qualsiasi drift richiede aggiornamento      │ CI verde                 │
  │      │ esplicito dello snapshot.                                                                                         │                          │
  └──────┴───────────────────────────────────────────────────────────────────────────────────────────────────────────────────┴──────────────────────────┘

  Nota: non devono essere test di qualità della stima, solo di stabilità. L'obiettivo è bloccare regressioni involontarie durante il cleanup.

  ---
  Fase 1 — Cleanup chirurgico (2–3 giornate)

  Obiettivo: meno 30–40% di LOC senza toccare la semantica. Ogni step deve lasciare i test golden verdi.

  1.1 — Estrai i tipi orfani da candidate-builder.ts

  - Sposta ScoredCandidate, ScoreContributions, CandidateSource → nuovo file netlify/functions/lib/domain/pipeline/candidate.types.ts
  - Aggiorna tutti gli import (grep mostra: candidate-synthesizer.ts, decision-engine.ts, decision-engine.types.ts)
  - Un solo commit, find/replace meccanico.

  1.2 — Elimina candidate-builder.ts

  - Verifica che buildCandidates() in candidate-set.service.ts (64 righe) copra il fallback in save-orchestrator.ts:202 (è già un pass-through, dovrebbe
  essere ok)
  - git rm netlify/functions/lib/candidate-builder.ts
  - Rigira golden tests

  Rischio: qualcosa in src/test/candidate-builder.test.ts potrebbe rompersi. Se il test copre logica ancora utile, riportala nel domain layer; altrimenti
  elimina anche il test.

  1.3 — Slim canonical-profile.service.ts (770 → ~200 righe)

  - Estrai computeAggregateConfidence() → domain/estimation/aggregate-confidence.ts (~50 righe)
  - Sposta buildCanonicalProfile, detectConflicts, evaluateStaleReasons, pinAnalysisToBlueprint in
  domain/estimation/diagnostics/canonical-profile-diagnostics.ts
  - Aggiungi header esplicito sul file diagnostics: "Non è su hot path di stima. Usato solo da save-orchestrator (non-fatal) e UI RequirementDetail."
  - Aggiorna index.ts di estimation

  1.4 — Rimuovi dead code evidente

  - netlify/functions/lib/domain/pipeline/complexity-resolver.ts: verifica con grep (rg "complexity-resolver|resolveComplexity" scope backend) che non sia
  chiamato. Se zero chiamate backend → elimina.
  - Stesso controllo su perimeter-normalizer.ts e canonical-requirement.ts: se sovrappongono con signal extractor e non sono chiamati dal handler/pipeline
  principale → elimina o consolida.
  - Regola: se il grep non trova chiamate dal path ai-estimate-from-interview → domain/pipeline → domain/estimation, è morto.

  1.5 — Deduplicazione formula EstimationEngine

  - Crea shared/estimation-formula.ts con la sola matematica pura (calculateBaseDays, calculateDriverMultiplier, calculateContingency, computeEstimation)
  - Sia src/lib/sdk/EstimationEngine.ts (UI) che netlify/functions/lib/domain/estimation/estimation-engine.ts (backend) lo importano
  - I due file diventano wrapper sottili con le rispettive interface
  - Attenzione al percorso shared: deve essere accessibile sia a Vite che a Netlify Functions. Se non già presente, usa src/shared/ + path alias.

  1.6 — Thin handler (ALTO RISCHIO, fallo ultimo di Fase 1)

  - Estrai la pipeline di orchestrazione di ai-estimate-from-interview.ts in domain/estimation/run-estimation-pipeline.ts con firma chiara:
  runEstimationPipeline(input: EstimationPipelineInput): Promise<EstimationPipelineResult>
  - Handler resta <200 righe: parse body, auth, chiamata a runEstimationPipeline, format response
  - Questo è il commit più grosso: fallo su un branch figlio e mergialo quando i golden tests passano.

  Criterio di fine Fase 1: LOC di netlify/functions/lib/ scesi di almeno 25%; handler principale < 250 righe; zero import di candidate-builder.

  ---
  Fase 2 — Observability + kill switches (3–5 giornate)

  Obiettivo: ogni decisione della pipeline è ispezionabile e ogni step è disattivabile.

  2.1 — Modello di trace

  Definisci in domain/estimation/trace/types.ts:

  type PipelineTrace = {
    runId: string;
    config: PipelineConfigSnapshot;   // quali step erano attivi
    signalExtraction: SignalExtractionTrace[];  // per fonte
    candidateSynthesis: CandidateScoringTrace[]; // per candidato
    agentPhases?: AgentPhaseTrace[];   // DRAFT/REFLECT/REFINE
    fallback?: DecisionEngineTrace;    // se è partito il fallback
    finalSelection: { code: string; reason: string }[];
    timing: Record<string, number>;
  }

  Ogni fase è pure enough da riempire la propria trace; l'orchestratore accumula.

  2.2 — Instrumentazione

  - Ogni signal adapter esce con (signals, trace) invece di signals. Poche righe in più, impatto enorme.
  - candidate-synthesizer registra per candidato: contributi pesati, score finale, motivo inclusione/esclusione.
  - agent-orchestrator: per fase, input/output/diff + tool calls eseguiti + token spesi.
  - decision-engine: per fase delle 5, quali regole hanno sparato.

  2.3 — Persistenza

  - Aggiungi colonna pipeline_trace jsonb su estimation_snapshots (o tabella dedicata pipeline_traces se vuoi TTL)
  - In dev, salva sempre. In prod, salva on-sample (es. 1% delle run) o on-error.

  2.4 — Kill switches nel PipelineConfig

  Estendi netlify/functions/lib/domain/pipeline/pipeline-config.ts (già esiste, 33 righe) con:

  type PipelineConfig = {
    signals: { blueprint: bool; impactMap: bool; understanding: bool;
               keyword: bool; projectActivities: bool; projectContext: bool };
    signalWeights?: Partial<Record<SignalSource, number>>;  // override
    agent: { enabled: bool; reflectionEnabled: bool; refineEnabled: bool };
    forceFallback: bool;  // salta l'agent, vai su decision-engine
  }

  Il config arriva dal body della request (in dev) o da env (prod default).

  2.5 — Dashboard /dev/pipeline-debug

  Nuova pagina src/pages/dev/PipelineDebug.tsx:
  - Sidebar sinistra: pick di un requisito esistente o paste di uno nuovo
  - Centrale: form di config (toggle signals, slider pesi, toggle reflection/refine, "force fallback")
  - Bottone Run: chiama handler con config custom
  - Risultato: trace espansa a tree (signal → candidati → selezione finale), con diff contro ultima run
  - Storia delle ultime 10 run comparabili affiancate

  Questa dashboard è l'arma diagnostica di cui stavi parlando: ti permette di fare "disattivo understanding signal, cosa cambia?" e vederlo in chiaro.

  ---
  Fase 3 — Decisioni empiriche (1–2 settimane, ma è lavoro iterativo)

  Solo ora, con dati e visibilità, si decide l'architettura finale.

  3.1 — Dataset etichettato

  Prepara 20–30 requisiti con "ground truth" (stima attesa, attività attese). Può essere "stime storiche validate da un senior", non serve verità assoluta.

  3.2 — Esperimenti

  Usa la dashboard per rispondere a domande precise:
  - Il REFINE gira davvero in prod? Controlla timing.refine sulle run: se è sempre null a causa del time budget, l'agent pipeline è de facto solo DRAFT.
  Taglia REFLECT+REFINE → meno codice, stessa qualità.
  - Ogni signal contribuisce? Disattiva uno alla volta: se impact-map off e i risultati non cambiano, il signal è rumore. Taglia.
  - Agent vs Decision Engine: forza fallback su tutto il dataset. Se l'agent LLM supera il decision engine di < X%, il decision engine diventa la canonical
  path e l'agent solo opzionale (o tagli l'agent).
  - Blueprint mapper 819 righe: quali strategie dentro al mapper emettono segnali mai usati? La trace te lo dice candidato per candidato.

  3.3 — Consolidamento regole

  L'intuizione vincente è: un solo "selection policy" modulo (mandatory + layer coverage + score gate) consumato sia dall'agent (come istruzioni nel prompt
  e validazione post-draft) sia dal decision engine. Oggi sono duplicate e divergono. Questo è il refactor più di valore dopo la Fase 1.

  3.4 — Split semantico di blueprint-activity-mapper

  Ora, guidato dai dati, lo spezzi in strategie isolate (component-strategy.ts, integration-strategy.ts, workflow-strategy.ts, …), ognuna testabile, ognuna
  con il suo contributo alla trace.

  ---
  Note operative

  - Commit granulari: ogni numerino di questo piano = un commit (o un mini-branch per 1.6). Mai committare due step insieme.
  - CI blocker: i golden test di Fase 0 devono essere verdi su ogni PR. Se diventano rossi, si aggiorna lo snapshot solo con approvazione esplicita.
  - Feature flag in prod: Fase 2 non va in prod con "tutto disattivabile da body": esponi i kill switch solo in dev tramite env, altrimenti apri un buco di
  sicurezza.
  - Documentazione: un docs/architecture/estimation-pipeline.md che nasce e cresce con il refactor (diagramma, file chiave, decisioni prese e perché). La
  prossima persona che apre il progetto non deve rifare la tua indagine.
  - Tempo stimato totale: ~2–3 settimane uomo per Fase 0+1+2 se ci lavori concentrato. Fase 3 è data-driven e può andare avanti in iterazioni di 2–3 giorni.

  Primo passo concreto su cui partirei domani: Fase 0, steps 0.1–0.3. Prima che tu abbia un safety net, qualsiasi altra cosa è rischiosa. Vuoi che iniziamo
  da lì?