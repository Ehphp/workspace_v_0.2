# Frontend Style Audit

**Date**: 2026-03-21
**Scope**: `shadcn-ui/src/` — all components, pages, global CSS, Tailwind config, and styling utilities
**Methodology**: Systematic file-by-file inspection of every component directory, page, shared component, layout, dialog, form, card, badge, table, wizard step, loading state, and styling utility in the repository.

---

## 1. Executive Summary

**Styling maturity: Intermediate — strong foundation, moderate drift.**

The codebase is built on a solid shadcn/ui + Tailwind CSS + CSS variables foundation. The design-system backbone exists and is well-wired: a centralized `cn()` utility, proper CSS variable tokens for light/dark mode, 10 UI primitives with CVA-based variant management, and a standard `components.json` setup. The wizard subsystem in particular shows excellent structural consistency — all steps share the same layout skeleton.

**Main architectural problems:**

1. **No shared page shell.** Every page independently imports `<Header />` and defines its own root container (`min-h-screen`, background, padding, max-width). There is no `<PageLayout>` wrapper. This makes page-level consistency fragile and duplicative.

2. **Card pattern proliferation.** At least 7 distinct card styling patterns exist (standard shadcn Card, KPI gradient cards, glassmorphism cards, premium elevated cards, nested row items, AiAssist action cards, status indicator boxes). Many could be unified through variants on a single abstraction.

3. **Badge/status duality.** Status styling is defined in two places that don't reference each other: `constants.ts` maps to shadcn variant names, while `RequirementBadges.tsx` defines a completely parallel gradient-based system with its own config objects. These coexist without a clear canonical choice.

4. **Heading typography has 18+ distinct patterns.** The range from `text-2xl font-bold text-slate-900` down to `text-[9px] font-semibold` is not governed by a defined hierarchy — each component picks its own combination.

5. **Dialog styling varies.** Content widths range from `sm:max-w-[425px]` to `max-w-4xl`. Background treatments range from `bg-white` to `bg-white/95 backdrop-blur-xl border-white/20 shadow-2xl`. Footer borders and button styling are mostly consistent but not enforced.

**Overall judgment:** Style coherence is moderate. The repo has not drifted into chaos — the shadcn foundation prevents that. But organic growth has produced localized inconsistencies that compound across the UI. The situation is correctable incrementally without a major redesign.

---

## 2. Styling Approaches Currently in Use

| Approach | Description | Coverage |
|----------|-------------|----------|
| **Tailwind utility-first** | Primary styling method. All components use Tailwind classes via `className`. | ~95% of all styling |
| **CSS variables (design tokens)** | HSL-based tokens defined in `src/index.css` `:root` and `.dark`. Used via `hsl(var(--X))` mapping in Tailwind config. | 100% of color semantics |
| **shadcn/ui primitives** | 49 UI components in `src/components/ui/`. Standard shadcn pattern with `cn()` merging. | All foundational UI |
| **CVA (class-variance-authority)** | Used in 10 UI components for structured variant management (Button, Badge, Alert, Toast, Toggle, Label, Sheet, NavigationMenu, Sidebar). | UI primitives only |
| **`cn()` utility** | `clsx` + `tailwind-merge` in `src/lib/utils.ts`. Single centralized entry point — no scattered direct imports. | 100% of class merging |
| **Inline styles** | Used in ~16 files, exclusively for: Recharts tooltip configs, dynamic widths/transforms, canvas geometry, `backgroundColor: variable`. | Charts + dynamic values only |
| **Global CSS** | `src/index.css` defines `@layer base` defaults, focus ring overrides, scrollbar hiding, and a custom `bg-syntero-gradient` utility. `App.css` is empty. | Minimal global footprint |
| **Manual variant objects** | `AiAssistPanel.tsx` uses plain JS objects (`cardVariants`, `optionVariants`) instead of CVA. `RequirementBadges.tsx` uses config maps. | 2 files |
| **Hardcoded hex colors** | Chart components use hex values (`#3b82f6`, `#8b5cf6`, etc.) for Recharts configuration. | Charts only (~6 files) |

---

## 3. Inconsistency Findings

### Summary Table

