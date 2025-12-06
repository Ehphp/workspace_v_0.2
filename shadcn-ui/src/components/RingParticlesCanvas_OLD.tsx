import React, { useEffect, useRef, useCallback } from 'react';
import { SimplexNoise, seededRandom } from '@/lib/noise';

export interface RingParticlesConfig {
    shape: 'ring' | 'disk' | 'field';
    particleCount: number;
    radius: number; // percentage of min(viewport)
    thickness: number; // percentage
    particleSize: [number, number]; // [min, max] px
    alphaRange: [number, number];
    color: { h: number; s: number };
    drift: number;
    angularSpeed: number;
    noiseFrequency: number;
    noiseAmplitude: number;
    seed: number;
    repeatPattern: boolean;
    blendMode: GlobalCompositeOperation;
    responsive: {
        maxParticlesMobile: number;
        scaleWithDPR: boolean;
    };
    accessibility: {
        prefersReducedMotion: boolean;
    };
    mouseInteraction?: {
        enabled: boolean;
        influenceK: number;       // Scale constant (default: 0.9)
        influenceP: number;       // Power for distance attenuation (default: 1.4)
        displacement: number;     // Max displacement in px (default: 12)
        epsilon: number;          // Avoid singularity (default: 8)
    };
}

interface RingParticlesCanvasProps {
    config: RingParticlesConfig;
    className?: string;
}

interface Particle {
    angleBase: number;
    jitterAngle: number;
    jitterRadius: number;
    phase: number;
    freq: number;
    sizeFactor: number;
    hueVariation: number;
    phaseInfluence: number;
    seed: number;
    // Physics properties
    origin: { x: number; y: number };
    pos: { x: number; y: number };
    vel: { x: number; y: number };
    mass: number;
    layer: number;
}

