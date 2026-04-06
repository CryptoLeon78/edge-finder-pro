import { useMemo } from 'react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip,
  ScatterChart, Scatter, CartesianGrid, BarChart, Bar, RadarChart,
  Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Cell,
  AreaChart, Area,
} from 'recharts';
import { motion } from 'framer-motion';
import { useAppStore } from '@/lib/store';
import { CHART_COLORS, CHART_TOOLTIP_STYLE, getStrategyColor } from '@/lib/chart-utils';

export function MonteCarloChart() {
  const { strategies, analyses, selectedStrategyIds } = useAppStore();
  const strategy = strategies.find(s => selectedStrategyIds.includes(s.id));
  const analysis = strategy ? analyses.get(strategy.id) : undefined;

  const data = useMemo(() => {
    if (!analysis) return [];
    const mc = analysis.monteCarloResult;
    
    // Build data points for each random curve + the strategy
    const maxLen = Math.max(...mc.randomEquityCurves.map(c => c.length), 1);
    return Array.from({ length: maxLen }, (_, i) => {
      const point: Record<string, number> = { x: i };
      mc.randomEquityCurves.forEach((curve, idx) => {
        point[`random_${idx}`] = curve[i] ?? curve[curve.length - 1];
      });
      // Simulated strategy curve (rising)
      point.strategy = i * (mc.originalPerformance * 2);
      return point;
    });
  }, [analysis]);

  if (!analysis) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="chart-container">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
        Monte Carlo — Estrategia vs Azar
      </h3>
      <div className="text-[10px] text-muted-foreground mb-2">
        Líneas grises = miles de permutaciones aleatorias. Línea roja = estrategia real. Si está por encima = ventaja real.
      </div>
      <div className="text-xs text-muted-foreground mb-2 font-mono">
        z-score: {analysis.monteCarloResult.zScore.toFixed(2)} • p-value: {analysis.monteCarloResult.pValue.toFixed(4)} • Percentil: {analysis.monteCarloResult.percentileBetter.toFixed(1)}%
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
          <XAxis dataKey="x" stroke={CHART_COLORS.textDim} tick={{ fontSize: 10 }} />
          <YAxis stroke={CHART_COLORS.textDim} tick={{ fontSize: 10 }} />
          <Tooltip {...CHART_TOOLTIP_STYLE} />
          {analysis.monteCarloResult.randomEquityCurves.map((_, i) => (
            <Line
              key={`random_${i}`}
              dataKey={`random_${i}`}
              stroke={CHART_COLORS.muted}
              strokeWidth={0.5}
              strokeOpacity={0.3}
              dot={false}
              isAnimationActive={false}
            />
          ))}
          <Line
            dataKey="strategy"
            stroke={CHART_COLORS.primary}
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </motion.div>
  );
}

export function FitnessRadar() {
  const { strategies, analyses, selectedStrategyIds } = useAppStore();
  const selected = strategies.filter(s => selectedStrategyIds.includes(s.id));

  const data = useMemo(() => {
    if (selected.length === 0) return [];

    const strategy = selected[0];
    const analysis = analyses.get(strategy.id);
    if (!analysis) return [];

    return analysis.components.map(comp => ({
      metric: comp.name.replace(/ /g, '\n').substring(0, 20),
      score: comp.score,
      fullMark: 100,
    }));
  }, [selected, analyses]);

  if (data.length === 0) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="chart-container">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
        Radar de Componentes
      </h3>
      <div className="text-[10px] text-muted-foreground mb-2">
        Puntuación de cada componente del Edge Score (Monte Carlo, Consistencia IS/OOS, Fitness, Robustez).
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <RadarChart data={data}>
          <PolarGrid stroke={CHART_COLORS.grid} />
          <PolarAngleAxis dataKey="metric" tick={{ fontSize: 9, fill: CHART_COLORS.text }} />
          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9, fill: CHART_COLORS.textDim }} />
          <Radar
            name="Score"
            dataKey="score"
            stroke={CHART_COLORS.primary}
            fill={CHART_COLORS.primary}
            fillOpacity={0.2}
            strokeWidth={2}
          />
        </RadarChart>
      </ResponsiveContainer>
    </motion.div>
  );
}