| ID | Severity | Type | Area | Files Involved | Problem | Recommended Direction |
|----|----------|------|------|---------------|---------|----------------------|
| F01 | **High** | Design-system drift | Page layout | All pages under `src/pages/` | No shared page shell; each page independently composes `<Header />` + container + background | Create `<PageShell>` layout wrapper |
| F02 | **High** | Duplication | Cards | 15+ component files | 7+ distinct card patterns with different radius, shadow, border, background, and opacity combinations | Define `<SectionCard>` with variants |
| F03 | **High** | Design-system drift | Typography | All component/page files | 18+ distinct heading class combinations with no defined hierarchy | Define 5-level type scale as Tailwind utilities or components |
| F04 | **Medium** | Duplication | Badges/Status | `constants.ts`, `RequirementBadges.tsx`, inline Badge usage | Dual status styling systems that don't reference each other | Consolidate into single `<StatusBadge>` with variant map |
| F05 | **Medium** | Visual inconsistency | Dialogs | All dialog files (~15) | Content width varies (425px–4xl), background treatment varies (solid vs glassmorphism), footer border inconsistent | Standardize dialog shell defaults |
| F06 | **Medium** | Duplication | Section headers | Dashboard, detail, estimation, wizard | Section headers use different icon+title patterns (gradient icon boxes, plain icons, no icons) | Create `<SectionHeader>` component |
| F07 | **Medium** | Visual inconsistency | Form labels | WizardStep1, CreateListDialog, ActivityDialog | Three label patterns: standard `<Label>`, icon+label, floating label. Help text uses `text-[10px]` vs `text-xs`. | Standardize on `<FormFieldBlock>` |
| F08 | **Medium** | Maintainability risk | KPI/Metric cards | `KpiCard.tsx`, `RequirementsStats.tsx`, `CalculationSummary.tsx` | Same visual pattern (gradient bg, border-2, rounded-xl) repeated with slight variations | Extract `<MetricCard>` |
| F09 | **Low** | Visual inconsistency | Border radius | All components | Mixed usage: `rounded-lg` (25), `rounded-xl` (35), `rounded-2xl` (8). Dominant is `rounded-xl` but `rounded-lg` also frequent. | Standardize: `rounded-xl` for cards, `rounded-lg` for inputs/buttons |
| F10 | **Low** | Visual inconsistency | Shadows | All components | Shadow escalation inconsistent: cards use `shadow-sm`, `shadow-md`, or `shadow-lg` without clear hierarchy rules | Define shadow scale by component type |
| F11 | **Low** | Duplication | Empty states | `RecentRequirements`, `MembersList`, `Requirements`, `ActivitiesSection` | Each empty state implemented ad-hoc (different icons, different spacing, different border treatment) | Create `<EmptyState>` component |
| F12 | **Low** | Maintainability risk | Color hardcoding | 6 chart files | Hex colors (`#3b82f6`, etc.) hardcoded in each chart component rather than shared constant | Extract `CHART_COLORS` constant |
| F13 | **Low** | Visual inconsistency | Glassmorphism | Header, dialogs, cards | `backdrop-blur-sm`, `backdrop-blur-md`, `backdrop-blur-xl`, `backdrop-blur-2xl` used without hierarchy rules | Define blur levels by elevation |
| F14 | **Low** | Maintainability risk | Page backgrounds | Pages | Different gradient backgrounds per page (`from-slate-50 via-blue-50/30`, `from-slate-50 to-indigo-50/20`, plain `bg-slate-50`) | Unify into page shell defaults |
| F15 | **Low** | Accessibility risk | Focus rings | `src/index.css` | Focus ring uses `box-shadow` with `!important` border override, may not work with all component types | Verify across all interactive elements |

---

### Expanded Findings

#### F01 — No Shared Page Shell (High)

Every page in `src/pages/` independently defines its root layout:

```tsx
// Dashboard.tsx
<div className="min-h-screen bg-slate-50 ...">
  <Header />
  <main className="container mx-auto max-w-7xl px-6 py-6">

// Requirements.tsx  
<div className="min-h-screen ...">
  <Header />
  <main className="container mx-auto max-w-7xl px-6 py-6">

// ConfigurationPresets.tsx
<div className="min-h-screen bg-slate-50 font-sans overflow-hidden relative">
  <RingParticlesBackground />
  <Header />
  <main className="container mx-auto px-4 py-10 lg:py-12 max-w-6xl">

// EstimationAccuracy.tsx
<div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
  <Header />
  <main className="container mx-auto max-w-7xl px-6 py-6">
```

