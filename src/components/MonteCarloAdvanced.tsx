import { useMemo, useState } from 'react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip,
  CartesianGrid, BarChart, Bar, Cell, ReferenceLine, AreaChart, Area,
} from 'recharts';
import { motion } from 'framer-motion';
import { useAppStore } from '@/lib/store';
import {
  runPermutationMC, analyzeExpectancy, simulateRuin,
  type PermutationMCResult, type ExpectancyAnalysis, type RuinSimulationResult,
} from '@/lib/monte-carlo-real';
import { CHART_COLORS, CHART_TOOLTIP_STYLE, formatNumber } from '@/lib/chart-utils';
import { Button } from '@/components/ui/button';
import { Play, TrendingUp, AlertTriangle, Target } from 'lucide-react';

function MetricBox({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="p-3 bg-surface-1 rounded space-y-1">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`text-sm font-mono font-bold ${color || 'text-foreground'}`}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

export function MonteCarloAdvancedPanel() {
  const { strategies, trades: tradesMap, selectedStrategyIds } = useAppStore();
  const strategy = strategies.find(s => selectedStrategyIds.includes(s.id));
  const trades = strategy ? tradesMap.get(strategy.id) : undefined;

  const [mcIterations, setMcIterations] = useState(2000);
  const [ruinThreshold, setRuinThreshold] = useState(50);
  const [isRunning, setIsRunning] = useState(false);

  const [mcResult, setMcResult] = useState<PermutationMCResult | null>(null);
  const [expectancy, setExpectancy] = useState<ExpectancyAnalysis | null>(null);
  const [ruinResult, setRuinResult] = useState<RuinSimulationResult | null>(null);

  const runAnalysis = () => {
    if (!trades?.length || !strategy) return;
    setIsRunning(true);

    // Use requestAnimationFrame to not block UI
    requestAnimationFrame(() => {
      const initial = strategy.moneyManagement.initialCapital;
      const mc = runPermutationMC(trades, initial, mcIterations);
      const exp = analyzeExpectancy(trades);
      const ruin = simulateRuin(trades, initial, ruinThreshold / 100, 5000);
      setMcResult(mc);
      setExpectancy(exp);
      setRuinResult(ruin);
      setIsRunning(false);
    });
  };

  // Auto-calculate expectancy on load
  const autoExpectancy = useMemo(() => {
    if (!trades?.length) return null;
    return analyzeExpectancy(trades);
  }, [trades]);

  const displayExpectancy = expectancy || autoExpectancy;

  if (!trades?.length) {
    return (
      <div className="glass-card p-6 text-center text-muted-foreground text-sm">
        No hay trades disponibles. Carga un archivo .sqx con datos de operaciones.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Monte Carlo Avanzado — Trades Reales
            </h3>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-xs text-muted-foreground flex items-center gap-1.5">
              Iteraciones:
              <select
                value={mcIterations}
                onChange={e => setMcIterations(Number(e.target.value))}
                className="bg-surface-2 border border-border rounded px-2 py-1 text-xs font-mono"
              >
                <option value={500}>500</option>
                <option value={1000}>1,000</option>
                <option value={2000}>2,000</option>
                <option value={5000}>5,000</option>
              </select>
            </label>
            <label className="text-xs text-muted-foreground flex items-center gap-1.5">
              Ruina (%):
              <select
                value={ruinThreshold}
                onChange={e => setRuinThreshold(Number(e.target.value))}
                className="bg-surface-2 border border-border rounded px-2 py-1 text-xs font-mono"
              >
                <option value={30}>30%</option>
                <option value={50}>50%</option>
                <option value={70}>70%</option>
                <option value={90}>90%</option>
              </select>
            </label>
            <Button size="sm" onClick={runAnalysis} disabled={isRunning} className="gap-1.5">
              <Play className="w-3 h-3" />
              {isRunning ? 'Ejecutando...' : 'Ejecutar Simulación'}
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Expectancy Section - Always shown */}
      {displayExpectancy && <ExpectancySection exp={displayExpectancy} />}

      {/* MC Results */}
      {mcResult && <MCResultsSection mc={mcResult} />}

      {/* Ruin Simulation */}
      {ruinResult && <RuinSection ruin={ruinResult} />}
    </div>
  );
}

function ExpectancySection({ exp }: { exp: ExpectancyAnalysis }) {
  const kellyColor = exp.kellyCriterion > 0.25 ? 'text-warning' :
    exp.kellyCriterion > 0 ? 'text-success' : 'text-destructive';

  const expectancyColor = exp.expectancy > 0 ? 'text-success' : 'text-destructive';

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-primary" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Expectativa Matemática
        </h3>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
        <MetricBox label="Esperanza (E)" value={`$${formatNumber(exp.expectancy)}`} sub="Por trade" color={expectancyColor} />
        <MetricBox label="E/Riesgo" value={exp.expectancyPerUnit.toFixed(3)} sub="Por unidad de riesgo" color={expectancyColor} />
        <MetricBox label="Win Rate" value={`${(exp.winRate * 100).toFixed(1)}%`} sub={`${exp.winningTrades}W / ${exp.losingTrades}L`} />
        <MetricBox label="R:R Ratio" value={exp.rewardRiskRatio.toFixed(2)} sub={`Avg W: $${formatNumber(exp.avgWin)} / L: $${formatNumber(exp.avgLoss)}`} />
        <MetricBox label="Kelly Criterion" value={`${(exp.kellyCriterion * 100).toFixed(1)}%`} sub={`½K: ${(exp.kellyHalf * 100).toFixed(1)}% | ¼K: ${(exp.kellyQuarter * 100).toFixed(1)}%`} color={kellyColor} />
        <MetricBox label="Profit Factor" value={exp.profitFactor === Infinity ? '∞' : exp.profitFactor.toFixed(2)} sub={`${exp.totalTrades} trades totales`} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <MetricBox label="Mediana Ganancia" value={`$${formatNumber(exp.medianWin)}`} />
        <MetricBox label="Mediana Pérdida" value={`$${formatNumber(exp.medianLoss)}`} />
        <MetricBox label="Mayor Ganancia" value={`$${formatNumber(exp.largestWin)}`} color="text-success" />
        <MetricBox label="Mayor Pérdida" value={`$${formatNumber(exp.largestLoss)}`} color="text-destructive" />
      </div>

      {/* Kelly interpretation */}
      <div className="p-2 bg-surface-1 rounded text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">Kelly:</span>
        {exp.kellyCriterion <= 0
          ? ' La estrategia no tiene ventaja positiva. No se recomienda operar.'
          : exp.kellyCriterion > 0.25
            ? ` Alto apalancamiento (${(exp.kellyCriterion * 100).toFixed(1)}%). Se recomienda usar ½ Kelly (${(exp.kellyHalf * 100).toFixed(1)}%) o ¼ Kelly para reducir volatilidad.`
            : ` Fracción óptima: ${(exp.kellyCriterion * 100).toFixed(1)}%. Se recomienda ½ Kelly (${(exp.kellyHalf * 100).toFixed(1)}%) para mayor estabilidad.`
        }
      </div>
    </motion.div>
  );
}

