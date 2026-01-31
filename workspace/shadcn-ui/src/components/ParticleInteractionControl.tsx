import React from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { MouseTracker } from '@/lib/mouseTracking';

export interface ParticleInteractionControlProps {
    mouseTracker: MouseTracker;
    className?: string;
    label?: string;
    description?: string;
}

/**
 * Accessibility control for toggling mouse interaction with particles
 */
export const ParticleInteractionControl: React.FC<ParticleInteractionControlProps> = ({
    mouseTracker,
    className = '',
    label = 'Mouse interaction',
    description = 'Particles respond to mouse movement'
}) => {
    const [enabled, setEnabled] = React.useState(mouseTracker.isEnabled());

    const handleToggle = (checked: boolean) => {
        mouseTracker.setEnabled(checked);
        setEnabled(checked);
    };

    return (
        <div className={`flex items-center justify-between ${className}`}>
            <div className="space-y-0.5">
                <Label htmlFor="particle-interaction" className="text-sm font-medium">
                    {label}
                </Label>
                {description && (
                    <p className="text-xs text-muted-foreground">
                        {description}
                    </p>
                )}
            </div>
            <Switch
                id="particle-interaction"
                checked={enabled}
                onCheckedChange={handleToggle}
                aria-label="Toggle particle mouse interaction"
            />
        </div>
    );
};

/**
 * Standalone toggle button version
 */
export interface ParticleInteractionButtonProps {
    mouseTracker: MouseTracker;
    className?: string;
    variant?: 'default' | 'outline' | 'ghost';
}

import { Button } from '@/components/ui/button';
import { Mouse, MouseOff } from 'lucide-react';

export const ParticleInteractionButton: React.FC<ParticleInteractionButtonProps> = ({
    mouseTracker,
    className = '',
    variant = 'ghost'
}) => {
    const [enabled, setEnabled] = React.useState(mouseTracker.isEnabled());

    const handleToggle = () => {
        const newState = !enabled;
        mouseTracker.setEnabled(newState);
        setEnabled(newState);
    };

    return (
        <Button
            variant={variant}
            size="sm"
            onClick={handleToggle}
            className={className}
            aria-label={enabled ? 'Disable mouse interaction' : 'Enable mouse interaction'}
            title={enabled ? 'Disable particle interaction' : 'Enable particle interaction'}
        >
            {enabled ? (
                <>
                    <Mouse className="w-4 h-4 mr-2" />
                    Interactive
                </>
            ) : (
                <>
                    <MouseOff className="w-4 h-4 mr-2" />
                    Static
                </>
            )}
        </Button>
    );
};