Note: `max-w-7xl` vs `max-w-6xl`, `px-6` vs `px-4`, `py-6` vs `py-10 lg:py-12`. These variations produce subtle but visible inconsistencies across page transitions.

`App.tsx` has no layout wrapper — just raw `<Routes>` with each page as a standalone element.

#### F02 — Card Pattern Proliferation (High)

Seven distinct card patterns identified:

| # | Pattern | Example Classes | Used In |
|---|---------|----------------|---------|
| 1 | **Standard shadcn Card** | `rounded-lg border bg-card text-card-foreground shadow-sm` | `HistorySection`, `ActualHoursTab`, `EstimationComparison` |
| 2 | **KPI gradient card** | `rounded-xl border-2 border-slate-200 bg-gradient-to-br from-slate-50/80 to-white p-4` | `KpiCard`, `RequirementsStats`, `CalculationSummary` |
| 3 | **Glassmorphism card** | `rounded-2xl shadow-lg border-slate-200/50 bg-white/80 backdrop-blur-xl` | `OverviewTab`, `ConsultantAnalysisCard` |
| 4 | **Detail info card** | `shadow-sm border-slate-200` (on shadcn Card) | `RequirementInfo`, `RequirementDescription`, `RequirementDriversCard` |
| 5 | **Nested row item** | `rounded-lg border border-slate-100 bg-slate-50/50 p-2.5` | `ImpactMapCard`, `EstimationBlueprintCard` |
| 6 | **Action/config card** | `rounded-2xl bg-white border border-slate-200 p-6 shadow-sm` | `AiAssistPanel` |
| 7 | **Status indicator box** | `rounded-xl bg-${color}-50 border border-${color}-100 p-4` | `AiAssistPanel`, `RequirementsStats` |

Cards 2, 3, 6, and 7 solve similar visual problems with different class combinations.

#### F03 — Typography Hierarchy Drift (High)

18 distinct heading patterns found, roughly falling into 5 logical tiers but with inconsistent class choices within each tier:

**Tier 1 (Page titles):**
- `text-2xl font-bold text-slate-900`
- `text-2xl font-bold text-slate-900 leading-none tracking-tight` (shadcn CardTitle)
- `text-xl font-bold text-slate-900`
- `text-xl font-bold text-slate-800`

**Tier 2 (Section headers):**
- `text-lg font-bold text-slate-900 leading-tight` (wizard steps — consistent here)
- `text-lg font-semibold text-slate-800`
- `text-lg font-bold text-slate-800`

**Tier 3 (Subsection headers):**
- `text-base font-semibold text-slate-800`
- `text-base font-bold text-slate-800`

**Tier 4 (Small labels):**
- `text-sm font-bold text-slate-900`
- `text-sm font-semibold text-slate-700`
- `text-sm font-semibold text-slate-800`
- `text-sm font-medium text-slate-800`

**Tier 5 (Micro labels):**
- `text-xs font-semibold`
- `text-[11px] font-semibold`
- `text-[10px] font-semibold`
- `text-[9px] font-semibold`

The color choice (`text-slate-800` vs `text-slate-900`) and weight choice (`font-bold` vs `font-semibold`) within the same tier creates visual noise.

#### F04 — Badge/Status Duality (Medium)

Two parallel systems exist for status styling:

**System 1** — `src/lib/constants.ts`: Maps status enums to shadcn Badge variant names (`'destructive'`, `'default'`, `'secondary'`, `'outline'`). Simple, uses the design system.

**System 2** — `src/components/shared/RequirementBadges.tsx`: Defines completely separate gradient-based configs with `PRIORITY_CONFIGS` and `STATE_CONFIGS`, each with `gradient`, `bgGradient`, `textColor`, `borderColor`, `leftBorder`, and `icon` properties. Does not reference or extend the shadcn Badge variants.

