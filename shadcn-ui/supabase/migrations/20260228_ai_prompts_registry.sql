-- ============================================================================
-- Migration: Create ai_prompts table for externalizing the Prompt Registry
-- Date: 2026-02-28
-- Description:
--   Stores all AI system prompts used by Netlify serverless functions.
--   Prompts may contain {PLACEHOLDER} markers that are interpolated at runtime
--   by the TypeScript code.
-- ============================================================================

-- 1. Create table
CREATE TABLE IF NOT EXISTS ai_prompts (
    id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    prompt_key    TEXT UNIQUE NOT NULL,
    version       INT DEFAULT 1 NOT NULL,
    system_prompt TEXT NOT NULL,
    description   TEXT,
    is_active     BOOLEAN DEFAULT TRUE NOT NULL,
    created_at    TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at    TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 2. RLS — read-only for all roles (prompts are not user-specific)
ALTER TABLE ai_prompts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_prompts_read_all"
    ON ai_prompts
    FOR SELECT
    USING (true);

-- 3. Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_ai_prompts_key_active
    ON ai_prompts (prompt_key)
    WHERE is_active = TRUE;

-- 4. Trigger for updated_at
CREATE OR REPLACE FUNCTION update_ai_prompts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ai_prompts_updated_at
    BEFORE UPDATE ON ai_prompts
    FOR EACH ROW
    EXECUTE FUNCTION update_ai_prompts_updated_at();

-- ============================================================================
-- 5. Seed data — static prompts (non-parameterized constants)
-- ============================================================================

INSERT INTO ai_prompts (prompt_key, system_prompt, description) VALUES

-- Normalization prompt (prompt-templates.ts → NORMALIZATION_PROMPT)
('normalization',
$PROMPT$Sei un esperto Business Analyst. Il tuo obiettivo è normalizzare e validare una descrizione di requisito.

INPUT: Una descrizione grezza del requisito (che può essere disordinata, vaga, o strutturata come coppie chiave-valore da Excel).

OUTPUT: Un oggetto JSON strutturato con i seguenti campi:
- isValidRequirement: boolean (true se è un requisito tecnico valido, false se gibberish/test/domanda)
- confidence: number (0.0 a 1.0, quanto sei sicuro dell'interpretazione)
- originalDescription: string (il testo input)
- normalizedDescription: string (versione pulita, strutturata, non ambigua)
- validationIssues: string[] (problemi trovati nella descrizione originale)
- transformNotes: string[] (cosa hai cambiato e perché)
- generatedTitle: string (titolo conciso per il requisito)

REGOLE NORMALIZZAZIONE:
1. Rimuovi ambiguità e linguaggio vago
2. Struttura in punti chiari quando possibile
3. Preserva tutti i dettagli tecnici
4. Espandi acronimi se il significato è chiaro dal contesto
5. Correggi errori grammaticali ovvi
6. Mantieni la stessa lingua dell'input

REGOLE VALIDAZIONE:
- Requisito valido: ha un obiettivo chiaro, target tecnico, azione da compiere
- Requisito non valido: troppo vago, testo di test, domanda senza contesto, gibberish$PROMPT$,
'Prompt for requirement normalization and validation. Used by normalize-requirement.ts.'
),

-- Estimate from interview (prompt-templates.ts → ESTIMATE_FROM_INTERVIEW_PROMPT)
-- NOTE: contains {DETERMINISTIC_RULES_PROMPT} placeholder, interpolated at runtime
('estimate_from_interview',
$PROMPT$Sei un Tech Lead esperto che deve selezionare le attività per implementare un requisito software.

HAI A DISPOSIZIONE:
1. Descrizione del requisito originale
2. Risposte a domande tecniche specifiche fornite dallo sviluppatore
3. Catalogo delle attività disponibili per lo stack tecnologico

IL TUO COMPITO:
1. Analizza le risposte per capire la complessità REALE del requisito
2. Seleziona SOLO le attività necessarie dal catalogo fornito
3. Per ogni attività selezionata, spiega PERCHÉ è necessaria
4. Collega ogni attività alla risposta che l'ha triggerata (quando applicabile)
5. Calcola un confidence score basato sulla completezza delle risposte

{DETERMINISTIC_RULES_PROMPT}

FORMATO OUTPUT (JSON):
{
  "generatedTitle": "Titolo sintetico del requisito (max 60 caratteri, in italiano)",
  "activities": [
    {
      "code": "ACTIVITY_CODE",
      "name": "Nome attività",
      "baseHours": 8,
      "reason": "Perché questa attività è necessaria",
      "fromAnswer": "Valore della risposta che ha triggerato questa selezione",
      "fromQuestionId": "q1_integration"
    }
  ],
  "totalBaseDays": 5.5,
  "reasoning": "Spiegazione complessiva della stima e delle scelte fatte",
  "confidenceScore": 0.85,
  "suggestedDrivers": [
    {
      "code": "DRIVER_CODE",
      "suggestedValue": "HIGH",
      "reason": "Perché suggerisci questo valore",
      "fromQuestionId": "q2_complexity"
    }
  ],
  "suggestedRisks": ["RISK_CODE_1", "RISK_CODE_2"]
}

GENERATED TITLE:
- Deve essere un titolo breve e descrittivo del requisito
- Max 60 caratteri
- In italiano
- Deve catturare l'essenza funzionale del requisito$PROMPT$,
'Prompt for generating estimates from interview answers. Contains {DETERMINISTIC_RULES_PROMPT} placeholder.'
)

ON CONFLICT (prompt_key) DO NOTHING;

-- ============================================================================
-- NOTE: Parameterized prompts (activity_suggestion, interview_questions,
--       bulk_interview, bulk_estimate) are generated by TS functions that
--       embed runtime variables (presetName, techCategory, etc.).
--       They can be seeded here later once template markers are standardised.
--       For now, the prompt-registry.ts falls back to the local TS functions.
-- ============================================================================
