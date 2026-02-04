/**
 * Complete Example: Interactive Ring Particles with User Controls
 * 
 * Demonstrates mouse interaction, accessibility controls, and configuration
 */

import React, { useState } from 'react';
import { RingParticlesBackground } from '@/components/RingParticlesBackground';
import { ParticleInteractionButton, ParticleInteractionControl } from '@/components/ParticleInteractionControl';
import { MouseTracker } from '@/lib/mouseTracking';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';

export function InteractiveParticlesDemo() {
    const [mouseTracker] = useState(() => new MouseTracker());
    const [influenceK, setInfluenceK] = useState(0.9);
    const [influenceP, setInfluenceP] = useState(1.4);
    const [displacement, setDisplacement] = useState(12);

    return (
        <div className="min-h-screen relative bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
            {/* Animated background with mouse interaction */}
            <RingParticlesBackground
                enableMouseInteraction
                config={{
                    particleCount: 500,
                    radius: 38,
                    thickness: 10,
                    color: { h: 220, s: 85 },
                    angularSpeed: 0.015,
                    mouseInteraction: {
                        enabled: true,
                        influenceK,
                        influenceP,
                        displacement,
                        epsilon: 8
                    }
                }}
            />

            {/* Content */}
            <div className="relative z-10 container mx-auto px-6 py-12">
                {/* Header with toggle */}
                <header className="flex justify-between items-center mb-12">
                    <div>
                        <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                            Interactive Particles Demo
                        </h1>
                        <p className="text-slate-600 mt-2">
                            Move your mouse to interact with the particles
                        </p>
                    </div>

                    <ParticleInteractionButton
                        mouseTracker={mouseTracker}
                        variant="outline"
                    />
                </header>

                {/* Controls */}
                <div className="grid md:grid-cols-2 gap-6 max-w-4xl">
                    <Card className="bg-white/80 backdrop-blur-sm">
                        <CardHeader>
                            <CardTitle>Interaction Controls</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Enable/Disable */}
                            <ParticleInteractionControl
                                mouseTracker={mouseTracker}
                            />

                            {/* Influence K */}
                            <div className="space-y-2">
                                <div className="flex justify-between">
                                    <Label>Influence Strength (K)</Label>
                                    <span className="text-sm text-muted-foreground">{influenceK.toFixed(2)}</span>
                                </div>
                                <Slider
                                    value={[influenceK]}
                                    onValueChange={([value]) => setInfluenceK(value)}
                                    min={0.1}
                                    max={2.0}
                                    step={0.1}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Higher = stronger mouse influence
                                </p>
                            </div>

                            {/* Influence P */}
                            <div className="space-y-2">
                                <div className="flex justify-between">
                                    <Label>Distance Falloff (p)</Label>
                                    <span className="text-sm text-muted-foreground">{influenceP.toFixed(2)}</span>
                                </div>
                                <Slider
                                    value={[influenceP]}
                                    onValueChange={([value]) => setInfluenceP(value)}
                                    min={1.0}
                                    max={3.0}
                                    step={0.1}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Higher = faster distance falloff
                                </p>
                            </div>

                            {/* Displacement */}
                            <div className="space-y-2">
                                <div className="flex justify-between">
                                    <Label>Displacement (px)</Label>
                                    <span className="text-sm text-muted-foreground">{displacement}</span>
                                </div>
                                <Slider
                                    value={[displacement]}
                                    onValueChange={([value]) => setDisplacement(value)}
                                    min={2}
                                    max={40}
                                    step={2}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Maximum particle displacement
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Info */}
                    <Card className="bg-white/80 backdrop-blur-sm">
                        <CardHeader>
                            <CardTitle>How It Works</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 text-sm text-slate-600">
                            <div>
                                <h3 className="font-semibold text-slate-900 mb-1">📐 Mathematics</h3>
                                <p>
                                    Influence is calculated using: <code className="bg-slate-100 px-1 rounded">influence = K / (dist^p + ε)</code>
                                </p>
                            </div>

                            <div>
                                <h3 className="font-semibold text-slate-900 mb-1">🎯 Smoothing</h3>
                                <p>
                                    Exponential smoothing (α = 0.12) prevents jitter and creates fluid motion.
                                </p>
                            </div>

                            <div>
                                <h3 className="font-semibold text-slate-900 mb-1">⚡ Performance</h3>
                                <p>
                                    Updates at ~60Hz with automatic throttling when tab is inactive.
                                </p>
                            </div>

                            <div>
                                <h3 className="font-semibold text-slate-900 mb-1">♿ Accessibility</h3>
                                <p>
                                    Respects <code className="bg-slate-100 px-1 rounded">prefers-reduced-motion</code> and
                                    saves user preference to localStorage.
                                </p>
                            </div>

                            <div>
                                <h3 className="font-semibold text-slate-900 mb-1">📱 Touch Support</h3>
                                <p>
                                    Works with touch devices, tracking finger movement for interaction.
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Technical Details */}
                <Card className="mt-6 max-w-4xl bg-white/80 backdrop-blur-sm">
                    <CardHeader>
                        <CardTitle>Technical Implementation</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid md:grid-cols-2 gap-6 text-sm">
                            <div>
                                <h3 className="font-semibold text-slate-900 mb-2">CSS Custom Properties</h3>
                                <ul className="space-y-1 text-slate-600 font-mono text-xs">
                                    <li>--mouse-x: <span className="text-blue-600">0..1 normalized</span></li>
                                    <li>--mouse-y: <span className="text-blue-600">0..1 normalized</span></li>
                                    <li>--mouse-vx: <span className="text-blue-600">velocity</span></li>
                                    <li>--mouse-vy: <span className="text-blue-600">velocity</span></li>
                                    <li>--mouse-force: <span className="text-blue-600">0..1 speed-based</span></li>
                                </ul>
                            </div>

                            <div>
                                <h3 className="font-semibold text-slate-900 mb-2">Configuration</h3>
                                <ul className="space-y-1 text-slate-600 font-mono text-xs">
                                    <li>influenceK: <span className="text-purple-600">{influenceK}</span></li>
                                    <li>influenceP: <span className="text-purple-600">{influenceP}</span></li>
                                    <li>displacement: <span className="text-purple-600">{displacement}px</span></li>
                                    <li>epsilon: <span className="text-purple-600">8px</span></li>
                                    <li>smoothingAlpha: <span className="text-purple-600">0.12</span></li>
                                </ul>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Footer tip */}
                <div className="mt-12 text-center">
                    <p className="text-sm text-slate-500">
                        💡 Try moving your mouse in circles or quickly across the screen to see different effects
                    </p>
                </div>
            </div>
        </div>
    );
}