Result: Status badges look different depending on which component renders them. The `RequirementBadges.tsx` gradient badges are richer visually but bypass the design system. The `constants.ts` mapping is simpler but produces plainer output.

#### F07 — Form Label Inconsistency (Medium)

Three distinct label patterns coexist:

1. **Standard Label** — most dialogs:
   ```tsx
   <Label htmlFor="id" className="text-slate-700 font-medium">Field Name</Label>
   ```

2. **Icon + Label** — `CreateListDialog`, `ActivityDialog`:
   ```tsx
   <Label className="text-slate-700 font-medium flex items-center gap-2">
     <Icon className="w-3.5 h-3.5 text-slate-400" /> Field Name
   </Label>
   ```

3. **Floating Label** — `WizardStep1`:
   ```tsx
   <label className={`absolute left-3 transition-all duration-150 pointer-events-none z-10
     ${isFocused || value
       ? '-top-1.1 text-[10px] font-semibold bg-white px-2 text-blue-600'
       : 'top-2.5 text-xs text-slate-500'}`}>
   ```

Help text also varies: `text-[10px] text-slate-500` vs `text-xs text-muted-foreground`. Field spacing uses `space-y-2`, `grid gap-2`, or `space-y-2.5` interchangeably.

---

## 4. Reuse and Duplication Map

### Card Patterns

| Pattern | Occurrences | Variants | Recommended Canonical |
|---------|-------------|----------|----------------------|
| KPI/Metric card (gradient bg, border-2) | 4 files | 3 (padding p-3/p-4, with/without icon container) | `<MetricCard icon={} label={} value={}>` |
| Section card (border, shadow-sm) | 8+ files | 4 (different shadow/border overrides on shadcn Card) | `<SectionCard>` wrapping shadcn Card with standardized className |
| Glassmorphism card (backdrop-blur, opacity bg) | 4 files | 2 (bg-white/80 vs bg-white/90, blur levels) | Variant of `<SectionCard variant="elevated">` |
| Nested row item (bg-slate-50/50, p-2.5) | 3 files | 1 (consistent) | `<NestedItem>` or keep as local pattern |
| Status indicator box (colored bg + border) | 3 files | 3 (different colors, p-3/p-4, rounded-lg/xl) | `<StatusBox color={}>` |

### Section Headers

| Pattern | Occurrences | Variants | Recommended Canonical |
|---------|-------------|----------|----------------------|
| Gradient icon + title + subtitle | 9 wizard steps | 1 (very consistent) | `<WizardStepHeader icon={} gradient={} title={} subtitle={}>` |
| Plain text section header | 12+ locations | 5 (different sizes/weights) | `<SectionHeader level={1|2|3}>` |
| Card header with icon | 4 detail cards | 2 (icon size/color varies) | Absorb into `<SectionCard>` header slot |

### Dialog Layouts

| Pattern | Occurrences | Variants | Recommended Canonical |
|---------|-------------|----------|----------------------|
| Form dialog (header + fields + footer) | 8 dialogs | 3 (width, background, footer border) | Standardize Dialog defaults; no new wrapper needed |
| Delete confirmation dialog | 4 dialogs | 1 (very consistent via AlertDialog) | Already canonical |
| Full-screen dialog (wizard) | 1 dialog | 1 | Unique — acceptable |

### Form Field Blocks

| Pattern | Occurrences | Variants | Recommended Canonical |
|---------|-------------|----------|----------------------|
| Label + Input + help text | 10+ forms | 3 (label style, spacing, help text style) | `<FormFieldBlock label={} help={}>` |
| Required field marker (`<span className="text-red-500">*</span>`) | 6+ forms | 1 | Absorb into FormFieldBlock |

### Badges/Status Pills

| Pattern | Occurrences | Variants | Recommended Canonical |
|---------|-------------|----------|----------------------|
| shadcn Badge with variant | 15+ locations | 4 variants (default/secondary/destructive/outline) | Keep as-is for generic badges |
| Gradient status badge (RequirementBadges) | 2 locations | Priority (3 colors) + State (4 colors) | Adopt as canonical for requirement status display |
| Custom inline badge overrides | 8+ locations | Many (custom bg/text/border per instance) | Replace with semantic variant |