function MCResultsSection({ mc }: { mc: PermutationMCResult }) {
  // Permuted equity curves chart data
  const curveData = useMemo(() => {
    const maxLen = Math.max(...mc.permutedEquities.map(c => c.length), 1);
    return Array.from({ length: maxLen }, (_, i) => {
      const point: Record<string, number> = { x: i };
      mc.permutedEquities.forEach((curve, idx) => {
        point[`p_${idx}`] = curve[i] ?? curve[curve.length - 1];
      });
      return point;
    });
  }, [mc]);

  // Distribution histogram
  const distData = useMemo(() => {
    const sorted = [...mc.randomFinalEquities].sort((a, b) => a - b);
    const bins = 30;
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const width = (max - min) / bins || 1;
    return Array.from({ length: bins }, (_, i) => {
      const lo = min + i * width;
      const hi = lo + width;
      const count = mc.randomFinalEquities.filter(v => v >= lo && (i === bins - 1 ? v <= hi : v < hi)).length;
      const isOriginal = mc.originalFinalEquity >= lo && mc.originalFinalEquity < hi;
      return { bin: `${(lo / 1000).toFixed(0)}K`, count, isOriginal };
    });
  }, [mc]);

  const eqColor = mc.pValueEquity < 0.05 ? 'text-success' : 'text-warning';
  const ddColor = mc.pValueDD < 0.05 ? 'text-success' : 'text-warning';

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-4 space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Resultados Monte Carlo — Permutación de Trades
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <MetricBox label="Percentil Equity" value={`${mc.percentileBetterEquity.toFixed(1)}%`} sub={`p=${mc.pValueEquity.toFixed(4)}`} color={eqColor} />
          <MetricBox label="Percentil Max DD" value={`${mc.percentileBetterDD.toFixed(1)}%`} sub={`p=${mc.pValueDD.toFixed(4)}`} color={ddColor} />
          <MetricBox label="Percentil Sharpe" value={`${mc.percentileBetterSharpe.toFixed(1)}%`} sub={`p=${mc.pValueSharpe.toFixed(4)}`} />
          <MetricBox label="IC 95%" value={`$${formatNumber(mc.confidenceInterval95[0])} — $${formatNumber(mc.confidenceInterval95[1])}`} sub="Intervalo de confianza" />
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Permuted curves */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="chart-container">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Curvas de Equity Permutadas
          </h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={curveData}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
              <XAxis dataKey="x" stroke={CHART_COLORS.textDim} tick={{ fontSize: 10 }} />
              <YAxis stroke={CHART_COLORS.textDim} tick={{ fontSize: 10 }} tickFormatter={v => formatNumber(v)} />
              <Tooltip {...CHART_TOOLTIP_STYLE} />
              {mc.permutedEquities.map((_, i) => (
                <Line key={`p_${i}`} dataKey={`p_${i}`} stroke={CHART_COLORS.muted} strokeWidth={0.5} strokeOpacity={0.4} dot={false} isAnimationActive={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Distribution of final equities */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="chart-container">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Distribución Equity Final (Permutaciones)
          </h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={distData}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
              <XAxis dataKey="bin" stroke={CHART_COLORS.textDim} tick={{ fontSize: 9 }} interval={Math.max(1, Math.floor(distData.length / 6))} />
              <YAxis stroke={CHART_COLORS.textDim} tick={{ fontSize: 10 }} />
              <Tooltip {...CHART_TOOLTIP_STYLE} />
              <ReferenceLine x={distData.find(d => d.isOriginal)?.bin} stroke={CHART_COLORS.primary} strokeWidth={2} label={{ value: 'Real', fill: CHART_COLORS.primary, fontSize: 10 }} />
              <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                {distData.map((entry, i) => (
                  <Cell key={i} fill={entry.isOriginal ? CHART_COLORS.primary : CHART_COLORS.muted} fillOpacity={entry.isOriginal ? 1 : 0.5} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </div>
    </>
  );
}

function RuinSection({ ruin }: { ruin: RuinSimulationResult }) {
  const ruinColor = ruin.probabilityOfRuin < 0.05 ? 'text-success' :
    ruin.probabilityOfRuin < 0.2 ? 'text-warning' : 'text-destructive';

  // Path data
  const pathData = useMemo(() => {
    const allPaths = [...ruin.survivePaths, ...ruin.ruinPaths];
    if (allPaths.length === 0) return [];
    const maxLen = Math.max(...allPaths.map(p => p.length));
    return Array.from({ length: maxLen }, (_, i) => {
      const point: Record<string, number> = { x: i };
      ruin.survivePaths.forEach((p, idx) => { point[`s_${idx}`] = p[i] ?? p[p.length - 1]; });
      ruin.ruinPaths.forEach((p, idx) => { point[`r_${idx}`] = p[i] ?? p[p.length - 1]; });
      return point;
    });
  }, [ruin]);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <div className="glass-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-warning" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Simulación de Ruina
          </h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <MetricBox label="P(Ruina)" value={`${(ruin.probabilityOfRuin * 100).toFixed(1)}%`} sub={`Umbral: ${(ruin.ruinThreshold * 100).toFixed(0)}% DD`} color={ruinColor} />
          <MetricBox label="Tasa Supervivencia" value={`${(ruin.survivalRate * 100).toFixed(1)}%`} />
          <MetricBox label="Equity Mediana Final" value={`$${formatNumber(ruin.medianFinalEquity)}`} />
          <MetricBox label="Trades Antes Ruina" value={ruin.avgTradesBeforeRuin.toFixed(0)} sub="Promedio si ruina ocurre" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Ruin paths */}
        {pathData.length > 0 && (
          <div className="chart-container">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Caminos de Simulación (Supervivencia vs Ruina)
            </h3>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={pathData}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
                <XAxis dataKey="x" stroke={CHART_COLORS.textDim} tick={{ fontSize: 10 }} />
                <YAxis stroke={CHART_COLORS.textDim} tick={{ fontSize: 10 }} tickFormatter={v => formatNumber(v)} />
                <Tooltip {...CHART_TOOLTIP_STYLE} />
                {ruin.survivePaths.map((_, i) => (
                  <Line key={`s_${i}`} dataKey={`s_${i}`} stroke={CHART_COLORS.primary} strokeWidth={0.7} strokeOpacity={0.5} dot={false} isAnimationActive={false} />
                ))}
                {ruin.ruinPaths.map((_, i) => (
                  <Line key={`r_${i}`} dataKey={`r_${i}`} stroke={CHART_COLORS.danger} strokeWidth={0.7} strokeOpacity={0.6} dot={false} isAnimationActive={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Equity distribution */}
        {ruin.equityDistribution.length > 0 && (
          <div className="chart-container">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Distribución de Equity Final
            </h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={ruin.equityDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
                <XAxis dataKey="bucket" stroke={CHART_COLORS.textDim} tick={{ fontSize: 9 }} interval={Math.max(1, Math.floor(ruin.equityDistribution.length / 6))} />
                <YAxis stroke={CHART_COLORS.textDim} tick={{ fontSize: 10 }} />
                <Tooltip {...CHART_TOOLTIP_STYLE} />
                <Bar dataKey="count" fill={CHART_COLORS.info} fillOpacity={0.6} radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </motion.div>
  );
}
