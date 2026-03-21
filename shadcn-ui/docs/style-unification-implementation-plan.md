# Piano di Implementazione — Style Unification

**Data**: 2026-03-21
**Basato su**: [Frontend Style Audit](frontend-style-audit.md) (stesso giorno)
**Obiettivo**: Risolvere le 15 inconsistenze individuate e unificare il layer di styling in modo incrementale, senza regressioni visive.

---

## Struttura del piano

Il piano è organizzato in **4 Sprint**, ognuno con task atomici. Ogni task indica:
- **File da creare** (nuovi)
- **File da modificare** (con descrizione esatta di cosa cambia)
- **Finding risolto** (ID dal report di audit)
- **Rischio di regressione** e strategia di verifica

---

## Sprint 1 — Fondazioni (rischio zero)

> Nessun componente esistente cambia aspetto. Si creano nuovi file e si aggiungono utility CSS.

### Task 1.1 — `CHART_COLORS` constant

**Risolve**: F12 (hardcoded hex colors in 6 chart files)

**File da creare**: nessuno

**File da modificare**: [src/lib/constants.ts](../src/lib/constants.ts)

Aggiungere in fondo al file:

```ts
/** Canonical chart color palette — matches Tailwind palette */
export const CHART_COLORS = [
  '#3b82f6', // blue-500
  '#8b5cf6', // violet-500
  '#10b981', // emerald-500
  '#f59e0b', // amber-500
  '#ef4444', // red-500
  '#06b6d4', // cyan-500
  '#ec4899', // pink-500
  '#6366f1', // indigo-500
  '#a855f7', // purple-500
  '#f97316', // orange-500
] as const;

/** Status-specific chart colors */
export const STATUS_CHART_COLORS = {
  PROPOSED:  '#3b82f6',
  APPROVED:  '#10b981',
  ESTIMATED: '#8b5cf6',
  ARCHIVED:  '#64748b',
  SELECTED:  '#f59e0b',
  SCHEDULED: '#8b5cf6',
  DONE:      '#10b981',
} as const;
```

**File da aggiornare** (sostituire array/oggetti hardcoded con import):

| File | Cosa sostituire |
|------|----------------|
| `src/components/charts/StatusDistributionChart.tsx` | Oggetto colori inline → `STATUS_CHART_COLORS` |
| `src/components/charts/TechStackUsageChart.tsx` | Array colori inline → `CHART_COLORS` |
| `src/components/charts/TechnologyAccuracyChart.tsx` | Array colori inline → `CHART_COLORS` |
| `src/components/charts/AccuracyScatterChart.tsx` | Colori inline → `CHART_COLORS[n]` |
| `src/components/charts/DeviationBarChart.tsx` | Colori inline → `CHART_COLORS[n]` |
| `src/components/requirements/RequirementsDashboardView.tsx` | Oggetto colori inline → `STATUS_CHART_COLORS` |

**Verifica**: build si compila, chart visualizzano stessi colori.

---

### Task 1.2 — Heading utility classes

**Risolve**: F03 (18+ heading patterns → 5 livelli canonici)

**File da modificare**: [src/index.css](../src/index.css)

Aggiungere dentro `@layer components` (nuova section):

```css
@layer components {
  /* Canonical heading hierarchy — use these instead of ad-hoc text-* combos */
  .heading-1 { @apply text-2xl font-bold text-slate-900 leading-tight tracking-tight; }
  .heading-2 { @apply text-lg font-bold text-slate-900 leading-tight; }
  .heading-3 { @apply text-base font-semibold text-slate-800; }
  .heading-4 { @apply text-sm font-semibold text-slate-700; }
  .heading-5 { @apply text-xs font-semibold text-slate-600; }
  
  /* Standard help text */
  .help-text { @apply text-xs text-muted-foreground; }
}
```

**Nessun file modificato ora** — le classi sono disponibili. L'adozione avviene nei task successivi.

**Verifica**: build OK, nessun impatto visivo (classi non ancora usate).

---

### Task 1.3 — Creare `<PageShell>` layout wrapper

**Risolve**: F01 (no shared page shell), F14 (page backgrounds divergenti)

**File da creare**: `src/components/layout/PageShell.tsx`

