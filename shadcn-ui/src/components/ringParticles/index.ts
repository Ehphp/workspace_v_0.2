/**
 * Ring Particles Background System
 * Main export file for easy imports
 */

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
