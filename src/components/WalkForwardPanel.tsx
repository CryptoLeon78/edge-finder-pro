import { useMemo, useState } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip,
  CartesianGrid, ReferenceLine, Cell,
} from 'recharts';
import { motion } from 'framer-motion';
import { Sliders } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { runWalkForward, type WalkForwardResult } from '@/lib/walk-forward';
import { CHART_COLORS, CHART_TOOLTIP_STYLE, formatNumber } from '@/lib/chart-utils';

export function WalkForwardPanel() {
  const { strategies, trades: tradesMap, selectedStrategyIds } = useAppStore();
  const strategy = strategies.find(s => selectedStrategyIds.includes(s.id));
  const trades = strategy ? tradesMap.get(strategy.id) : undefined;

  const [numWindows, setNumWindows] = useState(5);
  const [oosRatio, setOosRatio] = useState(0.3);

  const result = useMemo<WalkForwardResult | null>(() => {
    if (!trades?.length || trades.length < 30) return null;
    return runWalkForward(trades, numWindows, oosRatio);
  }, [trades, numWindows, oosRatio]);

  if (!result || result.windows.length === 0) return null;

  const chartData = result.windows.map(w => ({
    window: `W${w.windowIndex}`,
    IS: w.isPnl,
    OOS: w.oosPnl,
    degradation: w.degradation * 100,
  }));

  const formatDate = (ts: number) => {
    if (!ts || ts < 1e12) return '—';
    return new Date(ts).toISOString().slice(0, 10);
  };

  return (
    <div className="space-y-4">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-info" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Walk-Forward Analysis
            </h3>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <label className="flex items-center gap-1.5">
              <span className="text-muted-foreground">Ventanas:</span>
              <select
                value={numWindows}
                onChange={e => setNumWindows(Number(e.target.value))}
                className="bg-surface-2 border border-border rounded px-2 py-1 text-xs font-mono"
              >
                {[3, 4, 5, 6, 8, 10].map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-1.5">
              <span className="text-muted-foreground">OOS%:</span>
              <select
                value={oosRatio}
                onChange={e => setOosRatio(Number(e.target.value))}
                className="bg-surface-2 border border-border rounded px-2 py-1 text-xs font-mono"
              >
                {[0.2, 0.25, 0.3, 0.35, 0.4].map(r => (
                  <option key={r} value={r}>{(r * 100).toFixed(0)}%</option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {/* Help text */}
        <div className="text-[10px] text-muted-foreground space-y-1 pt-2 border-t border-border">
          <p><span className="font-medium text-foreground">Walk-Forward:</span> Valida la estrategia dividiendo el historial en ventanas IS/OOS sucesivas. Simula cómo habría funcionado en el futuro.</p>
          <p><span className="font-medium text-foreground">Degradación:</span> Diferencia entre rendimiento IS y OOS. &lt;20% es aceptable, &gt;50% indica overfitting.</p>
        </div>

        {/* KPI Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'OOS Efficiency', value: `${result.oosEfficiency.toFixed(0)}%`, danger: result.oosEfficiency < 50 },
            { label: 'Avg Degradation', value: `${(result.avgDegradation * 100).toFixed(1)}%`, danger: result.avgDegradation < 0.3 },
            { label: 'Consistency', value: `${result.consistency.toFixed(0)}%`, danger: result.consistency < 50 },
            { label: 'OOS P&L Total', value: `$${formatNumber(result.totalOOSPnl)}`, danger: result.totalOOSPnl < 0 },
          ].map((m, i) => (
            <div key={i} className={`p-3 rounded text-center ${m.danger ? 'bg-destructive/10 border border-destructive/20' : 'bg-surface-1'}`}>
              <p className="text-[10px] text-muted-foreground uppercase">{m.label}</p>
              <p className={`text-sm font-mono font-bold mt-0.5 ${m.danger ? 'text-destructive' : 'text-foreground'}`}>{m.value}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* IS vs OOS bar chart */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="chart-container">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
          IS vs OOS P&L por Ventana
        </h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
            <XAxis dataKey="window" stroke={CHART_COLORS.textDim} tick={{ fontSize: 10 }} />
            <YAxis stroke={CHART_COLORS.textDim} tick={{ fontSize: 10 }} tickFormatter={v => formatNumber(v)} />
            <Tooltip {...CHART_TOOLTIP_STYLE} formatter={(v: number, name: string) => [`$${formatNumber(v)}`, name]} />
            <ReferenceLine y={0} stroke={CHART_COLORS.muted} />
            <Bar dataKey="IS" fill={CHART_COLORS.primary} fillOpacity={0.7} radius={[3, 3, 0, 0]} />
            <Bar dataKey="OOS" radius={[3, 3, 0, 0]}>
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.OOS >= 0 ? CHART_COLORS.primary : CHART_COLORS.danger} fillOpacity={0.5} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Detail table */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Detalle por Ventana
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left py-1.5 px-2 text-muted-foreground">#</th>
                <th className="text-left py-1.5 px-2 text-muted-foreground">IS Periodo</th>
                <th className="text-left py-1.5 px-2 text-muted-foreground">OOS Periodo</th>
                <th className="text-left py-1.5 px-2 text-muted-foreground">IS Trades</th>
                <th className="text-left py-1.5 px-2 text-muted-foreground">OOS Trades</th>
                <th className="text-left py-1.5 px-2 text-muted-foreground">IS WR%</th>
                <th className="text-left py-1.5 px-2 text-muted-foreground">OOS WR%</th>
                <th className="text-left py-1.5 px-2 text-muted-foreground">IS P&L</th>
                <th className="text-left py-1.5 px-2 text-muted-foreground">OOS P&L</th>
                <th className="text-left py-1.5 px-2 text-muted-foreground">Deg%</th>
              </tr>
            </thead>
            <tbody>
              {result.windows.map(w => (
                <tr key={w.windowIndex} className="border-b border-border/20">
                  <td className="py-1.5 px-2">{w.windowIndex}</td>
                  <td className="py-1.5 px-2 text-muted-foreground">{formatDate(w.isStart)}→{formatDate(w.isEnd)}</td>
                  <td className="py-1.5 px-2 text-muted-foreground">{formatDate(w.oosStart)}→{formatDate(w.oosEnd)}</td>
                  <td className="py-1.5 px-2">{w.isTrades}</td>
                  <td className="py-1.5 px-2">{w.oosTrades}</td>
                  <td className="py-1.5 px-2">{w.isWinRate.toFixed(1)}</td>
                  <td className={`py-1.5 px-2 ${w.oosWinRate >= w.isWinRate * 0.8 ? 'text-success' : 'text-destructive'}`}>
                    {w.oosWinRate.toFixed(1)}
                  </td>
                  <td className={`py-1.5 px-2 ${w.isPnl >= 0 ? 'text-success' : 'text-destructive'}`}>
                    ${formatNumber(w.isPnl)}
                  </td>
                  <td className={`py-1.5 px-2 ${w.oosPnl >= 0 ? 'text-success' : 'text-destructive'}`}>
                    ${formatNumber(w.oosPnl)}
                  </td>
                  <td className={`py-1.5 px-2 ${w.degradation > 0.5 ? 'text-success' : 'text-destructive'}`}>
                    {(w.degradation * 100).toFixed(0)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