```tsx
import type React from 'react';
import { cn } from '@/lib/utils';
import { Header } from './Header';

interface PageShellProps {
  children: React.ReactNode;
  /** Larghezza max del container. Default: '7xl' */
  maxWidth?: '4xl' | '5xl' | '6xl' | '7xl';
  /** Sfondo pagina. Default: 'default' (bg-slate-50) */
  background?: 'default' | 'gradient';
  /** Padding verticale. Default: 'md' */
  paddingY?: 'sm' | 'md' | 'lg';
  /** Mostra Header. Default: true */
  showHeader?: boolean;
  /** Altezza fissa a viewport (h-screen). Default: false */
  fullHeight?: boolean;
  /** Classe aggiuntiva per il root container */
  className?: string;
  /** Classe aggiuntiva per il main content area */
  contentClassName?: string;
}

const maxWidthMap = {
  '4xl': 'max-w-4xl',
  '5xl': 'max-w-5xl',
  '6xl': 'max-w-6xl',
  '7xl': 'max-w-7xl',
} as const;

const paddingMap = {
  sm: 'py-4',
  md: 'py-6',
  lg: 'py-10 lg:py-12',
} as const;

const backgroundMap = {
  default: 'bg-slate-50',
  gradient: 'bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50',
} as const;

export function PageShell({
  children,
  maxWidth = '7xl',
  background = 'default',
  paddingY = 'md',
  showHeader = true,
  fullHeight = false,
  className,
  contentClassName,
}: PageShellProps) {
  return (
    <div
      className={cn(
        'min-h-screen flex flex-col',
        fullHeight && 'h-screen overflow-hidden',
        backgroundMap[background],
        className,
      )}
    >
      {showHeader && <Header />}
      <main
        id="main-content"
        className={cn(
          'container mx-auto px-6 flex-1',
          maxWidthMap[maxWidth],
          paddingMap[paddingY],
          contentClassName,
        )}
      >
        {children}
      </main>
    </div>
  );
}
```

**Nessun file modificato ora** — il componente è disponibile. La migrazione delle pagine avviene nello Sprint 3.

**Verifica**: build OK, nessun impatto (componente non ancora usato).

---

### Task 1.4 — Creare `<EmptyState>` component

**Risolve**: F11 (4+ empty state pattern ad-hoc)

**File da creare**: `src/components/shared/EmptyState.tsx`

```tsx
import type React from 'react';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        'border-2 border-dashed border-slate-200 rounded-lg p-8',
        className,
      )}
    >
      <Icon className="h-10 w-10 text-slate-300 mb-3" />
      <p className="text-sm font-medium text-slate-600">{title}</p>
      {description && (
        <p className="text-xs text-slate-400 mt-1 max-w-sm">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
```

**Verifica**: build OK, nessun impatto.

---

### Task 1.5 — Creare `<InfoBox>` component

**Risolve**: F06 parzialmente (info callout ripetuti)

**File da creare**: `src/components/shared/InfoBox.tsx`

```tsx
import type React from 'react';
import { cn } from '@/lib/utils';
import { Info, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';

const variants = {
  info: {
    container: 'bg-blue-50 border-blue-200',
    icon: 'text-blue-600',
    text: 'text-blue-800',
    Icon: Info,
  },
  warning: {
    container: 'bg-amber-50 border-amber-200',
    icon: 'text-amber-600',
    text: 'text-amber-800',
    Icon: AlertTriangle,
  },
  success: {
    container: 'bg-emerald-50 border-emerald-200',
    icon: 'text-emerald-600',
    text: 'text-emerald-800',
    Icon: CheckCircle2,
  },
  error: {
    container: 'bg-red-50 border-red-200',
    icon: 'text-red-600',
    text: 'text-red-800',
    Icon: XCircle,
  },
} as const;

interface InfoBoxProps {
  variant?: keyof typeof variants;
  children: React.ReactNode;
  className?: string;
}

export function InfoBox({ variant = 'info', children, className }: InfoBoxProps) {
  const v = variants[variant];
  return (
    <div className={cn('flex items-start gap-2 p-3 border rounded-lg', v.container, className)}>
      <v.Icon className={cn('h-4 w-4 shrink-0 mt-0.5', v.icon)} />
      <div className={cn('text-xs', v.text)}>{children}</div>
    </div>
  );
}
```

**Verifica**: build OK, nessun impatto.

---

### Task 1.6 — Standardizzare `DialogContent` defaults

**Risolve**: F05 (dialog background e styling divergenti)

**File da modificare**: [src/components/ui/dialog.tsx](../src/components/ui/dialog.tsx)

Cambiare la className di default di `DialogContent`:

```
PRIMA: 'fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 ...'

DOPO:  'fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border border-white/20 bg-white/95 backdrop-blur-xl p-6 shadow-2xl duration-200 ...'
```

Cambiare anche il `sm:rounded-lg` alla fine in `sm:rounded-xl`.

Aggiungere className di default per `DialogHeader`:
```
PRIMA: 'flex flex-col space-y-1.5 text-center sm:text-left'
DOPO:  'flex flex-col space-y-1.5 text-center sm:text-left pb-4 border-b border-slate-100'
```

Aggiungere className di default per `DialogFooter`:
```
PRIMA: 'flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2'
DOPO:  'flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 pt-2 border-t border-slate-100'
```

