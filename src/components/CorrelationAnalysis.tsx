import { useMemo, useState } from 'react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip,
  CartesianGrid, ReferenceLine, Legend,
} from 'recharts';
import { motion } from 'framer-motion';
import { GitBranch } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { analyzePortfolio, type PortfolioAnalysis, type AnalysisPeriod } from '@/lib/correlation-utils';
import { CHART_COLORS, CHART_TOOLTIP_STYLE, formatNumber } from '@/lib/chart-utils';
import { THRESHOLDS } from '@/lib/thresholds';

interface EquityPoint {
  date: string;
  equity: number;
  period?: string;
}

export function CorrelationPanel() {
  const { strategies, trades: tradesMap, equityCurves, selectedStrategyIds } = useAppStore();
  const selected = strategies.filter(s => selectedStrategyIds.includes(s.id));
  const [period, setPeriod] = useState<AnalysisPeriod>('all');

  const { correlation: corrT, ui: uiT } = THRESHOLDS;

  const portfolio = useMemo<PortfolioAnalysis & { alphaDecay: any } | null>(() => {
    if (selected.length < 2) return null;
    return analyzePortfolio(
      selected.map(s => s.id),
      selected.map(s => s.name),
      tradesMap,
      equityCurves,
      selected.map(s => s.moneyManagement.initialCapital),
      period,
      selected
    ) as PortfolioAnalysis & { alphaDecay: any };
  }, [selected, tradesMap, equityCurves, period]);

  const hasOOSRanges = selected.some(s => s.oosRanges.length > 0);

  // Calculate IS and OOS equity curves separately (consecutive)
  const equityData = useMemo(() => {
    if (selected.length < 2) return { is: [], oos: [], combined: [], totalInitial: 0 };
    
    const totalInitial = selected.reduce((s, s2) => s + s2.moneyManagement.initialCapital, 0);
    
    // IS data
    const isPnL = new Map<string, number>();
    const oosPnL = new Map<string, number>();
    
    for (const s of selected) {
      const trades = tradesMap.get(s.id) || [];
      const sorted = [...trades].sort((a, b) => a.closeTime - b.closeTime);
      
      if (s.oosRanges.length > 0) {
        // Real OOS ranges
        for (const t of trades) {
          const date = new Date(t.closeTime).toISOString().slice(0, 10);
          const inOOS = s.oosRanges.some(r => {
            const start = new Date(r.dateFrom).getTime();
            const end = new Date(r.dateTo).getTime();
            return t.closeTime >= start && t.closeTime <= end;
          });
          
          if (inOOS) {
            oosPnL.set(date, (oosPnL.get(date) || 0) + t.pnlMoney);
          } else {
            isPnL.set(date, (isPnL.get(date) || 0) + t.pnlMoney);
          }
        }
      } else {
        // Synthetic: first half IS, second half OOS
        const half = Math.floor(sorted.length / 2);
        sorted.slice(0, half).forEach(t => {
          const date = new Date(t.closeTime).toISOString().slice(0, 10);
          isPnL.set(date, (isPnL.get(date) || 0) + t.pnlMoney);
        });
        sorted.slice(half).forEach(t => {
          const date = new Date(t.closeTime).toISOString().slice(0, 10);
          oosPnL.set(date, (oosPnL.get(date) || 0) + t.pnlMoney);
        });
      }
    }

    // Build IS curve (starts from initial)
    const isDates = [...isPnL.keys()].sort();
    let cumIS = totalInitial;
    const isCurve: EquityPoint[] = isDates.map(date => {
      cumIS += isPnL.get(date)!;
      return { date, equity: cumIS, period: 'IS' };
    });

    // Build OOS curve (starts from where IS ends)
    const oosDates = [...oosPnL.keys()].sort();
    let cumOOS = cumIS;
    const oosCurve: EquityPoint[] = oosDates.map(date => {
      cumOOS += oosPnL.get(date)!;
      return { date, equity: cumOOS, period: 'OOS' };
    });

    // Combined (all trades)
    const allPnL = new Map<string, number>();
    for (const s of selected) {
      const trades = tradesMap.get(s.id) || [];
      trades.forEach(t => {
        const date = new Date(t.closeTime).toISOString().slice(0, 10);
        allPnL.set(date, (allPnL.get(date) || 0) + t.pnlMoney);
      });
    }
    
    const allDates = [...allPnL.keys()].sort();
    let cumAll = totalInitial;
    const combinedCurve: EquityPoint[] = allDates.map(date => {
      cumAll += allPnL.get(date)!;
      return { date, equity: cumAll };
    });

    return { is: isCurve, oos: oosCurve, combined: combinedCurve, totalInitial };
  }, [selected, tradesMap]);

  if (!portfolio) {
    return (
      <div className="glass-card p-6 text-center text-sm text-muted-foreground">
        Selecciona al menos 2 estrategias para el análisis de correlación.
      </div>
    );
  }

  const { correlationMatrix: cm, diversificationScore, combinedEquity, combinedReturn, combinedMaxDD, metrics, alphaDecay } = portfolio;

  const getCorrColor = (val: number): string => {
    const abs = Math.abs(val);
    if (abs > corrT.highCorrelation) return val > 0 ? 'bg-destructive/30 text-destructive' : 'bg-info/30 text-info';
    if (abs > corrT.mediumCorrelation) return val > 0 ? 'bg-warning/20 text-warning' : 'bg-info/20 text-info';
    return 'bg-success/10 text-success';
  };

  const divColor = diversificationScore >= uiT.diversificationSuccess ? 'text-success' : diversificationScore >= uiT.diversificationWarning ? 'text-warning' : 'text-destructive';

  // Merge IS and OOS for chart - OOS shifted to appear after IS
  const chartData = useMemo(() => {
    if (!equityData.is || !equityData.oos) return [];
    if (period === 'is') return equityData.is;
    if (period === 'oos') return equityData.oos;
    
    // "all" - shift OOS dates to appear after IS
    const isLength = equityData.is.length;
    const result: { date: string; equity: number; period: string }[] = [];
    
    // Add IS data
    equityData.is.forEach((d, i) => {
      result.push({ date: `${i}`, equity: d.equity, period: 'IS' });
    });
    
    // Add divider
    result.push({ date: 'divider', equity: equityData.is[isLength - 1]?.equity || 0, period: 'DIVIDER' });
    
    // Add OOS data shifted by IS length
    equityData.oos.forEach((d, i) => {
      result.push({ date: `${isLength + i}`, equity: d.equity, period: 'OOS' });
    });
    
    return result;
  }, [equityData, period]);

  // Domain - use combined domain for all periods
  const domain: [number, number] = useMemo(() => {
    const allValues = [
      ...(equityData.is?.map(p => p.equity) || []),
      ...(equityData.oos?.map(p => p.equity) || [])
    ];
    const init = equityData.totalInitial || 0;
    const min = allValues.length > 0 ? Math.min(...allValues, init) : init;
    const max = allValues.length > 0 ? Math.max(...allValues) : init;
    const pad = (max - min) * 0.1;
    return [min - pad, max + pad];
  }, [equityData.is, equityData.oos, equityData.totalInitial]);

  return (
    <div className="space-y-4">
      {/* Header with period selector */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-info" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Correlación & Portfolio
            </h3>
          </div>
          {hasOOSRanges && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Período:</span>
              <select
                value={period}
                onChange={e => setPeriod(e.target.value as AnalysisPeriod)}
                className="bg-surface-2 border border-border rounded px-2 py-1 text-xs font-mono"
              >
                <option value="all">Ambos</option>
                <option value="is">IS</option>
                <option value="oos">OOS</option>
              </select>
            </div>
          )}
        </div>
        {period !== 'all' && (
          <p className="text-[10px] text-muted-foreground mt-2">
            {period === 'oos' ? 'Analizando solo trades en rangos OOS' : 'Analizando solo trades en período IS'}
          </p>
        )}
      </motion.div>

      {/* KPIs */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3 rounded bg-surface-1 text-center">
            <p className="text-[10px] text-muted-foreground uppercase">Diversificación</p>
            <p className={`text-lg font-mono font-bold ${divColor}`}>{diversificationScore}</p>
          </div>
          <div className="p-3 rounded bg-surface-1 text-center">
            <p className="text-[10px] text-muted-foreground uppercase">P&L</p>
            <p className={`text-sm font-mono font-bold ${combinedReturn >= 0 ? 'text-success' : 'text-destructive'}`}>
              ${formatNumber(combinedReturn)}
            </p>
          </div>
          <div className="p-3 rounded bg-surface-1 text-center">
            <p className="text-[10px] text-muted-foreground uppercase">Max DD</p>
            <p className={`text-sm font-mono font-bold ${combinedMaxDD > 20 ? 'text-destructive' : 'text-success'}`}>
              {combinedMaxDD.toFixed(1)}%
            </p>
          </div>
          <div className="p-3 rounded bg-surface-1 text-center">
            <p className="text-[10px] text-muted-foreground uppercase">Estrat.</p>
            <p className="text-sm font-mono font-bold text-foreground">{selected.length}</p>
          </div>
        </div>

        {/* Alpha Decay Alert */}
        {alphaDecay && (
          <div className={`mt-3 p-3 rounded ${alphaDecay.hasDecay ? 'bg-destructive/10 border border-destructive/30' : 'bg-success/10 border border-success/30'}`}>
            <p className="text-xs font-semibold">
              {alphaDecay.hasDecay ? (
                <span className="text-destructive">⚠️ Alpha Decay: {alphaDecay.decayPercent.toFixed(1)}%</span>
              ) : (
                <span className="text-success">✓ Sin Alpha Decay</span>
              )}
            </p>
            {alphaDecay.hasDecay && (
              <p className="text-[10px] text-muted-foreground mt-1">
                Causado por: <span className="text-destructive font-semibold">{alphaDecay.culpritStrategy}</span>
                <br />IS: {alphaDecay.isScore.toFixed(1)}% → OOS: {alphaDecay.oosScore.toFixed(1)}%
              </p>
            )}
          </div>
        )}

        {/* Extended metrics */}
        <div className="mt-3 pt-3 border-t border-border">
          <p className="text-[10px] text-muted-foreground uppercase mb-2">Métricas ({period.toUpperCase()})</p>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2 text-xs">
            <div className="p-2 bg-surface-1 rounded">
              <span className="text-muted-foreground">Return:</span>
              <span className={`ml-1 ${metrics.totalReturn >= 0 ? 'text-success' : 'text-destructive'}`}>
                ${formatNumber(metrics.totalReturn)}
              </span>
            </div>
            <div className="p-2 bg-surface-1 rounded">
              <span className="text-muted-foreground">Max DD:</span>
              <span className={`ml-1 ${metrics.maxDrawdown > 20 ? 'text-destructive' : 'text-success'}`}>
                {metrics.maxDrawdown.toFixed(1)}%
              </span>
            </div>
            <div className="p-2 bg-surface-1 rounded">
              <span className="text-muted-foreground">Win%:</span>
              <span className="ml-1">{(metrics.winRate * 100).toFixed(1)}%</span>
            </div>
            <div className="p-2 bg-surface-1 rounded">
              <span className="text-muted-foreground">PF:</span>
              <span className={`ml-1 ${metrics.profitFactor >= uiT.profitFactorSuccess ? 'text-success' : metrics.profitFactor >= uiT.profitFactorWarning ? 'text-warning' : 'text-destructive'}`}>
                {metrics.profitFactor.toFixed(2)}
              </span>
            </div>
            <div className="p-2 bg-surface-1 rounded">
              <span className="text-muted-foreground">CAGR:</span>
              <span className={`ml-1 ${metrics.cagr > 0 ? 'text-success' : 'text-destructive'}`}>
                {metrics.cagr.toFixed(1)}%
              </span>
            </div>
            <div className="p-2 bg-surface-1 rounded">
              <span className="text-muted-foreground">Sharpe:</span>
              <span className={`ml-1 ${metrics.sharpeRatio >= uiT.sharpeSuccess ? 'text-success' : metrics.sharpeRatio >= uiT.sharpeWarning ? 'text-warning' : 'text-destructive'}`}>
                {metrics.sharpeRatio.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Correlation Matrix */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Matriz de Correlación
        </h3>
        <div className="overflow-x-auto">
          <table className="text-[10px] font-mono">
            <thead>
              <tr>
                <th className="py-1.5 px-2 text-left" />
                {cm.strategyNames.map((n, i) => (
                  <th key={i} className="py-1.5 px-2 text-center max-w-[80px] truncate">{n.substring(0, 10)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cm.strategyNames.map((n, i) => (
                <tr key={i}>
                  <td className="py-1.5 px-2 font-semibold max-w-[80px] truncate">{n.substring(0, 10)}</td>
                  {cm.matrix[i].map((v, j) => (
                    <td key={j} className={`py-1.5 px-2 text-center rounded ${i === j ? 'bg-surface-2' : getCorrColor(v)}`}>
                      {i === j ? '1.00' : v.toFixed(2)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Equity Chart */}
      {chartData.length > 0 && equityData.is && equityData.oos && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="chart-container">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Equity Combinada {period === 'all' ? 'IS → OOS' : period.toUpperCase()}
          </h3>
          <p className="text-[10px] text-muted-foreground mb-2">
            {period === 'all' 
              ? 'Azul = IS (entrenamiento) • Amarillo = OOS (validación)'
              : period === 'is' 
                ? 'Período de entrenamiento (In-Sample)'
                : 'Período de validación (Out-of-Sample)'}
          </p>
          
          {period === 'all' ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
                <XAxis 
                  data={equityData.is}
                  dataKey="date"
                  stroke={CHART_COLORS.textDim} 
                  tick={{ fontSize: 7 }} 
                  interval={15}
                />
                <YAxis 
                  stroke={CHART_COLORS.textDim} 
                  tick={{ fontSize: 9 }} 
                  tickFormatter={v => `$${(v/1000).toFixed(0)}K`}
                  domain={domain}
                />
                <Tooltip {...CHART_TOOLTIP_STYLE} formatter={(v: number, name: string) => [`$${formatNumber(v)}`, name]} />
                <Legend />
                <Line 
                  type="monotone" 
                  data={equityData.is}
                  dataKey="equity" 
                  stroke={CHART_COLORS.info} 
                  strokeWidth={2} 
                  dot={false}
                  name="IS"
                  connectNulls={false}
                />
                <Line 
                  type="monotone" 
                  data={equityData.oos}
                  dataKey="equity" 
                  stroke={CHART_COLORS.warning} 
                  strokeWidth={3} 
                  dot={false}
                  name="OOS"
                  connectNulls={false}
                />
                {equityData.is && equityData.is.length > 0 && equityData.oos && equityData.oos.length > 0 && (
                  <ReferenceLine 
                    x={equityData.is[equityData.is.length - 1]?.date} 
                    stroke={CHART_COLORS.danger} 
                    strokeDasharray="5 5"
                    strokeWidth={1}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={period === 'is' ? (equityData.is || []) : (equityData.oos || [])}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
                <XAxis dataKey="date" stroke={CHART_COLORS.textDim} tick={{ fontSize: 8 }} interval={20} />
                <YAxis 
                  stroke={CHART_COLORS.textDim} 
                  tick={{ fontSize: 9 }} 
                  tickFormatter={v => `$${(v/1000).toFixed(0)}K`}
                  domain={domain}
                />
                <Tooltip {...CHART_TOOLTIP_STYLE} formatter={(v: number) => [`$${formatNumber(v)}`, 'Equity']} />
                <Line 
                  type="monotone" 
                  dataKey="equity" 
                  stroke={period === 'is' ? CHART_COLORS.info : CHART_COLORS.warning}
                  strokeWidth={2} 
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </motion.div>
      )}
    </div>
  );
}