### Panel Wrappers

| Pattern | Occurrences | Variants | Recommended Canonical |
|---------|-------------|----------|----------------------|
| Info box (blue bg, border, icon + text) | 4+ locations | 2 (blue/amber/green) | `<InfoBox variant="info|warning|success">` |
| Error box (red bg, border, icon + text) | 3+ locations | 1 | `<InfoBox variant="error">` |
| Empty state (dashed border, icon, message) | 4 files | 4 (different icons, spacing) | `<EmptyState icon={} message={}>` |

---

## 5. Candidate Design-System Foundation

### Core Primitives (already exist, well maintained)

These shadcn/ui components form the design-system backbone and are used correctly throughout:

- `Button` (6 variants, 4 sizes)
- `Badge` (4 variants)
- `Card` / `CardHeader` / `CardContent` / `CardFooter`
- `Dialog` / `AlertDialog`
- `Input` / `Textarea` / `Select`
- `Label`
- `Table` / `TableRow` / `TableCell`
- `Tabs`
- `Tooltip`
- `ScrollArea`
- `Progress`
- `Separator`

### Layout Wrappers (candidates for creation)

| Component | Purpose | Props |
|-----------|---------|-------|
| `<PageShell>` | Universal page layout: min-h-screen, Header, container, background | `maxWidth?: '6xl' \| '7xl'`, `background?: 'default' \| 'gradient'`, `className?` |
| `<SectionCard>` | Canonical card with standardized defaults | `variant?: 'default' \| 'elevated' \| 'kpi'`, `padding?: 'sm' \| 'md' \| 'lg'` |
| `<WizardStepShell>` | Already effectively standardized in wizard steps; extract as explicit component | `icon`, `iconGradient`, `title`, `subtitle`, `badge?`, `footer` |

### Semantic Variants (candidates for creation)

| Component | Purpose | Props |
|-----------|---------|-------|
| `<StatusBadge>` | Unified requirement status/priority display | `type: 'priority' \| 'state' \| 'listStatus'`, `value` |
| `<MetricCard>` | KPI/metric display card | `icon`, `iconGradient`, `label`, `value`, `trend?` |
| `<InfoBox>` | Contextual info/warning/error/success message | `variant: 'info' \| 'warning' \| 'success' \| 'error'`, `children` |

### Shared Spacing Rules

Based on dominant patterns in the codebase, the canonical spacing scale should be:

| Context | Spacing | Current Reality |
|---------|---------|----------------|
| Page sections | `space-y-6` | Mostly consistent |
| Card padding | `p-4` (compact) / `p-6` (standard) | 2 choices, acceptable |
| Form field groups | `space-y-4` | Mostly consistent, some `space-y-3` |
| Field internal (label→input) | `space-y-2` | Consistent via `grid gap-2` |
| Inline items | `gap-2` / `gap-3` | Consistent |
| Button groups | `gap-2` | Consistent |

### Form Conventions

| Element | Canonical Pattern |
|---------|-------------------|
| Label | `<Label className="text-slate-700 font-medium">` |
| Required marker | `<span className="text-red-500">*</span>` inside Label |
| Help text | `<p className="text-xs text-muted-foreground">` |
| Input background | `bg-slate-50/50 border-slate-200 focus:bg-white transition-all` |
| Error display | Toast for validation; `<Alert variant="destructive">` for form-level errors |
| Button alignment | Footer: Cancel (ghost) left, Primary right with gradient |

### Data Display Conventions

| Element | Canonical Pattern |
|---------|-------------------|
| Data table | shadcn `Table` component with `hover:bg-slate-50/80` rows |
| Compact list | Div-based with `space-y-1`, `p-2`, `hover:bg-white/80` |
| Loading | `<Loader2 className="h-4 w-4 animate-spin" />` |
| Empty state | Dashed border container + centered icon + message text |
| Charts | Recharts with inline tooltip styling (acceptable current state) |

### Feedback State Conventions

| State | Pattern |
|-------|---------|
| Loading action | `Loader2` spinner inside button, button disabled |
| Success | `toast.success()` via Sonner |
| Error | `toast.error()` via Sonner |
| Form validation | Inline toast per field (no per-field error display) |
| Confirmation | `AlertDialog` for destructive actions |
| Info callout | Blue `bg-blue-50 border-blue-200` box with `Info` icon |