**Verifica**: ispezionare visivamente OGNI dialog per verificare che l'aspetto sia coerente. I dialog che già applicavano queste classi come override non cambiano aspetto. I dialog che non le applicavano ora ricevono il trattamento glassmorfismo di default.

**Rischio**: LOW — la maggior parte dei dialog già usava queste classi come override. Dopo il cambio, si possono rimuovere gli override ora ridondanti dai singoli dialog.

---

### Riepilogo Sprint 1

| Task | Tipo | File | Finding |
|------|------|------|---------|
| 1.1 | Modifica + 6 aggiornamenti | constants.ts + 6 chart files | F12 |
| 1.2 | Modifica | index.css | F03 (predisposizione) |
| 1.3 | Nuovo file | PageShell.tsx | F01, F14 (predisposizione) |
| 1.4 | Nuovo file | EmptyState.tsx | F11 (predisposizione) |
| 1.5 | Nuovo file | InfoBox.tsx | F06 parziale |
| 1.6 | Modifica | dialog.tsx | F05 |

**Risultato**: 3 nuovi componenti pronti, heading utilities definite, colori chart centralizzati, dialog unificati.

---

## Sprint 2 — Astrazioni condivise (rischio basso)

> Creazione di componenti wrapper che consolidano pattern ripetuti. Dopo la creazione, i file che usano il pattern vecchio vengono migrati uno alla volta.

### Task 2.1 — Creare `<MetricCard>` component

**Risolve**: F08 (KPI card duplicati in 3+ file)

**File da creare**: `src/components/shared/MetricCard.tsx`

```tsx
import type React from 'react';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  icon: LucideIcon;
  iconGradient: string;
  label: string;
  value: string | number;
  trend?: { value: number; isPositive: boolean };
  subtitle?: string;
  className?: string;
}

export function MetricCard({
  icon: Icon,
  iconGradient,
  label,
  value,
  trend,
  subtitle,
  className,
}: MetricCardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border-2 border-slate-200 bg-gradient-to-br from-slate-50/80 to-white p-4',
        'flex items-center gap-4 hover:shadow-md hover:border-slate-300 transition-all',
        className,
      )}
    >
      <div
        className={cn(
          'w-12 h-12 rounded-xl flex items-center justify-center shadow-md',
          'bg-gradient-to-br',
          iconGradient,
        )}
      >
        <Icon className="w-6 h-6 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
          {label}
        </p>
        <div className="flex items-baseline gap-2">
          <p className="text-2xl font-bold text-slate-900 leading-none">{value}</p>
          {trend && (
            <span
              className={cn(
                'text-xs font-semibold px-1.5 py-0.5 rounded',
                trend.isPositive
                  ? 'text-emerald-700 bg-emerald-100'
                  : 'text-red-700 bg-red-100',
              )}
            >
              {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
            </span>
          )}
        </div>
        {subtitle && (
          <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
        )}
      </div>
    </div>
  );
}
```

**File da aggiornare**:

| File | Azione |
|------|--------|
| `src/components/dashboard/KpiCard.tsx` | Sostituire l'implementazione interna con re-export di `MetricCard` (mantenere `KpiCard` come alias per backward compat) |

```tsx
// KpiCard.tsx — diventa un re-export
export { MetricCard as KpiCard } from '@/components/shared/MetricCard';
export type { MetricCardProps as KpiCardProps } from '@/components/shared/MetricCard';
```

**Verifica**: Dashboard KPI visualizzano identicamente. Nessuna regressione perché le classi sono identiche.

---

### Task 2.2 — Creare `<SectionCard>` con variants

**Risolve**: F02 (7 card patterns → 3 varianti canoniche)

**File da creare**: `src/components/shared/SectionCard.tsx`

```tsx
import type React from 'react';
import { cn } from '@/lib/utils';

type SectionCardVariant = 'default' | 'elevated' | 'flat';

interface SectionCardProps {
  variant?: SectionCardVariant;
  children: React.ReactNode;
  className?: string;
  padding?: 'sm' | 'md' | 'lg' | 'none';
}

const variantClasses: Record<SectionCardVariant, string> = {
  default: 'rounded-xl border border-slate-200 bg-white shadow-sm',
  elevated: 'rounded-2xl border border-slate-200/50 bg-white/80 backdrop-blur-xl shadow-lg',
  flat: 'rounded-lg border border-slate-200 bg-white',
};

const paddingClasses = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
};

export function SectionCard({
  variant = 'default',
  children,
  className,
  padding = 'md',
}: SectionCardProps) {
  return (
    <div className={cn(variantClasses[variant], paddingClasses[padding], className)}>
      {children}
    </div>
  );
}
```

**File da aggiornare** (migrazione graduale — uno alla volta):