export const RingParticlesCanvas: React.FC<RingParticlesCanvasProps> = ({
    config,
    className = ''
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationFrameRef = useRef<number | undefined>(undefined);
    const particlesRef = useRef<Particle[]>([]);
    const noiseRef = useRef<SimplexNoise | null>(null);
    const startTimeRef = useRef<number>(Date.now());
    const isVisibleRef = useRef<boolean>(true);
    const reducedMotionRef = useRef<boolean>(false);
    const lastFrameTimeRef = useRef<number>(performance.now());
    const mouseActiveRef = useRef<boolean>(false);
    const mouseXRef = useRef<number>(0.5);
    const mouseYRef = useRef<number>(0.5);

    // Initialize particles with physics
    const initializeParticles = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const isMobile = window.innerWidth < 768;
        const count = isMobile && config.responsive.maxParticlesMobile < config.particleCount
            ? config.responsive.maxParticlesMobile
            : config.particleCount;

        const dpr = config.responsive.scaleWithDPR ? (window.devicePixelRatio || 1) : 1;
        const width = canvas.width;
        const height = canvas.height;
        const cx = width / 2;
        const cy = height / 2;
        const minDim = Math.min(width, height);
        const baseRadius = (minDim * config.radius) / 100;
        const thickness = (minDim * config.thickness) / 100;

        particlesRef.current = [];

        for (let i = 0; i < count; i++) {
            const particleSeed = config.seed + i * 1000;
            const angleBase = (2 * Math.PI * i) / count;
            const jitterAngle = (seededRandom(particleSeed) - 0.5) * 0.3;
            const jitterRadius = (seededRandom(particleSeed + 1) - 0.5);

            // Calculate origin position (where particle naturally sits)
            const theta = angleBase + jitterAngle;
            const r = baseRadius + jitterRadius * thickness;
            const x0 = cx + r * Math.cos(theta);
            const y0 = cy + r * Math.sin(theta);

            particlesRef.current.push({
                angleBase,
                jitterAngle,
                jitterRadius,
                phase: seededRandom(particleSeed + 2) * Math.PI * 2,
                freq: seededRandom(particleSeed + 3) * 0.5 + 0.5,
                sizeFactor: seededRandom(particleSeed + 4),
                hueVariation: seededRandom(particleSeed + 5) * 20 - 10,
                phaseInfluence: seededRandom(particleSeed + 6) * 0.5 + 0.5,
                seed: particleSeed,
                // Physics
                origin: { x: x0, y: y0 },
                pos: { x: x0, y: y0 },
                vel: { x: 0, y: 0 },
                mass: 1 + seededRandom(particleSeed + 7) * 0.5,
                layer: seededRandom(particleSeed + 8) < 0.25 ? 0 : (seededRandom(particleSeed + 9) < 0.5 ? 1 : 2)
            });
        }

        noiseRef.current = new SimplexNoise(config.seed);
    }, [config.seed, config.particleCount, config.responsive.maxParticlesMobile, config.responsive.scaleWithDPR, config.radius, config.thickness]);

    // Render frame
    const renderFrame = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = config.responsive.scaleWithDPR ? (window.devicePixelRatio || 1) : 1;
        const width = canvas.width;
        const height = canvas.height;
        const cx = width / 2;
        const cy = height / 2;
        const minDim = Math.min(width, height);

        const baseRadius = (minDim * config.radius) / 100;
        const thickness = (minDim * config.thickness) / 100;

        // Clear canvas
        ctx.clearRect(0, 0, width, height);
        ctx.globalCompositeOperation = config.blendMode;

        // Calculate time
        const t = reducedMotionRef.current ? 0 : (Date.now() - startTimeRef.current) / 1000;

        const noise = noiseRef.current!;
        const [sizeMin, sizeMax] = config.particleSize.map(s => s * dpr);
        const [alphaMin, alphaMax] = config.alphaRange;

        // Mouse interaction parameters
        const mouseEnabled = config.mouseInteraction?.enabled && !reducedMotionRef.current;

        // Read mouse state from CSS custom properties
        let mouseX = 0.5, mouseY = 0.5;
        if (mouseEnabled) {
            const computedStyle = getComputedStyle(document.documentElement);
            mouseX = parseFloat(computedStyle.getPropertyValue('--mouse-x') || '0.5');
            mouseY = parseFloat(computedStyle.getPropertyValue('--mouse-y') || '0.5');
        }

        // Convert mouse position to pixel space
        const mousePx = mouseX * width;
        const mousePy = mouseY * height;

        // Draw particles
        for (const particle of particlesRef.current) {
            // Calculate angle with rotation
            const theta = particle.angleBase +
                particle.jitterAngle +
                config.angularSpeed * t +
                particle.phase;

            // Calculate radius with drift and noise
            const noiseVal = noise.noise2D(
                Math.cos(theta) * config.noiseFrequency + t * 0.1,
                Math.sin(theta) * config.noiseFrequency + t * 0.1
            );

            const radiusOffset = Math.sin(t * particle.freq * config.drift + particle.phase) * (thickness * 0.3) +
                noiseVal * config.noiseAmplitude * dpr;
            const r = baseRadius + particle.jitterRadius * thickness + radiusOffset;

            // Convert to cartesian (base position)
            let x = cx + r * Math.cos(theta);
            let y = cy + r * Math.sin(theta);

            // EFFETTO REPULSIONE - spinge le particelle via dal mouse
            if (mouseEnabled) {
                const dx = mousePx - x;
                const dy = mousePy - y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const repulsionRadius = Math.min(width, height) * 0.2; // Raggio più piccolo (20%)

                if (dist < repulsionRadius && dist > 1) {
                    // Forza di repulsione: più vicino = più forte, ma più smooth
                    const proximity = 1 - (dist / repulsionRadius);
                    const repulsionStrength = Math.pow(proximity, 1.5) * 25 * dpr; // Forza ridotta e curva più morbida

                    // Direzione opposta al mouse (repulsione)
                    const dirX = -dx / dist;
                    const dirY = -dy / dist;

                    // Applica spostamento radiale (verso l'esterno della corona)
                    x += dirX * repulsionStrength;
                    y += dirY * repulsionStrength;
                }
            }            // Calculate size and alpha
            const normalizedR = (r - (baseRadius - thickness / 2)) / thickness;
            const size = sizeMin + particle.sizeFactor * (sizeMax - sizeMin);

            const alphaNoise = noise.noise2D(particle.seed * 0.001, t * 0.05);
            const alphaFactor = (alphaNoise + 1) * 0.5;
            const alpha = alphaMin + alphaFactor * (alphaMax - alphaMin);

            // Calculate color variation
            const lightness = 50 + normalizedR * 30;

            // Calcola influenza mouse per colore magenta - SEMPLIFICATO E PIÙ AGGRESSIVO
            let hue = config.color.h + particle.hueVariation;
            let saturation = config.color.s;

            // Sempre calcola distanza se mouse enabled
            if (mouseEnabled) {
                const dx = mousePx - x;
                const dy = mousePy - y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const maxDist = Math.min(width, height) * 0.02; // 20% dello schermo - effetto più localizzato

                // Applica effetto basato su distanza, non su force
                if (dist < maxDist) {
                    const proximity = 1 - (dist / maxDist);
                    // Effetto quadratico per transizione più morbida
                    const strength = proximity * proximity;

                    // Interpola da verde (120) a magenta (300)
                    hue = 120 + (300 - 120) * strength;
                    saturation = 80 + (100 - 80) * strength;

                    // Debug quando l'effetto è attivo
                    if (strength > 0.1 && Math.random() < 0.01) {
                        console.log('🎨 Magenta effect active:', {
                            dist: dist.toFixed(0),
                            maxDist: maxDist.toFixed(0),
                            proximity: proximity.toFixed(2),
                            strength: strength.toFixed(2),
                            hue: hue.toFixed(0)
                        });
                    }
                }
            }

            // Draw particle
            ctx.fillStyle = `hsla(${hue}, ${saturation}%, ${lightness}%, ${alpha})`;
            ctx.beginPath();
            ctx.arc(x, y, size / 2, 0, Math.PI * 2);
            ctx.fill();
        }
    }, [config]);

    // Animation loop
    const animate = useCallback(() => {
        if (!isVisibleRef.current || reducedMotionRef.current) return;

        renderFrame();
        animationFrameRef.current = requestAnimationFrame(animate);
    }, [renderFrame]);

    // Handle resize
    const handleResize = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const dpr = config.responsive.scaleWithDPR ? (window.devicePixelRatio || 1) : 1;
        const rect = canvas.getBoundingClientRect();

        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;

        // Reinitialize particles on resize
        initializeParticles();
        renderFrame();
    }, [config.responsive.scaleWithDPR, initializeParticles, renderFrame]);

    // Handle visibility change
    const handleVisibilityChange = useCallback(() => {
        isVisibleRef.current = !document.hidden;

        if (isVisibleRef.current && !reducedMotionRef.current) {
            startTimeRef.current = Date.now();
            animate();
        } else if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
        }
    }, [animate]);

    // Setup and cleanup
    useEffect(() => {
        // Check for reduced motion preference
        const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        reducedMotionRef.current = config.accessibility.prefersReducedMotion && mediaQuery.matches;

        const handleMotionChange = (e: MediaQueryListEvent) => {
            reducedMotionRef.current = config.accessibility.prefersReducedMotion && e.matches;
            if (reducedMotionRef.current && animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
                renderFrame(); // Render one static frame
            } else if (!reducedMotionRef.current) {
                startTimeRef.current = Date.now();
                animate();
            }
        };

        mediaQuery.addEventListener('change', handleMotionChange);

        // Initialize
        initializeParticles();
        handleResize();

        // Start animation
        if (!reducedMotionRef.current) {
            animate();
        }

        // Event listeners
        window.addEventListener('resize', handleResize);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
            window.removeEventListener('resize', handleResize);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            mediaQuery.removeEventListener('change', handleMotionChange);
        };
    }, [config, animate, handleResize, handleVisibilityChange, initializeParticles, renderFrame]);

    return (
        <canvas
            ref={canvasRef}
            className={className}
            style={{
                display: 'block',
                width: '100%',
                height: '100%',
            }}
        />
    );
};
