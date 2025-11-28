# Archival of `.storage` and generated snapshots

This folder documents the archived snapshots and generated `.storage` artifacts that were present in the repository at the time of the documentation revision (2025-11-28).

Why archive: `.storage` contained generated snapshots and historical versions of documentation and built files (`build/`,`assets/`). These files can confuse contributors and accidentally introduce outdated guidance (like `VITE_OPENAI_API_KEY` in demos).

Action taken:
- The repository now enforces CI checks for leaked keys.
- We recommend deleting the workspace root `.storage` folder with the cleanup script `scripts/cleanup_storage.ps1` or by running an equivalent command.

If you need to recover archived `.storage` files later, contact the maintainers — they can re-generate snapshots.

Last updated: 2025-11-28