---

## 6. Incremental Unification Plan

### Phase 1: Low-Risk Standardization

**Goal:** Unify the most impactful inconsistencies without changing component APIs or visual behavior.

| Change | Target Files | Impact | Difficulty | Regression Risk |
|--------|-------------|--------|------------|-----------------|
| Create `<PageShell>` wrapper | New: `src/components/layout/PageShell.tsx`. Update: all 10+ page files | Eliminates duplicate Header/container/background composition | Low | Very low — purely structural |
| Standardize heading hierarchy | Define `heading-1` through `heading-5` utility classes in `index.css` `@layer components` | Eliminates 18 heading patterns | Low | Very low — CSS only |
| Standardize dialog defaults | Update `src/components/ui/dialog.tsx` to include default glassmorphism classes | Reduces per-dialog className overrides | Low | Low — verify each dialog |
| Extract `CHART_COLORS` constant | New: add to `src/lib/constants.ts`. Update: 6 chart files | Eliminates hardcoded hex duplication | Very low | None |

**Expected outcome:** All pages share a consistent container, heading sizes are predictable, dialogs look uniform.

### Phase 2: Shared Abstractions

**Goal:** Extract repeated visual patterns into reusable components.

| Change | Target Files | Impact | Difficulty | Regression Risk |
|--------|-------------|--------|------------|-----------------|
| Create `<SectionCard>` | New component. Refactor: 8+ files using card patterns | Unifies card styling into 3 variants | Medium | Low — visual diff review needed |
| Create `<MetricCard>` | New component. Refactor: `KpiCard`, `RequirementsStats`, `CalculationSummary` | Unifies KPI display | Medium | Low |
| Create `<StatusBadge>` | New component. Refactor: `RequirementBadges.tsx`, inline Badge usage | Consolidates dual badge systems | Medium | Medium — must preserve both visual styles |
| Create `<InfoBox>` | New component. Refactor: 4+ inline info/warning boxes | Unifies feedback callouts | Low | Very low |
| Create `<EmptyState>` | New component. Refactor: 4 files | Unifies empty data display | Low | Very low |
| Extract `<WizardStepShell>` | New component from existing wizard step pattern. Refactor: 9 wizard steps | Formalizes already-consistent pattern | Medium | Low — pattern is already stable |

**Expected outcome:** Repeated visual patterns become importable primitives. New features automatically inherit consistent styling.

### Phase 3: Page-Level Cleanup

**Goal:** Apply Phase 1+2 abstractions to all pages and address remaining one-off styling.

| Change | Target Files | Impact | Difficulty | Regression Risk |
|--------|-------------|--------|------------|-----------------|
| Migrate all pages to `<PageShell>` | All page files | Full layout consistency | Low | Low (if Phase 1 PageShell is proven) |
| Replace inline card patterns | Estimation detail, overview tabs | Use SectionCard variants | Medium | Medium — visual review per page |
| Standardize form label patterns | WizardStep1 (floating labels), all dialogs | Consistent label UX | Medium | Medium — floating labels are a distinct UX choice |
| Unify table row density | `PresetTableRow`, `MembersList`, `RecentRequirements` | Consistent list density | Low | Low |

**Expected outcome:** Full visual consistency across the application.

### Phase 4: Enforcement and Prevention

**Goal:** Prevent regression and style drift in future development.

| Change | Target Files | Impact | Difficulty | Regression Risk |
|--------|-------------|--------|------------|-----------------|
| Add ESLint class-pattern rules | `eslint.config.js` | Flag non-canonical patterns | Medium | None |
| Document canonical patterns | `docs/components/style-guide.md` | Developer reference | Low | None |
| Add Storybook for shared components | New config + stories | Visual regression testing | High | None |
| PR review checklist | `.github/PULL_REQUEST_TEMPLATE.md` | Human enforcement | Very low | None |

---

## 7. Priority Refactor List

Ranked by (value x ease) — highest-impact changes that are simplest to implement first.

