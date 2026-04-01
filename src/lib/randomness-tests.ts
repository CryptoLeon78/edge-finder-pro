// ============ ADVANCED RANDOMNESS TESTS ============

import type { TradeOrder } from './binary-parser';

export interface RunsTestResult {
  totalRuns: number;
  expectedRuns: number;
  zScore: number;
  pValue: number;
  isRandom: boolean; // p > 0.05
  wins: number;
  losses: number;
  description: string;
}

export interface AutocorrelationResult {
  lags: number[];
  coefficients: number[];
  significanceThreshold: number;
  hasSignificantLag: boolean;
  description: string;
}

export interface DistributionResult {
  mean: number;
  median: number;
  stdDev: number;
  skewness: number;
  kurtosis: number;
  jarqueBeraStatistic: number;
  jarqueBeraP: number;
  isNormal: boolean;
  histogram: { bin: string; count: number; normalExpected: number }[];
  description: string;
}

export interface RandomnessAnalysis {
  runsTest: RunsTestResult;
  autocorrelation: AutocorrelationResult;
  distribution: DistributionResult;
  overallRandomnessScore: number; // 0-100, higher = more evidence of edge (less random)
}

// ============ RUNS TEST (Wald–Wolfowitz) ============

export function runsTest(trades: TradeOrder[]): RunsTestResult {
  if (trades.length < 10) {
    return { totalRuns: 0, expectedRuns: 0, zScore: 0, pValue: 1, isRandom: true, wins: 0, losses: 0, description: 'Insuficientes trades para el test' };
  }
  
  const sequence = trades.map(t => t.pnlMoney > 0 ? 1 : 0);
  const n = sequence.length;
  const wins = sequence.filter(x => x === 1).length;
  const losses = n - wins;
  
  if (wins === 0 || losses === 0) {
    return { totalRuns: 1, expectedRuns: n, zScore: 0, pValue: 1, isRandom: true, wins, losses, description: 'Todos los trades son del mismo signo' };
  }
  
  // Count runs
  let totalRuns = 1;
  for (let i = 1; i < n; i++) {
    if (sequence[i] !== sequence[i - 1]) totalRuns++;
  }
  
  // Expected runs and std dev under null hypothesis
  const expectedRuns = 1 + (2 * wins * losses) / n;
  const variance = (2 * wins * losses * (2 * wins * losses - n)) / (n * n * (n - 1));
  const stdDev = Math.sqrt(Math.max(0, variance));
  
  const zScore = stdDev > 0 ? (totalRuns - expectedRuns) / stdDev : 0;
  const pValue = 2 * (1 - normalCDF(Math.abs(zScore)));
  
  const direction = zScore > 0 ? 'más rachas que el azar (tendencia a alternar)' : 'menos rachas que el azar (tendencia a rachas)';
  
  return {
    totalRuns,
    expectedRuns,
    zScore,
    pValue,
    isRandom: pValue > 0.05,
    wins,
    losses,
    description: pValue <= 0.05 
      ? `Patrón NO aleatorio detectado (p=${pValue.toFixed(4)}): ${direction}`
      : `No se detecta patrón significativo (p=${pValue.toFixed(4)})`,
  };
}

// ============ AUTOCORRELATION ============

export function autocorrelation(trades: TradeOrder[], maxLag = 20): AutocorrelationResult {
  const returns = trades.map(t => t.pnlMoney);
  const n = returns.length;
  
  if (n < maxLag + 5) {
    return { lags: [], coefficients: [], significanceThreshold: 0, hasSignificantLag: false, description: 'Insuficientes trades' };
  }
  
  const mean = returns.reduce((s, v) => s + v, 0) / n;
  const variance = returns.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
  
  const lags: number[] = [];
  const coefficients: number[] = [];
  const threshold = 1.96 / Math.sqrt(n); // 95% confidence
  let hasSignificant = false;
  
  for (let lag = 1; lag <= Math.min(maxLag, Math.floor(n / 4)); lag++) {
    let covariance = 0;
    for (let i = lag; i < n; i++) {
      covariance += (returns[i] - mean) * (returns[i - lag] - mean);
    }
    covariance /= n;
    
    const coeff = variance > 0 ? covariance / variance : 0;
    lags.push(lag);
    coefficients.push(coeff);
    
    if (Math.abs(coeff) > threshold) hasSignificant = true;
  }
  
  return {
    lags,
    coefficients,
    significanceThreshold: threshold,
    hasSignificantLag: hasSignificant,
    description: hasSignificant 
      ? 'Autocorrelación significativa detectada — los retornos NO son independientes'
      : 'Sin autocorrelación significativa — los retornos parecen independientes',
  };
}

