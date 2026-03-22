# Setup Guida: Docker e Redis per Windows

## 📋 Prerequisiti

Prima di iniziare, verifica di avere:
- Windows 10/11 Pro, Enterprise, o Education (per Hyper-V)
- Almeno 4GB di RAM disponibile
- Connessione internet attiva

---

## 🐳 STEP 1: Installare Docker Desktop per Windows

### 1.1 Download Docker Desktop

1. Vai su: https://www.docker.com/products/docker-desktop/
2. Clicca su **"Download for Windows"**
3. Salva il file `Docker Desktop Installer.exe`

### 1.2 Installazione

1. **Esegui l'installer** (doppio click su `Docker Desktop Installer.exe`)
2. **Accetta la licenza**
3. **Configurazione**:
   - ✅ Abilita "Use WSL 2 instead of Hyper-V" (raccomandato)
   - ✅ Abilita "Add shortcut to desktop"
4. **Clicca "Ok"** e attendi l'installazione (5-10 minuti)
5. **Riavvia il computer** quando richiesto

### 1.3 Primo Avvio

1. **Avvia Docker Desktop** dal menu Start o desktop
2. **Accetta i termini di servizio**
3. **Skip tutorial** (opzionale)
4. Attendi che Docker si avvii (icona Docker in basso a destra deve essere verde)

### 1.4 Verifica Installazione

Apri **PowerShell** e verifica:

```powershell
# Verifica versione Docker
docker --version
# Output atteso: Docker version 24.x.x, build ...

# Verifica che Docker sia in esecuzione
docker ps
# Output atteso: CONTAINER ID   IMAGE   ...  (tabella vuota va bene)
```

✅ **Se vedi la versione e nessun errore, Docker è installato correttamente!**

❌ **Se ricevi errori**:
- Assicurati che Docker Desktop sia avviato (icona nella system tray)
- Riavvia Docker Desktop: Tasto destro sull'icona → "Restart"
- Se persiste, riavvia il PC

---

## 🔴 STEP 2: Installare e Configurare Redis

### 2.1 Pull dell'Immagine Redis

In PowerShell, scarica l'immagine ufficiale Redis:

```powershell
docker pull redis:7-alpine
```

Output atteso:
```
7-alpine: Pulling from library/redis
...
Status: Downloaded newer image for redis:7-alpine
docker.io/library/redis:7-alpine
```

### 2.2 Avviare Container Redis

Crea e avvia un container Redis in background:

```powershell
docker run -d `
  --name redis-dev `
  -p 6379:6379 `
  --restart unless-stopped `
  redis:7-alpine
```

**Spiegazione parametri**:
- `-d`: Esegui in background (detached mode)
- `--name redis-dev`: Nome del container
- `-p 6379:6379`: Mappa porta 6379 (host:container)
- `--restart unless-stopped`: Riavvia automaticamente
- `redis:7-alpine`: Immagine leggera Redis 7

Output atteso:
```
a1b2c3d4e5f6... (container ID)
```

### 2.3 Verifica Container Redis

```powershell
# Verifica che Redis sia in esecuzione
docker ps

# Output atteso:
# CONTAINER ID   IMAGE            STATUS          PORTS                    NAMES
# a1b2c3d4e5f6   redis:7-alpine   Up 10 seconds   0.0.0.0:6379->6379/tcp   redis-dev
```

✅ **Se vedi il container "redis-dev" con STATUS "Up", Redis è attivo!**

### 2.4 Test Connessione Redis

**Metodo 1: Usando Docker exec**

```powershell
# Connettiti al CLI Redis nel container
docker exec -it redis-dev redis-cli

# Una volta dentro, testa con:
ping
# Output atteso: PONG

# Prova set/get:
set test "Hello Redis"
get test
# Output: "Hello Redis"

# Esci:
exit
```

**Metodo 2: Da Windows (installa redis-cli se disponibile)**

```powershell
# Se hai redis-cli installato su Windows
redis-cli ping
# Output: PONG
```

---

## ⚙️ STEP 3: Configurare il Progetto

### 3.1 Installare Dipendenze Node.js

Nel terminale PowerShell, dalla directory del progetto:

