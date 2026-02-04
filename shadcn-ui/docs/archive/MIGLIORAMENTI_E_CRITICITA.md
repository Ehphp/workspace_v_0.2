# Analisi Miglioramenti e Criticità - Syntero

**Data analisi:** 19 Dicembre 2024

---

## 📊 Executive Summary

Dall'analisi del codice sorgente emergono diverse aree di miglioramento e criticità che possono essere classificate in:
- **Criticità Alta (P0)**: Funzionalità dichiarate ma non implementate
- **Criticità Media (P1)**: Funzionalità incomplete o parzialmente integrate
- **Miglioramenti (P2)**: Ottimizzazioni e nuove feature suggerite

---

## 🔴 Criticità Alta (P0)

### 1. Export PDF/CSV Non Implementato

**Stato:** Dichiarato nel todo.md ma MAI implementato

**Evidenze:**
- `todo.md` linea 58: `- [ ] Export PDF/CSV functionality`
- `functional-analysis.md`: "export CSV/PDF previsto come Phase 2"
- `WizardStep5.tsx` linea 310: Bottone "Export PDF" presente ma **non funzionante**

**Impatto:**
- Gli utenti non possono esportare le stime per condividerle con stakeholder esterni
- La pagina "How It Works" mostra "Lock & Export" come feature ma l'export non funziona
- Promessa funzionale non mantenuta

**Soluzione Proposta:**
```
Implementare export utilizzando:
- jsPDF per generazione PDF
- xlsx per export Excel
- Creare componente ExportDialog con opzioni formato
```

---

### 2. Gestione Driver e Rischi Assente in Configuration

**Stato:** La pagina Configuration gestisce solo Attività e Preset

**Evidenze:**
- `/configuration/activities` - Gestione attività ✅
- `/configuration/presets` - Gestione preset ✅
- `/configuration/drivers` - **Non esiste** ❌
- `/configuration/risks` - **Non esiste** ❌

**Impatto:**
- Admin non possono creare/modificare driver di complessità
- Admin non possono creare/modificare rischi
- Solo i valori di seed sono disponibili

**Soluzione Proposta:**
```
Creare:
- ConfigurationDrivers.tsx - CRUD per drivers
- ConfigurationRisks.tsx - CRUD per risks
- Aggiungere card in Configuration.tsx hub
```

---

### 3. Reset Password Non Implementato

**Stato:** Nessuna funzionalità di recupero password

**Evidenze:**
- Login.tsx non ha link "Forgot Password"
- Non esiste ForgotPassword.tsx
- Test menzionano "password reset" ma solo come esempio

**Impatto:**
- Utenti che dimenticano la password sono bloccati
- Esperienza utente incompleta
- Non conforme agli standard di sicurezza moderni

**Soluzione Proposta:**
```
Implementare:
- ForgotPassword.tsx - Form email recovery
- Supabase Auth supporta già resetPasswordForEmail()
- Email template per recovery
```

---

## 🟠 Criticità Media (P1)

### 4. Locking Progetti Parzialmente Integrato

**Stato:** Componenti esistono ma non completamente integrati

**Evidenze:**
- `LockBanner.tsx` - Mostra banner quando progetto è locked ✅
- `ProjectStatusControl.tsx` - Permette cambio stato ✅
- Ma: **non tutti i form bloccano l'editing** quando status = LOCKED

**Impatto:**
- Utenti potrebbero modificare dati in progetti "locked"
- Governance compromessa

**Soluzione Proposta:**
```
- Aggiungere check `list.status !== 'LOCKED'` in tutti i form di modifica
- Disabilitare bottoni di azione quando locked
- Aggiungere indicatore visivo su RequirementCard
```

---

### 5. Versionamento Catalogo Non Implementato

**Stato:** Stime storiche non preservano stato catalogo

**Evidenze:**
- `ANALISI_FUNZIONALE.md` linea 137: "Se un admin cambia il peso di un'attività, le stime passate potrebbero ricalcolarsi"

**Impatto:**
- Modifiche alle attività post-stima alterano i dati storici
- Perdita di tracciabilità

**Soluzione Proposta:**
```
- Aggiungere snapshot attività/driver/rischi in estimation
- O creare tabella activity_versions con colonna valid_from/valid_to
- Alla visualizzazione storica, usare versione al momento della stima
```

---

### 6. Assenza Conferma Email alla Registrazione

