import React, { useEffect, useState } from 'react';
import { RingParticlesCanvas, RingParticlesConfig } from './RingParticlesCanvas';
import { MouseTracker } from '@/lib/mouseTracking';

export interface RingParticlesBackgroundProps {
    className?: string;
    config?: Partial<RingParticlesConfig>;
    usePaintWorklet?: boolean;
    enableMouseInteraction?: boolean;
    onMouseInteractionChange?: (enabled: boolean) => void;
}

const defaultConfig: RingParticlesConfig = {
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

export const RingParticlesBackground: React.FC<RingParticlesBackgroundProps> = ({
    className = '',
    config: userConfig = {},
    usePaintWorklet = true,
    enableMouseInteraction = true,
    onMouseInteractionChange
}) => {
    const [paintWorkletSupported, setPaintWorkletSupported] = useState(false);
    const [paintWorkletLoaded, setPaintWorkletLoaded] = useState(false);
    const [mouseTracker] = useState(() => new MouseTracker({
        respectReducedMotion: true,
        localStorageKey: 'ringParticles_mouseInteraction'
    }));

    const config: RingParticlesConfig = {
        ...defaultConfig,
        ...userConfig,
        responsive: {
            ...defaultConfig.responsive,
            ...userConfig.responsive
        },
        accessibility: {
            ...defaultConfig.accessibility,
            ...userConfig.accessibility
        },
        mouseInteraction: {
            ...defaultConfig.mouseInteraction,
            ...userConfig.mouseInteraction,
            enabled: enableMouseInteraction && (userConfig.mouseInteraction?.enabled ?? defaultConfig.mouseInteraction!.enabled)
        }
    };

    // Check Paint Worklet support and load
    useEffect(() => {
        const checkAndLoadWorklet = async () => {
            if (!usePaintWorklet) {
                setPaintWorkletSupported(false);
                return;
            }

            // Check if CSS Paint API is supported
            if ('paintWorklet' in CSS) {
                try {
                    await (CSS as any).paintWorklet.addModule('/ring-particles.worklet.js');
                    setPaintWorkletSupported(true);
                    setPaintWorkletLoaded(true);
                } catch (error) {
                    console.warn('Failed to load Paint Worklet, falling back to Canvas:', error);
                    setPaintWorkletSupported(false);
                }
            } else {
                setPaintWorkletSupported(false);
            }
        };

        checkAndLoadWorklet();
    }, [usePaintWorklet]);

    // Initialize mouse tracking
    useEffect(() => {
        if (!config.mouseInteraction?.enabled) {
            mouseTracker.setEnabled(false);
            return;
        }

        mouseTracker.setEnabled(true);
        mouseTracker.mount();

        return () => {
            mouseTracker.unmount();
        };
    }, [config.mouseInteraction?.enabled, mouseTracker]);

    // Notify parent of mouse interaction state changes
    useEffect(() => {
        if (onMouseInteractionChange) {
            onMouseInteractionChange(mouseTracker.isEnabled());
        }
    }, [mouseTracker, onMouseInteractionChange]);

    // Generate CSS custom properties for Paint Worklet
    const paintWorkletStyle = paintWorkletSupported && paintWorkletLoaded ? {
        background: 'paint(ring-particles)',
        '--ring-time': '0',
        '--ring-particle-count': config.particleCount.toString(),
        '--ring-radius': config.radius.toString(),
        '--ring-thickness': config.thickness.toString(),
        '--ring-particle-size-min': config.particleSize[0].toString(),
        '--ring-particle-size-max': config.particleSize[1].toString(),
        '--ring-alpha-min': config.alphaRange[0].toString(),
        '--ring-alpha-max': config.alphaRange[1].toString(),
        '--ring-hue': config.color.h.toString(),
        '--ring-saturation': config.color.s.toString(),
        '--ring-drift': config.drift.toString(),
        '--ring-angular-speed': config.angularSpeed.toString(),
        '--ring-noise-frequency': config.noiseFrequency.toString(),
        '--ring-noise-amplitude': config.noiseAmplitude.toString(),
        '--ring-seed': config.seed.toString(),
        '--ring-blend-mode': config.blendMode,
        '--mouse-influence-k': config.mouseInteraction?.influenceK?.toString() ?? '0.9',
        '--mouse-influence-p': config.mouseInteraction?.influenceP?.toString() ?? '1.4',
        '--mouse-displacement': config.mouseInteraction?.displacement?.toString() ?? '12',
    } as React.CSSProperties : {};

    // Animate --ring-time for Paint Worklet
    useEffect(() => {
        if (!paintWorkletSupported || !paintWorkletLoaded) return;

        const element = document.getElementById('ring-particles-bg');
        if (!element) return;

        let startTime = Date.now();
        let animationFrame: number;

        const animate = () => {
            const t = (Date.now() - startTime) / 1000;
            element.style.setProperty('--ring-time', t.toString());
            animationFrame = requestAnimationFrame(animate);
        };

        // Check for reduced motion
        const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        if (!config.accessibility.prefersReducedMotion || !mediaQuery.matches) {
            animate();
        }

        const handleMotionChange = (e: MediaQueryListEvent) => {
            if (config.accessibility.prefersReducedMotion && e.matches) {
                cancelAnimationFrame(animationFrame);
            } else {
                startTime = Date.now();
                animate();
            }
        };

        mediaQuery.addEventListener('change', handleMotionChange);

        return () => {
            cancelAnimationFrame(animationFrame);
            mediaQuery.removeEventListener('change', handleMotionChange);
        };
    }, [paintWorkletSupported, paintWorkletLoaded, config.accessibility.prefersReducedMotion]);

    return (
        <div
            id="ring-particles-bg"
            className={`fixed inset-0 -z-10 ${className}`}
            style={paintWorkletStyle}
        >
            {/* Fallback to Canvas if Paint Worklet not supported */}
            {(!paintWorkletSupported || !usePaintWorklet) && (
                <RingParticlesCanvas config={config} className="w-full h-full" />
            )}
        </div>
    );
};

// Export configuration utilities for easy customization
export const createRingConfig = (overrides: Partial<RingParticlesConfig>): Partial<RingParticlesConfig> => {
    return overrides;
};

// Preset configurations
export const presetConfigs = {
    default: defaultConfig,

    subtle: createRingConfig({
        particleCount: 300,
        alphaRange: [0.05, 0.3],
        angularSpeed: 0.005,
        drift: 0.1,
    }),

    energetic: createRingConfig({
        particleCount: 800,
        angularSpeed: 0.05,
        drift: 0.5,
        noiseAmplitude: 15,
        blendMode: 'screen',
    }),

    cosmic: createRingConfig({
        color: { h: 270, s: 80 },
        particleCount: 1000,
        radius: 45,
        thickness: 12,
        particleSize: [0.5, 4],
        blendMode: 'lighter',
    }),

    minimal: createRingConfig({
        particleCount: 150,
        particleSize: [2, 4],
        alphaRange: [0.3, 0.6],
        angularSpeed: 0.01,
        drift: 0.05,
    }),

    ocean: createRingConfig({
        color: { h: 200, s: 85 },
        particleCount: 500,
        drift: 0.3,
        noiseFrequency: 1.2,
        alphaRange: [0.2, 0.8],
    }),

    sunset: createRingConfig({
        color: { h: 25, s: 95 },
        particleCount: 450,
        alphaRange: [0.25, 0.9],
        blendMode: 'screen',
    }),
};
