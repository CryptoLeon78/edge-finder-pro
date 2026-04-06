import { motion } from 'framer-motion';
import { useAppStore } from '@/lib/store';

export function StrategyDetails() {
  const { strategies, selectedStrategyIds } = useAppStore();
  const selected = strategies.filter(s => selectedStrategyIds.includes(s.id));

  if (selected.length === 0) return null;

  const strategy = selected[0];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-4 space-y-4"
    >
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Lógica de la Estrategia
      </h3>

      {/* Help text */}
      <div className="text-[10px] text-muted-foreground space-y-1">
        <p>Detalles técnicos de la estrategia: señales, reglas de entrada/salida, indicadores y parámetros.</p>
      </div>

      {/* Signals */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2">Señales</p>
        <div className="space-y-1">
          {strategy.rules.signals.filter(s => s.indicatorKey !== 'Boolean').map((signal, i) => (
            <div key={i} className="flex items-center gap-2 p-2 bg-surface-1 rounded text-xs font-mono">
              <span className="text-primary">{signal.indicatorName}</span>
              <span className="text-muted-foreground">{signal.displayFormula}</span>
            </div>
          ))}
          {strategy.rules.signals.filter(s => s.indicatorKey !== 'Boolean').length === 0 && (
            <p className="text-xs text-muted-foreground italic">Solo condiciones booleanas</p>
          )}
        </div>
      </div>

      {/* Entry Rules */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2">Reglas de Entrada</p>
        <div className="space-y-1">
          {strategy.rules.entryRules.map((rule, i) => (
            <div key={i} className="p-2 bg-surface-1 rounded">
              <div className="flex items-center gap-2">
                <span className={`text-xs px-1.5 py-0.5 rounded font-mono ${
                  rule.direction === 'long' ? 'bg-success/20 text-success' :
                  rule.direction === 'short' ? 'bg-destructive/20 text-destructive' :
                  'bg-info/20 text-info'
                }`}>
                  {rule.direction.toUpperCase()}
                </span>
                <span className="text-xs font-medium">{rule.name}</span>
                <span className="text-xs text-muted-foreground font-mono">{rule.orderType}</span>
              </div>
              {rule.indicators.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {rule.indicators.map((ind, j) => (
                    <span key={j} className="text-xs px-1.5 py-0.5 bg-surface-2 rounded text-muted-foreground">
                      {ind}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* OOS Ranges */}
      {strategy.oosRanges.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">
            Periodos Out-of-Sample ({strategy.oosRanges.length})
          </p>
          <div className="grid grid-cols-2 gap-1">
            {strategy.oosRanges.map((range, i) => (
              <div key={i} className="p-2 bg-surface-1 rounded text-xs font-mono text-muted-foreground">
                {range.dateFrom} → {range.dateTo}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* App Version */}
      <div className="pt-2 border-t border-border/50">
        <p className="text-xs text-muted-foreground">
          {strategy.appVersion} • Motor: {strategy.engine}
        </p>
      </div>
    </motion.div>
  );
}
