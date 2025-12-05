/**
 * Ring Particles Background - Usage Examples
 * 
 * Complete examples for different use cases
 */

import { RingParticlesBackground, presetConfigs } from '@/components/RingParticlesBackground';
import {
    buildRingConfig,
    completePresets,
    withColorTheme,
    adaptiveConfig
} from '@/lib/ringParticlesConfig';

// ============================================================================
// Example 1: Basic Usage (Default Config)
// ============================================================================
export function Example1_BasicUsage() {
    return (
        <div className="relative min-h-screen">
            <RingParticlesBackground />

            <div className="relative z-10 container mx-auto px-6 py-12">
                <h1>My Content</h1>
            </div>
        </div>
    );
}

// ============================================================================
// Example 2: Using Preset Configurations
// ============================================================================
export function Example2_PresetConfigs() {
    return (
        <div className="relative min-h-screen">
            {/* Use cosmic preset */}
            <RingParticlesBackground config={presetConfigs.cosmic} />

            <div className="relative z-10">
                <h1>Cosmic Theme</h1>
            </div>
        </div>
    );
}

// ============================================================================
// Example 3: Custom Configuration
// ============================================================================
export function Example3_CustomConfig() {
    return (
        <div className="relative min-h-screen bg-slate-900">
            <RingParticlesBackground
                config={{
                    particleCount: 800,
                    radius: 45,
                    thickness: 12,
                    color: { h: 270, s: 90 },
                    angularSpeed: 0.03,
                    blendMode: 'screen',
                    alphaRange: [0.3, 1.0],
                }}
            />

            <div className="relative z-10 text-white">
                <h1>Dark Mode with Glow</h1>
            </div>
        </div>
    );
}

// ============================================================================
// Example 4: Using Configuration Builder
// ============================================================================
export function Example4_ConfigBuilder() {
    const myConfig = buildRingConfig()
        .withColor('purple')
        .withAnimation('energetic')
        .withDensity('dense')
        .withBlend('darkBg')
        .withSeed(42069)
        .build();

    return (
        <div className="relative min-h-screen bg-slate-900">
            <RingParticlesBackground config={myConfig} />

            <div className="relative z-10 text-white">
                <h1>Builder Pattern</h1>
            </div>
        </div>
    );
}

// ============================================================================
// Example 5: Adaptive Performance Based on Device
// ============================================================================
export function Example5_AdaptivePerformance() {
    return (
        <div className="relative min-h-screen">
            <RingParticlesBackground
                config={adaptiveConfig({
                    color: { h: 220, s: 85 },
                    angularSpeed: 0.015,
                })}
            />

            <div className="relative z-10">
                <h1>Adaptive to Device Capabilities</h1>
            </div>
        </div>
    );
}

// ============================================================================
// Example 6: Color Theme Variations
// ============================================================================
export function Example6_ColorThemes() {
    return (
        <div className="relative min-h-screen">
            <RingParticlesBackground
                config={withColorTheme('ocean', {
                    particleCount: 500,
                    angularSpeed: 0.02,
                })}
            />

            <div className="relative z-10">
                <h1>Ocean Color Theme</h1>
            </div>
        </div>
    );
}

// ============================================================================
// Example 7: Multiple Instances (Layered)
// ============================================================================
export function Example7_LayeredParticles() {
    return (
        <div className="relative min-h-screen">
            {/* Background layer - slow, subtle */}
            <RingParticlesBackground
                config={{
                    particleCount: 300,
                    radius: 50,
                    thickness: 15,
                    color: { h: 240, s: 70 },
                    angularSpeed: 0.01,
                    alphaRange: [0.05, 0.2],
                }}
            />

            {/* Foreground layer - faster, brighter */}
            <div className="absolute inset-0 -z-5">
                <RingParticlesBackground
                    config={{
                        particleCount: 200,
                        radius: 30,
                        thickness: 8,
                        color: { h: 200, s: 90 },
                        angularSpeed: 0.03,
                        alphaRange: [0.3, 0.8],
                        seed: 99999,
                    }}
                />
            </div>

            <div className="relative z-10">
                <h1>Layered Effect</h1>
            </div>
        </div>
    );
}

// ============================================================================
// Example 8: Dashboard/App Background (Subtle, Performance)
// ============================================================================
export function Example8_DashboardBackground() {
    return (
        <div className="relative min-h-screen bg-slate-50">
            <RingParticlesBackground
                config={completePresets.dashboard}
            />

            <div className="relative z-10 container mx-auto px-6 py-8">
                <nav className="mb-8">{/* Navigation */}</nav>
                <main>{/* Dashboard content */}</main>
            </div>
        </div>
    );
}