| Rank | Change | Value | Ease | Risk |
|------|--------|-------|------|------|
| 1 | Create `<PageShell>` layout wrapper | High | Easy | Very low |
| 2 | Define heading utility classes (`heading-1` .. `heading-5`) | High | Easy | Very low |
| 3 | Extract `CHART_COLORS` from hardcoded hex values | Low | Very easy | None |
| 4 | Standardize dialog `<DialogContent>` default classes | Medium | Easy | Low |
| 5 | Create `<EmptyState>` component | Medium | Easy | Very low |
| 6 | Create `<InfoBox>` component | Medium | Easy | Very low |
| 7 | Create `<MetricCard>` component | Medium | Medium | Low |
| 8 | Extract `<WizardStepShell>` from wizard step pattern | Medium | Medium | Low |
| 9 | Create `<SectionCard>` with `default \| elevated \| kpi` variants | High | Medium | Low |
| 10 | Consolidate `<StatusBadge>` (merge constants.ts + RequirementBadges.tsx) | Medium | Medium | Medium |
| 11 | Standardize form field spacing to `space-y-4` / `grid gap-2` | Low | Easy | Low |
| 12 | Unify border-radius convention (`rounded-xl` cards, `rounded-lg` inputs) | Low | Easy | Low |
| 13 | Standardize shadow hierarchy (sm for flat, md for cards, lg for elevated, xl for dialogs) | Low | Easy | Low |
| 14 | Standardize help text to `text-xs text-muted-foreground` | Low | Very easy | None |
| 15 | Migrate floating label in WizardStep1 to standard label pattern (or make it a deliberate design choice and document) | Low | Medium | Medium |

---

## 8. Optional Enforcement Mechanisms

### ESLint Rules

```js
// Forbid raw className patterns that should use abstractions
'no-restricted-syntax': [
  'warn',
  // Flag raw "min-h-screen" in page components (should use PageShell)
  { selector: 'JSXAttribute[name.name="className"][value.value=/min-h-screen/]', message: 'Use <PageShell> instead of raw min-h-screen' },
]
```

### CVA Extension Candidates

- `sectionCardVariants` — replace 7 card patterns with 3 explicit variants
- `statusBadgeVariants` — replace dual badge system with single source of truth

### Forbidden Raw Class Patterns (Candidate List)

| Pattern | Replacement |
|---------|-------------|
| `rounded-2xl shadow-lg border-slate-200/50 bg-white/80 backdrop-blur-xl` | `<SectionCard variant="elevated">` |
| `rounded-xl border-2 border-slate-200 bg-gradient-to-br from-slate-50/80 to-white p-3` | `<MetricCard>` |
| `text-2xl font-bold text-slate-900` (as section heading) | `className={heading.h1}` |
| `bg-blue-50 border border-blue-200 rounded-lg p-3` (info callout) | `<InfoBox variant="info">` |

### Preferred Wrapper Components

| Instead of | Use |
|------------|-----|
| Raw `<div className="min-h-screen..."><Header />...` | `<PageShell>` |
| Inline card className combos | `<SectionCard>` |
| Ad-hoc empty state divs | `<EmptyState>` |
| Inline info/warning boxes | `<InfoBox>` |
| Direct `<Badge>` with custom className for status | `<StatusBadge>` |

### Code Review Checklist Items

- [ ] New pages use `<PageShell>`, not raw layout divs
- [ ] New cards use `<SectionCard>` or `<MetricCard>`, not custom className combos
- [ ] Heading classes match the defined hierarchy (`heading-1` through `heading-5`)
- [ ] Status/priority badges use `<StatusBadge>`, not inline Badge overrides
- [ ] Form fields use standard label pattern (`<Label className="text-slate-700 font-medium">`)
- [ ] Empty states use `<EmptyState>` component
- [ ] No new hardcoded hex colors outside `CHART_COLORS`
- [ ] Dialog content uses default glassmorphism classes (no per-dialog background overrides)

### Style Documentation to Add

| Doc | Content |
|-----|---------|
| `docs/components/style-guide.md` | Canonical spacing, typography, color, shadow, radius rules |
| `docs/components/component-catalog.md` | List of shared abstractions with usage examples |

---

## 9. Final Verdict

### Does the repo have a usable design-system backbone?

