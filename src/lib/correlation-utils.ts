// ============ CORRELATION & PORTFOLIO ANALYSIS ============

import type { TradeOrder, DailyEquityPoint } from './binary-parser';
import type { SQXStrategy } from './sqx-parser';

export interface CorrelationMatrix {
  strategyIds: string[];
  strategyNames: string[];
  matrix: number[][];
}

export interface PortfolioMetrics {
  totalReturn: number;
  maxDrawdown: number;
  winRate: number;
  profitFactor: number;
  totalTrades: number;
  cagr: number;
  sharpeRatio: number;
  profitFactor2: number;
}

export interface AlphaDecayAnalysis {
  hasDecay: boolean;
  decayPercent: number;
  culpritStrategy: string | null;
  culpritIndex: number;
  isScore: number;
  oosScore: number;
}

export interface PortfolioAnalysis {
  correlationMatrix: CorrelationMatrix;
  diversificationScore: number;
  combinedEquity: { date: string; equity: number }[];
  combinedReturn: number;
  combinedMaxDD: number;
  period: 'all' | 'is' | 'oos';
  metrics: PortfolioMetrics;
}

export type AnalysisPeriod = 'all' | 'is' | 'oos';

/**
 * Filter trades by period (IS or OOS)
 */
function filterTradesByPeriod(trades: TradeOrder[], oosRanges: { dateFrom: string; dateTo: string }[]): TradeOrder[] {
  if (oosRanges.length === 0) {
    return trades;
  }
  
  return trades.filter(t => {
    const tradeDate = t.closeTime;
    if (!tradeDate || tradeDate < 1e12) return false;
    
    const inAnyOOS = oosRanges.some(range => {
      const oosStart = new Date(range.dateFrom).getTime();
      const oosEnd = new Date(range.dateTo).getTime();
      return tradeDate >= oosStart && tradeDate <= oosEnd;
    });
    
    return inAnyOOS;
  });
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
  return Math.round(Math.max(0, Math.min(100, (1 - avgAbsCorr) * 100)));
}

/**
 * Build combined portfolio equity curve (equal weight).
 */
