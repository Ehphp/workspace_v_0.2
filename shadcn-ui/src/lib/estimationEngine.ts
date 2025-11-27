import type { EstimationInput, EstimationResult, SelectedActivity } from '@/types/estimation';

/**
 * Deterministic estimation engine
 * Formula:
 * - Base Days = sum of selected activities' base_days
 * - Driver Multiplier = product of all driver multipliers
 * - Subtotal = Base Days × Driver Multiplier
 * - Risk Score = sum of selected risks' weights
 * - Contingency % based on Risk Score:
 *   - 0-10: 10%
 *   - 11-20: 15%
 *   - 21-30: 20%
 *   - 31+: 25%
 * - Total Days = Subtotal × (1 + Contingency %)
 */

export function calculateBaseDays(activities: SelectedActivity[]): number {
  return activities.reduce((sum, activity) => sum + activity.baseDays, 0);
}

export function calculateDriverMultiplier(drivers: { multiplier: number }[]): number {
  if (drivers.length === 0) return 1.0;
  return drivers.reduce((product, driver) => product * driver.multiplier, 1.0);
}

export function calculateRiskScore(risks: { weight: number }[]): number {
  return risks.reduce((sum, risk) => sum + risk.weight, 0);
}

export function calculateContingency(riskScore: number): number {
  // No risks selected -> no contingency
  if (riskScore <= 0) return 0.0;
  if (riskScore <= 10) return 0.10;
  if (riskScore <= 20) return 0.15;
  if (riskScore <= 30) return 0.20;
  return 0.25;
}

export function calculateEstimation(input: EstimationInput): EstimationResult {
  // Step 1: Calculate base days
  const baseDays = calculateBaseDays(input.activities);

  // Step 2: Calculate driver multiplier
  const driverMultiplier = calculateDriverMultiplier(input.drivers);

  // Step 3: Calculate subtotal
  const subtotal = baseDays * driverMultiplier;

  // Step 4: Calculate risk score and contingency
  const riskScore = calculateRiskScore(input.risks);
  const contingencyPercent = calculateContingency(riskScore);
  const contingencyDays = subtotal * contingencyPercent;

  // Step 5: Calculate total days
  const totalDays = subtotal + contingencyDays;

  // Calculate breakdown (simplified for MVP)
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

export function formatDays(days: number): string {
  return days.toFixed(2);
}

export function formatMultiplier(multiplier: number): string {
  return `${multiplier.toFixed(3)}x`;
}

export function formatPercent(percent: number): string {
  return `${percent.toFixed(0)}%`;
}

/**
 * Quick estimation for simplified workflow
 * 
 * @deprecated This function is deprecated. Use the AI-powered QuickEstimate component instead,
 * which calls suggestActivities() and calculateEstimation() for accurate results.
 * 
 * This legacy function used heuristic-based calculation with default assumptions:
 * - Base complexity: 10 days for simple requirements, scaled by word count
 * - Technology multiplier: 1.0 (neutral baseline)
 * - Default driver multiplier: 1.2 (moderate complexity)
 * - Default risk contingency: 15% (medium risk)
 * 
 * @param description - Requirement description
 * @param technology - Technology stack name (optional)
 * @returns Estimated days
 */
export function calculateQuickEstimation(description: string, technology?: string): number {
  // Base estimation from description complexity
  const words = description.trim().split(/\s+/).length;
  const descriptionComplexity = Math.min(words / 50, 3); // Scale 0-3 based on word count
  const baseDays = 10 + (descriptionComplexity * 5); // 10-25 days base

  // Technology multiplier (can be expanded later)
  let techMultiplier = 1.0;
  if (technology) {
    const lowerTech = technology.toLowerCase();
    // Complex technologies
    if (lowerTech.includes('microservices') || lowerTech.includes('kubernetes')) {
      techMultiplier = 1.4;
    } else if (lowerTech.includes('mobile') || lowerTech.includes('native')) {
      techMultiplier = 1.3;
    } else if (lowerTech.includes('full stack') || lowerTech.includes('enterprise')) {
      techMultiplier = 1.2;
    }
  }

  // Default assumptions
  const defaultDriverMultiplier = 1.2; // Moderate complexity
  const defaultContingency = 0.15; // 15% risk buffer

  // Calculate total
  const subtotal = baseDays * techMultiplier * defaultDriverMultiplier;
  const totalDays = subtotal * (1 + defaultContingency);

  return Number(totalDays.toFixed(1));
}
