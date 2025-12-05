/**
 * Ring Particles Background System
 * Main export file for easy imports
 */

// Main components
export { RingParticlesBackground, presetConfigs, createRingConfig } from './RingParticlesBackground';
export { RingParticlesCanvas } from './RingParticlesCanvas';
export type { RingParticlesConfig } from './RingParticlesCanvas';

// Configuration utilities
export {
    buildRingConfig,
    completePresets,
    colorThemes,
    animationIntensity,
    densityPresets,
    blendModeConfigs,
    withColorTheme,
    withAnimationIntensity,
    withDensity,
    withBlendMode,
    adaptiveConfig,
    performanceConfig,
    qualityConfig,
    RingParticlesConfigBuilder,
} from '@/lib/ringParticlesConfig';

// Noise utilities
export { SimplexNoise, seededRandom } from '@/lib/noise';