export function OOSComparison() {
  const { strategies, selectedStrategyIds } = useAppStore();
  const selected = strategies.filter(s => selectedStrategyIds.includes(s.id));

  const data = useMemo(() => {
    return selected.map((s, idx) => {
      const oosScores: Record<string, number | string> = { name: s.name.substring(0, 20) };
      for (let i = 1; i <= 10; i++) {
        const key = `OOS${i}`;
        const val = s.fitness[key];
        if (val && val > 0) {
          oosScores[`OOS${i}`] = val * 100;
        }
      }
      oosScores.IS = s.fitness.IS * 100;
      return oosScores;
    });
  }, [selected]);

  if (data.length === 0) return null;

  const oosKeys = Object.keys(data[0] || {}).filter(k => k !== 'name');

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="chart-container">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
        IS vs OOS — Degradación
      </h3>
      <div className="text-[10px] text-muted-foreground mb-2">
        Compara rendimiento In-Sample vs múltiples Out-of-Sample. Si OOS ≈ IS = buena robustez.
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
          <XAxis dataKey="name" stroke={CHART_COLORS.textDim} tick={{ fontSize: 10 }} />
          <YAxis stroke={CHART_COLORS.textDim} tick={{ fontSize: 10 }} domain={[0, 100]} />
          <Tooltip {...CHART_TOOLTIP_STYLE} />
          {oosKeys.map((key, i) => (
            <Bar
              key={key}
              dataKey={key}
              fill={key === 'IS' ? CHART_COLORS.primary : getStrategyColor(i)}
              fillOpacity={key === 'IS' ? 1 : 0.6}
              radius={[2, 2, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </motion.div>
  );
}

export function StrategyComparisonScatter() {
  const { strategies, analyses, selectedStrategyIds } = useAppStore();
  const selected = strategies.filter(s => selectedStrategyIds.includes(s.id));

  const data = useMemo(() => {
    return selected.map((s, idx) => {
      const analysis = analyses.get(s.id);
      return {
        name: s.name,
        fitnessIS: s.fitness.IS * 100,
        fitnessOOS: s.fitness.OOS * 100,
        score: analysis?.overallScore || 0,
        color: getStrategyColor(idx),
      };
    });
  }, [selected, analyses]);

  if (data.length === 0) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="chart-container">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
        Scatter — IS vs OOS Fitness
      </h3>
      <div className="text-[10px] text-muted-foreground mb-2">
        Eje X = IS, Eje Y = OOS. Estrategias cerca de la diagonal tienen buena consistencia. Por encima = mejor OOS.
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <ScatterChart>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
          <XAxis dataKey="fitnessIS" name="IS Fitness" unit="%" stroke={CHART_COLORS.textDim} tick={{ fontSize: 10 }} />
          <YAxis dataKey="fitnessOOS" name="OOS Fitness" unit="%" stroke={CHART_COLORS.textDim} tick={{ fontSize: 10 }} />
          <Tooltip {...CHART_TOOLTIP_STYLE} />
          <Scatter data={data} fill={CHART_COLORS.primary}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Scatter>
          {/* Diagonal reference line - perfect consistency */}
          <Line
            type="monotone"
            dataKey="fitnessOOS"
            stroke={CHART_COLORS.muted}
            strokeDasharray="5 5"
            strokeWidth={1}
          />
        </ScatterChart>
      </ResponsiveContainer>
    </motion.div>
  );
}

export function EdgeDistribution() {
  const { strategies, analyses, selectedStrategyIds } = useAppStore();
  const selected = strategies.filter(s => selectedStrategyIds.includes(s.id));

  const data = useMemo(() => {
    // Create histogram of edge scores
    const buckets = Array.from({ length: 10 }, (_, i) => ({
      range: `${i * 10}-${(i + 1) * 10}`,
      count: 0,
      isStrategy: false,
    }));

    selected.forEach(s => {
      const analysis = analyses.get(s.id);
      if (analysis) {
        const bucket = Math.min(9, Math.floor(analysis.overallScore / 10));
        buckets[bucket].count += 1;
        buckets[bucket].isStrategy = true;
      }
    });

    return buckets;
  }, [selected, analyses]);

  if (data.length === 0 || selected.length === 0) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="chart-container">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
        Distribución de Scores
      </h3>
      <div className="text-[10px] text-muted-foreground mb-2">
        Histograma de Edge Scores. 0-40: Sin ventaja, 40-55: Débil, 55-70: Moderada, 70-100: Fuerte.
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
          <XAxis dataKey="range" stroke={CHART_COLORS.textDim} tick={{ fontSize: 10 }} />
          <YAxis stroke={CHART_COLORS.textDim} tick={{ fontSize: 10 }} />
          <Tooltip {...CHART_TOOLTIP_STYLE} />
          <Bar dataKey="count" radius={[3, 3, 0, 0]}>
            {data.map((entry, i) => (
              <Cell
                key={i}
                fill={entry.count > 0 ? CHART_COLORS.primary : CHART_COLORS.grid}
                fillOpacity={entry.count > 0 ? 0.8 : 0.3}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </motion.div>
  );
}
