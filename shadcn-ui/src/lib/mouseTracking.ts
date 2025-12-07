/**
 * Mouse Tracking Utility for Ring Particles
 * 
 * Tracks mouse/touch movement with exponential smoothing and velocity calculation.
 * Updates CSS custom properties for consumption by Paint Worklet or Canvas renderer.
 */

export interface MouseTrackingState {
    x: number;           // Normalized 0..1
    y: number;           // Normalized 0..1
    vx: number;          // Velocity in normalized units per ms
    vy: number;          // Velocity in normalized units per ms
    force: number;       // 0..1 based on speed
    enabled: boolean;    // User preference
}

export interface MouseTrackingConfig {
    smoothingAlpha?: number;        // 0..1, higher = more responsive
    maxForce?: number;              // Maximum force value
    forceMultiplier?: number;       // Speed to force conversion
    updateThrottleMs?: number;      // Min ms between CSS updates
    respectReducedMotion?: boolean; // Respect prefers-reduced-motion
    localStorageKey?: string;       // Key for storing user preference
}

const DEFAULT_CONFIG: Required<MouseTrackingConfig> = {
    smoothingAlpha: 0.12,
    maxForce: 1.0,
    forceMultiplier: 100,
    updateThrottleMs: 16, // ~60fps
    respectReducedMotion: true,
    localStorageKey: 'ringParticles_mouseInteraction',
};

export class MouseTracker {
    private config: Required<MouseTrackingConfig>;
    private state: MouseTrackingState;
    private lastRaw: { x: number; y: number; t: number };
    private lastUpdateTime: number = 0;
    private animationFrameId: number | null = null;
    private mounted: boolean = false;

    constructor(config: MouseTrackingConfig = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };

        // Load user preference from localStorage
        const savedPreference = this.loadPreference();
        const reducedMotion = this.config.respectReducedMotion &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        this.state = {
            x: 0.5,
            y: 0.5,
            vx: 0,
            vy: 0,
            force: 0,
            enabled: savedPreference !== null ? savedPreference : !reducedMotion,
        };

