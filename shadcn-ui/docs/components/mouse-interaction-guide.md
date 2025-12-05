# Mouse Interaction - Implementation Guide

## ✅ Implementazione Completata

Sistema completo di interazione mouse/touch per Ring Particles con smoothing, performance optimization e accessibility.

---

## 📁 File Creati/Aggiornati

### **Nuovo: Mouse Tracking System**
- **`src/lib/mouseTracking.ts`** - Sistema di tracking con exponential smoothing, velocity calculation, CSS custom properties update

### **Nuovo: Accessibility Controls**
- **`src/components/ParticleInteractionControl.tsx`** - Switch e button components per toggle interazione

### **Aggiornati: Core Components**
- **`public/ring-particles.worklet.js`** - Legge mouse props e applica influenza
- **`src/components/RingParticlesCanvas.tsx`** - Mouse influence nel render loop
- **`src/components/RingParticlesBackground.tsx`** - Integrazione MouseTracker
- **`src/lib/ringParticlesConfig.ts`** - Defaults per mouse interaction

---

## 🎯 Funzionalità Implementate

### ✅ Mouse Tracking
- [x] Exponential smoothing (alpha = 0.12)
- [x] Velocity tracking (vx, vy)
- [x] Force calculation basata su speed
- [x] CSS custom properties update (~60Hz)
- [x] Touch support
- [x] Visibility API throttling

### ✅ Particle Influence
- [x] Distance-based formula: `K / (dist^p + ε)`
- [x] Per-particle phase variation
- [x] Displacement toward/away from mouse
- [x] Velocity-based rotation
- [x] Configurable parameters (K, p, displacement, epsilon)

### ✅ Accessibility
- [x] `prefers-reduced-motion` respect
- [x] User toggle (Switch/Button components)
- [x] localStorage persistence
- [x] Auto-disable su reduced motion
- [x] Performance-aware (CPU/GPU detection)

### ✅ Performance
- [x] RequestAnimationFrame throttling
- [x] Document visibility tracking
- [x] Adaptive particle count
- [x] CSS custom props update throttling (16ms)
- [x] Cleanup on unmount

---

## 🚀 Quick Start

### Basic Usage (Auto-enabled)

```tsx
import { RingParticlesBackground } from '@/components/RingParticlesBackground';

export default function MyPage() {
  return (
    <div className="relative min-h-screen">
      <RingParticlesBackground 
        config={{
          particleCount: 500,
          mouseInteraction: {
            enabled: true,  // Default
            influenceK: 0.9,
            influenceP: 1.4,
            displacement: 12,
          }
        }}
      />
      
      <div className="relative z-10">
        <h1>Move your mouse!</h1>
      </div>
    </div>
  );
}
```

### With User Toggle

```tsx
import { RingParticlesBackground } from '@/components/RingParticlesBackground';
import { ParticleInteractionButton } from '@/components/ParticleInteractionControl';
import { MouseTracker } from '@/lib/mouseTracking';
import { useState } from 'react';

export default function MyPage() {
  const [mouseTracker] = useState(() => new MouseTracker());

  return (
    <div className="relative min-h-screen">
      <RingParticlesBackground enableMouseInteraction />
      
      <div className="relative z-10">
        {/* Toggle button in header */}
        <header className="flex justify-between items-center p-4">
          <h1>My Site</h1>
          <ParticleInteractionButton mouseTracker={mouseTracker} />
        </header>
      </div>
    </div>
  );
}
```

### Advanced Configuration

```tsx
<RingParticlesBackground 
  config={{
    mouseInteraction: {
      enabled: true,
      influenceK: 1.2,        // Stronger influence
      influenceP: 1.6,        // Faster distance falloff
      displacement: 18,       // More displacement
      epsilon: 6,             // Less singularity protection
    }
  }}
/>
```

---

## ⚙️ Configuration

### Mouse Interaction Config

```typescript
mouseInteraction: {
  enabled: boolean;       // Enable/disable (default: true)
  influenceK: number;     // Scale constant (default: 0.9)
  influenceP: number;     // Power for attenuation (default: 1.4)
  displacement: number;   // Max displacement px (default: 12)
  epsilon: number;        // Avoid singularity (default: 8)
}
```

### Mouse Tracking Config