| File | Card attuale | Variante target |
|------|--------------|-----------------|
| `src/components/requirements/detail/RequirementInfo.tsx` | `Card className="shadow-sm border-slate-200 h-fit"` | `<SectionCard variant="default">` |
| `src/components/requirements/detail/RequirementDescription.tsx` | `Card className="shadow-sm border-slate-200"` | `<SectionCard variant="default">` |
| `src/components/requirements/detail/RequirementDriversCard.tsx` | `Card className="shadow-sm border-slate-200"` | `<SectionCard variant="default">` |
| `src/components/requirements/detail/tabs/OverviewTab.tsx` | `rounded-2xl shadow-lg border-slate-200/50 bg-white/80 backdrop-blur-xl` | `<SectionCard variant="elevated">` |
| `src/components/estimation/ConsultantAnalysisCard.tsx` | `rounded-2xl shadow-lg border-slate-200/50 bg-white/90 backdrop-blur-xl` | `<SectionCard variant="elevated">` |

**Nota**: Non si sostituiscono TUTTE le Card immediatamente. Si migrano quelle con styling custom ridondante. Le Card che usano il primitivo shadcn senza override (es. `HistorySection`, `ActualHoursTab`) restano invariate.

**Verifica**: confronto visivo per ogni file migrato.

---

### Task 2.3 — Creare `<StatusBadge>` unificato

**Risolve**: F04 (sistema duale badge — constants.ts vs RequirementBadges.tsx)

**File da creare**: `src/components/shared/StatusBadge.tsx`

```tsx
import type React from 'react';
import { cn } from '@/lib/utils';

// ---- Priority configs (from existing RequirementBadges.tsx) ----
const PRIORITY_STYLES = {
  HIGH: { bg: 'from-red-50 to-rose-50', text: 'text-red-700', border: 'border-red-200/50', dot: 'from-red-500 to-rose-500' },
  MEDIUM: { bg: 'from-amber-50 to-orange-50', text: 'text-amber-700', border: 'border-amber-200/50', dot: 'from-amber-500 to-orange-500' },
  LOW: { bg: 'from-emerald-50 to-teal-50', text: 'text-emerald-700', border: 'border-emerald-200/50', dot: 'from-emerald-500 to-teal-500' },
} as const;

// ---- State configs ----
const STATE_STYLES = {
  PROPOSED: { bg: 'from-blue-50 to-indigo-50', text: 'text-blue-700', border: 'border-blue-200/50' },
  SELECTED: { bg: 'from-violet-50 to-purple-50', text: 'text-violet-700', border: 'border-violet-200/50' },
  SCHEDULED: { bg: 'from-orange-50 to-amber-50', text: 'text-orange-700', border: 'border-orange-200/50' },
  DONE: { bg: 'from-teal-50 to-cyan-50', text: 'text-teal-700', border: 'border-teal-200/50' },
} as const;

// ---- List status configs ----
const LIST_STATUS_STYLES = {
  DRAFT: { bg: 'from-slate-50 to-gray-50', text: 'text-slate-600', border: 'border-slate-200/50' },
  ACTIVE: { bg: 'from-emerald-50 to-green-50', text: 'text-emerald-700', border: 'border-emerald-200/50' },
  ARCHIVED: { bg: 'from-gray-50 to-slate-50', text: 'text-gray-500', border: 'border-gray-200/50' },
} as const;

type StatusType = 'priority' | 'state' | 'listStatus';

interface StatusBadgeProps {
  type: StatusType;
  value: string;
  className?: string;
}

export function StatusBadge({ type, value, className }: StatusBadgeProps) {
  const styles =
    type === 'priority'
      ? PRIORITY_STYLES[value as keyof typeof PRIORITY_STYLES]
      : type === 'state'
        ? STATE_STYLES[value as keyof typeof STATE_STYLES]
        : LIST_STATUS_STYLES[value as keyof typeof LIST_STATUS_STYLES];

  if (!styles) return <span className="text-xs text-slate-500">{value}</span>;

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg',
        'bg-gradient-to-r border shadow-sm',
        styles.bg,
        styles.border,
        className,
      )}
    >
      {type === 'priority' && 'dot' in styles && (
        <div className={cn('w-1.5 h-1.5 rounded-full bg-gradient-to-r animate-pulse', styles.dot)} />
      )}
      <span className={cn('text-xs font-semibold', styles.text)}>
        {value.replace('_', ' ')}
      </span>
    </div>
  );
}

export { PRIORITY_STYLES, STATE_STYLES, LIST_STATUS_STYLES };
```

**File da aggiornare**:

| File | Azione |
|------|--------|
| `src/components/shared/RequirementBadges.tsx` | Refactoring: `PriorityBadge` e `StateBadge` ora delegano a `<StatusBadge>`. I vecchi export (`PRIORITY_CONFIGS`, `STATE_CONFIGS`) diventano re-export di `PRIORITY_STYLES` e `STATE_STYLES` per backward compat. |

