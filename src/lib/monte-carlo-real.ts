// ============ ADVANCED MONTE CARLO & MATHEMATICAL EXPECTANCY ============
// All calculations based on real trades - no hardcoded values

import type { TradeOrder } from './binary-parser';

// ============ TYPES ============

export interface PermutationMCResult {
  iterations: number;
  originalFinalEquity: number;
  originalMaxDD: number;
  originalSharpe: number;
  permutedEquities: number[][]; // subset for charting
  percentileBetterEquity: number;
  percentileBetterDD: number;
  percentileBetterSharpe: number;
  pValueEquity: number;
  pValueDD: number;
  pValueSharpe: number;
  randomFinalEquities: number[];
  confidenceInterval95: [number, number];
  confidenceInterval99: [number, number];
}

export interface ExpectancyAnalysis {
  expectancy: number; // E = W*avgWin - L*avgLoss
  expectancyPerUnit: number; // per-dollar-risked
  winRate: number;
  lossRate: number;
  avgWin: number;
  avgLoss: number;
  medianWin: number;
  medianLoss: number;
  largestWin: number;
  largestLoss: number;
  rewardRiskRatio: number; // avgWin / avgLoss
  payoffRatio: number; // same as R:R
  kellyCriterion: number; // optimal fraction
  kellyHalf: number; // half-Kelly (conservative)
  kellyQuarter: number;
  profitFactor: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  breakEvenTrades: number;
}

export interface RuinSimulationResult {
  probabilityOfRuin: number; // 0-1
  iterations: number;
  ruinThreshold: number; // % of capital considered ruin
  avgTradesBeforeRuin: number;
  survivalRate: number;
  medianFinalEquity: number;
  equityDistribution: { bucket: string; count: number }[];
  ruinPaths: number[][]; // subset of paths that hit ruin
  survivePaths: number[][]; // subset of surviving paths
}

// ============ PERMUTATION-BASED MONTE CARLO ============

export function runPermutationMC(
  trades: TradeOrder[],
  initialCapital: number,
  iterations = 2000,
  chartPaths = 30
): PermutationMCResult {
  if (trades.length < 5) {
    return emptyMCResult(iterations);
  }

  const pnls = trades.map(t => t.pnlMoney);
  
  // Original metrics
  const originalCurve = buildCurveFromPnls(pnls, initialCapital);
  const originalFinalEquity = originalCurve[originalCurve.length - 1];
  const originalMaxDD = calcMaxDrawdown(originalCurve);
  const originalSharpe = calcSharpe(pnls);

  // Permutation test: shuffle trade order
  const permutedEquities: number[][] = [];
  const randomFinalEquities: number[] = [];
  const randomMaxDDs: number[] = [];
  const randomSharpes: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const shuffled = fisherYatesShuffle([...pnls]);
    const curve = buildCurveFromPnls(shuffled, initialCapital);
    const finalEq = curve[curve.length - 1];
    
    randomFinalEquities.push(finalEq);
    randomMaxDDs.push(calcMaxDrawdown(curve));
    randomSharpes.push(calcSharpe(shuffled));

    if (i < chartPaths) {
      // Downsample for charting
      permutedEquities.push(downsampleCurve(curve, 100));
    }
  }

  const percentileBetterEquity = percentileRank(randomFinalEquities, originalFinalEquity);
  const percentileBetterDD = 100 - percentileRank(randomMaxDDs, originalMaxDD); // lower DD is better
  const percentileBetterSharpe = percentileRank(randomSharpes, originalSharpe);

  // Confidence intervals on final equity
  const sortedEquities = [...randomFinalEquities].sort((a, b) => a - b);
  const ci95: [number, number] = [
    sortedEquities[Math.floor(iterations * 0.025)],
    sortedEquities[Math.floor(iterations * 0.975)],
  ];
  const ci99: [number, number] = [
    sortedEquities[Math.floor(iterations * 0.005)],
    sortedEquities[Math.floor(iterations * 0.995)],
  ];

  return {
    iterations,
    originalFinalEquity,
    originalMaxDD,
    originalSharpe,
    permutedEquities,
    percentileBetterEquity,
    percentileBetterDD,
    percentileBetterSharpe,
    pValueEquity: 1 - percentileBetterEquity / 100,
    pValueDD: 1 - percentileBetterDD / 100,
    pValueSharpe: 1 - percentileBetterSharpe / 100,
    randomFinalEquities,
    confidenceInterval95: ci95,
    confidenceInterval99: ci99,
  };
}

