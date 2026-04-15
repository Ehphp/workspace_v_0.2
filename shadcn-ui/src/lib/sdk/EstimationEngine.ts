import type { EstimationInput, EstimationResult, SelectedActivity } from '@/types/estimation';
import {
  calculateBaseDays as domainCalculateBaseDays,
  calculateDriverMultiplier as domainCalculateDriverMultiplier,
  calculateRiskScore as domainCalculateRiskScore,
  calculateContingency as domainCalculateContingency,
  computeEstimation,
} from '../../../netlify/functions/lib/domain/estimation/estimation-engine';

/**
 * Isolated SDK module for the Estimation Engine.
 * Delegates all math to the canonical domain-layer pure functions in
 * netlify/functions/lib/domain/estimation/estimation-engine.ts.
 * This class is a thin frontend wrapper — no duplicate formula.
 */
export class EstimationEngineSDK {

  public static calculateBaseDays(activities: SelectedActivity[]): number {
    return domainCalculateBaseDays(activities);
  }

  public static calculateDriverMultiplier(drivers: { multiplier: number }[]): number {
    return domainCalculateDriverMultiplier(drivers);
  }

  public static calculateRiskScore(risks: { weight: number }[]): number {
    return domainCalculateRiskScore(risks);
  }

  public static calculateContingency(riskScore: number): number {
    return domainCalculateContingency(riskScore);
  }

  public static calculateEstimation(input: EstimationInput): EstimationResult {
    return computeEstimation(input);
  }

  // Formatting helpers
  public static formatDays(days: number): string {
    return days.toFixed(2);
  }

  public static formatMultiplier(multiplier: number): string {
    return `${multiplier.toFixed(3)}x`;
  }

  public static formatPercent(percent: number): string {
    return `${percent.toFixed(0)}%`;
  }

  /**
   * Quick estimation for simplified workflow
   * @deprecated Retained for backward compatibility
   */
  public static calculateQuickEstimation(description: string, technology?: string): number {
    const words = description.trim().split(/\s+/).length;
    const descriptionComplexity = Math.min(words / 50, 3);
    const baseDays = 10 + (descriptionComplexity * 5);

    let techMultiplier = 1.0;
    if (technology) {
      const lowerTech = technology.toLowerCase();
      if (lowerTech.includes('microservices') || lowerTech.includes('kubernetes')) {
        techMultiplier = 1.4;
      } else if (lowerTech.includes('mobile') || lowerTech.includes('native')) {
        techMultiplier = 1.3;
      } else if (lowerTech.includes('full stack') || lowerTech.includes('enterprise')) {
        techMultiplier = 1.2;
      }
    }

    const defaultDriverMultiplier = 1.2;
    const defaultContingency = 0.15;

    const subtotal = baseDays * techMultiplier * defaultDriverMultiplier;
    const totalDays = subtotal * (1 + defaultContingency);

    return Number(totalDays.toFixed(1));
  }
}