```tsx
// RequirementBadges.tsx — diventa un thin wrapper
import { StatusBadge, PRIORITY_STYLES, STATE_STYLES } from './StatusBadge';

export function PriorityBadge({ priority }: { priority: string }) {
  return <StatusBadge type="priority" value={priority} />;
}

export function StateBadge({ state }: { state: string }) {
  return <StatusBadge type="state" value={state} />;
}

// Backward compat re-exports
export const PRIORITY_CONFIGS = PRIORITY_STYLES;
export const STATE_CONFIGS = STATE_STYLES;
```

**Verifica**: tutti i punti dove si usano `PriorityBadge`, `StateBadge`, o `PRIORITY_CONFIGS` continuano a funzionare senza cambiamenti.

---

### Task 2.4 — Creare `<WizardStepShell>` component

**Risolve**: F02 parziale (formalizzazione del pattern wizard già consistente)

**File da creare**: `src/components/requirements/wizard/WizardStepShell.tsx`

```tsx
import type React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface WizardStepShellProps {
  /** Icona Lucide per l'header */
  icon: LucideIcon;
  /** Gradiente per il box icona (es. "from-blue-500 to-cyan-500") */
  iconGradient: string;
  /** Titolo dello step */
  title: string;
  /** Sottotitolo descrittivo */
  subtitle: string;
  /** Badge opzionale (es. "Confermato") a destra */
  badge?: React.ReactNode;
  /** Contenuto scrollabile dello step */
  children: React.ReactNode;
  /** Pulsante Indietro handler */
  onBack?: () => void;
  /** Azioni nel footer (area destra) */
  footerActions?: React.ReactNode;
  /** Label per il pulsante Indietro. Default: "Indietro" */
  backLabel?: string;
  /** Disabilita il pulsante Indietro */
  backDisabled?: boolean;
  /** Classe aggiuntiva per il root */
  className?: string;
}

export function WizardStepShell({
  icon: Icon,
  iconGradient,
  title,
  subtitle,
  badge,
  children,
  onBack,
  footerActions,
  backLabel = 'Indietro',
  backDisabled = false,
  className,
}: WizardStepShellProps) {
  return (
    <div className={cn('flex flex-col h-full gap-3', className)}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 pb-2 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'w-9 h-9 rounded-xl flex items-center justify-center shadow-lg bg-gradient-to-br',
              iconGradient,
            )}
          >
            <Icon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 leading-tight">{title}</h2>
            <p className="text-xs text-slate-600">{subtitle}</p>
          </div>
        </div>
        {badge}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto pr-1">{children}</div>

      {/* Footer */}
      {(onBack || footerActions) && (
        <div className="flex-shrink-0 border-t border-slate-200 pt-3 mt-1">
          <div className="flex items-center justify-between gap-2">
            {onBack ? (
              <Button variant="outline" size="sm" onClick={onBack} disabled={backDisabled}>
                <ArrowLeft className="w-4 h-4 mr-1" />
                {backLabel}
              </Button>
            ) : (
              <div />
            )}
            {footerActions && <div className="flex items-center gap-2">{footerActions}</div>}
          </div>
        </div>
      )}
    </div>
  );
}
```

**File da aggiornare** (migrazione graduale — uno step alla volta):

| File | Azione |
|------|--------|
| `WizardStepUnderstanding.tsx` | Sostituire header/content/footer boilerplate con `<WizardStepShell>` |
| `WizardStepImpactMap.tsx` | Idem |
| `WizardStepBlueprint.tsx` | Idem |
| `WizardStep1.tsx` | Idem |
| `WizardStep2.tsx` | Idem |
| `WizardStep3.tsx` | Idem |
| `WizardStep4.tsx` | Idem |
| `WizardStep5.tsx` | Idem |

**Nota**: la migrazione di `WizardStepInterview.tsx` è separata perché ha una struttura multi-fase unica. Può restare invariato.

**Verifica**: per ogni step migrato, verificare che header, scroll e footer siano identici.

---

### Task 2.5 — Creare `<FormFieldBlock>` component

**Risolve**: F07 (3 label patterns, help text inconsistente)

**File da creare**: `src/components/shared/FormFieldBlock.tsx`

```tsx
import type React from 'react';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';

interface FormFieldBlockProps {
  label: string;
  htmlFor?: string;
  required?: boolean;
  help?: string;
  children: React.ReactNode;
  className?: string;
}

export function FormFieldBlock({
  label,
  htmlFor,
  required,
  help,
  children,
  className,
}: FormFieldBlockProps) {
  return (
    <div className={cn('grid gap-2', className)}>
      <Label htmlFor={htmlFor} className="text-slate-700 font-medium">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </Label>
      {children}
      {help && <p className="text-xs text-muted-foreground">{help}</p>}
    </div>
  );
}
```

