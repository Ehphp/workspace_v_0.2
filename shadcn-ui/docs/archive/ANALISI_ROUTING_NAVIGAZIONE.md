# Analisi Routing e Navigazione

## 1. Panoramica del Sistema di Routing

Il progetto utilizza **React Router v6** (`react-router-dom`) configurato in `src/App.tsx`.
La struttura è piatta (non usa `createBrowserRouter` con oggetti annidati, ma componenti `<Route>` classici).
L'autenticazione è gestita tramite un wrapper component `<AuthGuard>` che protegge le route sensibili.

## 2. Mappa delle Route

| Path | Componente | Accesso | Note |
| :--- | :--- | :--- | :--- |
| `/` | `Home` | Pubblico | Landing page e Wizard (gestito tramite stato interno) |
| `/login` | `Login` | Pubblico | Pagina di login |
| `/register` | `Register` | Pubblico | Pagina di registrazione |
| `/how-it-works` | `HowItWorks` | Pubblico | Pagina informativa |
| `/lists` | `Lists` | **Protetto** | Elenco progetti/liste utente |
| `/lists/:listId/requirements` | `Requirements` | **Protetto** | Dettaglio lista (elenco requisiti) |
| `/lists/:listId/requirements/:reqId` | `RequirementDetail` | **Protetto** | Dettaglio singolo requisito e stima |
| `/admin` | `Admin` | **Protetto** | Dashboard amministrativa generale |
| `/admin/activities` | `AdminActivities` | **Protetto** | Gestione catalogo attività |
| `/presets` | `Presets` | **Protetto** | Gestione preset tecnologici |
| `/profile` | `Profile` | **Protetto** | Profilo utente |
| `*` | `NotFound` | Pubblico | Fallback 404 |

**Route Annidate / Layout**:
Non ci sono route annidate a livello di router (es. `<Route path="admin" element={<AdminLayout />}>`).
Il layout visivo (Header + Sidebar) è gestito manualmente dentro ogni pagina o tramite un wrapper `Layout` (visibile in `src/components/layout/Layout.tsx`), ma non è imposto strutturalmente dal router.

## 3. Mappa della Navbar / Menu

La navigazione è divisa in due componenti principali:
1.  **Header (`src/components/layout/Header.tsx`)**: Barra superiore orizzontale.
2.  **Sidebar (`src/components/layout/Sidebar.tsx`)**: Menu laterale verticale (visibile solo in alcune pagine che usano il componente `Layout`).

### Header Menu (Utente Loggato)

| Etichetta | Path | Icona | Note |
| :--- | :--- | :--- | :--- |
| Home | `/` | - | |
| Lists | `/lists` | `List` | |
| Admin | `/admin` | `Shield` | |
| Presets | `/presets` | `Layers` | |
| Come funziona | `/how-it-works` | `BookOpen` | |
| (Avatar) -> Profile | `/profile` | `User` | Dropdown menu |
| (Avatar) -> Sign out | - | `LogOut` | Azione, non link |

### Sidebar Menu

| Etichetta | Path | Icona | Note |
| :--- | :--- | :--- | :--- |
| Home | `/` | `Home` | |
| My Lists | `/lists` | `FolderOpen` | |
| Help & Docs | `/help` | `HelpCircle` | **LINK ROTTO** (Route inesistente) |
| Settings | `/settings` | `Settings` | **LINK ROTTO** (Route inesistente) |

## 4. Verifica di Consistenza Routing ↔ Navbar

### ✅ Punti di Forza
*   **Breadcrumbs Dinamici**: L'Header implementa una logica breadcrumb intelligente (`Lists > Project Name > Requirement Title`) che aiuta l'orientamento nelle route profonde (`/lists/:id/requirements/:id`).
*   **Active States**: L'Header gestisce correttamente lo stato attivo dei bottoni.

### ❌ Criticità e Incoerenze

1.  **Link Rotti nella Sidebar**:
    *   La Sidebar contiene link a `/help` e `/settings` che **NON esistono** nel router (`App.tsx`). Cliccandoli si finisce sulla 404.
    *   *Impatto UX*: Frustrazione utente e percezione di incompletezza.

2.  **Duplicazione Navigazione**:
    *   Le voci "Home" e "Lists" sono presenti sia nell'Header che nella Sidebar.
    *   *Impatto UX*: Ridondanza inutile che consuma spazio.

3.  **Admin Navigation Frammentata**:
    *   Nell'Header c'è "Admin" (`/admin`) e "Presets" (`/presets`).
    *   Tuttavia, `/admin/activities` è una route esistente ma non ha una voce di menu diretta nell'Header (probabilmente è raggiungibile dalla dashboard `/admin`).
    *   *Impatto UX*: Difficile scoprire le funzionalità admin se non si passa dalla dashboard principale.

4.  **Incoerenza Layout**:
    *   Non tutte le pagine sembrano usare la Sidebar. Le pagine principali (`Home`, `Lists`) sembrano autonome. La Sidebar è importata ma la sua logica di visualizzazione non è centralizzata nel Router.

## 5. Proposte di Miglioramento

### Priorità Alta (Fix immediati)
1.  **Rimuovere o Implementare Link Rotti**:
    *   Rimuovere `/help` e `/settings` dalla Sidebar finché le pagine non esistono.
    *   Oppure, redirigere `/help` su `/how-it-works` (che esiste).

2.  **Centralizzare Layout Admin**:
    *   Creare un layout dedicato per l'area Admin che includa una Sidebar specifica con: "Dashboard", "Activities", "Presets", "Users".

### Priorità Media (UX Refactoring)
3.  **Pulizia Navbar**:
    *   Spostare "Presets" sotto il menu "Admin" (o renderlo visibile solo agli admin). Non ha senso come voce di primo livello per un utente standard se è una configurazione tecnica.
    *   Unificare "Home" e "Lists": Se l'utente è loggato, la "Home" potrebbe essere direttamente la dashboard delle liste, o comunque la distinzione è debole.

4.  **Standardizzazione URL**:
    *   Attualmente abbiamo `/admin` (dashboard) e `/presets` (root level). Sarebbe più pulito avere `/admin/presets` per coerenza semantica, dato che i preset sono configurazioni di sistema.

### Priorità Bassa (Polish)
5.  **Route Protection Granulare**:
    *   Verificare se `/admin` e `/presets` debbano essere accessibili a tutti gli utenti loggati o solo a chi ha ruolo "Admin". Attualmente `<AuthGuard>` controlla solo il login, non il ruolo.