        this.lastRaw = {
            x: 0.5,
            y: 0.5,
            t: performance.now(),
        };
    }

    private loadPreference(): boolean | null {
        try {
            const stored = localStorage.getItem(this.config.localStorageKey);
            return stored !== null ? stored === 'true' : null;
        } catch {
            return null;
        }
    }

    private savePreference(enabled: boolean): void {
        try {
            localStorage.setItem(this.config.localStorageKey, String(enabled));
        } catch {
            // Silently fail if localStorage not available
        }
    }

    /**
     * Enable or disable mouse tracking
     */
    public setEnabled(enabled: boolean): void {
        this.state.enabled = enabled;
        this.savePreference(enabled);

        if (!enabled) {
            // Reset to neutral state
            this.state.force = 0;
            this.updateCSSProperties();
        }
    }

    public isEnabled(): boolean {
        return this.state.enabled;
    }

    public getState(): Readonly<MouseTrackingState> {
        return { ...this.state };
    }

    /**
     * Handle mouse/touch move event
     */
    private handleMove = (clientX: number, clientY: number): void => {
        if (!this.state.enabled) return;

        const rect = document.documentElement.getBoundingClientRect();
        const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));

        const now = performance.now();
        const dt = Math.max(1, now - this.lastRaw.t);

        // Calculate instantaneous velocity (normalized units per ms)
        const vx = (x - this.lastRaw.x) / dt;
        const vy = (y - this.lastRaw.y) / dt;

        // Update last raw state
        this.lastRaw = { x, y, t: now };

        // Apply exponential smoothing
        const alpha = this.config.smoothingAlpha;
        this.state.x += (x - this.state.x) * alpha;
        this.state.y += (y - this.state.y) * alpha;
        this.state.vx += (vx - this.state.vx) * alpha;
        this.state.vy += (vy - this.state.vy) * alpha;

        // Calculate force from speed
        const speed = Math.hypot(this.state.vx, this.state.vy) * this.config.forceMultiplier;
        this.state.force = Math.min(this.config.maxForce, speed);

        // Throttle CSS updates
        this.scheduleUpdate();
    };

    private onMouseMove = (e: MouseEvent): void => {
        this.handleMove(e.clientX, e.clientY);
    };

    private onTouchMove = (e: TouchEvent): void => {
        if (e.touches[0]) {
            this.handleMove(e.touches[0].clientX, e.touches[0].clientY);
        }
    };

    private onVisibilityChange = (): void => {
        if (document.hidden) {
            // Cancel scheduled updates when tab is hidden
            if (this.animationFrameId !== null) {
                cancelAnimationFrame(this.animationFrameId);
                this.animationFrameId = null;
            }
        }
    };

    private onMediaQueryChange = (e: MediaQueryListEvent): void => {
        if (this.config.respectReducedMotion && e.matches) {
            // User enabled reduced motion - disable tracking
            this.setEnabled(false);
        }
    };

    /**
     * Schedule CSS property update (throttled)
     */
    private scheduleUpdate(): void {
        if (this.animationFrameId !== null) return;

        this.animationFrameId = requestAnimationFrame(() => {
            const now = performance.now();
            if (now - this.lastUpdateTime >= this.config.updateThrottleMs) {
                this.updateCSSProperties();
                this.lastUpdateTime = now;
            }
            this.animationFrameId = null;
        });
    }

    /**
     * Update CSS custom properties on document root
     */
    private updateCSSProperties(): void {
        const root = document.documentElement;

        root.style.setProperty('--mouse-x', this.state.x.toFixed(4));
        root.style.setProperty('--mouse-y', this.state.y.toFixed(4));
        root.style.setProperty('--mouse-vx', this.state.vx.toFixed(6));
        root.style.setProperty('--mouse-vy', this.state.vy.toFixed(6));
        root.style.setProperty('--mouse-force', this.state.force.toFixed(3));

        // Debug log removed for production
    }

    /**
     * Initialize event listeners
     */
    public mount(): void {
        if (this.mounted) return;

        window.addEventListener('mousemove', this.onMouseMove, { passive: true });
        window.addEventListener('touchmove', this.onTouchMove, { passive: true });
        document.addEventListener('visibilitychange', this.onVisibilityChange);

        // Listen for changes to reduced motion preference
        if (this.config.respectReducedMotion) {
            const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
            mediaQuery.addEventListener('change', this.onMediaQueryChange);
        }

        // Set initial CSS properties
        this.updateCSSProperties();

        this.mounted = true;
    }

    /**
     * Remove event listeners and cleanup
     */
    public unmount(): void {
        if (!this.mounted) return;

        window.removeEventListener('mousemove', this.onMouseMove);
        window.removeEventListener('touchmove', this.onTouchMove);
        document.removeEventListener('visibilitychange', this.onVisibilityChange);

        if (this.config.respectReducedMotion) {
            const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
            mediaQuery.removeEventListener('change', this.onMediaQueryChange);
        }

        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }

        // Reset CSS properties
        const root = document.documentElement;
        root.style.removeProperty('--mouse-x');
        root.style.removeProperty('--mouse-y');
        root.style.removeProperty('--mouse-vx');
        root.style.removeProperty('--mouse-vy');
        root.style.removeProperty('--mouse-force');

        this.mounted = false;
    }
}

/**
 * React hook for mouse tracking
 */
export function useMouseTracking(config?: MouseTrackingConfig): {
    tracker: MouseTracker;
    enabled: boolean;
    setEnabled: (enabled: boolean) => void;
} {
    const [tracker] = React.useState(() => new MouseTracker(config));
    const [enabled, setEnabledState] = React.useState(tracker.isEnabled());

    React.useEffect(() => {
        tracker.mount();
        return () => tracker.unmount();
    }, [tracker]);

    const setEnabled = React.useCallback((value: boolean) => {
        tracker.setEnabled(value);
        setEnabledState(value);
    }, [tracker]);

    return { tracker, enabled, setEnabled };
}

// For non-React usage
import React from 'react';