**File da aggiornare** (graduale):

| File | Azione |
|------|--------|
| `CreateListDialog.tsx` | Sostituire blocchi `<div className="grid gap-2"><Label>...</Label>...` con `<FormFieldBlock>` |
| `EditListDialog.tsx` | Idem |
| `ActivityDialog.tsx` | Idem |
| `CreateOrganizationDialog.tsx` | Idem |
| Dialog di configurazione vari | Idem, dove applicabile |

**Nota**: `WizardStep1.tsx` usa floating labels — è una scelta UX deliberata e diversa. Non forzare la migrazione. Documentare la decisione.

**Verifica**: form fields identici visivamente, label e help text ora consistenti.

---

### Riepilogo Sprint 2

| Task | Tipo | File | Finding |
|------|------|------|---------|
| 2.1 | Nuovo + refactor KpiCard | MetricCard.tsx + KpiCard.tsx | F08 |
| 2.2 | Nuovo + 5 migrazioni | SectionCard.tsx + 5 detail/estimation files | F02 |
| 2.3 | Nuovo + refactor RequirementBadges | StatusBadge.tsx + RequirementBadges.tsx | F04 |
| 2.4 | Nuovo + 8 migrazioni | WizardStepShell.tsx + 8 wizard steps | F02 |
| 2.5 | Nuovo + 4+ migrazioni | FormFieldBlock.tsx + dialog files | F07 |

**Risultato**: 5 nuovi componenti condivisi, ~20 file migrati a usare astrazioni canoniche.

---

## Sprint 3 — Migrazione pagine (rischio medio-basso)

> Le pagine vengono migrate a usare `<PageShell>` e i componenti dello Sprint 2. Ogni pagina è un PR indipendente.

### Task 3.1 — Migrare Dashboard.tsx a `<PageShell>`

**File da modificare**: `src/pages/dashboard/Dashboard.tsx`

Struttura corrente:
```tsx
<div className="min-h-screen bg-slate-50 ...">
  <Header />
  <main className="container mx-auto max-w-7xl px-6 py-6">
    {content}
  </main>
</div>
```

Diventa:
```tsx
<PageShell maxWidth="7xl">
  {content}
</PageShell>
```

Rimuovere: import di `Header`, div wrapper con `min-h-screen`, `<main>` container.

---

### Task 3.2 — Migrare Requirements.tsx a `<PageShell>`

**File da modificare**: `src/pages/requirements/Requirements.tsx`

Stessa trasformazione del Task 3.1. Verificare che il contenuto interno non dipenda da padding/max-width specifici.

---

### Task 3.3 — Migrare RequirementDetail.tsx a `<PageShell>`

**File da modificare**: `src/pages/requirements/RequirementDetail.tsx`

Struttura corrente: `h-screen flex flex-col bg-slate-50 relative overflow-hidden` con `container mx-auto px-6 py-4`.

Diventa:
```tsx
<PageShell fullHeight paddingY="sm">
  {content}
</PageShell>
```

---

### Task 3.4 — Migrare pagine Configuration

**File da modificare**:
- `src/pages/configuration/Configuration.tsx`
- `src/pages/configuration/ConfigurationPresets.tsx`
- `src/pages/configuration/ConfigurationActivities.tsx`
- `src/pages/configuration/Profile.tsx`
- `src/pages/configuration/OrganizationSettings.tsx`

Le pagine configuration usano `max-w-6xl` o `max-w-5xl` e `px-4`. Migrare con `<PageShell maxWidth="6xl">` (o `"5xl"` per Profile e OrgSettings).

**Nota speciale**: `ConfigurationPresets.tsx` include `<RingParticlesBackground />`. Usare il prop `className` di PageShell per aggiungere `relative overflow-hidden` e inserire il particles background come child prima del contenuto, oppure aggiungere un prop `beforeHeader` a PageShell.

---

### Task 3.5 — Migrare EstimationAccuracy.tsx a `<PageShell>`

**File da modificare**: `src/pages/analytics/EstimationAccuracy.tsx`

Struttura corrente: `bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20`.

Diventa:
```tsx
<PageShell background="gradient" maxWidth="7xl">
  {content}
</PageShell>
```

---

### Task 3.6 — Migrare PromptManagement.tsx a `<PageShell>`

**File da modificare**: `src/pages/admin/PromptManagement.tsx`

Struttura corrente: root è un `container mx-auto py-8 px-4 max-w-5xl` senza Header.

Diventa:
```tsx
<PageShell maxWidth="5xl" showHeader={false} paddingY="lg">
  {content}
</PageShell>
```

---

### Task 3.7 — Migrare empty states a `<EmptyState>`

**File da modificare**: (uno alla volta)

