# Guida ai Test di Consistenza delle Stime

## Panoramica

Il progetto include test automatici per verificare che il sistema di stima sia **deterministico** e **ripetibile**. Questo significa che con gli stessi input otterrai sempre gli stessi risultati.

## Configurazione Completata

✅ **Vitest** installato e configurato  
✅ **Testing Library** per test dei componenti React  
✅ **Test di consistenza** creati

## Struttura dei Test

### 1. Test di Setup (`src/test/setup.test.ts`)
Test di base per verificare che Vitest funzioni correttamente.

### 2. Test di Consistenza (`src/test/estimationConsistency.test.ts`)
Test che verificano la ripetibilità delle stime:

#### **calculateBaseDays** - Somma dei giorni base
```typescript
// Verifica che sommando gli stessi valori ottengo sempre lo stesso risultato
attività: Design (2 giorni) + Dev (5 giorni) + Test (3 giorni) = 10 giorni
```

#### **calculateDriverMultiplier** - Moltiplicatore dei driver
```typescript
// Verifica che moltiplicando gli stessi valori ottengo sempre lo stesso risultato
driver: 1.2 × 1.1 = 1.32
```

#### **calculateRiskScore** - Punteggio di rischio
```typescript
// Verifica che sommando i pesi dei rischi ottengo sempre lo stesso totale
rischi: 5 + 8 = 13
```

#### **calculateEstimation** - Stima completa
```typescript
// Verifica che eseguendo 10 volte la stessa stima ottengo 10 risultati identici
for (let i = 0; i < 10; i++) {
  result = calculateEstimation(sameInput);
  // Tutti i risultati devono essere identici
}
```

### 3. Test di Varianza - Stesso Requisito, Scenari Diversi

Il test più importante per rispondere alla tua domanda:

```typescript
// STESSO REQUISITO, ma con scelte diverse:

// Scenario BEST CASE (ottimistico)
- Attività: 10 giorni base
- Complessità: BASSA (0.8x)
- Rischi: BASSI (peso 3)
→ Risultato: ~8.8 giorni

// Scenario AVERAGE CASE (realistico)
- Attività: 10 giorni base
- Complessità: MEDIA (1.0x)
- Rischi: MEDI (peso 10)
→ Risultato: ~11 giorni

// Scenario WORST CASE (pessimistico)
- Attività: 10 giorni base
- Complessità: ALTA (1.5x)
- Rischi: ALTI (peso 25)
→ Risultato: ~18.75 giorni
```

**Varianza**: circa 70% tra best e worst case per lo stesso requisito!

## Come Eseguire i Test

### Eseguire tutti i test
```bash
cd workspace/shadcn-ui
pnpm test
```

### Eseguire i test una sola volta (no watch mode)
```bash
pnpm test:run
```

### Eseguire i test con interfaccia UI
```bash
pnpm test:ui
```

### Eseguire solo i test di consistenza
```bash
pnpm test estimationConsistency
```

## Interpretare i Risultati

### ✅ Test PASSA
Il sistema è deterministico: gli stessi input producono sempre gli stessi output.

### ❌ Test FALLISCE
C'è un problema di non-determinismo nel calcolo delle stime. Possibili cause:
- Uso di valori random (`Math.random()`)
- Dipendenza da timestamp o date
- Arrotondamenti inconsistenti
- Stato globale mutato

## Formula di Stima (Deterministica)

```
1. BASE_DAYS = Σ (giorni di ciascuna attività selezionata)

2. DRIVER_MULTIPLIER = Π (moltiplicatore di ciascun driver)

3. SUBTOTAL = BASE_DAYS × DRIVER_MULTIPLIER

4. RISK_SCORE = Σ (peso di ciascun rischio selezionato)

5. CONTINGENCY% = 
   - 10% se RISK_SCORE ≤ 10
   - 15% se RISK_SCORE ≤ 20
   - 20% se RISK_SCORE ≤ 30
   - 25% se RISK_SCORE > 30

6. TOTAL_DAYS = SUBTOTAL × (1 + CONTINGENCY%)
```

## Esempio Pratico

```typescript
// Input identico eseguito 3 volte
const input = {
  activities: [
    { code: 'ANALYSIS', baseDays: 3, isAiSuggested: false },
    { code: 'DEV', baseDays: 8, isAiSuggested: true },
  ],
  drivers: [
    { code: 'COMPLEXITY', value: 'HIGH', multiplier: 1.2 },
  ],
  risks: [
    { code: 'R_TECH', weight: 5 },
  ],
};

// Esecuzione 1: totalDays = 14.52
// Esecuzione 2: totalDays = 14.52
// Esecuzione 3: totalDays = 14.52

// ✅ Consistente!
```

## Perché la Varianza è Normale

Se invii lo **stesso requisito** ma:
- Selezioni **attività diverse**
- Scegli **driver diversi**
- Consideri **rischi diversi**

È **normale e corretto** ottenere stime diverse! Questo riflette scenari di stima diversi:
- Implementazione semplice vs complessa
- Bassa vs alta complessità tecnica
- Pochi vs molti rischi

## Test di Storia delle Stime

Il file `estimationHistory.test.tsx` (attualmente commentato) contiene test per:
- **EstimationTimeline**: visualizzazione della cronologia delle stime
- **EstimationComparison**: confronto tra due stime dello stesso requisito
- Statistiche: min, max, media, trend

Questi test sono pronti per essere attivati quando necessario.

## Prossimi Passi

1. ✅ Configurazione completata
2. ⏳ Eseguire i test per verificare la consistenza
3. ⏳ Attivare i test dell'UI (decommentare estimationHistory.test.tsx)
4. ⏳ Aggiungere test per nuove funzionalità

## Domande Frequenti

**Q: Se rifaccio la stima dello stesso requisito, ottengo valori diversi?**  
A: **Solo se cambi le selezioni** (attività, driver, rischi). Con le stesse selezioni ottieni sempre lo stesso risultato.

**Q: Come faccio a vedere quanto variano le stime?**  
A: Guarda i log del test "should show variance range for same requirement with different scenarios" - mostra best/average/worst case e la varianza percentuale.

**Q: Il sistema usa AI random?**  
A: L'AI suggerisce attività, ma il calcolo della stima è **completamente deterministico** basato su formule matematiche fisse.

## Troubleshooting

### Errore: "Cannot find module '@/lib/estimationEngine'"
Verifica che il path alias sia configurato in `vite.config.ts`:
```typescript
resolve: {
  alias: {
    '@': path.resolve(__dirname, './src'),
  },
}
```

### Test non si avviano
1. Verifica che le dipendenze siano installate: `pnpm install`
2. Controlla che non ci siano errori di TypeScript: `pnpm lint`
3. Prova a pulire la cache: `pnpm test --clearCache`

---

**Autore**: Sistema di Test Automatico  
**Data**: 19 Novembre 2025  
**Versione**: 1.0