**Stato:** Utenti registrati accedono senza verifica

**Evidenze:**
- Register.tsx naviga direttamente a /dashboard dopo signup
- Non c'è check su `email_confirmed_at`

**Impatto:**
- Possibili registrazioni con email false
- Non conforme a best practices

**Soluzione Proposta:**
```
- Abilitare email confirmation in Supabase
- Creare VerifyEmail.tsx con messaggio attesa
- Redirect a login dopo conferma
```

---

### 7. Quick Estimate Non Salva in Database

**Stato:** Le stime "quick" non vengono persistite

**Evidenze:**
- `QuickEstimate.tsx` mostra risultato ma non salva
- Non esiste flusso per convertire quick estimate in requisito

**Impatto:**
- Utenti perdono le stime quick alla chiusura
- Non c'è storico delle stime rapide

**Soluzione Proposta:**
```
- Aggiungere bottone "Salva come Requisito" nel risultato
- Creare flusso per selezionare lista destinazione
- Oppure creare tabella quick_estimations per storico
```

---

## 🟢 Miglioramenti (P2)

### 8. Notifiche In-App Assenti

**Suggerimento:** Implementare sistema di notifiche per:
- Stima completata da collaboratore
- Requisito assegnato
- Progetto locked/unlocked
- Cambio stato requisito

---

### 9. Dashboard Analytics Limitata

**Suggerimento:** Aggiungere:
- Trend stime nel tempo (grafico linea)
- Varianza AI vs manuale
- Stime per utente
- Tempo medio di stima

---

### 10. Ricerca Globale Assente

**Suggerimento:** Implementare:
- Search bar globale nel Header
- Ricerca in progetti, requisiti, attività
- Navigazione rapida

---

### 11. Undo/Redo Mancante

**Suggerimento:** Implementare per:
- Selezione attività nel wizard
- Modifiche requisiti
- Idealmente con keyboard shortcuts (Ctrl+Z)

---

### 12. Modalità Offline Non Supportata

**Suggerimento:** Implementare:
- Service worker per caching
- Sincronizzazione quando online
- Indicatore stato connessione

---

### 13. Accessibilità (a11y) Da Migliorare

**Suggerimento:**
- Audit con axe/lighthouse
- Focus management nel wizard
- Screen reader support completo
- Contrasto colori in alcuni componenti

---

### 14. Internazionalizzazione (i18n) Parziale

**Stato:** Mix di italiano e inglese nell'UI

**Suggerimento:**
- Implementare i18n completo (react-i18next)
- Estrarre tutte le stringhe
- Supporto IT/EN

---

### 15. Test Coverage Limitata

**Suggerimento:**
- Aggiungere test per componenti critici
- Test E2E con Playwright
- Coverage target > 70%

---

## 📋 Priorità Implementazione Suggerita

| # | Criticità | Effort | Business Value | Priorità |
|---|-----------|--------|----------------|----------|
| 1 | Export PDF/CSV | Medium | Alto | **P0** |
| 2 | Driver/Risk Config | Medium | Alto | **P0** |
| 3 | Reset Password | Low | Alto | **P0** |
| 4 | Lock Integration | Low | Medio | **P1** |
| 5 | Versionamento Catalogo | High | Alto | **P1** |
| 6 | Email Confirmation | Low | Medio | **P1** |
| 7 | Quick Estimate Save | Low | Medio | **P1** |
| 8 | Notifiche | Medium | Medio | **P2** |
| 9 | Dashboard Analytics | Medium | Medio | **P2** |
| 10 | Ricerca Globale | Medium | Medio | **P2** |

---

## 🔗 File Correlati

Riferimenti nel codice:
- [todo.md](file:///c:/Users/EmilioCittadini/Downloads/Guida%20UtenteEstimazioni%20Req/workspace/shadcn-ui/todo.md) - Backlog originale
- [ANALISI_FUNZIONALE.md](file:///c:/Users/EmilioCittadini/Downloads/Guida%20UtenteEstimazioni%20Req/ANALISI_FUNZIONALE.md) - Limiti documentati
- [LockBanner.tsx](file:///c:/Users/EmilioCittadini/Downloads/Guida%20UtenteEstimazioni%20Req/workspace/shadcn-ui/src/components/shared/LockBanner.tsx) - Componente lock

---

*Report generato dall'analisi del codice sorgente - Syntero v2024.12*