| File | Pattern attuale | Migrazione |
|------|----------------|------------|
| `src/pages/requirements/Requirements.tsx` | `border-2 border-dashed ... p-8` + icon + testo inline | `<EmptyState icon={X} title="..." description="..." action={<Button>}/>` |
| `src/pages/dashboard/Dashboard.tsx` | `border-2 border-dashed ... p-8` + icon + testo inline | `<EmptyState icon={X} title="..." />` |
| `src/components/estimation/ActivitiesSection.tsx` | `border-2 border-dashed ... p-6` (empty state, non drop zone) | `<EmptyState icon={X} title="..." />` |
| `src/components/estimation/CalculationSummary.tsx` | `border-2 border-dashed ... py-6` | `<EmptyState icon={X} title="..." />` |
| `src/components/organizations/MembersList.tsx` | `text-center p-8 ... border-dashed ...` | `<EmptyState icon={X} title="..." />` |

**Nota**: i **drop zone** (es. `ActivitiesSection` drag zone, `TechnologyDialog` drag zone) NON sono empty states. Sono zone interactive e vanno lasciati invariati.

---

### Task 3.8 — Adottare heading utilities nei componenti chiave

**File da modificare** (graduale, batch per area):

| Area | File | Cambio |
|------|------|--------|
| Wizard steps | Tutti i `WizardStep*.tsx` | Titolo `text-lg font-bold text-slate-900 leading-tight` → `heading-2` (già gestito da WizardStepShell) |
| Dashboard | `Dashboard.tsx` | Page title → `heading-1` |
| Detail view | `RequirementHeader.tsx` | Section headers → `heading-2` o `heading-3` |
| Estimation | `ConsultantAnalysisCard.tsx`, `CalculationSummary.tsx` | Section titles → `heading-3` |
| Configuration | `ConfigurationPresets.tsx` | Page headers → `heading-1`, section headers → `heading-3` |

**Nota**: NON toccare i testi semantici dei componenti shadcn (es. `CardTitle`, `DialogTitle`) — quelli hanno i loro default.

---

### Riepilogo Sprint 3

| Task | File coinvolti | Finding |
|------|---------------|---------|
| 3.1–3.6 | 8 page files | F01, F14 |
| 3.7 | 5 component files | F11 |
| 3.8 | 10+ files | F03 |

**Risultato**: tutte le pagine usano `<PageShell>`, tutti gli empty state sono unificati, le heading seguono la gerarchia canonica.

---

## Sprint 4 — Pulizia e prevenzione (rischio basso)

> Rimozione di override ridondanti, standardizzazione di spacing/radius/shadow, e setup guardrail.

### Task 4.1 — Rimuovere override ridondanti dai dialog

Dopo Task 1.6 (dialog defaults aggiornati), rimuovere le classi duplicate da ogni dialog:

| File | Classi da rimuovere |
|------|---------------------|
| `CreateListDialog.tsx` | `bg-white/95 backdrop-blur-xl border-white/20 shadow-2xl` da `DialogContent`, `pb-4 border-b border-slate-100` da `DialogHeader`, `pt-2 border-t border-slate-100` da `DialogFooter` |
| `EditListDialog.tsx` | Idem |
| `ExportDialog.tsx` | Idem (verificare che lo styling custom del header venga preservato) |
| `ImportRequirementsDialog.tsx` | Idem |
| `ActivityDialog.tsx` | Idem |
| `CreateOrganizationDialog.tsx` | Idem |
| `BulkEstimateDialog.tsx` | Idem |
| `BulkInterviewDialog.tsx` | Idem |

**Nota**: alcuni dialog hanno classi **aggiuntive** oltre quelle di default (es. `p-0 overflow-hidden` in `ExportDialog`). Queste vanno preservate.

**Verifica**: ogni dialog appare identico al prima.

---

### Task 4.2 — Standardizzare border-radius

**Risolve**: F09

**Regola canonica**:
- `rounded-xl` → cards, panels, containers
- `rounded-lg` → inputs, buttons, smaller UI elements
- `rounded-2xl` → modale, elevated overlays (accettabile come variante premium)
- `rounded-full` → avatar, dot indicators, pill badges

**File da verificare e normalizzare**: pass globale su tutti i componenti. Cambiare `rounded-lg` a `rounded-xl` per card containers, e `rounded-xl` a `rounded-lg` per input fields dove applicabile.

---

### Task 4.3 — Standardizzare shadow hierarchy

**Risolve**: F10

**Regola canonica**:
- `shadow-sm` → card a livello pagina (flat)
- `shadow-md` → card in hover state
- `shadow-lg` → elementi flottanti (dropdown, popover, tooltip, wizard icon)
- `shadow-xl` → dialog overlay
- `shadow-2xl` → solo dialog content (già impostato nel Task 1.6)

**Azione**: verificare e normalizzare dove necessario.

---

### Task 4.4 — Standardizzare help text

