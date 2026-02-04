# Migration: base_days → base_hours

## Data: 2025-12-07

## Descrizione
Allineamento completo del sistema per usare `base_hours` (ore) invece di `base_days` (giorni) sia nel database che nel codice.

## Modifiche Applicate

### 1. Database Schema (`supabase_schema.sql`)
- ✅ Rinominata colonna: `activities.base_days` → `activities.base_hours`
- ✅ Tipo: `DECIMAL(5,2)` (supporta valori come 12.8 ore, 25.6 ore, etc.)

### 2. Seed Data (`supabase_seed.sql`)
- ✅ Convertiti tutti i valori da giorni a ore (moltiplicati per 8)
- Esempi:
  - `2.0 giorni` → `16.0 ore`
  - `4.0 giorni` → `32.0 ore`
  - `8.0 giorni` → `64.0 ore`
  - `1.6 giorni` → `12.8 ore`

### 3. Migration Script (`migrations/migrate_base_days_to_base_hours.sql`)
- ✅ Creato script per database esistenti
- Procedura:
  1. Aggiunge colonna `base_hours`
  2. Copia e converte dati: `base_hours = base_days * 8`
  3. Imposta NOT NULL
  4. Rimuove colonna `base_days`

### 4. Backend (Netlify Functions)
- ✅ `ai-suggest.ts`: Interface aggiornata a `base_hours`
- ✅ `prompt-builder.ts`: Conversione per display `base_hours / 8` giorni
- ✅ `generate-preset.ts`: Usa `base_hours` e converte in `baseDays` output

### 5. Frontend (TypeScript/React)
- ✅ `types/database.ts`: Interface `Activity.base_hours: number`
- ✅ UI Components: Mantengono conversione `base_hours / 8` per display in giorni
- ✅ Test files: Aggiornati per usare `base_hours`

## Convenzioni

### Storage
- **Database**: Sempre `base_hours` (ore)
- **TypeScript interfaces**: `base_hours: number`

### Display
- **UI**: Converti in giorni per utente finale: `base_hours / 8`
- **Formato**: `{(base_hours / 8).toFixed(1)}d` → "4.0d"

### Calcoli
```typescript
// Calcolo stima totale
const baseDays = base_hours / 8;
const subtotal = baseDays * driverMultiplier;
const total = subtotal * (1 + contingencyPercent / 100);
```

## Breaking Changes
⚠️ **Per database esistenti**: Eseguire migration script prima di deployare nuova versione.

## Compatibilità
- ✅ Nuovo codice legge solo `base_hours`
- ✅ Migration converte automaticamente dati esistenti
- ❌ Vecchio codice che cerca `base_days` fallirà

## Testing
Verificare dopo migration:
```sql
-- Check conversion
SELECT code, name, base_hours, (base_hours / 8) as days 
FROM activities 
WHERE code IN ('PP_ANL_ALIGN', 'BE_API_SIMPLE', 'FE_UI_COMPONENT')
ORDER BY code;

-- Expected results:
-- PP_ANL_ALIGN: 32.0 ore = 4.0 giorni
-- BE_API_SIMPLE: 48.0 ore = 6.0 giorni
-- FE_UI_COMPONENT: 32.0 ore = 4.0 giorni
```

## Rollback
Se necessario rollback:
```sql
ALTER TABLE activities ADD COLUMN base_days DECIMAL(5,2);
UPDATE activities SET base_days = base_hours / 8;
ALTER TABLE activities ALTER COLUMN base_days SET NOT NULL;
ALTER TABLE activities DROP COLUMN base_hours;
```
