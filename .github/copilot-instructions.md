# Syntero Repo Policy: Docs are mandatory

When you modify code, you must update canonical documentation under:
- workspace/shadcn-ui/docs/

Use this impact guide:
- netlify/functions/** -> docs/ai-integration.md (+ architecture.md if endpoints/files change)
- src/lib/**estimation** -> docs/estimation-engine.md
- supabase/** or schema/migrations -> docs/data-model.md
- interview/preset wizard UI or APIs -> docs/ai-integration.md (+ architecture.md)

If you believe no docs are needed, add:
- workspace/shadcn-ui/docs/NO_DOCS_NEEDED.md
with a short justification.

Do not edit docs/archive/ as part of normal updates (archive is historical only).