**Risolve**: F03 parziale (micro-consistenza)

Cercare e sostituire in tutti i file:
- `text-[10px] text-slate-500` → `help-text` (alias per `text-xs text-muted-foreground`)
- `text-[10px] text-slate-400` → `help-text`

---

### Task 4.5 — Documentazione design system

**File da creare**: `docs/components/style-guide.md`

Contenuto:
- Gerarchia heading: `heading-1` → `heading-5`
- Spacing canonico: tabella da audit
- Shadow/radius rules
- Lista componenti condivisi (`PageShell`, `SectionCard`, `MetricCard`, `StatusBadge`, `EmptyState`, `InfoBox`, `WizardStepShell`, `FormFieldBlock`)
- Regole form (label, help text, error display)
- Regole dialog (default, override consentiti)
- Regole badge (usare `StatusBadge` per status/priority)

---

### Task 4.6 — Guardrail ESLint (opzionale)

**File da modificare**: `eslint.config.js`

Aggiungere rule per segnalare:
- `min-h-screen` in file `.tsx` sotto `src/pages/` → suggerire `<PageShell>`
- `border-2 border-dashed` in file che non sono drop zone → suggerire `<EmptyState>`

Queste sono **warning**, non errori.

---

### Riepilogo Sprint 4

| Task | File coinvolti | Finding |
|------|---------------|---------|
| 4.1 | ~8 dialog files | F05 cleanup |
| 4.2 | Pass globale | F09 |
| 4.3 | Pass globale | F10 |
| 4.4 | Pass globale | F03 micro |
| 4.5 | Nuovo doc file | — |
| 4.6 | eslint.config.js | — |

---

## Riepilogo globale

### File da CREARE (9 nuovi)

| File | Sprint |
|------|--------|
| `src/components/layout/PageShell.tsx` | 1 |
| `src/components/shared/EmptyState.tsx` | 1 |
| `src/components/shared/InfoBox.tsx` | 1 |
| `src/components/shared/MetricCard.tsx` | 2 |
| `src/components/shared/SectionCard.tsx` | 2 |
| `src/components/shared/StatusBadge.tsx` | 2 |
| `src/components/shared/FormFieldBlock.tsx` | 2 |
| `src/components/requirements/wizard/WizardStepShell.tsx` | 2 |
| `docs/components/style-guide.md` | 4 |

### File da MODIFICARE (per sprint)

| Sprint | File modificati | Rischio |
|--------|----------------|---------|
| Sprint 1 | `constants.ts`, `index.css`, `dialog.tsx`, 6 chart files | Very low |
| Sprint 2 | `KpiCard.tsx`, `RequirementBadges.tsx`, 5 detail/estimation files, 8 wizard steps, 4+ dialog files | Low |
| Sprint 3 | 8 page files, 5 empty state files, 10+ heading files | Low–Medium |
| Sprint 4 | ~8 dialog files (cleanup), pass globale radius/shadow/text, `eslint.config.js` | Very low |

### Finding risolti per sprint

| Sprint | Findings | Severity |
|--------|----------|----------|
| Sprint 1 | F03 (prep), F05, F12, F14 (prep) | 1 High, 1 Medium, 2 Low |
| Sprint 2 | F02, F04, F07, F08, F06 (partial) | 1 High, 3 Medium |
| Sprint 3 | F01, F03 (full), F11, F14 (full) | 1 High, 2 Low |
| Sprint 4 | F05 (cleanup), F09, F10, F03 (micro) | 3 Low |

### Criteri di completamento per sprint

| Sprint | Criterio | Come verificare |
|--------|----------|-----------------|
| Sprint 1 | Build compila, nessun cambiamento visivo tranne dialog unificati | `pnpm build` + test visivo dialog |
| Sprint 2 | Tutti i componenti creati compilano, file migrati producono output identico | `pnpm build` + confronto screenshot |
| Sprint 3 | Tutte le pagine usano PageShell, empty states usano EmptyState | `pnpm build` + navigazione completa |
| Sprint 4 | Nessun override ridondante, documenti presenti, lint warnings attivi | `pnpm lint` + review manuale |

### Ordine di priorità se il tempo è limitato

Se non si riesce a completare tutti e 4 gli sprint, dare priorità in questo ordine:

1. **Sprint 1 (Task 1.1 + 1.3 + 1.6)** — chart colors, PageShell creato, dialog unificati. Massimo impatto, zero rischio.
2. **Sprint 2 (Task 2.1 + 2.3)** — MetricCard e StatusBadge. I due pattern più ripetuti.
3. **Sprint 3 (Task 3.1–3.6)** — Migrazione pagine a PageShell. Elimina la duplicazione più visibile.
4. **Il resto** — importante ma non urgente.

---

*Piano di implementazione completo. Pronto per iniziare dallo Sprint 1.*