// ============================================================================
// Example 9: Hero Section with Impact
// ============================================================================
export function Example9_HeroSection() {
    return (
        <div className="relative min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-50">
            <RingParticlesBackground
                config={completePresets.hero}
            />

            <div className="relative z-10 flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <h1 className="text-6xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                        Welcome to Our Platform
                    </h1>
                    <p className="text-xl text-slate-600 mt-4">
                        Experience the future of software development
                    </p>
                </div>
            </div>
        </div>
    );
}

// ============================================================================
// Example 10: Static (No Animation) for Screenshots
// ============================================================================
export function Example10_StaticBackground() {
    return (
        <div className="relative min-h-screen">
            <RingParticlesBackground
                config={{
                    particleCount: 400,
                    angularSpeed: 0,
                    drift: 0,
                    noiseAmplitude: 0,
                    accessibility: {
                        prefersReducedMotion: true
                    }
                }}
            />

            <div className="relative z-10">
                <h1>Static Background for Screenshots</h1>
            </div>
        </div>
    );
}

// ============================================================================
// Example 11: User Toggle for Animation
// ============================================================================
import { useState } from 'react';
import { Button } from '@/components/ui/button';

export function Example11_UserToggle() {
    const [animationEnabled, setAnimationEnabled] = useState(true);

    return (
        <div className="relative min-h-screen">
            <RingParticlesBackground
                config={{
                    particleCount: 500,
                    accessibility: {
                        prefersReducedMotion: !animationEnabled
                    }
                }}
            />

            <div className="relative z-10 container mx-auto px-6 py-8">
                <Button
                    onClick={() => setAnimationEnabled(!animationEnabled)}
                    variant="outline"
                >
                    {animationEnabled ? 'Disable' : 'Enable'} Animation
                </Button>

                <h1 className="mt-8">User-Controlled Animation</h1>
            </div>
        </div>
    );
}

// ============================================================================
// Example 12: Responsive Different Configs (Mobile vs Desktop)
// ============================================================================
import { useMediaQuery } from '@/hooks/use-media-query';

export function Example12_ResponsiveConfig() {
    const isMobile = useMediaQuery('(max-width: 768px)');

    return (
        <div className="relative min-h-screen">
            <RingParticlesBackground
                config={isMobile ? {
                    particleCount: 150,
                    particleSize: [2, 4],
                    angularSpeed: 0.01,
                    noiseAmplitude: 4,
                } : {
                    particleCount: 600,
                    particleSize: [1, 6],
                    angularSpeed: 0.02,
                    noiseAmplitude: 8,
                }}
            />

            <div className="relative z-10">
                <h1>Responsive Configuration</h1>
            </div>
        </div>
    );
}

// ============================================================================
// Example 13: Complete Homepage Integration
// ============================================================================
export function Example13_CompleteHomepage() {
    return (
        <div className="min-h-screen flex flex-col relative bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
            {/* Animated background */}
            <RingParticlesBackground
                config={{
                    particleCount: 500,
                    radius: 38,
                    thickness: 10,
                    particleSize: [1, 5],
                    alphaRange: [0.1, 0.7],
                    color: { h: 220, s: 85 },
                    drift: 0.15,
                    angularSpeed: 0.015,
                    noiseFrequency: 0.9,
                    noiseAmplitude: 6,
                    seed: 42069,
                    blendMode: 'normal',
                    responsive: {
                        maxParticlesMobile: 200,
                        scaleWithDPR: true
                    }
                }}
            />

            {/* Grid overlay */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

            {/* Header */}
            <header className="relative z-10 border-b border-white/20 backdrop-blur-md bg-white/80">
                <div className="container mx-auto px-6 h-16 flex justify-between items-center">
                    <div className="font-bold text-xl">Logo</div>
                    <nav className="flex gap-4">
                        <a href="#" className="hover:text-blue-600">Features</a>
                        <a href="#" className="hover:text-blue-600">Pricing</a>
                        <a href="#" className="hover:text-blue-600">Contact</a>
                    </nav>
                </div>
            </header>

            {/* Main content */}
            <main className="relative z-10 flex-1 flex items-center justify-center">
                <div className="text-center">
                    <h1 className="text-5xl font-bold mb-4">
                        Your Product Name
                    </h1>
                    <p className="text-xl text-slate-600 mb-8">
                        Beautiful animated backgrounds with Ring Particles
                    </p>
                    <button className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                        Get Started
                    </button>
                </div>
            </main>

            {/* Footer */}
            <footer className="relative z-10 border-t border-white/20 backdrop-blur-md bg-white/80">
                <div className="container mx-auto px-6 py-4 text-center text-sm text-slate-600">
                    © 2025 Your Company. All rights reserved.
                </div>
            </footer>
        </div>
    );
}
