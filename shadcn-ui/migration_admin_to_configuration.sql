-- ============================================
-- MIGRATION: Admin → Configuration Refactoring
-- Data: 2025-11-27
-- Descrizione: Aggiunge supporto per preset tecnologici personalizzati per utente
-- ============================================

-- ============================================
-- STEP 1: Modifica tabella technology_presets
-- ============================================

-- Aggiungi nuove colonne
ALTER TABLE technology_presets 
ADD COLUMN IF NOT EXISTS is_custom BOOLEAN DEFAULT false;

ALTER TABLE technology_presets 
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- Imposta is_custom = false per tutti i preset esistenti (sono preset di sistema)
UPDATE technology_presets 
SET is_custom = false, created_by = NULL 
WHERE is_custom IS NULL;

-- ============================================
-- STEP 2: Modifica vincoli UNIQUE
-- ============================================

-- Rimuovi il vincolo UNIQUE globale sul code (se esiste)
-- NOTA: Il nome del vincolo può variare, sostituisci 'technology_presets_code_key' 
-- con il nome effettivo ottenuto da: 
-- SELECT conname FROM pg_constraint WHERE conrelid = 'technology_presets'::regclass;
ALTER TABLE technology_presets 
DROP CONSTRAINT IF EXISTS technology_presets_code_key;

-- Aggiungi vincolo UNIQUE per combinazione (code, created_by)
-- Questo permette stesso code per preset di sistema e custom di utenti diversi
ALTER TABLE technology_presets 
ADD CONSTRAINT technology_presets_code_created_by_key 
UNIQUE (code, created_by);

-- Crea indice parziale UNIQUE per preset di sistema (created_by IS NULL)
-- Questo garantisce che i preset di sistema abbiano code unici
CREATE UNIQUE INDEX IF NOT EXISTS idx_tech_presets_system_code 
ON technology_presets(code) 
WHERE created_by IS NULL;

-- ============================================
-- STEP 3: Aggiorna Row Level Security Policies
-- ============================================

-- ========== TECHNOLOGY PRESETS ==========

-- Rimuovi vecchie policy (se esistenti)
DROP POLICY IF EXISTS "Allow public read on technology_presets" ON technology_presets;
DROP POLICY IF EXISTS "Technology presets are viewable by everyone" ON technology_presets;

-- Policy 1: SELECT - Utenti possono vedere preset di sistema e propri
CREATE POLICY "Users can view system and own presets" 
ON technology_presets
FOR SELECT 
USING (
    created_by IS NULL OR created_by = auth.uid()
);

-- Policy 2: INSERT - Utenti autenticati possono creare preset personali
CREATE POLICY "Users can insert own presets" 
ON technology_presets
FOR INSERT 
WITH CHECK (
    auth.role() = 'authenticated' 
    AND created_by = auth.uid()
);

-- Policy 3: UPDATE - Utenti possono modificare solo i propri preset
CREATE POLICY "Users can update own presets" 
ON technology_presets
FOR UPDATE 
USING (
    created_by = auth.uid()
);

-- Policy 4: DELETE - Utenti possono eliminare solo i propri preset
CREATE POLICY "Users can delete own presets" 
ON technology_presets
FOR DELETE 
USING (
    created_by = auth.uid()
);

-- ========== TECHNOLOGY PRESET ACTIVITIES ==========

-- Rimuovi vecchie policy (se esistenti)
DROP POLICY IF EXISTS "Technology preset activities are viewable by everyone" ON technology_preset_activities;

-- Policy 1: SELECT - Utenti possono vedere attività di preset accessibili
CREATE POLICY "Users can view preset activities" 
ON technology_preset_activities
FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM technology_presets tp
        WHERE tp.id = technology_preset_activities.tech_preset_id
        AND (tp.created_by IS NULL OR tp.created_by = auth.uid())
    )
);

-- Policy 2: INSERT/UPDATE/DELETE - Utenti possono gestire attività solo dei propri preset
CREATE POLICY "Users can manage activities for own presets" 
ON technology_preset_activities
FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM technology_presets tp
        WHERE tp.id = technology_preset_activities.tech_preset_id
        AND tp.created_by = auth.uid()
    )
);

-- ========== ACTIVITIES ==========

-- Rimuovi vecchia policy
DROP POLICY IF EXISTS "Allow public read on activities" ON activities;

-- Nuova policy: Utenti vedono solo attività di sistema o proprie custom
CREATE POLICY "Allow read on system and own activities" 
ON activities 
FOR SELECT 
USING (
    is_custom = false OR created_by = auth.uid()
);

-- ============================================
-- STEP 4: Verifica finale
-- ============================================

-- Verifica che le colonne siano state aggiunte
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'technology_presets' 
        AND column_name = 'is_custom'
    ) THEN
        RAISE EXCEPTION 'Colonna is_custom non trovata!';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'technology_presets' 
        AND column_name = 'created_by'
    ) THEN
        RAISE EXCEPTION 'Colonna created_by non trovata!';
    END IF;
    
    RAISE NOTICE 'Migration completata con successo!';
END $$;

-- ============================================
-- QUERY DI TEST (opzionale - commentate)
-- ============================================

-- Verifica preset di sistema
-- SELECT id, code, name, is_custom, created_by 
-- FROM technology_presets 
-- WHERE created_by IS NULL 
-- ORDER BY name;

-- Verifica policy attive
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
-- FROM pg_policies 
-- WHERE tablename IN ('technology_presets', 'technology_preset_activities', 'activities')
-- ORDER BY tablename, policyname;

-- ============================================
-- NOTE IMPORTANTI
-- ============================================

/*
1. Esegui questo script su un BACKUP del database prima di applicarlo in produzione
2. Il nome del vincolo UNIQUE potrebbe essere diverso - verifica con:
   SELECT conname FROM pg_constraint WHERE conrelid = 'technology_presets'::regclass;
3. Tutti i preset esistenti verranno marcati come is_custom=false (preset di sistema)
4. Gli utenti potranno creare nuovi preset con is_custom=true e created_by=<user_id>
5. Le policy RLS garantiscono l'isolamento dei dati tra utenti
*/