```typescript
const tracker = new MouseTracker({
  smoothingAlpha: 0.12,           // 0..1, higher = more responsive
  maxForce: 1.0,                  // Maximum force value
  forceMultiplier: 100,           // Speed to force conversion
  updateThrottleMs: 16,           // Min ms between updates (~60Hz)
  respectReducedMotion: true,     // Respect OS preference
  localStorageKey: 'ringParticles_mouseInteraction',
});
```

---

## 📐 Matematica

### Influence Formula

```
influence = min(1, (mouseForce * K) / (dist^p + ε))
```

Dove:
- **mouseForce**: 0..1 basato su velocità mouse
- **K**: Costante di scala (default: 0.9)
- **p**: Power per attenuazione distanza (default: 1.4)
- **ε** (epsilon): Evita singolarità (default: 8)
- **dist**: Distanza euclidea tra mouse e particella

### Displacement

```
dx = mouseX - particleX
dy = mouseY - particleY
dist = sqrt(dx² + dy²)

dirX = dx / dist
dirY = dy / dist

particleX += dirX * influence * displacement
particleY += dirY * influence * displacement
```

### Velocity-based Rotation

```
rotationInfluence = (mouseVx + mouseVy) * influence * 0.5

particleX += rotationInfluence * -dy * 0.1
particleY += rotationInfluence * dx * 0.1
```

---

## 🎨 CSS Custom Properties

Il sistema espone automaticamente queste proprietà su `:root`:

```css
:root {
  --mouse-x: 0.5;          /* Normalized 0..1 */
  --mouse-y: 0.5;          /* Normalized 0..1 */
  --mouse-vx: 0;           /* Velocity normalized/ms */
  --mouse-vy: 0;           /* Velocity normalized/ms */
  --mouse-force: 0;        /* 0..1 based on speed */
  
  /* Paint Worklet only */
  --mouse-influence-k: 0.9;
  --mouse-influence-p: 1.4;
  --mouse-displacement: 12;
}
```

---

## 🎮 Accessibility Controls

### Switch Component

```tsx
import { ParticleInteractionControl } from '@/components/ParticleInteractionControl';
import { MouseTracker } from '@/lib/mouseTracking';

const tracker = new MouseTracker();

<ParticleInteractionControl 
  mouseTracker={tracker}
  label="Mouse effects"
  description="Particles respond to cursor movement"
/>
```

### Button Component

```tsx
import { ParticleInteractionButton } from '@/components/ParticleInteractionControl';

<ParticleInteractionButton 
  mouseTracker={tracker}
  variant="outline"
/>
```

### Manual Control

```tsx
const tracker = new MouseTracker();

// Enable/disable
tracker.setEnabled(true);
tracker.setEnabled(false);

// Check state
const isEnabled = tracker.isEnabled();

// Get current state
const state = tracker.getState();
// { x, y, vx, vy, force, enabled }
```

---

## 📊 Performance

### Default Settings (Balanced)

| Parameter | Value | Purpose |
|-----------|-------|---------|
| `smoothingAlpha` | 0.12 | Smooth but responsive |
| `updateThrottleMs` | 16ms | ~60 FPS updates |
| `influenceK` | 0.9 | Moderate influence |
| `influenceP` | 1.4 | Natural falloff |
| `displacement` | 12px | Visible but not jarring |

### Performance Optimization

```tsx
// Reduced CPU usage
<RingParticlesBackground 
  config={{
    particleCount: 300,  // Fewer particles
    mouseInteraction: {
      displacement: 8,   // Less calculation
      epsilon: 12,       // Larger deadzone
    }
  }}
/>

// High quality (powerful devices)
<RingParticlesBackground 
  config={{
    particleCount: 800,
    mouseInteraction: {
      influenceK: 1.2,
      displacement: 18,
    }
  }}
/>
```

### Adaptive Based on Device

```tsx
const isMobile = window.innerWidth < 768;
const isLowEnd = navigator.hardwareConcurrency < 4;

<RingParticlesBackground 
  config={{
    particleCount: isLowEnd ? 200 : 600,
    mouseInteraction: {
      enabled: !isMobile,  // Disable on touch-only devices
      displacement: isLowEnd ? 6 : 12,
    }
  }}
/>
```

---

## 🧪 Testing & Debugging

### Check if Mouse Tracking is Active

