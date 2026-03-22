## Technology preset ↔ activities: schema & client alignment

### Schema recap
- `tech_category` enum enforced on `activities` and `technology_presets`.
- `technology_preset_activities` pivot defines the default activities per preset (`tech_preset_id`, `activity_id`, `position`).
- `estimations.tech_preset_id` tracks the preset used; triggers block estimation activities non‑compatibili con il preset (o `MULTI`).
- Trigger su `activities` evita `base_activity_id` cross‑tech (salvo `MULTI`).

### Client behavior (allineato alla pivot)
- **Data load**: `useEstimationData` carica la pivot e normalizza i preset ricostruendo `default_activity_codes` ordinati per `position`.
- **Wizard**:
  - Step 2: legge la pivot (join su `activities(code)`) e normalizza i preset mostrati.
  - Step 3: se usa dati reali, rilegge la pivot per il preset selezionato e applica i default già filtrati.
- **Requirement detail / estimation UI**: usa `useEstimationData` normalizzato; selezioni bloccate/filtrate per tecnologia con warning se mancano attività.
- **AI flows**:
  - Quick Estimate: filtra attività per tech/MULTI; se l’AI non fornisce attività compatibili, fa fallback sui default della pivot.
  - Bulk Estimate: preload pivot + cataloghi; filtra per tech, scarta suggerimenti AI incompatibili, fallback sui default della pivot.

### Cosa resta del campo JSON
- `default_activity_codes` rimane nel type/DTO, ma lato client viene rimpiazzato dai codici derivati dalla pivot quando disponibile. Quando tutte le integrazioni saranno migrate, il campo JSON potrà essere deprecato.

### Note operative
- Se il preset non ha attività compatibili, UI e flussi AI mostrano un errore/fallback: verificare i dati in `technology_preset_activities` o attivare attività `MULTI`.
- Per nuovi preset/attività, inserire sempre la relazione nella pivot con `position` per mantenere l’ordinamento atteso nei default.
