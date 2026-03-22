# 🚀 Quick Setup Script - Docker & Redis

## Esegui questi comandi UNO ALLA VOLTA dopo aver avviato Docker Desktop

### 1. Verifica Docker (dopo che l'icona è verde)
```powershell
docker ps
```
✅ **Output atteso**: Tabella vuota (CONTAINER ID, IMAGE, etc.)
❌ **Se errore**: Docker Desktop non è ancora pronto, aspetta altri 30 secondi

---

### 2. Scarica Redis
```powershell
docker pull redis:7-alpine
```
⏳ Download di circa 10-30 MB, richiede 1-2 minuti

---

### 3. Avvia Redis Container
```powershell
docker run -d --name redis-dev -p 6379:6379 --restart unless-stopped redis:7-alpine
```
✅ **Output atteso**: Un ID lungo (es: `a1b2c3d4e5f6...`)

---

### 4. Verifica Redis sia Attivo
```powershell
docker ps
```
✅ **Output atteso**: Devi vedere una riga con:
- IMAGE: `redis:7-alpine`
- NAMES: `redis-dev`
- STATUS: `Up X seconds`

---

### 5. Test Connessione Redis
```powershell
docker exec -it redis-dev redis-cli ping
```
✅ **Output atteso**: `PONG`

---

### 6. Installa Dipendenze Node.js
```powershell
cd "c:\Users\EmilioCittadini\Downloads\Guida UtenteEstimazioni Req\workspace\shadcn-ui"
pnpm add redis ajv
```

---

### 7. Configura Environment Variables

Apri il file `.env` e aggiungi:

```env
REDIS_URL=redis://localhost:6379
AI_ENABLED=true
AI_ENSEMBLE=true
AI_MAX_HOURS=8
AI_COMPLETENESS_THRESHOLD=0.65
AI_MIN_ACTIVITIES=5
AI_MAX_ACTIVITIES=20
```

---

### 8. Avvia il Server
```powershell
pnpm run dev:netlify
```

---

## ⚡ Quick Reference

### Comandi Rapidi Redis

```powershell
# Fermare Redis
docker stop redis-dev

# Avviare Redis
docker start redis-dev

# Vedere logs
docker logs redis-dev

# CLI Redis
docker exec -it redis-dev redis-cli

# Vedere chiavi cache
docker exec redis-dev redis-cli KEYS "processed:preset:*"
```

---

## 🐛 Troubleshooting

### Problema: "docker daemon is not running"
➡️ **Soluzione**: Avvia Docker Desktop dal menu Start

### Problema: "port 6379 is already in use"
➡️ **Soluzione**: 
```powershell
docker stop redis-dev
docker rm redis-dev
# Poi ri-esegui il comando run
```

### Problema: "name redis-dev already in use"
➡️ **Soluzione**:
```powershell
docker rm -f redis-dev
# Poi ri-esegui il comando run
```

---

## ✅ Checklist Finale

Prima di procedere, verifica:

- [ ] Docker Desktop è avviato (icona verde)
- [ ] `docker ps` funziona senza errori
- [ ] Container `redis-dev` è in esecuzione (STATUS: Up)
- [ ] `docker exec redis-dev redis-cli ping` ritorna `PONG`
- [ ] Dipendenze installate (`pnpm list redis ajv`)
- [ ] File `.env` configurato con `REDIS_URL`
- [ ] Server Netlify si avvia senza errori Redis

---

**Una volta completati tutti gli step, il setup è completo!** 🎉
