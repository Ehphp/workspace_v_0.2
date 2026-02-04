/**
 * Simplex Noise implementation for organic particle movement
 * Seeded for deterministic results
 */

export class SimplexNoise {
    private perm: number[];

    constructor(private seed: number = 0) {
        this.perm = this.buildPermutationTable(seed);
    }

    private buildPermutationTable(seed: number): number[] {
        const p: number[] = [];
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

    noise2D(x: number, y: number): number {
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

    private fade(t: number): number {
        return t * t * t * (t * (t * 6 - 15) + 10);
    }

    private lerp(t: number, a: number, b: number): number {
        return a + t * (b - a);
    }

    private grad(hash: number, x: number, y: number): number {
        const h = hash & 3;
        return (h === 0 ? x + y : h === 1 ? -x + y : h === 2 ? x - y : -x - y);
    }
}

/**
 * Seeded random number generator for deterministic particle positions
 */
export function seededRandom(seed: number): number {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
}
