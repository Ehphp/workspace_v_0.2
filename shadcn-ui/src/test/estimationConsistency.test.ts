/**
 * Test suite for Estimation Consistency and Repeatability
 * 
 * Verifica che con gli stessi input si ottengano sempre gli stessi risultati
 */

import { describe, it, expect } from 'vitest';
import {
    calculateBaseDays,
    calculateDriverMultiplier,
    calculateRiskScore,
    calculateContingency,
    calculateEstimation,
    calculateQuickEstimation,
} from '@/lib/estimationEngine';
import type { EstimationInput, SelectedActivity } from '@/types/estimation';

describe('Estimation Engine - Consistency Tests', () => {
    describe('calculateBaseDays - Ripetibilità', () => {
        it('should return same result for same activities', () => {
            const activities: SelectedActivity[] = [
                { code: 'DESIGN', baseDays: 2, isAiSuggested: false },
                { code: 'DEV', baseDays: 5, isAiSuggested: true },
                { code: 'TEST', baseDays: 3, isAiSuggested: false },
            ];

            const result1 = calculateBaseDays(activities);
            const result2 = calculateBaseDays(activities);
            const result3 = calculateBaseDays(activities);

            expect(result1).toBe(10);
            expect(result2).toBe(10);
            expect(result3).toBe(10);
            expect(result1).toBe(result2);
            expect(result2).toBe(result3);
        });

        it('should return 0 for empty activities', () => {
            const result1 = calculateBaseDays([]);
            const result2 = calculateBaseDays([]);

            expect(result1).toBe(0);
            expect(result2).toBe(0);
            expect(result1).toBe(result2);
        });

        it('should handle decimal values consistently', () => {
            const activities: SelectedActivity[] = [
                { code: 'TASK1', baseDays: 1.5, isAiSuggested: false },
                { code: 'TASK2', baseDays: 2.3, isAiSuggested: false },
            ];

            const result1 = calculateBaseDays(activities);
            const result2 = calculateBaseDays(activities);

            expect(result1).toBe(3.8);
            expect(result2).toBe(3.8);
        });
    });

    describe('calculateDriverMultiplier - Ripetibilità', () => {
        it('should return same multiplier for same drivers', () => {
            const drivers = [
                { code: 'COMPLEXITY', value: 'HIGH', multiplier: 1.2 },
                { code: 'INTEGRATION', value: 'MEDIUM', multiplier: 1.5 },
                { code: 'QUALITY', value: 'LOW', multiplier: 0.8 },
            ];

            const result1 = calculateDriverMultiplier(drivers);
            const result2 = calculateDriverMultiplier(drivers);
            const result3 = calculateDriverMultiplier(drivers);

            expect(result1).toBe(result2);
            expect(result2).toBe(result3);
            expect(result1).toBeCloseTo(1.44, 5); // 1.2 * 1.5 * 0.8 = 1.44
        });

        it('should return 1.0 for empty drivers consistently', () => {
            const result1 = calculateDriverMultiplier([]);
            const result2 = calculateDriverMultiplier([]);

            expect(result1).toBe(1.0);
            expect(result2).toBe(1.0);
        });
    });

    describe('calculateRiskScore - Ripetibilità', () => {
        it('should return same score for same risks', () => {
            const risks = [
                { code: 'R_TECH', weight: 5 },
                { code: 'R_INTEG', weight: 3 },
                { code: 'R_PERF', weight: 7 },
            ];

            const result1 = calculateRiskScore(risks);
            const result2 = calculateRiskScore(risks);
            const result3 = calculateRiskScore(risks);

            expect(result1).toBe(15);
            expect(result2).toBe(15);
            expect(result3).toBe(15);
        });
    });

    describe('calculateContingency - Determinismo', () => {
        it('should return consistent contingency for same risk score', () => {
            expect(calculateContingency(5)).toBe(0.10);
            expect(calculateContingency(5)).toBe(0.10);

            expect(calculateContingency(15)).toBe(0.15);
            expect(calculateContingency(15)).toBe(0.15);

            expect(calculateContingency(25)).toBe(0.20);
            expect(calculateContingency(25)).toBe(0.20);

            expect(calculateContingency(35)).toBe(0.25);
            expect(calculateContingency(35)).toBe(0.25);
        });

        it('should handle boundary values consistently', () => {
            // Boundary tests
            expect(calculateContingency(10)).toBe(0.10);
            expect(calculateContingency(11)).toBe(0.15);
            expect(calculateContingency(20)).toBe(0.15);
            expect(calculateContingency(21)).toBe(0.20);
            expect(calculateContingency(30)).toBe(0.20);
            expect(calculateContingency(31)).toBe(0.25);
        });
    });

    describe('calculateEstimation - Full Consistency Test', () => {
        it('should return identical results for identical inputs (multiple runs)', () => {
            const input: EstimationInput = {
                activities: [
                    { code: 'ANALYSIS', baseDays: 3, isAiSuggested: false },
                    { code: 'DEV', baseDays: 8, isAiSuggested: true },
                    { code: 'TEST', baseDays: 4, isAiSuggested: false },
                ],
                drivers: [
                    { code: 'COMPLEXITY', value: 'HIGH', multiplier: 1.2 },
                    { code: 'INTEGRATION', value: 'MEDIUM', multiplier: 1.1 },
                ],
                risks: [
                    { code: 'R_TECH', weight: 5 },
                    { code: 'R_INTEG', weight: 8 },
                ],
            };

            // Run estimation 10 times
            const results = Array.from({ length: 10 }, () => calculateEstimation(input));

            // All results should be identical
            const firstResult = results[0];
            results.forEach((result, index) => {
                expect(result.baseDays).toBe(firstResult.baseDays);
                expect(result.driverMultiplier).toBe(firstResult.driverMultiplier);
                expect(result.subtotal).toBe(firstResult.subtotal);
                expect(result.riskScore).toBe(firstResult.riskScore);
                expect(result.contingencyPercent).toBe(firstResult.contingencyPercent);
                expect(result.contingencyDays).toBe(firstResult.contingencyDays);
                expect(result.totalDays).toBe(firstResult.totalDays);
            });

            // Verify specific expected values
            expect(firstResult.baseDays).toBe(15); // 3 + 8 + 4
            expect(firstResult.driverMultiplier).toBe(1.32); // 1.2 * 1.1 = 1.32
            expect(firstResult.subtotal).toBe(19.8); // 15 * 1.32
            expect(firstResult.riskScore).toBe(13); // 5 + 8
            expect(firstResult.contingencyPercent).toBe(15); // Risk score 13 -> 15%
        });

        it('should be deterministic with different input combinations', () => {
            const scenarios = [
                {
                    name: 'Simple project',
                    input: {
                        activities: [{ code: 'DEV', baseDays: 5, isAiSuggested: false }],
                        drivers: [{ code: 'COMPLEXITY', value: 'LOW', multiplier: 1.0 }],
                        risks: [{ code: 'R_LOW', weight: 5 }],
                    },
                },
                {
                    name: 'Complex project',
                    input: {
                        activities: [
                            { code: 'DESIGN', baseDays: 10, isAiSuggested: false },
                            { code: 'DEV', baseDays: 20, isAiSuggested: true },
                        ],
                        drivers: [
                            { code: 'COMPLEXITY', value: 'HIGH', multiplier: 1.5 },
                            { code: 'INTEGRATION', value: 'MEDIUM', multiplier: 1.3 },
                        ],
                        risks: [
                            { code: 'R_HIGH1', weight: 10 },
                            { code: 'R_HIGH2', weight: 15 },
                        ],
                    },
                },
            ];

            scenarios.forEach((scenario) => {
                const result1 = calculateEstimation(scenario.input);
                const result2 = calculateEstimation(scenario.input);
                const result3 = calculateEstimation(scenario.input);

                expect(result1).toEqual(result2);
                expect(result2).toEqual(result3);
            });
        });

        it('should handle edge cases consistently', () => {
            // Empty estimation
            const emptyInput: EstimationInput = {
                activities: [],
                drivers: [],
                risks: [],
            };

            const result1 = calculateEstimation(emptyInput);
            const result2 = calculateEstimation(emptyInput);

            expect(result1).toEqual(result2);
            expect(result1.totalDays).toBe(0);

            // Only activities, no drivers or risks
            const minimalInput: EstimationInput = {
                activities: [{ code: 'TASK', baseDays: 10, isAiSuggested: false }],
                drivers: [],
                risks: [],
            };

            const result3 = calculateEstimation(minimalInput);
            const result4 = calculateEstimation(minimalInput);

            expect(result3).toEqual(result4);
            expect(result3.baseDays).toBe(10);
            expect(result3.driverMultiplier).toBe(1.0);
            expect(result3.contingencyPercent).toBe(10); // No risks = 10%
        });
    });

    describe('calculateQuickEstimation - Consistency', () => {
        it('should return same result for same description', () => {
            const description = 'Create a user authentication system with login and registration';

            const result1 = calculateQuickEstimation(description);
            const result2 = calculateQuickEstimation(description);
            const result3 = calculateQuickEstimation(description);

            expect(result1).toBe(result2);
            expect(result2).toBe(result3);
            expect(result1).toBeGreaterThan(0);
        });

        it('should be deterministic with same inputs including technology', () => {
            const description = 'Build a REST API with CRUD operations';
            const technology = 'React';

            const result1 = calculateQuickEstimation(description, technology);
            const result2 = calculateQuickEstimation(description, technology);

            expect(result1).toBe(result2);
        });

        it('should handle empty description consistently', () => {
            const result1 = calculateQuickEstimation('');
            const result2 = calculateQuickEstimation('');

            expect(result1).toBe(result2);
        });
    });

    describe('Same Requirement - Variance Analysis', () => {
        it('should detect when different selections produce different results', () => {
            const baseRequirement: EstimationInput = {
                activities: [
                    { code: 'ANALYSIS', baseDays: 5, isAiSuggested: false },
                    { code: 'DEV', baseDays: 10, isAiSuggested: false },
                ],
                drivers: [{ code: 'COMPLEXITY', value: 'MEDIUM', multiplier: 1.2 }],
                risks: [{ code: 'R_MEDIUM', weight: 10 }],
            };

            // Scenario 1: Base
            const result1 = calculateEstimation(baseRequirement);

            // Scenario 2: Add more activities
            const optimisticRequirement: EstimationInput = {
                ...baseRequirement,
                activities: [
                    { code: 'ANALYSIS', baseDays: 5, isAiSuggested: false },
                ],
            };
            const result2 = calculateEstimation(optimisticRequirement);

            // Scenario 3: Higher complexity
            const pessimisticRequirement: EstimationInput = {
                ...baseRequirement,
                drivers: [{ code: 'COMPLEXITY', value: 'HIGH', multiplier: 1.5 }],
                risks: [{ code: 'R_HIGH', weight: 20 }],
            };
            const result3 = calculateEstimation(pessimisticRequirement);

            // Results should be different
            expect(result1.totalDays).not.toBe(result2.totalDays);
            expect(result1.totalDays).not.toBe(result3.totalDays);
            expect(result2.totalDays).not.toBe(result3.totalDays);

            // But each should be consistent when re-run
            expect(calculateEstimation(baseRequirement)).toEqual(result1);
            expect(calculateEstimation(optimisticRequirement)).toEqual(result2);
            expect(calculateEstimation(pessimisticRequirement)).toEqual(result3);
        });

        it('should show variance range for same requirement with different scenarios', () => {
            const baseActivities = [
                { code: 'DEV', baseDays: 10, isAiSuggested: false },
            ];

            // Best case
            const bestCase = calculateEstimation({
                activities: baseActivities,
                drivers: [{ code: 'COMPLEXITY', value: 'LOW', multiplier: 0.8 }],
                risks: [{ code: 'R_LOW', weight: 3 }],
            });

            // Average case
            const avgCase = calculateEstimation({
                activities: baseActivities,
                drivers: [{ code: 'COMPLEXITY', value: 'MEDIUM', multiplier: 1.0 }],
                risks: [{ code: 'R_MEDIUM', weight: 10 }],
            });

            // Worst case
            const worstCase = calculateEstimation({
                activities: baseActivities,
                drivers: [{ code: 'COMPLEXITY', value: 'HIGH', multiplier: 1.5 }],
                risks: [{ code: 'R_HIGH', weight: 25 }],
            });

            // Calculate variance
            const variance = worstCase.totalDays - bestCase.totalDays;
            const variancePercent = ((variance / avgCase.totalDays) * 100).toFixed(1);

            // Verify variance exists
            expect(bestCase.totalDays).toBeLessThan(avgCase.totalDays);
            expect(avgCase.totalDays).toBeLessThan(worstCase.totalDays);

            // Log for analysis
            console.log('Same requirement, different scenarios:');
            console.log('Best case:', bestCase.totalDays, 'days');
            console.log('Average case:', avgCase.totalDays, 'days');
            console.log('Worst case:', worstCase.totalDays, 'days');
            console.log('Variance:', variance.toFixed(2), 'days', `(${variancePercent}%)`);
        });
    });
});