```tsx
const tracker = new MouseTracker();
tracker.mount();

// Check in console
console.log(tracker.getState());

// Watch CSS properties
setInterval(() => {
  const root = document.documentElement;
  console.log({
    x: root.style.getPropertyValue('--mouse-x'),
    y: root.style.getPropertyValue('--mouse-y'),
    force: root.style.getPropertyValue('--mouse-force'),
  });
}, 1000);
```

### Visual Debug Layer

```tsx
// Add debug overlay to see mouse state
function MouseDebugOverlay() {
  const [state, setState] = useState({ x: 0, y: 0, force: 0 });

  useEffect(() => {
    const interval = setInterval(() => {
      const root = document.documentElement;
      setState({
        x: parseFloat(root.style.getPropertyValue('--mouse-x') || '0'),
        y: parseFloat(root.style.getPropertyValue('--mouse-y') || '0'),
        force: parseFloat(root.style.getPropertyValue('--mouse-force') || '0'),
      });
    }, 100);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed top-4 right-4 bg-black/80 text-white p-4 rounded font-mono text-xs">
      <div>X: {state.x.toFixed(3)}</div>
      <div>Y: {state.y.toFixed(3)}</div>
      <div>Force: {state.force.toFixed(3)}</div>
    </div>
  );
}
```

---

## 🐛 Troubleshooting

### Particelle non reagiscono al mouse

**Causa**: Mouse tracking non inizializzato  
**Soluzione**:
```tsx
// Assicurati che enableMouseInteraction sia true
<RingParticlesBackground enableMouseInteraction={true} />
```

### Effetto troppo forte/debole

**Causa**: Parametri di influenza non ottimali  
**Soluzione**:
```tsx
config={{
  mouseInteraction: {
    influenceK: 0.5,      // Ridurre per effetto più debole
    displacement: 6,      // Ridurre displacement
  }
}}
```

### Jitter/movimento nervoso

**Causa**: Smoothing troppo basso  
**Soluzione**:
```tsx
const tracker = new MouseTracker({
  smoothingAlpha: 0.08,  // Più basso = più smooth (ma meno responsive)
});
```

### Performance degradata

**Causa**: Troppi particelle + calcoli mouse  
**Soluzione**:
```tsx
config={{
  particleCount: 300,
  mouseInteraction: {
    enabled: !isMobile,  // Disabilita su mobile
  }
}}
```

---

## 🎓 Esempi Avanzati

### Layered Effect (Parallax)

```tsx
// Layer background - influenza debole
<RingParticlesBackground 
  config={{
    radius: 50,
    mouseInteraction: {
      influenceK: 0.5,
      displacement: 6,
    }
  }}
/>

// Layer foreground - influenza forte
<div className="absolute inset-0 -z-5">
  <RingParticlesBackground 
    config={{
      radius: 30,
      seed: 99999,
      mouseInteraction: {
        influenceK: 1.5,
        displacement: 24,
      }
    }}
  />
</div>
```

### Repulsion Effect

```tsx
config={{
  mouseInteraction: {
    influenceK: -1.2,  // Negative = repulsion!
    displacement: 20,
  }
}}
```

### Zone-based Interaction

```tsx
// Stronger effect in center, weaker at edges
config={{
  mouseInteraction: {
    influenceP: 2.0,  // Higher power = faster falloff
    epsilon: 4,       // Smaller epsilon = stronger center
  }
}}
```

---

## 📚 API Reference

### MouseTracker Class

```typescript
class MouseTracker {
  constructor(config?: MouseTrackingConfig)
  
  mount(): void
  unmount(): void
  setEnabled(enabled: boolean): void
  isEnabled(): boolean
  getState(): MouseTrackingState
}
```

### RingParticlesBackground Props

```typescript
interface RingParticlesBackgroundProps {
  className?: string;
  config?: Partial<RingParticlesConfig>;
  usePaintWorklet?: boolean;
  enableMouseInteraction?: boolean;
  onMouseInteractionChange?: (enabled: boolean) => void;
}
```

---

## 🎉 Risultato

✅ **Mouse tracking** con exponential smoothing  
✅ **Paint Worklet** + Canvas support  
✅ **Accessibility** compliant (reduced motion, toggle)  
✅ **Performance** ottimizzata (throttling, adaptive)  
✅ **localStorage** persistence  
✅ **Touch** support  
✅ **TypeScript** strict  
✅ **Documentazione** completa  

Sistema pronto per production! 🚀