```powershell
# Vai alla directory del progetto
cd "c:\Users\EmilioCittadini\Downloads\Guida UtenteEstimazioni Req\workspace\shadcn-ui"

# Installa dipendenze Redis e AJV
pnpm add redis ajv

# Installa dev dependencies (opzionale)
pnpm add -D @vitest/ui
```

### 3.2 Creare File .env

Crea o aggiorna il file `.env` nella root del progetto:

```powershell
# Crea/modifica .env
notepad .env
```

Aggiungi queste variabili:

```env
# OpenAI (esistente)
OPENAI_API_KEY=sk-your-key-here

# Redis Configuration (NUOVO)
REDIS_URL=redis://localhost:6379

# AI Pipeline Feature Flags (NUOVO)
AI_ENABLED=true
AI_ENSEMBLE=true
AI_MAX_HOURS=8
AI_COMPLETENESS_THRESHOLD=0.65
AI_MIN_ACTIVITIES=5
AI_MAX_ACTIVITIES=20

# Rate Limiting (esistente, ora Redis-backed)
AI_RATE_LIMIT_MAX=50
AI_RATE_LIMIT_WINDOW_MS=600000

# Supabase (esistente)
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-anon-key
```

**Salva e chiudi** (Ctrl+S, poi chiudi Notepad).

### 3.3 Verifica File di Configurazione

Controlla che tutti i file siano presenti:

```powershell
# Verifica prompts
ls netlify\functions\lib\ai\prompts

# Output atteso:
# skeleton.system
# expand.system
# policy.system
```

---

## 🧪 STEP 4: Test della Configurazione

### 4.1 Test Connessione Redis da Node.js

Crea un file di test temporaneo:

```powershell
notepad test-redis.js
```

Contenuto:

```javascript
const { createClient } = require('redis');

async function testRedis() {
    const client = createClient({
        url: 'redis://localhost:6379'
    });

    try {
        await client.connect();
        console.log('✅ Connesso a Redis!');
        
        await client.set('test-key', 'test-value');
        const value = await client.get('test-key');
        console.log('✅ Test SET/GET:', value);
        
        await client.disconnect();
        console.log('✅ Redis funziona correttamente!');
    } catch (error) {
        console.error('❌ Errore Redis:', error.message);
    }
}

testRedis();
```

Esegui il test:

```powershell
node test-redis.js
```

Output atteso:
```
✅ Connesso a Redis!
✅ Test SET/GET: test-value
✅ Redis funziona correttamente!
```

### 4.2 Avviare il Server Netlify

```powershell
pnpm run dev:netlify
```

Output atteso (senza errori Redis):
```
◈ Netlify Dev ◈
◈ Starting Netlify Dev with Vite

⚡️ Vite ready at http://localhost:5173
◈ Functions server listening on http://localhost:8888/.netlify/functions
```

✅ **Se vedi questo output senza errori, tutto funziona!**

### 4.3 Test Endpoint AI

In un nuovo terminale PowerShell:

```powershell
# Test endpoint (richiede token auth valido)
$headers = @{
    "Content-Type" = "application/json"
    "Authorization" = "Bearer YOUR_SUPABASE_TOKEN"
}

$body = @{
    description = "Dashboard HR con metriche real-time"
    answers = @{
        framework = "React"
        backend = "AWS Lambda"
    }
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:8888/.netlify/functions/ai-generate-preset" `
    -Method POST `
    -Headers $headers `
    -Body $body
```

---

## 🔧 Comandi Utili Docker & Redis

### Gestione Container Redis

```powershell
# Fermare Redis
docker stop redis-dev

# Avviare Redis (se fermo)
docker start redis-dev

# Riavviare Redis
docker restart redis-dev

# Vedere logs Redis
docker logs redis-dev

# Logs in tempo reale
docker logs -f redis-dev

# Rimuovere container (attenzione: cancella dati!)
docker stop redis-dev
docker rm redis-dev

# Ricreare container Redis pulito
docker run -d --name redis-dev -p 6379:6379 --restart unless-stopped redis:7-alpine
```

### Gestione Dati Redis

```powershell
# Entrare nel CLI Redis
docker exec -it redis-dev redis-cli