// Example 2: Simple Homepage Integration
export function SimpleHomepageWithInteraction() {
    return (
        <div className="min-h-screen relative bg-gradient-to-br from-slate-50 to-blue-50">
            {/* Just add enableMouseInteraction - that's it! */}
            <RingParticlesBackground
                enableMouseInteraction
                config={{
                    particleCount: 400,
                    color: { h: 200, s: 80 },
                }}
            />

            <div className="relative z-10 flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <h1 className="text-6xl font-bold">Interactive Background</h1>
                    <p className="text-xl text-slate-600 mt-4">
                        Move your mouse to interact
                    </p>
                </div>
            </div>
        </div>
    );
}

// Example 3: Disabled on Mobile
export function ResponsiveInteraction() {
    const isMobile = window.innerWidth < 768;

    return (
        <div className="min-h-screen relative">
            <RingParticlesBackground
                config={{
                    particleCount: isMobile ? 200 : 500,
                    mouseInteraction: {
                        enabled: !isMobile,  // Disable on mobile
                        influenceK: 0.9,
                        influenceP: 1.4,
                        displacement: isMobile ? 6 : 12,
                        epsilon: 8
                    }
                }}
            />

            <div className="relative z-10 p-8">
                <h1>Responsive Interaction</h1>
                <p>{isMobile ? 'Touch devices: static' : 'Desktop: interactive'}</p>
            </div>
        </div>
    );
}

// Example 4: Repulsion Effect
export function RepulsionEffect() {
    return (
        <div className="min-h-screen relative bg-slate-900">
            <RingParticlesBackground
                enableMouseInteraction
                config={{
                    color: { h: 280, s: 90 },
                    blendMode: 'screen',
                    mouseInteraction: {
                        enabled: true,
                        influenceK: -1.5,  // Negative = repulsion!
                        influenceP: 1.8,
                        displacement: 25,
                        epsilon: 8
                    }
                }}
            />

            <div className="relative z-10 flex items-center justify-center min-h-screen">
                <h1 className="text-6xl font-bold text-white">
                    Repulsion Effect
                </h1>
            </div>
        </div>
    );
}// Example 5: With Settings Panel
export function WithSettingsPanel() {
    const [mouseTracker] = useState(() => new MouseTracker());
    const [showSettings, setShowSettings] = useState(false);

    return (
        <div className="min-h-screen relative">
            <RingParticlesBackground enableMouseInteraction />

            {/* Floating settings button */}
            <button
                onClick={() => setShowSettings(!showSettings)}
                className="fixed bottom-4 right-4 z-20 bg-white rounded-full p-4 shadow-lg hover:shadow-xl transition-shadow"
            >
                ⚙️
            </button>

            {/* Settings panel */}
            {showSettings && (
                <div className="fixed bottom-20 right-4 z-20 w-80">
                    <Card className="bg-white/95 backdrop-blur">
                        <CardHeader>
                            <CardTitle className="text-lg">Particle Settings</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ParticleInteractionControl mouseTracker={mouseTracker} />
                        </CardContent>
                    </Card>
                </div>
            )}

            <div className="relative z-10 p-8">
                <h1 className="text-4xl font-bold">Your Content</h1>
            </div>
        </div>
    );
}
