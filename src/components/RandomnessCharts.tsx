import { useMemo } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip,
  CartesianGrid, Cell, ReferenceLine, ScatterChart, Scatter, Line,
  ComposedChart,
} from 'recharts';
import { motion } from 'framer-motion';
import { useAppStore } from '@/lib/store';
import { analyzeRandomness, type RandomnessAnalysis } from '@/lib/randomness-tests';
import { CHART_COLORS, CHART_TOOLTIP_STYLE } from '@/lib/chart-utils';

function StatusBadge({ pass, label }: { pass: boolean; label: string }) {
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
      pass ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive'
    }`}>
      {label}
    </span>
  );
}

export function RandomnessPanel() {
  const { strategies, trades: tradesMap, selectedStrategyIds } = useAppStore();
  const strategy = strategies.find(s => selectedStrategyIds.includes(s.id));
  const trades = strategy ? tradesMap.get(strategy.id) : undefined;

  const analysis = useMemo<RandomnessAnalysis | null>(() => {
    if (!trades?.length || trades.length < 15) return null;
    return analyzeRandomness(trades);
  }, [trades]);

  if (!analysis) return null;

  const { runsTest, autocorrelation: ac, distribution: dist } = analysis;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Tests de Aleatoriedad
          </h3>
          <span className="text-sm font-mono font-bold text-primary">
            Score: {analysis.overallRandomnessScore}/100
          </span>
        </div>
        {/* Help text */}
        <div className="text-[10px] text-muted-foreground mb-3 space-y-1">
          <p><span className="font-medium text-foreground">Runs Test:</span> Verifica si la secuencia win/loss es aleatoria o tiene patrones (z&gt;1.96 indica no-aleatorio).</p>
          <p><span className="font-medium text-foreground">Autocorrelación:</span> Mide si un trade influye en el siguiente. Coeff &gt;0.06 indica dependencia.</p>
          <p><span className="font-medium text-foreground">Distribución:</span> Los mercados no son normales. Skew + = mayores ganancias; Kurt + = colas gordas.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-3 bg-surface-1 rounded space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium">Test de Rachas</span>
              <StatusBadge pass={!runsTest.isRandom} label={runsTest.isRandom ? 'Aleatorio' : 'Patrón'} />
            </div>
            <p className="text-[10px] text-muted-foreground">{runsTest.description}</p>
            <p className="text-xs font-mono">z={runsTest.zScore.toFixed(3)} p={runsTest.pValue.toFixed(4)}</p>
          </div>
          <div className="p-3 bg-surface-1 rounded space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium">Autocorrelación</span>
              <StatusBadge pass={ac.hasSignificantLag} label={ac.hasSignificantLag ? 'Dependencia' : 'Independiente'} />
            </div>
            <p className="text-[10px] text-muted-foreground">{ac.description}</p>
          </div>
          <div className="p-3 bg-surface-1 rounded space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium">Distribución P&L</span>
              <StatusBadge pass={!dist.isNormal} label={dist.isNormal ? 'Normal' : 'No Normal'} />
            </div>
            <p className="text-[10px] text-muted-foreground">{dist.description}</p>
            <p className="text-xs font-mono">Asim: {dist.skewness.toFixed(3)} Kurt: {dist.kurtosis.toFixed(3)}</p>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Autocorrelation Chart */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="chart-container">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
            Autocorrelación de Retornos
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={ac.lags.map((lag, i) => ({ lag, coeff: ac.coefficients[i] }))}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
              <XAxis dataKey="lag" stroke={CHART_COLORS.textDim} tick={{ fontSize: 10 }} label={{ value: 'Lag', position: 'bottom', fontSize: 10, fill: CHART_COLORS.textDim }} />
              <YAxis stroke={CHART_COLORS.textDim} tick={{ fontSize: 10 }} />
              <Tooltip {...CHART_TOOLTIP_STYLE} />
              <ReferenceLine y={ac.significanceThreshold} stroke={CHART_COLORS.danger} strokeDasharray="3 3" />
              <ReferenceLine y={-ac.significanceThreshold} stroke={CHART_COLORS.danger} strokeDasharray="3 3" />
              <ReferenceLine y={0} stroke={CHART_COLORS.muted} />
              <Bar dataKey="coeff" radius={[2, 2, 0, 0]}>
                {ac.coefficients.map((c, i) => (
                  <Cell key={i} fill={Math.abs(c) > ac.significanceThreshold ? CHART_COLORS.accent : CHART_COLORS.primary} fillOpacity={0.7} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* P&L Distribution Histogram */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="chart-container">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
            Distribución P&L vs Normal
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={dist.histogram}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
              <XAxis dataKey="bin" stroke={CHART_COLORS.textDim} tick={{ fontSize: 9 }} interval={Math.max(1, Math.floor(dist.histogram.length / 8))} />
              <YAxis stroke={CHART_COLORS.textDim} tick={{ fontSize: 10 }} />
              <Tooltip {...CHART_TOOLTIP_STYLE} />
              <Bar dataKey="count" name="Observado" fill={CHART_COLORS.primary} fillOpacity={0.6} radius={[2, 2, 0, 0]} />
              <Line type="monotone" dataKey="normalExpected" name="Normal esperada" stroke={CHART_COLORS.accent} strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </motion.div>
      </div>
    </div>
  );
}
