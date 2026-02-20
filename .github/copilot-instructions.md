# Syntero Repo Policy: Docs are mandatory

When you modify code, you must update canonical documentation under:
- shadcn-ui/docs/

Use this impact guide:
- shadcn-ui/netlify/functions/** -> shadcn-ui/docs/api/ai-endpoints.md (+ shadcn-ui/docs/ai-integration.md if behavior changes)
- shadcn-ui/src/lib/**estimation** -> shadcn-ui/docs/estimation-engine.md
- supabase schema/seed/migrations (*.sql, shadcn-ui/supabase/**) -> shadcn-ui/docs/data-model.md (+ shadcn-ui/docs/data/integrity-playbook.md if presets/activities impacted)
- interview/preset wizard UI or APIs -> shadcn-ui/docs/api/ai-endpoints.md and/or shadcn-ui/docs/ai-integration.md

If you believe no docs are needed, add:
- shadcn-ui/docs/NO_DOCS_NEEDED.md
with a short justification.

Do not edit shadcn-ui/docs/archive/ as part of normal updates (archive is historical only).
