import type { EstimationInput, EstimationResult, SelectedActivity } from '@/types/estimation';

/**
 * Isolated SDK module for the Estimation Engine.
 * This class exposes pure functions to calculate estimations, 
 * decoupled from any UI or global React state.
 */
export class EstimationEngineSDK {

  /**
   * Calculate base days from an array of selected activities.
   * Total hours are divided by 8 to get base days.
   */
  public static calculateBaseDays(activities: SelectedActivity[]): number {
    const totalHours = activities.reduce((sum, activity) => sum + activity.baseHours, 0);
    return totalHours / 8.0;
  }

  /**
   * Calculate multiplier from an array of drivers.
   */
  public static calculateDriverMultiplier(drivers: { multiplier: number }[]): number {
    if (drivers.length === 0) return 1.0;
    return drivers.reduce((product, driver) => product * driver.multiplier, 1.0);
  }

  /**
   * Calculate the total risk score.
   */
  public static calculateRiskScore(risks: { weight: number }[]): number {
    return risks.reduce((sum, risk) => sum + risk.weight, 0);
  }

  /**
   * Calculate contingency percentage based on risk score.
   * Baseline contingency is always 10%, even with no risks.
   * ≤0:  10% (baseline)
   * 1-10: 10%
   * 11-20: 15%
   * 21-30: 20%
   * 31+: 25%
   */
  public static calculateContingency(riskScore: number): number {
    // Baseline contingency is always 10%, even with no risks
    if (riskScore <= 0) return 0.10;
    if (riskScore <= 10) return 0.10;
    if (riskScore <= 20) return 0.15;
    if (riskScore <= 30) return 0.20;
    return 0.25;
  }

  /**
   * Calculate the total estimation based on activities, drivers, and risks.
   * Formula: Total Days = (Base/8) * DriversMultiplier * (1+Contingency)
   */
  public static calculateEstimation(input: EstimationInput): EstimationResult {
    const baseDays = this.calculateBaseDays(input.activities);
    const driverMultiplier = this.calculateDriverMultiplier(input.drivers);
    const subtotal = baseDays * driverMultiplier;

    const riskScore = this.calculateRiskScore(input.risks);
    const contingencyPercent = this.calculateContingency(riskScore);
    const contingencyDays = subtotal * contingencyPercent;

    const totalDays = subtotal + contingencyDays;

    const breakdown = {
      byGroup: {} as Record<string, number>,
      byTech: {} as Record<string, number>,
    };

    return {
      baseDays: Number(baseDays.toFixed(2)),
      driverMultiplier: Number(driverMultiplier.toFixed(3)),
      subtotal: Number(subtotal.toFixed(2)),
      riskScore,
      contingencyPercent: Number((contingencyPercent * 100).toFixed(2)),
      contingencyDays: Number(contingencyDays.toFixed(2)),
      totalDays: Number(totalDays.toFixed(2)),
      breakdown,
    };
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
