# Template Layout Pagine - Requirements Estimator

## ⚠️ IMPORTANTE: Pattern Corretto per Layout Pagine

Tutte le pagine DEVONO seguire questo pattern per essere **scrollabili** e **responsive**:

## ✅ Template Corretto

```tsx
import { Header } from '@/components/layout/Header';

export default function PageName() {
  return (
    <div className="relative h-screen flex flex-col bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20 overflow-hidden">
      {/* Background Pattern - SEMPRE con pointer-events-none */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,...')] opacity-30 pointer-events-none"></div>

      {/* Fixed Header */}
      <Header />

      {/* Hero Section (opzionale) - flex-shrink-0 per mantenerlo fisso */}
      <div className="relative border-b border-white/30 bg-white/60 backdrop-blur-lg flex-shrink-0">
        <div className="container mx-auto px-6 py-8 relative">
          {/* Hero content */}
        </div>
      </div>

      {/* Main Content - QUESTA È LA PARTE SCROLLABILE */}
      <div className="relative flex-1 overflow-y-auto">
        <div className="container mx-auto px-6 py-12">
          {/* Page content here */}
        </div>
      </div>
    </div>
  );
}
```

## 🔑 Classi Chiave (DA MEMORIZZARE!)

### Container principale (root):
```
className="relative h-screen flex flex-col overflow-hidden"
```
- ✅ `h-screen` (NON `min-h-screen`)
- ✅ `flex flex-col`
- ✅ `overflow-hidden`
- ✅ `relative`

### Background pattern:
```
className="absolute inset-0 ... opacity-30 pointer-events-none"
```
- ✅ `pointer-events-none` (FONDAMENTALE!)

### Header sezione (opzionale):
```
className="relative ... flex-shrink-0"
```
- ✅ `flex-shrink-0` (non si comprime)
- ✅ `relative` (per contenuto interno assoluto)

### Main content (area scrollabile):
```
className="relative flex-1 overflow-y-auto"
```
- ✅ `flex-1` (prende tutto lo spazio rimanente)
- ✅ `overflow-y-auto` (SCROLLABILE!)
- ✅ `relative`

## ❌ Errori Comuni da EVITARE

### 1. ❌ Usare `min-h-screen` invece di `h-screen`
```tsx
// ❌ SBAGLIATO - non scrollabile
<div className="min-h-screen flex flex-col">
```

### 2. ❌ Dimenticare `overflow-hidden` nel container root
```tsx
// ❌ SBAGLIATO - scroll sul body invece che nell'area content
<div className="h-screen flex flex-col">
```

### 3. ❌ Dimenticare `overflow-y-auto` nel main content
```tsx
// ❌ SBAGLIATO - contenuto viene tagliato
<div className="relative flex-1">
```

### 4. ❌ Dimenticare `pointer-events-none` sul pattern
```tsx
// ❌ SBAGLIATO - il pattern blocca i click
<div className="absolute inset-0 bg-[url(...)]"></div>
```

### 5. ❌ Dimenticare `flex-shrink-0` sull'header section
```tsx
// ❌ SBAGLIATO - header si comprime
<div className="relative border-b ...">
```

## 📋 Checklist Pre-Commit

Prima di creare/modificare una pagina, verifica:

- [ ] Container root usa `h-screen` (non `min-h-screen`)
- [ ] Container root ha `overflow-hidden`
- [ ] Background pattern ha `pointer-events-none`
- [ ] Hero section (se presente) ha `flex-shrink-0`
- [ ] Main content ha `flex-1 overflow-y-auto`
- [ ] Header component è incluso
- [ ] Testato lo scroll su contenuti lunghi

## 🎯 Pagine di Riferimento (Corrette)

- ✅ `AdminActivities.tsx` - implementazione perfetta
- ✅ `RequirementDetail.tsx` - con tabs scrollabili
- ✅ `Presets.tsx` - con tabella scrollabile

## 🚀 Quick Copy-Paste

```tsx
// Starter template veloce
export default function NewPage() {
  return (
    <div className="relative h-screen flex flex-col bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20 overflow-hidden">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgxNDgsMTYzLDE4NCwwLjA1KSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-30 pointer-events-none"></div>
      <Header />
      <div className="relative flex-1 overflow-y-auto">
        <div className="container mx-auto px-6 py-12">
          {/* Your content */}
        </div>
      </div>
    </div>
  );
}
```
