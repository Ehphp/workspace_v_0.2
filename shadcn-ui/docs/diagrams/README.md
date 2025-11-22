# Diagrams — Mermaid preview

This folder contains the ERD and sequence diagrams (Mermaid) for the Requirements Estimation System along with a simple HTML page that renders diagrams interactively using Mermaid.js.

Files:
- `ERD.mmd` — Mermaid ERD script
- `sequences.mmd` — Mermaid sequence diagrams script
- `index.html` — Interactive page that loads and renders diagrams (open with a static server)

How to preview locally:

1. Start a local static server from the repo root (you can use `http-server`, `live-server`, or `npx http-server`):

```bash
npx http-server -c-1 -p 8080 docs/diagrams
# then open: http://localhost:8080/index.html
```

2. In the page, pick a diagram from the dropdown and click *Render*. You can also toggle theme and download the SVG.

Troubleshooting
- If you see an error "mermaid is not defined" it means the Mermaid library couldn't be loaded from the CDN. The interactive page attempts to load Mermaid dynamically from a primary CDN and a fallback CDN; if both fail, the UI shows a friendly error message.
- Make sure you run the page via a local server (not `file://`) and you have network access to fetch the CDN script (or replace the script URL in `index.html` with an accessible mirror).
 - Make sure you run the page via a local server (not `file://`) and you have network access to fetch the CDN script (or replace the script URL in `index.html` with an accessible mirror).

Quick network debugging commands
- Check whether primary CDN is reachable from your machine:
```bash
curl -I "https://cdn.jsdelivr.net/npm/mermaid@10.0.2/dist/mermaid.min.js"
```
- Check fallback CDN:
```bash
curl -I "https://unpkg.com/mermaid@10.0.2/dist/mermaid.min.js"
```
- Check local fallback served by your http-server (after running it)
```bash
curl -I "http://127.0.0.1:8080/lib/mermaid.min.js"
```

If any of the `curl -I` calls returns `200 OK`, the resource is reachable. If you receive `404`, it means path is not found (local fallback missing or CDN path changed). If you get `403`/`blocked`, that indicates network blocking.

Local fallback (offline / firewall-protected networks)
- If your network blocks the CDNs you can host a local copy of `mermaid.min.js` inside `docs/diagrams/lib/mermaid.min.js` and the UI will try to load it as a last fallback.
- To download a local copy on Windows / Mac / Linux (from project root):

```bash
mkdir -p docs/diagrams/lib
curl -L "https://cdn.jsdelivr.net/npm/mermaid@10.0.2/dist/mermaid.min.js" -o docs/diagrams/lib/mermaid.min.js
# or with PowerShell:
# Invoke-WebRequest -Uri "https://cdn.jsdelivr.net/npm/mermaid@10.0.2/dist/mermaid.min.js" -OutFile "docs/diagrams/lib/mermaid.min.js"
```

-- After downloading, restart the static server and reload the page. The interactive UI will attempt to load the local script if CDNs are unreachable.

Opening the correct URL
- Verify the server port when previewing: if you started `npx http-server -p 8080 docs/diagrams`, open `http://127.0.0.1:8080/index.html` (not 5500 or file:// path). The server logs show which IPs/ports are available.

Notes:
- Mermaid's API is used for dynamic rendering in `index.html`.
- If your browser prevents local file fetch via the `file://` protocol, use a static server.

Mermaid versions and documentation:
- This preview uses the Mermaid v10 CDN: https://unpkg.com/mermaid@10.0.2/dist/mermaid.min.js

Reference diagrams are extracted from project schema and sequence flows in `docs/architecture/` and the codebase (`src/`, `netlify/functions`, `supabase_schema.sql`).
