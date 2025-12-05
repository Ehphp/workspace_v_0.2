/**
 * Ring Particles Background Configuration Utilities
 * 
 * Utilities for creating custom particle configurations and theme variations
 */

import { RingParticlesConfig } from '@/components/RingParticlesCanvas';

/**
 * Default base configuration
 */
export const baseConfig: RingParticlesConfig = {
    shape: 'ring',
    particleCount: 600,
    radius: 40,
    thickness: 8,
    particleSize: [1, 6],
    alphaRange: [0.15, 0.95],
    color: { h: 210, s: 90 },
    drift: 0.2,
    angularSpeed: 0.02,
    noiseFrequency: 0.8,
    noiseAmplitude: 8,
    seed: 12345,
    repeatPattern: true,
    blendMode: 'source-over',
    responsive: {
        maxParticlesMobile: 220,
        scaleWithDPR: true
    },
    accessibility: {
        prefersReducedMotion: true
    },
    mouseInteraction: {
        enabled: true,
        influenceK: 0.9,
        influenceP: 1.4,
        displacement: 12,
        epsilon: 8
    }
};

/**
 * Create custom config with partial overrides
 */
export function createRingConfig(
    overrides: Partial<RingParticlesConfig>
): Partial<RingParticlesConfig> {
    return {
        ...overrides,
        responsive: overrides.responsive
            ? { ...baseConfig.responsive, ...overrides.responsive }
            : undefined,
        accessibility: overrides.accessibility
            ? { ...baseConfig.accessibility, ...overrides.accessibility }
            : undefined,
        mouseInteraction: overrides.mouseInteraction
            ? { ...baseConfig.mouseInteraction, ...overrides.mouseInteraction }
            : undefined
    };
}

/**
 * Performance preset for low-end devices
 */
export function performanceConfig(
    config: Partial<RingParticlesConfig> = {}
): Partial<RingParticlesConfig> {
    return createRingConfig({
        particleCount: 200,
        noiseAmplitude: 4,
        drift: 0.1,
        angularSpeed: 0.01,
        responsive: {
            maxParticlesMobile: 80,
            scaleWithDPR: false
        },
        ...config
    });
}

/**
 * High quality preset for powerful devices
 */
export function qualityConfig(
    config: Partial<RingParticlesConfig> = {}
): Partial<RingParticlesConfig> {
    return createRingConfig({
        particleCount: 1000,
        noiseAmplitude: 12,
        drift: 0.3,
        angularSpeed: 0.025,
        responsive: {
            maxParticlesMobile: 300,
            scaleWithDPR: true
        },
        ...config
    });
}

/**
 * Adaptive configuration based on device capabilities
 */
export function adaptiveConfig(
    config: Partial<RingParticlesConfig> = {}
): Partial<RingParticlesConfig> {
    const cores = navigator.hardwareConcurrency || 4;
    const isMobile = /Mobile|Android|iPhone/i.test(navigator.userAgent);
    const isHighEnd = cores >= 8 && !isMobile;
    const isLowEnd = cores <= 4 || isMobile;

    if (isHighEnd) {
        return qualityConfig(config);
    } else if (isLowEnd) {
        return performanceConfig(config);
    }

    return createRingConfig(config);
}

/**
 * Theme-specific color configurations
 */
export const colorThemes = {
    // Blue theme (default)
    blue: { h: 210, s: 90 },

    // Indigo/Purple theme
    indigo: { h: 240, s: 85 },
    purple: { h: 270, s: 80 },

    // Cyan/Teal theme
    cyan: { h: 180, s: 85 },
    teal: { h: 165, s: 80 },

    // Green theme
    green: { h: 140, s: 75 },
    emerald: { h: 155, s: 80 },

    // Warm themes
    orange: { h: 25, s: 95 },
    amber: { h: 40, s: 90 },
    rose: { h: 345, s: 85 },

    // Grayscale
    gray: { h: 210, s: 10 },
    neutral: { h: 0, s: 0 },
};

/**
 * Apply color theme to config
 */
export function withColorTheme(
    themeName: keyof typeof colorThemes,
    config: Partial<RingParticlesConfig> = {}
): Partial<RingParticlesConfig> {
    return createRingConfig({
        color: colorThemes[themeName],
        ...config
    });
}

/**
 * Animation intensity presets
 */
export const animationIntensity = {
    static: {
        angularSpeed: 0,
        drift: 0,
        noiseAmplitude: 0,
    },

    subtle: {
        angularSpeed: 0.005,
        drift: 0.05,
        noiseAmplitude: 3,
    },

    moderate: {
        angularSpeed: 0.02,
        drift: 0.2,
        noiseAmplitude: 8,
    },

    energetic: {
        angularSpeed: 0.05,
        drift: 0.5,
        noiseAmplitude: 15,
    },

    chaotic: {
        angularSpeed: 0.1,
        drift: 1.0,
        noiseAmplitude: 25,
    }
};

/**
 * Apply animation intensity
 */
export function withAnimationIntensity(
    intensity: keyof typeof animationIntensity,
    config: Partial<RingParticlesConfig> = {}
): Partial<RingParticlesConfig> {
    return createRingConfig({
        ...animationIntensity[intensity],
        ...config
    });
}

/**
 * Density presets
 */