// ============ MATHEMATICAL EXPECTANCY ============

export function analyzeExpectancy(trades: TradeOrder[]): ExpectancyAnalysis {
  if (trades.length === 0) return emptyExpectancy();

  const wins = trades.filter(t => t.pnlMoney > 0);
  const losses = trades.filter(t => t.pnlMoney < 0);
  const breakEvens = trades.filter(t => t.pnlMoney === 0);

  const winRate = wins.length / trades.length;
  const lossRate = losses.length / trades.length;

  const avgWin = wins.length > 0 ? mean(wins.map(t => t.pnlMoney)) : 0;
  const avgLoss = losses.length > 0 ? Math.abs(mean(losses.map(t => t.pnlMoney))) : 0;

  const medianWin = wins.length > 0 ? median(wins.map(t => t.pnlMoney)) : 0;
  const medianLoss = losses.length > 0 ? Math.abs(median(losses.map(t => t.pnlMoney))) : 0;

  const largestWin = wins.length > 0 ? Math.max(...wins.map(t => t.pnlMoney)) : 0;
  const largestLoss = losses.length > 0 ? Math.min(...losses.map(t => t.pnlMoney)) : 0;

  const rewardRiskRatio = avgLoss > 0 ? avgWin / avgLoss : 0;
  const expectancy = winRate * avgWin - lossRate * avgLoss;
  const expectancyPerUnit = avgLoss > 0 ? expectancy / avgLoss : 0;

  // Kelly Criterion: f* = (p*b - q) / b where p=winRate, q=lossRate, b=R:R
  const kelly = rewardRiskRatio > 0
    ? (winRate * rewardRiskRatio - lossRate) / rewardRiskRatio
    : 0;

  const totalWinMoney = wins.reduce((s, t) => s + t.pnlMoney, 0);
  const totalLossMoney = losses.reduce((s, t) => s + Math.abs(t.pnlMoney), 0);
  const profitFactor = totalLossMoney > 0 ? totalWinMoney / totalLossMoney : totalWinMoney > 0 ? Infinity : 0;

  return {
    expectancy,
    expectancyPerUnit,
    winRate,
    lossRate,
    avgWin,
    avgLoss,
    medianWin,
    medianLoss,
    largestWin,
    largestLoss,
    rewardRiskRatio,
    payoffRatio: rewardRiskRatio,
    kellyCriterion: Math.max(0, kelly),
    kellyHalf: Math.max(0, kelly / 2),
    kellyQuarter: Math.max(0, kelly / 4),
    profitFactor,
    totalTrades: trades.length,
    winningTrades: wins.length,
    losingTrades: losses.length,
    breakEvenTrades: breakEvens.length,
  };
}

// ============ RUIN SIMULATION ============

