# Syntero Design System — Style Guide

> Canonical styling rules for the Syntero frontend. All new components and pages must follow these conventions.

---

## 1. Heading Hierarchy

Defined in `src/index.css` as utility classes. Use these instead of raw Tailwind classes for headings.

| Class | Resolves To | Usage |
|-------|------------|-------|
| `.heading-1` | `text-2xl font-bold text-slate-900 leading-tight tracking-tight` | Page titles (Dashboard, Requirements header) |
| `.heading-2` | `text-lg font-bold text-slate-900 leading-tight` | Major section titles, wizard step titles |
| `.heading-3` | `text-base font-semibold text-slate-800` | Sub-section titles, config page headers |
| `.heading-4` | `text-sm font-semibold text-slate-700` | Card section headers, collapsible panel titles |
| `.heading-5` | `text-xs font-semibold text-slate-600` | Small section headers, summary labels |

**Do NOT** apply heading utilities to shadcn semantic elements (`CardTitle`, `DialogTitle`).

---

## 2. Help Text

Use the `.help-text` utility class for descriptions, field hints, and supplementary text:

```
.help-text → text-xs text-muted-foreground
```

Avoid `text-[10px] text-slate-500` for new code. Existing compact data labels (estimation panels, stat counters) may keep `text-[10px]` where space is constrained.

---

## 3. Spacing

| Context | Value |
|---------|-------|
| Page padding (horizontal) | `px-4` to `px-6` via `PageShell` |
| Page padding (vertical) | `py-6` (default), `py-8` (lg) via `PageShell` |
| Section gap | `space-y-6` or `space-y-8` |
| Card internal padding | `p-3` (sm), `p-4` (md), `p-6` (lg) via `SectionCard` |
| Form field spacing | `space-y-4` |
| Inline element gap | `gap-2` to `gap-3` |

---

## 4. Border Radius

| Element Type | Class |
|-------------|-------|
| Cards, panels, containers | `rounded-xl` |
| Inputs, buttons, smaller UI | `rounded-lg` |
| Modals, elevated overlays | `rounded-2xl` |
| Avatars, dots, pill badges | `rounded-full` |

---

## 5. Shadow Hierarchy

| Level | Class | Usage |
|-------|-------|-------|
| Flat | `shadow-sm` | Page-level cards at rest |
| Hover | `shadow-md` | Cards on hover |
| Floating | `shadow-lg` | Dropdowns, popovers, tooltips, wizard icons |
| Overlay | `shadow-xl` | Dialog overlay backdrop |
| Dialog | `shadow-2xl` | Dialog content (set in `dialog.tsx` defaults) |

Colored shadows (e.g. `shadow-blue-500/25`) are acceptable for gradient buttons and decorative elements.

---

## 6. Shared Components

### Layout

| Component | Location | Purpose |
|-----------|----------|---------|
| `PageShell` | `src/components/layout/PageShell.tsx` | Unified page wrapper with Header, background, maxWidth, padding |

**Props**: `maxWidth`, `background`, `paddingY`, `showHeader`, `fullHeight`, `className`, `contentClassName`, `headerClassName`, `backgroundSlot`, `noContainer`

### Data Display

| Component | Location | Purpose |
|-----------|----------|---------|
| `MetricCard` | `src/components/shared/MetricCard.tsx` | KPI/metric display with icon, label, value |
| `SectionCard` | `src/components/shared/SectionCard.tsx` | Generic card wrapper (default / elevated / flat) |
| `StatusBadge` | `src/components/shared/StatusBadge.tsx` | Canonical status/priority badges |
| `EmptyState` | `src/components/shared/EmptyState.tsx` | Empty list/no-results placeholder |
| `InfoBox` | `src/components/shared/InfoBox.tsx` | Info/warning/success/error message box |

### Forms

| Component | Location | Purpose |
|-----------|----------|---------|
| `FormFieldBlock` | `src/components/shared/FormFieldBlock.tsx` | Label + input + help text wrapper |
| `WizardStepShell` | `src/components/requirements/wizard/WizardStepShell.tsx` | Wizard step layout with icon + title + description |

---

## 7. Dialog Defaults

The base `dialog.tsx` already applies:
- `bg-white/95 backdrop-blur-xl border-white/20 shadow-2xl` on `DialogContent`
- `pb-4 border-b border-slate-100` on `DialogHeader`
- `pt-2 border-t border-slate-100` on `DialogFooter`

**Do NOT duplicate** these classes in individual dialogs. Only add custom classes for:
- Layout overrides (`p-0 overflow-hidden`, `max-w-3xl`, `max-h-[90vh]`)
- Custom border colors (`border-slate-200`)
- Background (only if intentionally different, e.g. `bg-white` for fully opaque)

---

## 8. Chart Colors

Use `CHART_COLORS` and `STATUS_CHART_COLORS` from `src/lib/constants.ts`. Do not hardcode hex values in chart components.

---

## 9. Badge Rules

Use `StatusBadge` for requirement status and priority display. Available variants: `status` and `priority`, supporting all standard values (PROPOSED, SELECTED, SCHEDULED, etc. for status; LOW, MEDIUM, HIGH, CRITICAL for priority).

---

*Last updated: 2026-03-21 — Sprint 4 (Style Unification)*
