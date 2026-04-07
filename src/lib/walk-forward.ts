// ============ WALK-FORWARD SIMULATION ============

import type { TradeOrder } from './binary-parser';
import { THRESHOLDS } from './thresholds';

export interface WFWindow {
  windowIndex: number;
  isStart: number;
  isEnd: number;
  oosStart: number;
  oosEnd: number;
  isTrades: number;
  oosTrades: number;
  isWinRate: number;
  oosWinRate: number;
  isPnl: number;
  oosPnl: number;
  isProfitFactor: number;
  oosProfitFactor: number;
  degradation: number; // OOS/IS ratio
}

export interface WalkForwardResult {
  windows: WFWindow[];
  avgDegradation: number;
  oosEfficiency: number; // % of OOS windows profitable
  consistency: number; // 0-100
  totalISPnl: number;
  totalOOSPnl: number;
}

function profitFactor(trades: TradeOrder[]): number {
  const gp = trades.filter(t => t.pnlMoney > 0).reduce((s, t) => s + t.pnlMoney, 0);
  const gl = Math.abs(trades.filter(t => t.pnlMoney < 0).reduce((s, t) => s + t.pnlMoney, 0));
  return gl > 0 ? gp / gl : gp > 0 ? 99 : 0;
}

/**
 * @param trades All trades sorted by closeTime
 * @param numWindows Number of WF windows (default 5)
 * @param oosRatio Fraction of each window used as OOS
 */
export function runWalkForward(
  trades: TradeOrder[],
  numWindows = 5,
  oosRatio = THRESHOLDS.walkForward.oosRatio
): WalkForwardResult {
  const { walkForward: t } = THRESHOLDS;
  if (trades.length < 30) {
    return { windows: [], avgDegradation: 0, oosEfficiency: 0, consistency: 0, totalISPnl: 0, totalOOSPnl: 0 };
  }

  const sorted = [...trades].sort((a, b) => a.closeTime - b.closeTime);
  const totalTrades = sorted.length;
  const windowSize = Math.floor(totalTrades / numWindows);
  const oosSize = Math.max(5, Math.floor(windowSize * oosRatio));
  const isSize = windowSize - oosSize;

  if (isSize < 10 || oosSize < 5) {
    return { windows: [], avgDegradation: 0, oosEfficiency: 0, consistency: 0, totalISPnl: 0, totalOOSPnl: 0 };
  }

  const windows: WFWindow[] = [];

  for (let w = 0; w < numWindows; w++) {
    const start = w * windowSize;
    const isEnd = start + isSize;
    const oosEnd = Math.min(start + windowSize, totalTrades);

    const isTrades = sorted.slice(start, isEnd);
    const oosTrades = sorted.slice(isEnd, oosEnd);

    if (isTrades.length < 5 || oosTrades.length < 3) continue;

    const isWins = isTrades.filter(t => t.pnlMoney > 0).length;
    const oosWins = oosTrades.filter(t => t.pnlMoney > 0).length;
    const isPnl = isTrades.reduce((s, t) => s + t.pnlMoney, 0);
    const oosPnl = oosTrades.reduce((s, t) => s + t.pnlMoney, 0);
    const isPF = profitFactor(isTrades);
    const oosPF = profitFactor(oosTrades);

    const degradation = isPnl !== 0 ? oosPnl / isPnl : 0;

    windows.push({
      windowIndex: w + 1,
      isStart: isTrades[0].closeTime,
      isEnd: isTrades[isTrades.length - 1].closeTime,
      oosStart: oosTrades[0].closeTime,
      oosEnd: oosTrades[oosTrades.length - 1].closeTime,
      isTrades: isTrades.length,
      oosTrades: oosTrades.length,
      isWinRate: isTrades.length > 0 ? (isWins / isTrades.length) * 100 : 0,
      oosWinRate: oosTrades.length > 0 ? (oosWins / oosTrades.length) * 100 : 0,
      isPnl,
      oosPnl,
      isProfitFactor: isPF,
      oosProfitFactor: oosPF,
      degradation,
    });
  }

  const profitableOOS = windows.filter(w => w.oosPnl > 0).length;
  const degradations = windows.map(w => w.degradation).filter(d => isFinite(d) && !isNaN(d));
  const avgDeg = degradations.length > 0 ? degradations.reduce((s, d) => s + d, 0) / degradations.length : 0;

  // Consistency: how many OOS windows maintain >50% of IS performance
  const consistentWindows = windows.filter(w => w.degradation > THRESHOLDS.walkForward.degradationThreshold).length;
  const consistency = windows.length > 0 ? (consistentWindows / windows.length) * 100 : 0;

  return {
    windows,
    avgDegradation: avgDeg,
    oosEfficiency: windows.length > 0 ? (profitableOOS / windows.length) * 100 : 0,
    consistency,
    totalISPnl: windows.reduce((s, w) => s + w.isPnl, 0),
    totalOOSPnl: windows.reduce((s, w) => s + w.oosPnl, 0),
  };
}
