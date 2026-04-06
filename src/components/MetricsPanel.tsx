import { motion } from 'framer-motion';
import { useAppStore } from '@/lib/store';
import type { EdgeAnalysis } from '@/lib/statistics';

interface MetricCardProps {
  label: string;
  value: string;
  subValue?: string;
  status?: 'positive' | 'negative' | 'neutral';
  delay?: number;
}

function MetricCard({ label, value, subValue, status, delay = 0 }: MetricCardProps) {
  const statusClass = status === 'positive' ? 'text-success' :
    status === 'negative' ? 'text-destructive' :
    status === 'neutral' ? 'text-warning' : 'text-foreground';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="glass-card p-4"
    >
      <p className="metric-label">{label}</p>
      <p className={`metric-value mt-1 ${statusClass}`}>{value}</p>
      {subValue && <p className="text-xs text-muted-foreground mt-1">{subValue}</p>}
    </motion.div>
  );
}

export function EdgeScoreCard({ analysis }: { analysis: EdgeAnalysis }) {
  const colorClass = analysis.verdict === 'strong_edge' ? 'text-success glow-primary' :
    analysis.verdict === 'moderate_edge' ? 'text-warning glow-accent' :
    analysis.verdict === 'weak_edge' ? 'text-accent' :
    'text-destructive glow-danger';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`glass-card p-6 text-center ${colorClass}`}
    >
      <p className="metric-label">Puntuación de Ventaja</p>
      <p className="text-5xl font-bold font-mono mt-2">{analysis.overallScore.toFixed(0)}</p>
      <p className="text-sm font-semibold mt-2">{analysis.verdictLabel}</p>
      <div className="mt-4 w-full bg-surface-2 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all duration-1000 ${
            analysis.verdict === 'strong_edge' ? 'bg-success' :
            analysis.verdict === 'moderate_edge' ? 'bg-warning' :
            analysis.verdict === 'weak_edge' ? 'bg-accent' :
            'bg-destructive'
          }`}
          style={{ width: `${analysis.overallScore}%` }}
        />
      </div>
    </motion.div>
  );
}

export function MetricsGrid() {
  const { strategies, analyses, selectedStrategyIds } = useAppStore();

  const selected = strategies.filter(s => selectedStrategyIds.includes(s.id));
  if (selected.length === 0) return null;

  // Show first selected strategy's metrics
  const strategy = selected[0];
  const analysis = analyses.get(strategy.id);

  return (
    <div className="space-y-4 animate-fade-in">
      {analysis && <EdgeScoreCard analysis={analysis} />}

      {/* Help text */}
      <div className="glass-card p-3">
        <div className="text-[10px] text-muted-foreground space-y-1">
          <p><span className="font-medium text-foreground">Edge Score:</span> Puntuación 0-100 que combina Monte Carlo, Consistencia IS/OOS, Fitness y Robustez.</p>
          <p><span className="font-medium text-foreground">Fitness IS:</span> Rendimiento dentro de muestra (datos usados para desarrollar la estrategia). &gt;70% es bueno.</p>
          <p><span className="font-medium text-foreground">Fitness OOS:</span> Rendimiento fuera de muestra (datos nunca vistos). &gt;70% indica robustez real.</p>
        </div>
      </div>

      <div className="terminal-grid grid-cols-2 md:grid-cols-4">
        <MetricCard
          label="Símbolo"
          value={strategy.setup.symbol}
          subValue={strategy.setup.timeframe}
          delay={0.05}
        />
        <MetricCard
          label="Período"
          value={strategy.setup.dateFrom.split('.')[0] || '—'}
          subValue={`${strategy.setup.dateFrom} → ${strategy.setup.dateTo}`}
          delay={0.1}
        />
        <MetricCard
          label="Fitness IS"
          value={`${(strategy.fitness.IS * 100).toFixed(1)}%`}
          status={strategy.fitness.IS > 0.7 ? 'positive' : strategy.fitness.IS > 0.5 ? 'neutral' : 'negative'}
          delay={0.15}
        />
        <MetricCard
          label="Fitness OOS"
          value={`${(strategy.fitness.OOS * 100).toFixed(1)}%`}
          status={strategy.fitness.OOS > 0.7 ? 'positive' : strategy.fitness.OOS > 0.5 ? 'neutral' : 'negative'}
          delay={0.2}
        />
        <MetricCard
          label="Capital Inicial"
          value={`$${strategy.moneyManagement.initialCapital.toLocaleString()}`}
          delay={0.25}
        />
        <MetricCard
          label="MM Tipo"
          value={strategy.moneyManagement.type}
          delay={0.3}
        />
        <MetricCard
          label="Spread"
          value={`${strategy.setup.spread} pips`}
          delay={0.35}
        />
        <MetricCard
          label="Comisión"
          value={`$${strategy.setup.commission}`}
          subValue={`Swap L:${strategy.setup.swapLong} S:${strategy.setup.swapShort}`}
          delay={0.4}
        />
      </div>

      {analysis && (
        <div className="glass-card p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Componentes del Análisis
          </h3>
          <div className="space-y-3">
            {analysis.components.map((comp, i) => (
              <div key={comp.name} className="space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-medium">{comp.name}</span>
                  <span className="text-xs font-mono font-semibold">
                    {comp.score.toFixed(1)}
                  </span>
                </div>
                <div className="w-full bg-surface-2 rounded-full h-1.5">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${comp.score}%` }}
                    transition={{ delay: i * 0.08, duration: 0.5 }}
                    className={`h-1.5 rounded-full ${
                      comp.score >= 70 ? 'bg-success' :
                      comp.score >= 50 ? 'bg-warning' :
                      'bg-destructive'
                    }`}
                  />
                </div>
                <p className="text-xs text-muted-foreground">{comp.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
