// ============ CORRELATION & PORTFOLIO ANALYSIS ============

import type { TradeOrder, DailyEquityPoint } from './binary-parser';

export interface CorrelationMatrix {
  strategyIds: string[];
  strategyNames: string[];
  matrix: number[][];
}

export interface PortfolioAnalysis {
  correlationMatrix: CorrelationMatrix;
  diversificationScore: number; // 0-100, higher = better diversification
  combinedEquity: { date: string; equity: number }[];
  combinedReturn: number;
  combinedMaxDD: number;
}

/**
 * Compute Pearson correlation between two return series.
 */
function pearsonCorrelation(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 3) return 0;

  const meanA = a.slice(0, n).reduce((s, v) => s + v, 0) / n;
  const meanB = b.slice(0, n).reduce((s, v) => s + v, 0) / n;

  let cov = 0, varA = 0, varB = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    cov += da * db;
    varA += da * da;
    varB += db * db;
  }

  const denom = Math.sqrt(varA * varB);
  return denom > 0 ? cov / denom : 0;
}

/**
 * Build daily returns from trades, aligned to calendar dates.
 */
function buildDailyReturns(trades: TradeOrder[]): Map<string, number> {
  const daily = new Map<string, number>();
  for (const t of trades) {
    if (!t.closeTime || t.closeTime < 1e12) continue;
    const dateKey = new Date(t.closeTime).toISOString().slice(0, 10);
    daily.set(dateKey, (daily.get(dateKey) || 0) + t.pnlMoney);
  }
  return daily;
}

/**
 * Align two date-keyed return maps to a common date set.
 */
function alignReturns(a: Map<string, number>, b: Map<string, number>): [number[], number[]] {
  const commonDates = [...a.keys()].filter(d => b.has(d)).sort();
  return [
    commonDates.map(d => a.get(d)!),
    commonDates.map(d => b.get(d)!),
  ];
}

/**
 * Build correlation matrix for multiple strategies.
 */
export function buildCorrelationMatrix(
  strategyIds: string[],
  strategyNames: string[],
  tradesMap: Map<string, TradeOrder[]>
): CorrelationMatrix {
  const n = strategyIds.length;
  const dailyReturns = strategyIds.map(id => buildDailyReturns(tradesMap.get(id) || []));
  const matrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    matrix[i][i] = 1;
    for (let j = i + 1; j < n; j++) {
      const [a, b] = alignReturns(dailyReturns[i], dailyReturns[j]);
      const corr = pearsonCorrelation(a, b);
      matrix[i][j] = corr;
      matrix[j][i] = corr;
    }
  }

  return { strategyIds, strategyNames, matrix };
}

/**
 * Compute diversification score from correlation matrix.
 * Lower average |correlation| = higher diversification.
 */
export function computeDiversificationScore(matrix: number[][]): number {
  const n = matrix.length;
  if (n < 2) return 100;

  let sumAbsCorr = 0;
  let count = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      sumAbsCorr += Math.abs(matrix[i][j]);
      count++;
    }
  }

  const avgAbsCorr = count > 0 ? sumAbsCorr / count : 0;
  // Score: 0 correlation = 100, 1 correlation = 0
  return Math.round(Math.max(0, Math.min(100, (1 - avgAbsCorr) * 100)));
}

/**
 * Build combined portfolio equity curve (equal weight).
 */
export function buildCombinedEquity(
  strategyIds: string[],
  tradesMap: Map<string, TradeOrder[]>,
  equityCurves: Map<string, DailyEquityPoint[]>,
  initialCapitals: number[]
): { date: string; equity: number }[] {
  // Merge all daily P&L across strategies
  const dailyPnLs = new Map<string, number>();

  for (const id of strategyIds) {
    const trades = tradesMap.get(id) || [];
    for (const t of trades) {
      if (!t.closeTime || t.closeTime < 1e12) continue;
      const dateKey = new Date(t.closeTime).toISOString().slice(0, 10);
      dailyPnLs.set(dateKey, (dailyPnLs.get(dateKey) || 0) + t.pnlMoney);
    }
  }

  const totalInitial = initialCapitals.reduce((s, c) => s + c, 0);
  const dates = [...dailyPnLs.keys()].sort();
  let cumEquity = totalInitial;
  const curve: { date: string; equity: number }[] = [{ date: dates[0] || '', equity: totalInitial }];

  for (const date of dates) {
    cumEquity += dailyPnLs.get(date)!;
    curve.push({ date, equity: cumEquity });
  }

  return curve;
}

/**
 * Full portfolio analysis.
 */
export function analyzePortfolio(
  strategyIds: string[],
  strategyNames: string[],
  tradesMap: Map<string, TradeOrder[]>,
  equityCurves: Map<string, DailyEquityPoint[]>,
  initialCapitals: number[]
): PortfolioAnalysis {
  const correlationMatrix = buildCorrelationMatrix(strategyIds, strategyNames, tradesMap);
  const diversificationScore = computeDiversificationScore(correlationMatrix.matrix);
  const combinedEquity = buildCombinedEquity(strategyIds, tradesMap, equityCurves, initialCapitals);

  // Combined stats
  const combinedReturn = combinedEquity.length >= 2
    ? combinedEquity[combinedEquity.length - 1].equity - combinedEquity[0].equity
    : 0;

  let peak = combinedEquity[0]?.equity || 0;
  let maxDD = 0;
  for (const p of combinedEquity) {
    if (p.equity > peak) peak = p.equity;
    const dd = peak > 0 ? ((peak - p.equity) / peak) * 100 : 0;
    if (dd > maxDD) maxDD = dd;
  }

  return {
    correlationMatrix,
    diversificationScore,
    combinedEquity,
    combinedReturn,
    combinedMaxDD: maxDD,
  };
}
