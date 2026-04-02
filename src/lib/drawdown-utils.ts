// ============ DRAWDOWN & RETURN ANALYSIS UTILITIES ============

import type { TradeOrder, DailyEquityPoint } from './binary-parser';

export interface DrawdownPeriod {
  startDate: number;
  endDate: number;
  recoveryDate: number | null;
  peakEquity: number;
  troughEquity: number;
  drawdownPct: number;
  drawdownAbs: number;
  durationDays: number;
  recoveryDays: number | null;
  isRecovered: boolean;
}

export interface DrawdownAnalysis {
  maxDrawdownPct: number;
  maxDrawdownAbs: number;
  maxDrawdownDuration: number; // days
  avgDrawdownPct: number;
  recoveryFactor: number;
  calmarRatio: number;
  underwaterCurve: { date: string; drawdown: number }[];
  drawdownPeriods: DrawdownPeriod[];
  monthlyReturns: MonthlyReturn[];
  yearlyReturns: { year: number; totalReturn: number }[];
}

export interface MonthlyReturn {
  year: number;
  month: number;
  returnPct: number;
  label: string;
}

const MS_PER_DAY = 86400000;

export function analyzeDrawdowns(
  trades: TradeOrder[],
  equityCurve: DailyEquityPoint[],
  initialCapital: number
): DrawdownAnalysis {
  // Build equity series from trades if no daily equity
  const equitySeries = equityCurve.length > 0
    ? equityCurve.map(p => ({ time: p.timestamp, equity: p.equity }))
    : buildEquityFromTrades(trades, initialCapital);

  if (equitySeries.length === 0) {
    return emptyAnalysis();
  }

  // Underwater curve
  let peak = equitySeries[0].equity;
  const underwaterCurve: { date: string; drawdown: number }[] = [];
  const drawdownPeriods: DrawdownPeriod[] = [];

  let currentDD: Partial<DrawdownPeriod> | null = null;

  for (const point of equitySeries) {
    if (point.equity > peak) {
      // New peak — close any active DD
      if (currentDD) {
        currentDD.recoveryDate = point.time;
        currentDD.isRecovered = true;
        currentDD.recoveryDays = Math.round((point.time - (currentDD.endDate || point.time)) / MS_PER_DAY);
        drawdownPeriods.push(currentDD as DrawdownPeriod);
        currentDD = null;
      }
      peak = point.equity;
    }

    const ddPct = peak > 0 ? ((peak - point.equity) / peak) * 100 : 0;
    const ddAbs = peak - point.equity;

    underwaterCurve.push({
      date: formatTimestamp(point.time),
      drawdown: -ddPct,
    });

    if (ddPct > 0) {
      if (!currentDD) {
        currentDD = {
          startDate: point.time,
          endDate: point.time,
          recoveryDate: null,
          peakEquity: peak,
          troughEquity: point.equity,
          drawdownPct: ddPct,
          drawdownAbs: ddAbs,
          durationDays: 0,
          recoveryDays: null,
          isRecovered: false,
        };
      }
      if (ddPct >= (currentDD.drawdownPct || 0)) {
        currentDD.troughEquity = point.equity;
        currentDD.drawdownPct = ddPct;
        currentDD.drawdownAbs = ddAbs;
        currentDD.endDate = point.time;
      }
      currentDD.durationDays = Math.round((point.time - (currentDD.startDate || point.time)) / MS_PER_DAY);
    }
  }

  // Close unclosed DD
  if (currentDD) {
    currentDD.isRecovered = false;
    drawdownPeriods.push(currentDD as DrawdownPeriod);
  }

  const maxDDPeriod = drawdownPeriods.reduce((max, p) => p.drawdownPct > (max?.drawdownPct || 0) ? p : max, drawdownPeriods[0]);

  const totalReturn = equitySeries[equitySeries.length - 1].equity - equitySeries[0].equity;
  const maxDD = maxDDPeriod?.drawdownPct || 0;
  const maxDDAbs = maxDDPeriod?.drawdownAbs || 0;
  const totalDays = (equitySeries[equitySeries.length - 1].time - equitySeries[0].time) / MS_PER_DAY;
  const years = totalDays / 365.25;
  const cagr = years > 0 ? (Math.pow(equitySeries[equitySeries.length - 1].equity / equitySeries[0].equity, 1 / years) - 1) * 100 : 0;

  const monthlyReturns = computeMonthlyReturns(equitySeries);
  const yearlyReturns = computeYearlyReturns(monthlyReturns);

  return {
    maxDrawdownPct: maxDD,
    maxDrawdownAbs: maxDDAbs,
    maxDrawdownDuration: maxDDPeriod?.durationDays || 0,
    avgDrawdownPct: drawdownPeriods.length > 0
      ? drawdownPeriods.reduce((s, p) => s + p.drawdownPct, 0) / drawdownPeriods.length
      : 0,
    recoveryFactor: maxDDAbs > 0 ? totalReturn / maxDDAbs : 0,
    calmarRatio: maxDD > 0 ? cagr / maxDD : 0,
    underwaterCurve,
    drawdownPeriods: drawdownPeriods.sort((a, b) => b.drawdownPct - a.drawdownPct).slice(0, 10),
    monthlyReturns,
    yearlyReturns,
  };
}

