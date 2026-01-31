# Archived Documentation

This folder contains historical documentation that has been superseded by the current documentation structure.

## Why Archive?

Documents are archived when:
- Content has been consolidated into a single authoritative document
- Implementation details have changed significantly
- Content was duplicated across multiple files
- Content described planned features rather than implemented functionality

## Archived Files

The following files from the repository root and various locations have been superseded:

| Original File | Superseded By | Reason |
|---------------|---------------|--------|
| `ANALISI_FUNZIONALE.md` | [architecture.md](../architecture.md) | Functional analysis consolidated |
| `ANALISI_FUNZIONALE_AGGIORNATA.md` | [README.md](../README.md) | Updated version, now consolidated |
| `ANALISI_NAVBAR_UI_UX.md` | N/A (historical) | UI/UX analysis during development |
| `ANALISI_ROUTING_NAVIGAZIONE.md` | N/A (historical) | Routing analysis during development |
| `DOCUMENTAZIONE_FUNZIONALITA_COMPLETE.md` | Multiple docs | Content spread across specialized docs |
| `MIGLIORAMENTI_E_CRITICITA.md` | N/A (historical) | Point-in-time improvement analysis |
| `ROOT_LEVEL_FILES_NOTE.md` | N/A | Migration tracking note |

## Storage Cleanup

The `.storage` folder contained generated snapshots. Use the cleanup script to remove:

```powershell
./scripts/cleanup_storage.ps1
```

## Recovery

If you need historical documentation, check git history or contact maintainers.

---

**Last Updated**: 2026-01-31
