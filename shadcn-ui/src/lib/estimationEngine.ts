import type { EstimationInput, EstimationResult, SelectedActivity } from '@/types/estimation';
import { EstimationEngineSDK } from './sdk/EstimationEngine';

/**
 * Proxy functions that delegate to the isolated EstimationEngineSDK.
 * These preserve the original import paths used throughout the frontend.
 */

export function calculateBaseDays(activities: SelectedActivity[]): number {
  return EstimationEngineSDK.calculateBaseDays(activities);
}

export function calculateDriverMultiplier(drivers: { multiplier: number }[]): number {
  return EstimationEngineSDK.calculateDriverMultiplier(drivers);
}

export function calculateRiskScore(risks: { weight: number }[]): number {
  return EstimationEngineSDK.calculateRiskScore(risks);
}

export function calculateContingency(riskScore: number): number {
  return EstimationEngineSDK.calculateContingency(riskScore);
}

export function calculateEstimation(input: EstimationInput): EstimationResult {
  return EstimationEngineSDK.calculateEstimation(input);
}

export function formatDays(days: number): string {
  return EstimationEngineSDK.formatDays(days);
}

export function formatMultiplier(multiplier: number): string {
  return EstimationEngineSDK.formatMultiplier(multiplier);
}

export function formatPercent(percent: number): string {
  return EstimationEngineSDK.formatPercent(percent);
}

/**
 * Quick estimation for simplified workflow
 * @deprecated Retained for backward compatibility
 */
export function calculateQuickEstimation(description: string, technology?: string): number {
  return EstimationEngineSDK.calculateQuickEstimation(description, technology);
}
