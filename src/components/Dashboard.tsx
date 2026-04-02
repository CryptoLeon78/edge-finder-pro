import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, AlertCircle, Info, TrendingUp, TrendingDown, Activity, BarChart3, Target, Zap } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area } from 'recharts';
import { useAppStore } from '@/lib/store';
import { analyzeDrawdowns, checkMetricAlerts, type MetricAlert } from '@/lib/drawdown-utils';
import { CHART_COLORS, getStrategyColor } from '@/lib/chart-utils';

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const chartData = data.map((v, i) => ({ i, v }));
  return (
    <ResponsiveContainer width="100%" height={32}>
      <AreaChart data={chartData} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
        <defs>
          <linearGradient id={`spark-${color.replace(/[^a-z0-9]/gi, '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.4} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="v"
          stroke={color}
          fill={`url(#spark-${color.replace(/[^a-z0-9]/gi, '')})`}
          strokeWidth={1.5}
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function AlertBadge({ alert }: { alert: MetricAlert }) {
  const Icon = alert.severity === 'danger' ? AlertCircle : alert.severity === 'warning' ? AlertTriangle : Info;
  const colorClass = alert.severity === 'danger' ? 'bg-destructive/10 text-destructive border-destructive/20'
    : alert.severity === 'warning' ? 'bg-warning/10 text-warning border-warning/20'
    : 'bg-info/10 text-info border-info/20';

  return (
    <div className={`flex items-start gap-2 p-2 rounded border text-xs ${colorClass}`}>
      <Icon className="w-3.5 h-3.5 shrink-0 mt-0.5" />
      <div>
        <span className="font-semibold">{alert.metric}:</span>{' '}
        <span className="opacity-80">{alert.message}</span>
      </div>
    </div>
  );
}

interface KPI {
  label: string;
  value: string;
  icon: typeof Activity;
  trend?: 'up' | 'down' | 'neutral';
  color: string;
}

export function DashboardSummary() {
  const { strategies, analyses, trades: tradesMap, equityCurves, selectedStrategyIds } = useAppStore();
  const selected = strategies.filter(s => selectedStrategyIds.includes(s.id));

  const dashboardData = useMemo(() => {
    if (selected.length === 0) return null;

    const strategyKPIs: { name: string; kpis: KPI[]; sparklineData: number[]; alerts: MetricAlert[]; color: string }[] = [];

    selected.forEach((s, idx) => {
      const analysis = analyses.get(s.id);
      const trades = tradesMap.get(s.id) || [];
      const equity = equityCurves.get(s.id) || [];
      const color = getStrategyColor(idx);

      const dd = analyzeDrawdowns(trades, equity, s.moneyManagement.initialCapital);
      const wins = trades.filter(t => t.pnlMoney > 0).length;
      const winRate = trades.length > 0 ? (wins / trades.length) * 100 : 0;
      const totalPnl = trades.reduce((sum, t) => sum + t.pnlMoney, 0);
      const grossProfit = trades.filter(t => t.pnlMoney > 0).reduce((sum, t) => sum + t.pnlMoney, 0);
      const grossLoss = Math.abs(trades.filter(t => t.pnlMoney < 0).reduce((sum, t) => sum + t.pnlMoney, 0));
      const pf = grossLoss > 0 ? grossProfit / grossLoss : 0;

      // Build sparkline from equity or trades
      let sparkline: number[] = [];
      if (equity.length > 0) {
        const step = Math.max(1, Math.floor(equity.length / 50));
        sparkline = equity.filter((_, i) => i % step === 0).map(p => p.equity);
      } else if (trades.length > 0) {
        let cum = s.moneyManagement.initialCapital;
        sparkline = [cum];
        for (const t of trades) {
          cum += t.pnlMoney;
          sparkline.push(cum);
        }
        if (sparkline.length > 50) {
          const step = Math.floor(sparkline.length / 50);
          sparkline = sparkline.filter((_, i) => i % step === 0);
        }
      }

      const alerts = checkMetricAlerts(dd, analysis?.overallScore || 0, winRate, pf, trades);

      const kpis: KPI[] = [
        { label: 'Edge Score', value: analysis ? analysis.overallScore.toFixed(0) : '—', icon: Target, trend: (analysis?.overallScore || 0) >= 55 ? 'up' : 'down', color: 'text-primary' },
        { label: 'P&L Total', value: `$${totalPnl.toFixed(0)}`, icon: totalPnl >= 0 ? TrendingUp : TrendingDown, trend: totalPnl >= 0 ? 'up' : 'down', color: totalPnl >= 0 ? 'text-success' : 'text-destructive' },
        { label: 'Win Rate', value: `${winRate.toFixed(1)}%`, icon: BarChart3, trend: winRate >= 50 ? 'up' : 'down', color: winRate >= 50 ? 'text-success' : 'text-warning' },
        { label: 'Max DD', value: `${dd.maxDrawdownPct.toFixed(1)}%`, icon: Activity, trend: dd.maxDrawdownPct > 20 ? 'down' : 'up', color: dd.maxDrawdownPct > 20 ? 'text-destructive' : 'text-success' },
        { label: 'Recovery', value: dd.recoveryFactor.toFixed(2), icon: Zap, trend: dd.recoveryFactor >= 2 ? 'up' : 'down', color: dd.recoveryFactor >= 2 ? 'text-success' : 'text-warning' },
        { label: 'Profit Factor', value: pf.toFixed(2), icon: BarChart3, trend: pf >= 1.5 ? 'up' : 'down', color: pf >= 1.5 ? 'text-success' : 'text-warning' },
      ];

      strategyKPIs.push({ name: s.name, kpis, sparklineData: sparkline, alerts, color });
    });

    return strategyKPIs;
  }, [selected, analyses, tradesMap, equityCurves]);

  if (!dashboardData || dashboardData.length === 0) return null;

  return (
    <div className="space-y-4">
      {dashboardData.map((strat, sIdx) => (
        <motion.div
          key={sIdx}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: sIdx * 0.1 }}
          className="glass-card p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: strat.color }} />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {strat.name.substring(0, 30)}
              </h3>
            </div>
            {strat.alerts.length > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded bg-warning/10 text-warning font-mono">
                {strat.alerts.length} alerta(s)
              </span>
            )}
          </div>

          {/* KPIs row */}
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
            {strat.kpis.map((kpi, i) => (
              <div key={i} className="p-2 bg-surface-1 rounded text-center space-y-0.5">
                <div className="flex items-center justify-center gap-1">
                  <kpi.icon className="w-3 h-3 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground">{kpi.label}</span>
                </div>
                <p className={`text-sm font-mono font-bold ${kpi.color}`}>{kpi.value}</p>
              </div>
            ))}
          </div>

          {/* Sparkline */}
          {strat.sparklineData.length > 2 && (
            <div className="px-1">
              <Sparkline data={strat.sparklineData} color={strat.color} />
            </div>
          )}

          {/* Alerts */}
          {strat.alerts.length > 0 && (
            <div className="space-y-1.5">
              {strat.alerts.map((alert, i) => (
                <AlertBadge key={i} alert={alert} />
              ))}
            </div>
          )}
        </motion.div>
      ))}
    </div>
  );
}
