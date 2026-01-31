/**
 * Ring Particles Paint Worklet
 * CSS Houdini Paint API implementation for animated particle ring
 */

class SimplexNoise {
    constructor(seed = 0) {
        this.seed = seed;
        this.perm = this.buildPermutationTable(seed);
    }

    buildPermutationTable(seed) {
        const p = [];
        for (let i = 0; i < 256; i++) p[i] = i;

        // Shuffle using seed
        let n = 256;
        while (n > 1) {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            const k = seed % n;
            n--;
            [p[n], p[k]] = [p[k], p[n]];
        }

        return [...p, ...p]; // Double for overflow
    }

    noise2D(x, y) {
        const X = Math.floor(x) & 255;
        const Y = Math.floor(y) & 255;

        x -= Math.floor(x);
        y -= Math.floor(y);

        const u = this.fade(x);
        const v = this.fade(y);

        const a = this.perm[X] + Y;
        const b = this.perm[X + 1] + Y;

        return this.lerp(v,
            this.lerp(u, this.grad(this.perm[a], x, y), this.grad(this.perm[b], x - 1, y)),
            this.lerp(u, this.grad(this.perm[a + 1], x, y - 1), this.grad(this.perm[b + 1], x - 1, y - 1))
        );
    }

    fade(t) {
        return t * t * t * (t * (t * 6 - 15) + 10);
    }

    lerp(t, a, b) {
        return a + t * (b - a);
    }

    grad(hash, x, y) {
        const h = hash & 3;
        return (h === 0 ? x + y : h === 1 ? -x + y : h === 2 ? x - y : -x - y);
    }
}

class RingParticlesPainter {
    static get inputProperties() {
        return [
            '--ring-time',
            '--ring-particle-count',
            '--ring-radius',
            '--ring-thickness',
            '--ring-particle-size-min',
            '--ring-particle-size-max',
            '--ring-alpha-min',
            '--ring-alpha-max',
            '--ring-hue',
            '--ring-saturation',
            '--ring-drift',
            '--ring-angular-speed',
            '--ring-noise-frequency',
            '--ring-noise-amplitude',
            '--ring-seed',
            '--ring-blend-mode',
            // Mouse interaction properties
            '--mouse-x',
            '--mouse-y',
            '--mouse-vx',
            '--mouse-vy',
            '--mouse-force',
            '--mouse-influence-k',
            '--mouse-influence-p',
            '--mouse-displacement'
        ];
    }

    parseValue(props, name, defaultValue) {
        const value = props.get(name);
        if (!value) return defaultValue;
        const parsed = parseFloat(value.toString());
        return isNaN(parsed) ? defaultValue : parsed;
    }

    seededRandom(seed) {
        const x = Math.sin(seed++) * 10000;
        return x - Math.floor(x);
    }

