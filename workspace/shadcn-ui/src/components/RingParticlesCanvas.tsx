import React, { useEffect, useRef, useCallback } from 'react';
import { SimplexNoise, seededRandom } from '@/lib/noise';

export interface RingParticlesConfig {
    shape: 'ring' | 'disk' | 'field';
    particleCount: number;
    radius: number;
    thickness: number;
    particleSize: [number, number];
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
        influenceK: number;
        influenceP: number;
        displacement: number;
        epsilon: number;
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

            // Calculate origin position with spiral offset
            const spiralFactor = i / count; // 0 to 1
            const theta = angleBase + jitterAngle + spiralFactor * Math.PI * 0.2; // Slight spiral offset
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
    }, [config]);

    // Apply mouse impulse
    const applyMouseImpulse = useCallback((particle: Particle, mx: number, my: number, dpr: number, minDim: number) => {
        const dx = particle.pos.x - mx;
        const dy = particle.pos.y - my;
        const dist = Math.sqrt(dx * dx + dy * dy);

        const repulsionRadius = minDim * 1.20;
        const impulseStrength = reducedMotionRef.current ? 0 : 120 * dpr;

        if (dist < repulsionRadius && dist > 0.5) {
            const proximity = 1 - (dist / repulsionRadius);
            const strength = Math.pow(proximity, 0.6) * impulseStrength / particle.mass;
            const nx = dx / dist;
            const ny = dy / dist;

            particle.vel.x += nx * strength;
            particle.vel.y += ny * strength;
        }
    }, []);

    // Update particle physics
    const updateParticle = useCallback((particle: Particle, dt: number, t: number, dpr: number, cx: number, cy: number, minDim: number) => {
        const springK = reducedMotionRef.current ? 40 : 12;
        const drag = 3.5;
        const gravity = 0;
        const maxVelocity = 200 * dpr;

        const layerFactor = 1 + particle.layer * 0.2;
        const k = springK * layerFactor;

        // MOVIMENTO A SPIRALE CONTINUO: aggiorna l'origine in rotazione
        const spiralSpeed = config.angularSpeed * 0.5; // Metà della velocità configurata per movimento più lento
        const baseRadius = (minDim * config.radius) / 100;
        const thickness = (minDim * config.thickness) / 100;

        // Calcola nuovo angolo per origine che ruota
        const currentAngle = particle.angleBase + particle.jitterAngle + spiralSpeed * t;
        const r = baseRadius + particle.jitterRadius * thickness;

        // Aggiorna l'origine in modo che ruoti attorno al centro
        particle.origin.x = cx + r * Math.cos(currentAngle);
        particle.origin.y = cy + r * Math.sin(currentAngle);

        // Spring force verso l'origine che si muove
        const dx = particle.pos.x - particle.origin.x;
        const dy = particle.pos.y - particle.origin.y;
        const F_spring_x = -k * dx;
        const F_spring_y = -k * dy;

        // Drag
        const F_drag_x = -drag * particle.vel.x;
        const F_drag_y = -drag * particle.vel.y;

        // Gravity
        const g = gravity * layerFactor * particle.mass;

        // Acceleration
        const ax = (F_spring_x + F_drag_x) / particle.mass;
        const ay = (F_spring_y + F_drag_y + g) / particle.mass;

        // Semi-implicit Euler
        particle.vel.x += ax * dt;
        particle.vel.y += ay * dt;

        // Clamp velocity
        const vmag2 = particle.vel.x * particle.vel.x + particle.vel.y * particle.vel.y;
        if (vmag2 > maxVelocity * maxVelocity) {
            const vmag = Math.sqrt(vmag2);
            particle.vel.x = (particle.vel.x / vmag) * maxVelocity;
            particle.vel.y = (particle.vel.y / vmag) * maxVelocity;
        }

        // Update position
        particle.pos.x += particle.vel.x * dt;
        particle.pos.y += particle.vel.y * dt;

        // Jitter
        const jitter = Math.sin(t * 0.8 + particle.phase) * 0.25;
        particle.pos.x += jitter * (0.5 + particle.layer * 0.2);
        particle.pos.y += jitter * (0.5 + particle.layer * 0.2);
    }, [config.angularSpeed, config.radius, config.thickness]);

    // Render frame
    const renderFrame = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = config.responsive.scaleWithDPR ? (window.devicePixelRatio || 1) : 1;
        const width = canvas.width;
        const height = canvas.height;
        const minDim = Math.min(width, height);

        // Delta time
        const now = performance.now();
        const dt = Math.min(0.033, (now - lastFrameTimeRef.current) / 1000);
        lastFrameTimeRef.current = now;

        const t = reducedMotionRef.current ? 0 : (Date.now() - startTimeRef.current) / 1000;

        // Clear
        ctx.clearRect(0, 0, width, height);
        ctx.globalCompositeOperation = config.blendMode;

        // Mouse
        const mouseEnabled = config.mouseInteraction?.enabled && !reducedMotionRef.current;
        let mouseX = 0.5, mouseY = 0.5;
        if (mouseEnabled) {
            const computedStyle = getComputedStyle(document.documentElement);
            mouseX = parseFloat(computedStyle.getPropertyValue('--mouse-x') || '0.5');
            mouseY = parseFloat(computedStyle.getPropertyValue('--mouse-y') || '0.5');
        }

        const mousePx = mouseX * width;
        const mousePy = mouseY * height;

        const cx = width / 2;
        const cy = height / 2;

        // Apply impulses
        if (mouseEnabled) {
            for (const particle of particlesRef.current) {
                applyMouseImpulse(particle, mousePx, mousePy, dpr, minDim);
            }
        }

        // Update physics
        for (const particle of particlesRef.current) {
            updateParticle(particle, dt, t, dpr, cx, cy, minDim);
        }

        // Draw
        const [sizeMin, sizeMax] = config.particleSize.map(s => s * dpr);
        const [alphaMin, alphaMax] = config.alphaRange;

        for (const particle of particlesRef.current) {
            // Size based on velocity
            const vel = particle.vel.x * particle.vel.x + particle.vel.y * particle.vel.y;
            const velFactor = Math.min(1, Math.sqrt(vel) / (50 * dpr));
            const size = sizeMin + particle.sizeFactor * (sizeMax - sizeMin) * (1 + velFactor * 0.5);

            // Alpha
            const alpha = alphaMin + (alphaMax - alphaMin) * (0.7 + velFactor * 0.3);

            // Color based on displacement
            const dx = particle.pos.x - particle.origin.x;
            const dy = particle.pos.y - particle.origin.y;
            const displacement = Math.sqrt(dx * dx + dy * dy);
            const maxDisplacement = minDim * 0.15;
            const displacementFactor = Math.min(1, displacement / maxDisplacement);

            const hue = 120 + (300 - 120) * Math.pow(displacementFactor, 0.8) + particle.hueVariation;
            const saturation = 80 + (100 - 80) * displacementFactor;
            const lightness = 50 + particle.layer * 10;

            // Draw
            ctx.fillStyle = `hsla(${hue}, ${saturation}%, ${lightness}%, ${alpha})`;
            ctx.beginPath();
            ctx.arc(particle.pos.x, particle.pos.y, size / 2, 0, Math.PI * 2);
            ctx.fill();
        }
    }, [config, applyMouseImpulse, updateParticle]);

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

        initializeParticles();
        renderFrame();
    }, [config.responsive.scaleWithDPR, initializeParticles, renderFrame]);

    // Handle visibility
    const handleVisibilityChange = useCallback(() => {
        isVisibleRef.current = !document.hidden;

        if (isVisibleRef.current && !reducedMotionRef.current) {
            startTimeRef.current = Date.now();
            lastFrameTimeRef.current = performance.now();
            animate();
        } else if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
        }
    }, [animate]);

    // Setup
    useEffect(() => {
        const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        reducedMotionRef.current = config.accessibility.prefersReducedMotion && mediaQuery.matches;

        const handleMotionChange = (e: MediaQueryListEvent) => {
            reducedMotionRef.current = config.accessibility.prefersReducedMotion && e.matches;
            if (reducedMotionRef.current && animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
                renderFrame();
            } else if (!reducedMotionRef.current) {
                startTimeRef.current = Date.now();
                lastFrameTimeRef.current = performance.now();
                animate();
            }
        };

        mediaQuery.addEventListener('change', handleMotionChange);

        initializeParticles();
        handleResize();

        if (!reducedMotionRef.current) {
            animate();
        }

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