export function simulateRuin(
  trades: TradeOrder[],
  initialCapital: number,
  ruinThresholdPct = 0.5, // 50% drawdown = ruin
  iterations = 5000,
  tradeHorizon?: number,
  chartPaths = 20
): RuinSimulationResult {
  if (trades.length < 5) return emptyRuinResult(iterations, ruinThresholdPct);

  const pnls = trades.map(t => t.pnlMoney);
  const horizon = tradeHorizon || pnls.length * 3; // simulate 3x the history
  const ruinLevel = initialCapital * (1 - ruinThresholdPct);

  let ruinCount = 0;
  let totalTradesBeforeRuin = 0;
  const finalEquities: number[] = [];
  const ruinPaths: number[][] = [];
  const survivePaths: number[][] = [];

  for (let i = 0; i < iterations; i++) {
    let equity = initialCapital;
    const path: number[] = [equity];
    let ruined = false;

    for (let t = 0; t < horizon; t++) {
      // Sample with replacement from actual trades
      const pnl = pnls[Math.floor(Math.random() * pnls.length)];
      equity += pnl;
      
      if (i < chartPaths) path.push(equity);

      if (equity <= ruinLevel) {
        ruined = true;
        ruinCount++;
        totalTradesBeforeRuin += t + 1;
        if (ruinPaths.length < 10) ruinPaths.push(downsampleCurve(path, 80));
        break;
      }
    }

    finalEquities.push(equity);
    if (!ruined && survivePaths.length < 10 && i < chartPaths) {
      survivePaths.push(downsampleCurve(path, 80));
    }
  }

  // Equity distribution histogram
  const sorted = [...finalEquities].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const bucketCount = 20;
  const bucketWidth = (max - min) / bucketCount || 1;
  const equityDistribution = Array.from({ length: bucketCount }, (_, i) => {
    const lo = min + i * bucketWidth;
    const hi = lo + bucketWidth;
    const count = finalEquities.filter(v => v >= lo && (i === bucketCount - 1 ? v <= hi : v < hi)).length;
    return { bucket: `${(lo / 1000).toFixed(0)}K`, count };
  });

  return {
    probabilityOfRuin: ruinCount / iterations,
    iterations,
    ruinThreshold: ruinThresholdPct,
    avgTradesBeforeRuin: ruinCount > 0 ? totalTradesBeforeRuin / ruinCount : horizon,
    survivalRate: 1 - ruinCount / iterations,
    medianFinalEquity: sorted[Math.floor(iterations / 2)],
    equityDistribution,
    ruinPaths,
    survivePaths,
  };
}

// ============ UTILITIES ============

function buildCurveFromPnls(pnls: number[], initial: number): number[] {
  const curve = [initial];
  let eq = initial;
  for (const pnl of pnls) {
    eq += pnl;
    curve.push(eq);
  }
  return curve;
}

function calcMaxDrawdown(curve: number[]): number {
  let peak = curve[0];
  let maxDD = 0;
  for (const eq of curve) {
    if (eq > peak) peak = eq;
    const dd = (peak - eq) / peak;
    if (dd > maxDD) maxDD = dd;
  }
  return maxDD;
}

function calcSharpe(returns: number[]): number {
  if (returns.length < 2) return 0;
  const m = mean(returns);
  const s = stdDev(returns);
  // Use sqrt(N) where N = number of trades as annualization proxy
  // This gives a per-trade Sharpe scaled by sample size
  return s > 0 ? (m / s) * Math.sqrt(returns.length) : 0;
}

function fisherYatesShuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function percentileRank(distribution: number[], value: number): number {
  const count = distribution.filter(v => value > v).length;
  return (count / distribution.length) * 100;
}

function downsampleCurve(curve: number[], maxPoints: number): number[] {
  if (curve.length <= maxPoints) return curve;
  const step = curve.length / maxPoints;
  return Array.from({ length: maxPoints }, (_, i) => curve[Math.floor(i * step)]);
}

function mean(arr: number[]): number {
  return arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
}

function median(arr: number[]): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function stdDev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1));
}

function emptyMCResult(iterations: number): PermutationMCResult {
  return {
    iterations, originalFinalEquity: 0, originalMaxDD: 0, originalSharpe: 0,
    permutedEquities: [], percentileBetterEquity: 0, percentileBetterDD: 0,
    percentileBetterSharpe: 0, pValueEquity: 1, pValueDD: 1, pValueSharpe: 1,
    randomFinalEquities: [], confidenceInterval95: [0, 0], confidenceInterval99: [0, 0],
  };
}

function emptyExpectancy(): ExpectancyAnalysis {
  return {
    expectancy: 0, expectancyPerUnit: 0, winRate: 0, lossRate: 0,
    avgWin: 0, avgLoss: 0, medianWin: 0, medianLoss: 0,
    largestWin: 0, largestLoss: 0, rewardRiskRatio: 0, payoffRatio: 0,
    kellyCriterion: 0, kellyHalf: 0, kellyQuarter: 0, profitFactor: 0,
    totalTrades: 0, winningTrades: 0, losingTrades: 0, breakEvenTrades: 0,
  };
}

function emptyRuinResult(iterations: number, threshold: number): RuinSimulationResult {
  return {
    probabilityOfRuin: 0, iterations, ruinThreshold: threshold,
    avgTradesBeforeRuin: 0, survivalRate: 1, medianFinalEquity: 0,
    equityDistribution: [], ruinPaths: [], survivePaths: [],
  };
}
