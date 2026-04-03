import { useMemo } from 'react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip,
  CartesianGrid,
} from 'recharts';
import { motion } from 'framer-motion';
import { GitBranch } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { analyzePortfolio, type PortfolioAnalysis } from '@/lib/correlation-utils';
import { CHART_COLORS, CHART_TOOLTIP_STYLE, formatNumber } from '@/lib/chart-utils';

export function CorrelationPanel() {
  const { strategies, trades: tradesMap, equityCurves, selectedStrategyIds } = useAppStore();
  const selected = strategies.filter(s => selectedStrategyIds.includes(s.id));

  const portfolio = useMemo<PortfolioAnalysis | null>(() => {
    if (selected.length < 2) return null;
    return analyzePortfolio(
      selected.map(s => s.id),
      selected.map(s => s.name),
      tradesMap,
      equityCurves,
      selected.map(s => s.moneyManagement.initialCapital)
    );
  }, [selected, tradesMap, equityCurves]);

  if (!portfolio) {
    return (
      <div className="glass-card p-6 text-center text-sm text-muted-foreground">
        Selecciona al menos 2 estrategias para el análisis de correlación.
      </div>
    );
  }

  const { correlationMatrix: cm, diversificationScore, combinedEquity, combinedReturn, combinedMaxDD } = portfolio;

  const getCorrColor = (val: number): string => {
    const abs = Math.abs(val);
    if (abs > 0.7) return val > 0 ? 'bg-destructive/30 text-destructive' : 'bg-info/30 text-info';
    if (abs > 0.4) return val > 0 ? 'bg-warning/20 text-warning' : 'bg-info/20 text-info';
    return 'bg-success/10 text-success';
  };

  const divColor = diversificationScore >= 70 ? 'text-success' : diversificationScore >= 40 ? 'text-warning' : 'text-destructive';

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <GitBranch className="w-4 h-4 text-info" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Análisis de Correlación & Portfolio
          </h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3 rounded bg-surface-1 text-center">
            <p className="text-[10px] text-muted-foreground uppercase">Diversificación</p>
            <p className={`text-lg font-mono font-bold ${divColor}`}>{diversificationScore}</p>
          </div>
          <div className="p-3 rounded bg-surface-1 text-center">
            <p className="text-[10px] text-muted-foreground uppercase">P&L Combinado</p>
            <p className={`text-sm font-mono font-bold ${combinedReturn >= 0 ? 'text-success' : 'text-destructive'}`}>
              ${formatNumber(combinedReturn)}
            </p>
          </div>
          <div className="p-3 rounded bg-surface-1 text-center">
            <p className="text-[10px] text-muted-foreground uppercase">Max DD Portfolio</p>
            <p className={`text-sm font-mono font-bold ${combinedMaxDD > 20 ? 'text-destructive' : 'text-success'}`}>
              {combinedMaxDD.toFixed(2)}%
            </p>
          </div>
          <div className="p-3 rounded bg-surface-1 text-center">
            <p className="text-[10px] text-muted-foreground uppercase">Estrategias</p>
            <p className="text-sm font-mono font-bold text-foreground">{selected.length}</p>
          </div>
        </div>
      </motion.div>

      {/* Correlation Matrix */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Matriz de Correlación de Retornos
        </h3>
        <div className="overflow-x-auto">
          <table className="text-[10px] font-mono">
            <thead>
              <tr>
                <th className="py-1.5 px-2 text-muted-foreground text-left" />
                {cm.strategyNames.map((name, i) => (
                  <th key={i} className="py-1.5 px-2 text-muted-foreground text-center max-w-[80px] truncate">
                    {name.substring(0, 12)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cm.strategyNames.map((name, i) => (
                <tr key={i}>
                  <td className="py-1.5 px-2 text-muted-foreground font-semibold max-w-[80px] truncate">
                    {name.substring(0, 12)}
                  </td>
                  {cm.matrix[i].map((val, j) => (
                    <td key={j} className={`py-1.5 px-2 text-center rounded ${i === j ? 'bg-surface-2 text-muted-foreground' : getCorrColor(val)}`}>
                      {i === j ? '1.00' : val.toFixed(2)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex gap-4 mt-3 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1"><span className="w-3 h-2 rounded bg-destructive/30" /> Alta (+)</span>
          <span className="flex items-center gap-1"><span className="w-3 h-2 rounded bg-warning/20" /> Media</span>
          <span className="flex items-center gap-1"><span className="w-3 h-2 rounded bg-success/10" /> Baja</span>
          <span className="flex items-center gap-1"><span className="w-3 h-2 rounded bg-info/20" /> Inversa</span>
        </div>
      </motion.div>

      {/* Combined Equity */}
      {combinedEquity.length > 2 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="chart-container">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
            Equity Combinada del Portfolio
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={combinedEquity}>
              <defs>
                <linearGradient id="portfolioGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART_COLORS.info} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={CHART_COLORS.info} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
              <XAxis dataKey="date" stroke={CHART_COLORS.textDim} tick={{ fontSize: 9 }} interval="preserveStartEnd" />
              <YAxis stroke={CHART_COLORS.textDim} tick={{ fontSize: 10 }} tickFormatter={v => formatNumber(v)} />
              <Tooltip {...CHART_TOOLTIP_STYLE} formatter={(v: number) => [`$${formatNumber(v)}`, 'Portfolio']} />
              <Area
                type="monotone"
                dataKey="equity"
                stroke={CHART_COLORS.info}
                fill="url(#portfolioGrad)"
                strokeWidth={1.5}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>
      )}
    </div>
  );
}