export const densityPresets = {
    sparse: {
        particleCount: 150,
        thickness: 6,
    },

    normal: {
        particleCount: 400,
        thickness: 8,
    },

    dense: {
        particleCount: 800,
        thickness: 12,
    },

    packed: {
        particleCount: 1200,
        thickness: 15,
    }
};

/**
 * Apply density preset
 */
export function withDensity(
    density: keyof typeof densityPresets,
    config: Partial<RingParticlesConfig> = {}
): Partial<RingParticlesConfig> {
    return createRingConfig({
        ...densityPresets[density],
        ...config
    });
}

/**
 * Blend mode configurations for different backgrounds
 */
export const blendModeConfigs = {
    // For light backgrounds
    lightBg: {
        blendMode: 'normal' as GlobalCompositeOperation,
        alphaRange: [0.1, 0.7] as [number, number],
    },

    // For dark backgrounds
    darkBg: {
        blendMode: 'screen' as GlobalCompositeOperation,
        alphaRange: [0.2, 0.9] as [number, number],
    },

    // For colorful overlays
    colorful: {
        blendMode: 'multiply' as GlobalCompositeOperation,
        alphaRange: [0.15, 0.8] as [number, number],
    },

    // For glow effects
    glow: {
        blendMode: 'lighter' as GlobalCompositeOperation,
        alphaRange: [0.3, 1.0] as [number, number],
    }
};

/**
 * Apply blend mode config
 */
export function withBlendMode(
    mode: keyof typeof blendModeConfigs,
    config: Partial<RingParticlesConfig> = {}
): Partial<RingParticlesConfig> {
    return createRingConfig({
        ...blendModeConfigs[mode],
        ...config
    });
}

/**
 * Complete preset combinations
 */
export const completePresets = {
    // Professional subtle background
    corporate: createRingConfig({
        ...animationIntensity.subtle,
        ...densityPresets.normal,
        color: colorThemes.blue,
        blendMode: 'source-over' as GlobalCompositeOperation,
        alphaRange: [0.05, 0.3],
    }),

    // Hero section with impact
    hero: createRingConfig({
        ...animationIntensity.moderate,
        ...densityPresets.dense,
        color: colorThemes.indigo,
        blendMode: 'source-over' as GlobalCompositeOperation,
        alphaRange: [0.15, 0.8],
    }),

    // Cosmic space theme
    cosmic: createRingConfig({
        ...animationIntensity.energetic,
        ...densityPresets.packed,
        color: colorThemes.purple,
        blendMode: 'lighter',
        alphaRange: [0.2, 1.0],
        particleSize: [0.5, 4],
    }),

    // Ocean waves
    ocean: createRingConfig({
        ...animationIntensity.moderate,
        ...densityPresets.normal,
        color: colorThemes.cyan,
        noiseFrequency: 1.2,
        drift: 0.3,
    }),

    // Sunset warmth
    sunset: createRingConfig({
        ...animationIntensity.subtle,
        ...densityPresets.normal,
        color: colorThemes.orange,
        blendMode: 'screen',
        alphaRange: [0.25, 0.9],
    }),

    // Minimal clean
    minimal: createRingConfig({
        ...animationIntensity.subtle,
        particleCount: 150,
        particleSize: [2, 4],
        color: colorThemes.gray,
        alphaRange: [0.3, 0.6],
    }),

    // High performance for dashboards
    dashboard: createRingConfig({
        ...performanceConfig(),
        ...animationIntensity.subtle,
        color: colorThemes.blue,
        alphaRange: [0.05, 0.2],
    }),
};

/**
 * Builder pattern for complex configurations
 */
export class RingParticlesConfigBuilder {
    private config: Partial<RingParticlesConfig> = {};

    constructor(baseConfig?: Partial<RingParticlesConfig>) {
        this.config = baseConfig || {};
    }

    withColor(themeName: keyof typeof colorThemes) {
        this.config.color = colorThemes[themeName];
        return this;
    }

    withAnimation(intensity: keyof typeof animationIntensity) {
        Object.assign(this.config, animationIntensity[intensity]);
        return this;
    }

    withDensity(density: keyof typeof densityPresets) {
        Object.assign(this.config, densityPresets[density]);
        return this;
    }

    withBlend(mode: keyof typeof blendModeConfigs) {
        Object.assign(this.config, blendModeConfigs[mode]);
        return this;
    }

    withPerformance(optimize: boolean = true) {
        if (optimize) {
            Object.assign(this.config, performanceConfig());
        } else {
            Object.assign(this.config, qualityConfig());
        }
        return this;
    }

    withSeed(seed: number) {
        this.config.seed = seed;
        return this;
    }

    withAccessibility(reducedMotion: boolean = true) {
        this.config.accessibility = {
            prefersReducedMotion: reducedMotion
        };
        return this;
    }

    build(): Partial<RingParticlesConfig> {
        return createRingConfig(this.config);
    }
}

/**
 * Quick builder function
 */
export function buildRingConfig() {
    return new RingParticlesConfigBuilder();
}

// Example usage:
// const config = buildRingConfig()
//   .withColor('purple')
//   .withAnimation('energetic')
//   .withDensity('dense')
//   .withBlend('darkBg')
//   .withSeed(42069)
//   .build();