function buildEquityFromTrades(trades: TradeOrder[], initialCapital: number): { time: number; equity: number }[] {
  if (trades.length === 0) return [];
  const sorted = [...trades].sort((a, b) => a.closeTime - b.closeTime);
  const points = [{ time: sorted[0].fillTime, equity: initialCapital }];
  let cum = initialCapital;
  for (const t of sorted) {
    cum += t.pnlMoney;
    points.push({ time: t.closeTime, equity: cum });
  }
  return points;
}

function computeMonthlyReturns(series: { time: number; equity: number }[]): MonthlyReturn[] {
  if (series.length < 2) return [];

  const byMonth = new Map<string, { first: number; last: number }>();

  for (const p of series) {
    const d = new Date(p.time);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const entry = byMonth.get(key);
    if (!entry) {
      byMonth.set(key, { first: p.equity, last: p.equity });
    } else {
      entry.last = p.equity;
    }
  }

  const returns: MonthlyReturn[] = [];
  const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

  for (const [key, val] of byMonth) {
    const [yearStr, monthStr] = key.split('-');
    const year = parseInt(yearStr);
    const month = parseInt(monthStr);
    const ret = val.first > 0 ? ((val.last - val.first) / val.first) * 100 : 0;
    returns.push({ year, month, returnPct: ret, label: monthNames[month] });
  }

  return returns.sort((a, b) => a.year * 100 + a.month - (b.year * 100 + b.month));
}

function computeYearlyReturns(monthly: MonthlyReturn[]): { year: number; totalReturn: number }[] {
  const byYear = new Map<number, number>();
  for (const m of monthly) {
    byYear.set(m.year, (byYear.get(m.year) || 0) + m.returnPct);
  }
  return Array.from(byYear.entries()).map(([year, totalReturn]) => ({ year, totalReturn })).sort((a, b) => a.year - b.year);
}

function formatTimestamp(ts: number): string {
  if (!ts || ts < 1000000000000) return '';
  return new Date(ts).toISOString().slice(0, 10);
}

function emptyAnalysis(): DrawdownAnalysis {
  return {
    maxDrawdownPct: 0,
    maxDrawdownAbs: 0,
    maxDrawdownDuration: 0,
    avgDrawdownPct: 0,
    recoveryFactor: 0,
    calmarRatio: 0,
    underwaterCurve: [],
    drawdownPeriods: [],
    monthlyReturns: [],
    yearlyReturns: [],
  };
}

// ============ KPI ALERTS ============

export interface MetricAlert {
  metric: string;
  value: number;
  threshold: number;
  severity: 'warning' | 'danger' | 'info';
  message: string;
}

export function checkMetricAlerts(
  analysis: DrawdownAnalysis,
  edgeScore: number,
  winRate: number,
  profitFactor: number,
  trades: TradeOrder[]
): MetricAlert[] {
  const alerts: MetricAlert[] = [];

  if (analysis.maxDrawdownPct > 30) {
    alerts.push({
      metric: 'Max Drawdown',
      value: analysis.maxDrawdownPct,
      threshold: 30,
      severity: 'danger',
      message: `Drawdown máximo ${analysis.maxDrawdownPct.toFixed(1)}% excede el umbral de 30%`,
    });
  } else if (analysis.maxDrawdownPct > 20) {
    alerts.push({
      metric: 'Max Drawdown',
      value: analysis.maxDrawdownPct,
      threshold: 20,
      severity: 'warning',
      message: `Drawdown máximo ${analysis.maxDrawdownPct.toFixed(1)}% cercano al umbral`,
    });
  }

  if (analysis.recoveryFactor < 1) {
    alerts.push({
      metric: 'Recovery Factor',
      value: analysis.recoveryFactor,
      threshold: 1,
      severity: 'danger',
      message: `Factor de recuperación ${analysis.recoveryFactor.toFixed(2)} < 1.0`,
    });
  }

  if (analysis.maxDrawdownDuration > 180) {
    alerts.push({
      metric: 'DD Duration',
      value: analysis.maxDrawdownDuration,
      threshold: 180,
      severity: 'warning',
      message: `Drawdown máximo duró ${analysis.maxDrawdownDuration} días`,
    });
  }

  if (edgeScore < 35) {
    alerts.push({
      metric: 'Edge Score',
      value: edgeScore,
      threshold: 35,
      severity: 'danger',
      message: `Score ${edgeScore.toFixed(0)} indica ausencia de ventaja`,
    });
  }

  if (winRate < 40) {
    alerts.push({
      metric: 'Win Rate',
      value: winRate,
      threshold: 40,
      severity: 'warning',
      message: `Win rate ${winRate.toFixed(1)}% por debajo del 40%`,
    });
  }

  if (profitFactor < 1.2 && profitFactor > 0) {
    alerts.push({
      metric: 'Profit Factor',
      value: profitFactor,
      threshold: 1.2,
      severity: 'warning',
      message: `Profit factor ${profitFactor.toFixed(2)} bajo (< 1.2)`,
    });
  }

  if (trades.length < 100) {
    alerts.push({
      metric: 'Sample Size',
      value: trades.length,
      threshold: 100,
      severity: 'info',
      message: `Solo ${trades.length} trades — muestra pequeña`,
    });
  }

  return alerts;
}
