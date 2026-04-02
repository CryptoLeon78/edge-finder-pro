import { useMemo } from 'react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip,
  CartesianGrid, ReferenceLine,
} from 'recharts';
import { motion } from 'framer-motion';
import { useAppStore } from '@/lib/store';
import { analyzeDrawdowns, type DrawdownAnalysis as DDAnalysis } from '@/lib/drawdown-utils';
import { CHART_COLORS, CHART_TOOLTIP_STYLE, formatNumber } from '@/lib/chart-utils';

export function DrawdownPanel() {
  const { strategies, trades: tradesMap, equityCurves, selectedStrategyIds } = useAppStore();
  const strategy = strategies.find(s => selectedStrategyIds.includes(s.id));
  const trades = strategy ? tradesMap.get(strategy.id) : undefined;
  const equity = strategy ? equityCurves.get(strategy.id) : undefined;

  const dd = useMemo<DDAnalysis | null>(() => {
    if (!strategy) return null;
    return analyzeDrawdowns(
      trades || [],
      equity || [],
      strategy.moneyManagement.initialCapital
    );
  }, [strategy, trades, equity]);

  if (!dd || (dd.underwaterCurve.length === 0 && dd.monthlyReturns.length === 0)) return null;

  return (
    <div className="space-y-4">
      {/* DD Metrics */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Análisis de Drawdown
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Max DD %', value: `${dd.maxDrawdownPct.toFixed(2)}%`, danger: dd.maxDrawdownPct > 20 },
            { label: 'Max DD $', value: `$${formatNumber(dd.maxDrawdownAbs)}`, danger: false },
            { label: 'Duración Max', value: `${dd.maxDrawdownDuration}d`, danger: dd.maxDrawdownDuration > 180 },
            { label: 'DD Promedio', value: `${dd.avgDrawdownPct.toFixed(2)}%`, danger: false },
            { label: 'Recovery Factor', value: dd.recoveryFactor.toFixed(2), danger: dd.recoveryFactor < 1 },
            { label: 'Calmar Ratio', value: dd.calmarRatio.toFixed(2), danger: dd.calmarRatio < 1 },
            { label: 'Top DD Periods', value: `${dd.drawdownPeriods.length}`, danger: false },
            { label: 'Recovered', value: `${dd.drawdownPeriods.filter(p => p.isRecovered).length}/${dd.drawdownPeriods.length}`, danger: false },
          ].map((m, i) => (
            <div key={i} className={`p-3 rounded text-center ${m.danger ? 'bg-destructive/10 border border-destructive/20' : 'bg-surface-1'}`}>
              <p className="text-[10px] text-muted-foreground uppercase">{m.label}</p>
              <p className={`text-sm font-mono font-bold mt-0.5 ${m.danger ? 'text-destructive' : 'text-foreground'}`}>{m.value}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Underwater Chart */}
      {dd.underwaterCurve.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="chart-container">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
            Underwater Equity (Drawdown)
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={dd.underwaterCurve}>
              <defs>
                <linearGradient id="ddGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART_COLORS.danger} stopOpacity={0.4} />
                  <stop offset="95%" stopColor={CHART_COLORS.danger} stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
              <XAxis dataKey="date" stroke={CHART_COLORS.textDim} tick={{ fontSize: 9 }} interval="preserveStartEnd" />
              <YAxis stroke={CHART_COLORS.textDim} tick={{ fontSize: 10 }} tickFormatter={v => `${v.toFixed(0)}%`} />
              <Tooltip {...CHART_TOOLTIP_STYLE} formatter={(v: number) => [`${v.toFixed(2)}%`, 'Drawdown']} />
              <ReferenceLine y={0} stroke={CHART_COLORS.muted} />
              <Area
                type="monotone"
                dataKey="drawdown"
                stroke={CHART_COLORS.danger}
                fill="url(#ddGradient)"
                strokeWidth={1.5}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>
      )}

      {/* Top DD Periods */}
      {dd.drawdownPeriods.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Top Periodos de Drawdown
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left py-1.5 px-2 text-muted-foreground">#</th>
                  <th className="text-left py-1.5 px-2 text-muted-foreground">DD%</th>
                  <th className="text-left py-1.5 px-2 text-muted-foreground">DD$</th>
                  <th className="text-left py-1.5 px-2 text-muted-foreground">Duración</th>
                  <th className="text-left py-1.5 px-2 text-muted-foreground">Recuperado</th>
                </tr>
              </thead>
              <tbody>
                {dd.drawdownPeriods.slice(0, 5).map((p, i) => (
                  <tr key={i} className="border-b border-border/20">
                    <td className="py-1.5 px-2">{i + 1}</td>
                    <td className="py-1.5 px-2 text-destructive">{p.drawdownPct.toFixed(2)}%</td>
                    <td className="py-1.5 px-2 text-destructive">${formatNumber(p.drawdownAbs)}</td>
                    <td className="py-1.5 px-2">{p.durationDays}d</td>
                    <td className="py-1.5 px-2">
                      <span className={p.isRecovered ? 'text-success' : 'text-warning'}>
                        {p.isRecovered ? `Sí (${p.recoveryDays}d)` : 'No'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* Monthly Returns Heatmap */}
      {dd.monthlyReturns.length > 0 && <MonthlyHeatmap returns={dd.monthlyReturns} yearlyReturns={dd.yearlyReturns} />}
    </div>
  );
}

function MonthlyHeatmap({ returns, yearlyReturns }: { returns: { year: number; month: number; returnPct: number; label: string }[]; yearlyReturns: { year: number; totalReturn: number }[] }) {
  const years = [...new Set(returns.map(r => r.year))].sort();
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

  const getColor = (val: number): string => {
    if (val > 5) return 'bg-success/40';
    if (val > 2) return 'bg-success/25';
    if (val > 0) return 'bg-success/10';
    if (val > -2) return 'bg-destructive/10';
    if (val > -5) return 'bg-destructive/25';
    return 'bg-destructive/40';
  };

  const getTextColor = (val: number): string => {
    return val >= 0 ? 'text-success' : 'text-destructive';
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        Mapa de Calor — Retornos Mensuales
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-[10px] font-mono">
          <thead>
            <tr>
              <th className="py-1 px-1.5 text-left text-muted-foreground">Año</th>
              {months.map(m => (
                <th key={m} className="py-1 px-1.5 text-center text-muted-foreground">{m}</th>
              ))}
              <th className="py-1 px-1.5 text-center text-muted-foreground font-bold">Total</th>
            </tr>
          </thead>
          <tbody>
            {years.map(year => {
              const yearly = yearlyReturns.find(y => y.year === year);
              return (
                <tr key={year}>
                  <td className="py-1 px-1.5 text-muted-foreground font-semibold">{year}</td>
                  {Array.from({ length: 12 }, (_, m) => {
                    const entry = returns.find(r => r.year === year && r.month === m);
                    if (!entry) return <td key={m} className="py-1 px-1.5" />;
                    return (
                      <td key={m} className={`py-1 px-1.5 text-center rounded ${getColor(entry.returnPct)}`}>
                        <span className={getTextColor(entry.returnPct)}>
                          {entry.returnPct >= 0 ? '+' : ''}{entry.returnPct.toFixed(1)}
                        </span>
                      </td>
                    );
                  })}
                  <td className={`py-1 px-1.5 text-center font-bold ${getTextColor(yearly?.totalReturn || 0)}`}>
                    {yearly ? `${yearly.totalReturn >= 0 ? '+' : ''}${yearly.totalReturn.toFixed(1)}%` : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