    paint(ctx, geom, props) {
        const dpr = globalThis.devicePixelRatio || 1;
        const width = geom.width * dpr;
        const height = geom.height * dpr;
        const cx = width / 2;
        const cy = height / 2;
        const minDim = Math.min(width, height);

        // Parse properties
        const t = this.parseValue(props, '--ring-time', 0);
        const particleCount = Math.floor(this.parseValue(props, '--ring-particle-count', 600));
        const radiusPercent = this.parseValue(props, '--ring-radius', 40);
        const thicknessPercent = this.parseValue(props, '--ring-thickness', 8);
        const sizeMin = this.parseValue(props, '--ring-particle-size-min', 1) * dpr;
        const sizeMax = this.parseValue(props, '--ring-particle-size-max', 6) * dpr;
        const alphaMin = this.parseValue(props, '--ring-alpha-min', 0.15);
        const alphaMax = this.parseValue(props, '--ring-alpha-max', 0.95);
        const hue = this.parseValue(props, '--ring-hue', 210);
        const saturation = this.parseValue(props, '--ring-saturation', 90);
        const drift = this.parseValue(props, '--ring-drift', 0.2);
        const angularSpeed = this.parseValue(props, '--ring-angular-speed', 0.02);
        const noiseFreq = this.parseValue(props, '--ring-noise-frequency', 0.8);
        const noiseAmp = this.parseValue(props, '--ring-noise-amplitude', 8) * dpr;
        const seed = this.parseValue(props, '--ring-seed', 12345);

        // Parse mouse interaction properties
        const mx = this.parseValue(props, '--mouse-x', 0.5);
        const my = this.parseValue(props, '--mouse-y', 0.5);
        const mvx = this.parseValue(props, '--mouse-vx', 0);
        const mvy = this.parseValue(props, '--mouse-vy', 0);
        const mforce = this.parseValue(props, '--mouse-force', 0);
        const influenceK = this.parseValue(props, '--mouse-influence-k', 0.9);
        const influenceP = this.parseValue(props, '--mouse-influence-p', 1.4);
        const displacement = this.parseValue(props, '--mouse-displacement', 12) * dpr;

        // Mouse position in pixel space
        const mouseX = mx * width;
        const mouseY = my * height;

        const baseRadius = (minDim * radiusPercent) / 100;
        const thickness = (minDim * thicknessPercent) / 100;

        // Initialize noise
        const noise = new SimplexNoise(seed);

        // Set blend mode
        const blendMode = props.get('--ring-blend-mode')?.toString().trim() || 'normal';
        ctx.globalCompositeOperation = blendMode;

        // Scale context
        ctx.scale(1 / dpr, 1 / dpr);

        // Draw particles
        for (let i = 0; i < particleCount; i++) {
            const particleSeed = seed + i * 1000;

            // Initial position (deterministic)
            const angleBase = (2 * Math.PI * i) / particleCount;
            const jitterAngle = (this.seededRandom(particleSeed) - 0.5) * 0.3;
            const jitterRadius = (this.seededRandom(particleSeed + 1) - 0.5) * thickness;

            // Temporal variation
            const phase = this.seededRandom(particleSeed + 2) * Math.PI * 2;
            const freq = this.seededRandom(particleSeed + 3) * 0.5 + 0.5;

            // Calculate angle with rotation
            const theta = angleBase + jitterAngle + angularSpeed * t + phase;

            // Calculate radius with drift and noise
            const noiseVal = noise.noise2D(
                Math.cos(theta) * noiseFreq + t * 0.1,
                Math.sin(theta) * noiseFreq + t * 0.1
            );

            const radiusOffset = Math.sin(t * freq * drift + phase) * (thickness * 0.3) + noiseVal * noiseAmp;
            const r = baseRadius + jitterRadius + radiusOffset;

            // Convert to cartesian (base position)
            let x = cx + r * Math.cos(theta);
            let y = cy + r * Math.sin(theta);

            // Apply mouse influence
            if (mforce > 0.001) {
                const dx = mouseX - x;
                const dy = mouseY - y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const epsilon = 8;

                // Calculate influence: K / (dist^p + epsilon)
                const influence = Math.min(1, (mforce * influenceK) / (Math.pow(dist + epsilon, influenceP)));

                // Vary influence by particle phase for organic effect
                const phaseInfluence = this.seededRandom(particleSeed + 6) * 0.5 + 0.5;
                const finalInfluence = influence * phaseInfluence;

                // Apply displacement toward/away from mouse
                if (dist > 0.1) {
                    const dirX = dx / dist;
                    const dirY = dy / dist;
                    x += dirX * finalInfluence * displacement;
                    y += dirY * finalInfluence * displacement;
                }

                // Add velocity-based rotation influence
                const rotationInfluence = (mvx + mvy) * finalInfluence * 0.5;
                x += rotationInfluence * -dy * 0.1;
                y += rotationInfluence * dx * 0.1;
            }

            // Calculate size and alpha based on position
            const normalizedR = (r - (baseRadius - thickness / 2)) / thickness;
            const sizeFactor = this.seededRandom(particleSeed + 4);
            const size = sizeMin + sizeFactor * (sizeMax - sizeMin);

            const alphaNoise = noise.noise2D(i * 0.1, t * 0.05);
            const alphaFactor = (alphaNoise + 1) * 0.5;
            const alpha = alphaMin + alphaFactor * (alphaMax - alphaMin);

            // Calculate color variation
            const hueVariation = this.seededRandom(particleSeed + 5) * 20 - 10;
            const lightness = 50 + normalizedR * 30;

            // Draw particle
            ctx.fillStyle = `hsla(${hue + hueVariation}, ${saturation}%, ${lightness}%, ${alpha})`;
            ctx.beginPath();
            ctx.arc(x, y, size / 2, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

// Register the paint worklet
if (typeof registerPaint !== 'undefined') {
    registerPaint('ring-particles', RingParticlesPainter);
}
