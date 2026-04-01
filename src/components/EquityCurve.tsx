import { useMemo } from 'react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip,
  CartesianGrid, ReferenceLine,
} from 'recharts';
import { motion } from 'framer-motion';
import { useAppStore } from '@/lib/store';
import { CHART_COLORS, CHART_TOOLTIP_STYLE, getStrategyColor, formatNumber } from '@/lib/chart-utils';

export function EquityCurveChart() {
  const { strategies, trades: tradesMap, equityCurves, selectedStrategyIds } = useAppStore();
  const selected = strategies.filter(s => selectedStrategyIds.includes(s.id));

  const data = useMemo(() => {
    if (selected.length === 0) return [];

    // Use dailyEquity if available, otherwise build from trades
    const firstId = selected[0].id;
    const equity = equityCurves.get(firstId);
    const trades = tradesMap.get(firstId);

    if (equity?.length) {
      return equity.map(p => ({
        date: new Date(p.timestamp).toISOString().slice(0, 10),
        equity: p.equity,
      }));
    }

    if (trades?.length) {
      const initial = selected[0].moneyManagement.initialCapital;
      let cum = initial;
      const points = [{ date: '', equity: initial }];
      for (const t of trades) {
        cum += t.pnlMoney;
        points.push({
          date: new Date(t.closeTime).toISOString().slice(0, 10),
          equity: cum,
        });
      }
      return points;
    }

    return [];
  }, [selected, tradesMap, equityCurves]);

  if (data.length === 0) return null;

  const minEquity = Math.min(...data.map(d => d.equity));
  const maxEquity = Math.max(...data.map(d => d.equity));
  const initialEquity = data[0]?.equity || 0;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="chart-container">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
        Curva de Equity Real
      </h3>
      <div className="text-xs text-muted-foreground mb-2 font-mono">
        Min: ${formatNumber(minEquity)} • Max: ${formatNumber(maxEquity)} • 
        Retorno: {((data[data.length - 1]?.equity - initialEquity) / initialEquity * 100).toFixed(1)}%
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.3} />
              <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
          <XAxis dataKey="date" stroke={CHART_COLORS.textDim} tick={{ fontSize: 9 }} interval="preserveStartEnd" />
          <YAxis stroke={CHART_COLORS.textDim} tick={{ fontSize: 10 }} tickFormatter={v => formatNumber(v)} />
          <Tooltip {...CHART_TOOLTIP_STYLE} formatter={(v: number) => [`$${formatNumber(v)}`, 'Equity']} />
          <ReferenceLine y={initialEquity} stroke={CHART_COLORS.muted} strokeDasharray="5 5" />
          <Area
            type="monotone"
            dataKey="equity"
            stroke={CHART_COLORS.primary}
            fill="url(#equityGradient)"
            strokeWidth={1.5}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </motion.div>
  );
}