# Comandi utili in redis-cli:
# - KEYS *                  # Lista tutte le chiavi
# - KEYS processed:preset:* # Lista cache preset
# - GET chiave              # Leggi valore
# - DEL chiave              # Cancella chiave
# - FLUSHALL                # ATTENZIONE: Cancella tutto!
# - INFO memory             # Info memoria
# - DBSIZE                  # Numero chiavi totali
```

### Monitoring Redis

```powershell
# Statistiche in tempo reale
docker exec -it redis-dev redis-cli INFO stats

# Memoria usata
docker exec -it redis-dev redis-cli INFO memory | Select-String "used_memory_human"

# Connessioni attive
docker exec -it redis-dev redis-cli INFO clients
```

---

## 🐛 Troubleshooting Comuni

### Problema 1: "docker: command not found"

**Causa**: Docker Desktop non è avviato o non è nel PATH.

**Soluzione**:
1. Avvia Docker Desktop manualmente
2. Aspetta che l'icona diventi verde
3. Riapri PowerShell (nuovo terminale)

### Problema 2: "Cannot connect to Docker daemon"

**Causa**: Docker Desktop non è in esecuzione.

**Soluzione**:
```powershell
# Verifica se Docker è attivo
Get-Process "*docker*"

# Se non ci sono processi, avvia Docker Desktop dal menu Start
```

### Problema 3: Porta 6379 già in uso

**Causa**: Altro servizio usa la porta 6379.

**Soluzione**:
```powershell
# Trova processo sulla porta 6379
netstat -ano | findstr :6379

# Usa porta alternativa per Redis
docker run -d --name redis-dev -p 6380:6379 redis:7-alpine

# Aggiorna .env:
# REDIS_URL=redis://localhost:6380
```

### Problema 4: Container si ferma immediatamente

**Causa**: Conflitto nomi o errore configurazione.

**Soluzione**:
```powershell
# Rimuovi container esistente
docker rm -f redis-dev

# Ricrea container
docker run -d --name redis-dev -p 6379:6379 redis:7-alpine

# Controlla logs per errori
docker logs redis-dev
```

### Problema 5: "Error: connect ECONNREFUSED 127.0.0.1:6379"

**Causa**: Redis container non è avviato.

**Soluzione**:
```powershell
# Verifica stato container
docker ps -a | findstr redis-dev

# Se STATUS è "Exited", riavvia:
docker start redis-dev

# Aspetta 2-3 secondi, poi ri-testa l'applicazione
```

---

## 📊 Verifica Finale Setup Completo

Esegui questa checklist per confermare che tutto funziona:

```powershell
# 1. Docker è installato e attivo
docker --version
# ✅ Mostra versione

# 2. Redis container è in esecuzione
docker ps | findstr redis-dev
# ✅ Mostra STATUS "Up"

# 3. Redis risponde a ping
docker exec redis-dev redis-cli ping
# ✅ Output: PONG

# 4. Dipendenze Node.js installate
pnpm list redis ajv
# ✅ Mostra redis@4.x.x e ajv@8.x.x

# 5. File .env configurato
cat .env | findstr REDIS_URL
# ✅ Mostra REDIS_URL=redis://localhost:6379

# 6. Server Netlify si avvia senza errori
pnpm run dev:netlify
# ✅ Nessun errore "Redis connection failed"
```

---

## 🚀 Prossimi Passi

Dopo il setup completo:

1. **Run tests**:
   ```powershell
   pnpm test src\test\preset-pipeline.test.ts
   ```

2. **Testa API**:
   - Usa il frontend dell'app
   - Oppure usa Postman/Insomnia per chiamare `/.netlify/functions/ai-generate-preset`

3. **Monitor Redis cache**:
   ```powershell
   # Guarda le chiavi create
   docker exec redis-dev redis-cli KEYS "processed:preset:*"
   ```

4. **Deploy to production**:
   - Aggiungi Redis add-on su Netlify
   - Configura variabili d'ambiente
   - Deploy con `netlify deploy --prod`

---

## 📚 Risorse Utili

- Docker Desktop Docs: https://docs.docker.com/desktop/windows/
- Redis Docker Hub: https://hub.docker.com/_/redis
- Redis CLI Commands: https://redis.io/commands/
- Project Docs: `docs/ai/PIPELINE_IMPLEMENTATION_GUIDE.md`

---

**Setup completato!** 🎉  
Ora hai Docker e Redis configurati correttamente per la pipeline AI.