// ============ P&L DISTRIBUTION VS NORMAL ============

export function distributionAnalysis(trades: TradeOrder[], bins = 20): DistributionResult {
  const returns = trades.map(t => t.pnlPips);
  const n = returns.length;
  
  if (n < 10) {
    return {
      mean: 0, median: 0, stdDev: 0, skewness: 0, kurtosis: 0,
      jarqueBeraStatistic: 0, jarqueBeraP: 1, isNormal: true,
      histogram: [], description: 'Insuficientes trades',
    };
  }
  
  const sorted = [...returns].sort((a, b) => a - b);
  const mean = returns.reduce((s, v) => s + v, 0) / n;
  const median = n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[Math.floor(n / 2)];
  const variance = returns.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1);
  const stdDev = Math.sqrt(variance);
  
  // Skewness and kurtosis
  const m3 = returns.reduce((s, v) => s + ((v - mean) / stdDev) ** 3, 0) / n;
  const m4 = returns.reduce((s, v) => s + ((v - mean) / stdDev) ** 4, 0) / n;
  const skewness = m3;
  const kurtosis = m4 - 3; // excess kurtosis
  
  // Jarque-Bera test
  const jb = (n / 6) * (skewness ** 2 + (kurtosis ** 2) / 4);
  const jbP = 1 - chiSquaredCDF(jb, 2);
  
  // Histogram
  const min = sorted[0];
  const max = sorted[n - 1];
  const binWidth = (max - min) / bins || 1;
  
  const histogram: { bin: string; count: number; normalExpected: number }[] = [];
  for (let i = 0; i < bins; i++) {
    const lo = min + i * binWidth;
    const hi = lo + binWidth;
    const count = returns.filter(v => v >= lo && (i === bins - 1 ? v <= hi : v < hi)).length;
    const normalExpected = n * (normalCDF((hi - mean) / stdDev) - normalCDF((lo - mean) / stdDev));
    histogram.push({
      bin: `${lo.toFixed(0)}`,
      count,
      normalExpected: Math.round(normalExpected * 10) / 10,
    });
  }
  
  return {
    mean,
    median,
    stdDev,
    skewness,
    kurtosis,
    jarqueBeraStatistic: jb,
    jarqueBeraP: jbP,
    isNormal: jbP > 0.05,
    histogram,
    description: jbP <= 0.05
      ? `Distribución NO normal (JB=${jb.toFixed(2)}, p=${jbP.toFixed(4)}). Asimetría: ${skewness.toFixed(3)}, Curtosis: ${kurtosis.toFixed(3)}`
      : `Distribución compatible con normal (JB=${jb.toFixed(2)}, p=${jbP.toFixed(4)})`,
  };
}

// ============ COMBINED SCORE ============

export function analyzeRandomness(trades: TradeOrder[]): RandomnessAnalysis {
  const runs = runsTest(trades);
  const ac = autocorrelation(trades);
  const dist = distributionAnalysis(trades);
  
  // Score: higher = more evidence of non-randomness (edge)
  let score = 50; // neutral start
  
  // Runs test: non-random patterns suggest structure
  if (!runs.isRandom) score += 15;
  else score -= 5;
  
  // Autocorrelation: significant autocorrelation suggests exploitable patterns
  if (ac.hasSignificantLag) score += 10;
  
  // Distribution: non-normal with positive skew or fat tails
  if (!dist.isNormal) score += 10;
  if (dist.skewness > 0.3) score += 10; // positive skew = bigger wins than losses
  if (dist.mean > 0) score += 5;
  
  return {
    runsTest: runs,
    autocorrelation: ac,
    distribution: dist,
    overallRandomnessScore: Math.max(0, Math.min(100, score)),
  };
}

// ============ STATISTICAL UTILITIES ============

function normalCDF(x: number): number {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429;
  const p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x);
  const t = 1 / (1 + p * absX);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX / 2);
  return 0.5 * (1 + sign * y);
}

function chiSquaredCDF(x: number, k: number): number {
  if (x <= 0) return 0;
  // Approximation using Wilson-Hilferty
  const z = Math.pow(x / k, 1 / 3) - (1 - 2 / (9 * k));
  const denom = Math.sqrt(2 / (9 * k));
  return normalCDF(z / denom);
}
