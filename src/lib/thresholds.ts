export const THRESHOLDS = {
  // ============ RISK ALERTS ============
  alerts: {
    maxDrawdownDanger: 30,
    maxDrawdownWarning: 20,
    recoveryFactorDanger: 1,
    maxDrawdownDurationDays: 180,
    edgeScoreDanger: 35,
    winRateWarning: 40,
    profitFactorWarning: 1.2,
    sampleSizeInfo: 100,
  },

  // ============ MONTE CARLO ============
  monteCarlo: {
    iterations: 1000,
    ruinIterations: 5000,
    ruinThreshold: 0.5,
    tradeHorizonMultiplier: 3,
    confidenceInterval95: [0.025, 0.975],
    confidenceInterval99: [0.005, 0.995],
    bucketCount: 20,
    chartPaths: 20,
  },

  // ============ RANDOMNESS TESTS ============
  randomness: {
    significanceThreshold: 1.96,
    maxLag: 20,
    skewnessThreshold: 0.3,
    histogramBins: 10,
  },

  // ============ CORRELATION ============
  correlation: {
    highCorrelation: 0.7,
    mediumCorrelation: 0.4,
    alphaDecayThreshold: 0.2,
  },

  // ============ EDGE CLASSIFICATION ============
  edgeClassification: {
    strongEdge: 75,
    moderateEdge: 55,
    weakEdge: 35,
  },

  // ============ WALK-FORWARD ============
  walkForward: {
    oosRatio: 0.3,
    degradationThreshold: 0.5,
  },

  // ============ UI THRESHOLDS ============
  ui: {
    kellyWarning: 0.25,
    sharpeSuccess: 1,
    sharpeWarning: 0.5,
    profitFactorSuccess: 1.5,
    profitFactorWarning: 1,
    diversificationSuccess: 70,
    diversificationWarning: 40,
    statisticalSignificance: 0.05,
    ruinProbabilitySuccess: 0.05,
    ruinProbabilityWarning: 0.2,
  },
} as const;

export type Thresholds = typeof THRESHOLDS;