export function buildCombinedEquity(
  tradesMap: Map<string, TradeOrder[]>,
  initialCapitals: number[]
): { date: string; equity: number }[] {
  const dailyPnLs = new Map<string, number>();
  const strategyIds = [...tradesMap.keys()];

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
 * Calculate portfolio metrics from trades
 */
function calculateMetrics(trades: TradeOrder[], initialCapital: number): PortfolioMetrics {
  if (trades.length === 0) {
    return { totalReturn: 0, maxDrawdown: 0, winRate: 0, profitFactor: 0, totalTrades: 0, cagr: 0, sharpeRatio: 0, profitFactor2: 0 };
  }

  // Sort trades by time
  const sortedTrades = [...trades].sort((a, b) => a.closeTime - b.closeTime);
  
  const wins = trades.filter(t => t.pnlMoney > 0);
  const losses = trades.filter(t => t.pnlMoney < 0);
  const winRate = wins.length / trades.length;
  
  const grossProfit = wins.reduce((s, t) => s + t.pnlMoney, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnlMoney, 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999 : 0;
  
  const totalReturn = trades.reduce((s, t) => s + t.pnlMoney, 0);
  
  // Calculate max drawdown and returns
  let peak = initialCapital;
  let maxDD = 0;
  let equity = initialCapital;
  const dailyReturns: number[] = [];
  let lastDate = '';
  
  for (const t of sortedTrades) {
    equity += t.pnlMoney;
    if (equity > peak) peak = equity;
    const dd = (peak - equity) / peak;
    if (dd > maxDD) maxDD = dd;
    
    // Calculate daily return for Sharpe
    const tradeDate = new Date(t.closeTime).toISOString().slice(0, 10);
    if (tradeDate !== lastDate) {
      dailyReturns.push(t.pnlMoney / equity);
      lastDate = tradeDate;
    }
  }

  // Calculate CAGR
  const firstTime = sortedTrades[0]?.closeTime || Date.now();
  const lastTime = sortedTrades[sortedTrades.length - 1]?.closeTime || Date.now();
  const years = Math.max((lastTime - firstTime) / (365 * 24 * 60 * 60 * 1000), 1);
  const finalEquity = initialCapital + totalReturn;
  const cagr = (Math.pow(finalEquity / initialCapital, 1 / years) - 1) * 100;

  // Calculate Sharpe Ratio
  const avgReturn = dailyReturns.reduce((s, r) => s + r, 0) / dailyReturns.length;
  const variance = dailyReturns.reduce((s, r) => s + Math.pow(r - avgReturn, 2), 0) / dailyReturns.length;
  const stdDev = Math.sqrt(variance);
  const sharpeRatio = stdDev > 0 ? (avgReturn * 252) / (stdDev * Math.sqrt(252)) : 0;

  // Profit Factor 2 (including break-even trades)
  const breakEvens = trades.filter(t => t.pnlMoney === 0).length;
  const profitFactor2 = (grossProfit + breakEvens * Math.abs(grossLoss / losses.length)) / (grossLoss || 1);

  return {
    totalReturn,
    maxDrawdown: maxDD * 100,
    winRate,
    profitFactor,
    totalTrades: trades.length,
    cagr,
    sharpeRatio,
    profitFactor2,
  };
}

/**
 * Analyze alpha decay between IS and OOS
 */
function analyzeAlphaDecay(
  strategyIds: string[],
  strategyNames: string[],
  tradesMap: Map<string, TradeOrder[]>,
  strategies?: SQXStrategy[]
): AlphaDecayAnalysis | null {
  if (!strategies || strategyIds.length < 2) return null;

  const results: { name: string; isReturn: number; oosReturn: number; decay: number }[] = [];

  for (let i = 0; i < strategyIds.length; i++) {
    const strategy = strategies.find(s => s.id === strategyIds[i]);
    const trades = tradesMap.get(strategyIds[i]) || [];
    
    if (!strategy || trades.length === 0) continue;

    const totalReturn = trades.reduce((s, t) => s + t.pnlMoney, 0);
    const initialCapital = strategy.moneyManagement.initialCapital;
    
    // If no OOS ranges, calculate synthetic
    if (strategy.oosRanges.length === 0) {
      const halfIndex = Math.floor(trades.length / 2);
      const isTrades = trades.slice(0, halfIndex);
      const oosTrades = trades.slice(halfIndex);
      
      const isReturn = isTrades.reduce((s, t) => s + t.pnlMoney, 0) / initialCapital * 100;
      const oosReturn = oosTrades.reduce((s, t) => s + t.pnlMoney, 0) / initialCapital * 100;
      const decay = isReturn > 0 ? ((isReturn - oosReturn) / isReturn) * 100 : 0;
      
      results.push({ name: strategyNames[i], isReturn, oosReturn, decay });
    } else {
      const oosTrades = filterTradesByPeriod(trades, strategy.oosRanges);
      const isTrades = trades.filter(t => !oosTrades.includes(t));
      
      const isReturn = isTrades.reduce((s, t) => s + t.pnlMoney, 0) / initialCapital * 100;
      const oosReturn = oosTrades.reduce((s, t) => s + t.pnlMoney, 0) / initialCapital * 100;
      const decay = isReturn > 0 ? ((isReturn - oosReturn) / isReturn) * 100 : 0;
      
      results.push({ name: strategyNames[i], isReturn, oosReturn, decay });
    }
  }

  if (results.length === 0) return null;

  // Find culprit (max decay)
  const culprit = results.reduce((max, r) => r.decay > max.decay ? r : max, results[0]);
  
  const avgDecay = results.reduce((s, r) => s + r.decay, 0) / results.length;
  const avgIS = results.reduce((s, r) => s + r.isReturn, 0) / results.length;
  const avgOOS = results.reduce((s, r) => s + r.oosReturn, 0) / results.length;

  return {
    hasDecay: avgDecay > 20,
    decayPercent: avgDecay,
    culpritStrategy: culprit.name,
    culpritIndex: results.findIndex(r => r.name === culprit.name),
    isScore: avgIS,
    oosScore: avgOOS,
  };
}

/**
 * Full portfolio analysis with IS/OOS support.
 */
export function analyzePortfolio(
  strategyIds: string[],
  strategyNames: string[],
  tradesMap: Map<string, TradeOrder[]>,
  equityCurves: Map<string, DailyEquityPoint[]>,
  initialCapitals: number[],
  period: AnalysisPeriod = 'all',
  strategies?: SQXStrategy[]
): PortfolioAnalysis & { alphaDecay: AlphaDecayAnalysis | null } {
  let filteredTradesMap = new Map<string, TradeOrder[]>();
  
  if (period === 'all' || !strategies) {
    filteredTradesMap = tradesMap;
  } else {
    for (let i = 0; i < strategyIds.length; i++) {
      const strategy = strategies.find(s => s.id === strategyIds[i]);
      const trades = tradesMap.get(strategyIds[i]) || [];
      
      if (strategy && strategy.oosRanges.length > 0) {
        if (period === 'oos') {
          filteredTradesMap.set(strategyIds[i], filterTradesByPeriod(trades, strategy.oosRanges));
        } else {
          const oosTrades = filterTradesByPeriod(trades, strategy.oosRanges);
          const oosSet = new Set(oosTrades.map(t => t.orderNumber));
          filteredTradesMap.set(strategyIds[i], trades.filter(t => !oosSet.has(t.orderNumber)));
        }
      } else {
        filteredTradesMap.set(strategyIds[i], trades);
      }
    }
  }

  const correlationMatrix = buildCorrelationMatrix(strategyIds, strategyNames, filteredTradesMap);
  const diversificationScore = computeDiversificationScore(correlationMatrix.matrix);
  const combinedEquity = buildCombinedEquity(filteredTradesMap, initialCapitals);

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

  const allFilteredTrades = [...filteredTradesMap.values()].flat();
  const totalInitial = initialCapitals.reduce((s, c) => s + c, 0);
  const metrics = calculateMetrics(allFilteredTrades, totalInitial);

  // Calculate alpha decay if strategies provided
  const alphaDecay = strategies ? analyzeAlphaDecay(strategyIds, strategyNames, tradesMap, strategies) : null;

  return {
    correlationMatrix,
    diversificationScore,
    combinedEquity,
    combinedReturn,
    combinedMaxDD: maxDD,
    period,
    metrics,
    alphaDecay,
  };
}
