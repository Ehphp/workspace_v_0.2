import { describe, it, expect, vi } from 'vitest';

// Mock before import
vi.mock('../lib/supabase', () => ({
    supabase: {
        from: vi.fn(),
    },
}));

import { saveEstimation, ApiError } from '../lib/api';

console.log("Test file loaded!");

describe('saveEstimation', () => {
    it('should throw ApiError when activities are empty', async () => {
        const input: any = {
            requirementId: 'req-1',
            userId: 'user-1',
            totalDays: 5,
            baseDays: 5,
            driverMultiplier: 1,
            riskScore: 0,
            contingencyPercent: 10,
            activities: [], // Empty activities
            drivers: [],
            risks: []
        };

        await expect(saveEstimation(input)).rejects.toThrow(ApiError);
        await expect(saveEstimation(input)).rejects.toThrow('Cannot save an estimation without activities');
    });

    it('should throw ApiError when activities are null/undefined', async () => {
        const input: any = {
            requirementId: 'req-1',
            userId: 'user-1',
            totalDays: 5,
            baseDays: 5,
            driverMultiplier: 1,
            riskScore: 0,
            contingencyPercent: 10,
            activities: null,
            drivers: [],
            risks: []
        };

        await expect(saveEstimation(input)).rejects.toThrow(ApiError);
    });
});