**Yes.** The shadcn/ui foundation is properly configured, the CSS variable token system supports light/dark mode, the `cn()` utility is centralized, and CVA is used appropriately in UI primitives. The design system exists and works — it just isn't leveraged consistently above the primitive layer.

### Is style drift localized or systemic?

**Localized but widespread.** The drift is not random chaos — it follows a predictable pattern: each feature area (dashboard, wizard, estimation, configuration) developed its own local styling conventions that are internally consistent but differ from other areas. The wizard steps are the best example of what "consistent" looks like in this codebase — 9 steps all sharing the same layout skeleton. The card and heading patterns are the worst examples of drift.

### Can unification be done incrementally?

**Yes, without question.** The four-phase plan above is designed for incremental adoption:
- Phase 1 (PageShell + heading utilities) can be done in a single PR with zero risk
- Phase 2 (shared components) can be adopted one component at a time
- Phase 3 (page cleanup) can be done page by page
- Phase 4 (enforcement) happens naturally as conventions solidify

No broader redesign is needed. The visual language is already coherent enough — it just needs formalization.

---

## Canonicalization Candidates

Based on repeated patterns found in the codebase, these components or wrappers should be introduced:

### `<PageShell>`
**Justification:** Every page (10+ files) independently composes `min-h-screen` + `<Header />` + `container mx-auto` + `max-w-{size}` + `px-{n} py-{n}`. Repeated in: `Dashboard.tsx`, `Requirements.tsx`, `RequirementDetail.tsx`, `ConfigurationPresets.tsx`, `Configuration.tsx`, `EstimationAccuracy.tsx`, `OrganizationSettings.tsx`, `Profile.tsx`.

### `<SectionCard>`
**Justification:** 7 distinct card patterns across 15+ files. The shadcn `Card` is used but always overridden with different shadow/border/background combinations. A variant-based wrapper (`default`, `elevated`, `kpi`) would eliminate className proliferation.

### `<MetricCard>`
**Justification:** The pattern `rounded-xl border-2 border-slate-200 bg-gradient-to-br from-slate-50/80 to-white p-3/4` with icon+label+value appears in `KpiCard.tsx`, `RequirementsStats.tsx`, `CalculationSummary.tsx`, and portions of `EstimationAccuracy.tsx`. At least 3 files share this exact structure.

### `<WizardStepShell>`
**Justification:** All 9 wizard steps already share `flex flex-col h-full gap-3` + header (gradient icon + title + subtitle + optional badge) + scrollable content + footer buttons. This pattern is already stable — extracting it would just formalize it and prevent future drift.

### `<StatusBadge>`
**Justification:** Status badges are rendered in two incompatible ways: `constants.ts` maps to shadcn Badge variants, while `RequirementBadges.tsx` defines a separate gradient system with `PRIORITY_CONFIGS` and `STATE_CONFIGS`. A single `<StatusBadge type="priority" value="HIGH" />` would consolidate both paths.

### `<SectionHeader>`
**Justification:** Section headers appear in 12+ locations with 5+ different size/weight/color combinations for the same semantic level. Wizard steps have their own consistent pattern (gradient icon + title), but non-wizard sections use ad-hoc heading classes.

### `<FormFieldBlock>`
**Justification:** The pattern `<div className="grid gap-2"><Label>...</Label><Input /><p className="text-xs ...">help</p></div>` repeats in 10+ forms with variations in spacing (`space-y-2` vs `grid gap-2`), label style (standard vs icon-label vs floating), and help text size (`text-[10px]` vs `text-xs`).

### `<InfoBox>`
**Justification:** Info/warning/success callout boxes with `bg-{color}-50 border border-{color}-200 rounded-lg p-3` + icon + text appear in 4+ locations with different colors but identical structure. `WizardStep2`, `ActivityDialog`, `AiAssistPanel`, and `RequirementInfo` all use this pattern.

### `<EmptyState>`
**Justification:** Four files (`RecentRequirements`, `MembersList`, `Requirements`, `ActivitiesSection`) each implement empty data states with different icons, spacing, border styles (dashed vs solid), and message layouts. All solve the same UX problem.

---

*End of audit. No code changes made. All findings are grounded in actual file inspection.*
