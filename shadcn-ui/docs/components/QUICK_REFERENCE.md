# Ring Particles Background - Quick Reference

## 🚀 Import

```tsx
import { RingParticlesBackground } from '@/components/RingParticlesBackground';
```

## 📦 Basic Usage

```tsx
<RingParticlesBackground />
```

## 🎨 With Preset

```tsx
import { presetConfigs } from '@/components/RingParticlesBackground';

<RingParticlesBackground config={presetConfigs.cosmic} />
```

## ⚙️ Custom Config

```tsx
<RingParticlesBackground 
  config={{
    particleCount: 800,
    radius: 45,
    color: { h: 270, s: 90 },
    angularSpeed: 0.03,
  }}
/>
```

## 🏗️ Builder Pattern

```tsx
import { buildRingConfig } from '@/lib/ringParticlesConfig';

const config = buildRingConfig()
  .withColor('purple')
  .withAnimation('energetic')
  .withDensity('dense')
  .build();

<RingParticlesBackground config={config} />
```

## 📋 All Presets

```tsx
presetConfigs.default      presetConfigs.subtle
presetConfigs.energetic    presetConfigs.cosmic
presetConfigs.minimal      presetConfigs.ocean
presetConfigs.sunset
```

## 🎨 Color Themes

```tsx
blue  indigo  purple  cyan  teal  green
emerald  orange  amber  rose  gray  neutral
```

## 🎭 Animation Levels

```tsx
static  subtle  moderate  energetic  chaotic
```

## 🔧 Performance

```tsx
import { adaptiveConfig } from '@/lib/ringParticlesConfig';

<RingParticlesBackground config={adaptiveConfig()} />
```

## 🎯 Quick Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `particleCount` | number | 600 | Total particles |
| `radius` | number | 40 | % of viewport |
| `thickness` | number | 8 | Ring thickness % |
| `color.h` | number | 210 | Hue (0-360) |
| `color.s` | number | 90 | Saturation (0-100) |
| `angularSpeed` | number | 0.02 | Rotation speed |
| `drift` | number | 0.2 | Radial movement |
| `seed` | number | 12345 | Random seed |

## 📱 Responsive

```tsx
config={{
  responsive: {
    maxParticlesMobile: 200,
    scaleWithDPR: true
  }
}}
```

## ♿ Accessibility

```tsx
config={{
  accessibility: {
    prefersReducedMotion: true
  }
}}
```

## 🎨 Blend Modes

```tsx
'source-over' | 'screen' | 'multiply' | 'lighter'
```

## 🏠 Homepage Example

```tsx
<div className="relative min-h-screen">
  <RingParticlesBackground 
    config={{
      particleCount: 500,
      color: { h: 220, s: 85 },
    }}
  />
  
  <div className="relative z-10">
    {/* Your content */}
  </div>
</div>
```

## 📚 Full Docs

- **Complete API**: `docs/components/ring-particles-background.md`
- **Examples**: `src/examples/ringParticlesExamples.tsx`
- **Config Utils**: `src/lib/ringParticlesConfig.ts`
