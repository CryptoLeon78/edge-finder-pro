export type SubscriptionPlan = 'free' | 'pro' | 'enterprise';

export interface PlanLimits {
  maxStrategies: number;
  monteCarloIterations: number;
  walkForward: boolean;
  portfolioAnalysis: boolean;
  ruinSimulation: boolean;
  pdfExport: boolean;
  emailSupport: boolean;
  apiAccess: boolean;
  prioritySupport: boolean;
}

export const PLANS: Record<SubscriptionPlan, PlanLimits> = {
  free: {
    maxStrategies: 3,
    monteCarloIterations: 100,
    walkForward: false,
    portfolioAnalysis: false,
    ruinSimulation: false,
    pdfExport: false,
    emailSupport: false,
    apiAccess: false,
    prioritySupport: false,
  },
  pro: {
    maxStrategies: 20,
    monteCarloIterations: 1000,
    walkForward: true,
    portfolioAnalysis: true,
    ruinSimulation: true,
    pdfExport: true,
    emailSupport: true,
    apiAccess: false,
    prioritySupport: false,
  },
  enterprise: {
    maxStrategies: -1, // unlimited
    monteCarloIterations: 5000,
    walkForward: true,
    portfolioAnalysis: true,
    ruinSimulation: true,
    pdfExport: true,
    emailSupport: true,
    apiAccess: true,
    prioritySupport: true,
  },
};

export const PLAN_PRICES: Record<SubscriptionPlan, number> = {
  free: 0,
  pro: 29,
  enterprise: 99,
};

export const PLAN_NAMES: Record<SubscriptionPlan, string> = {
  free: 'Básico',
  pro: 'Pro',
  enterprise: 'Enterprise',
};

export function canAccessFeature(plan: SubscriptionPlan, feature: keyof PlanLimits): boolean {
  return PLANS[plan][feature] as boolean;
}

export function getStrategiesLimit(plan: SubscriptionPlan): number {
  return PLANS[plan].maxStrategies;
}