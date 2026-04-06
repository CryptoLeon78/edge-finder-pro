import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Download, Trophy, TrendingUp, TrendingDown } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import type { EdgeAnalysis } from '@/lib/statistics';
import type { TradeOrder } from '@/lib/binary-parser';

interface StrategyRow {
  id: string;
  rank: number;
  name: string;
  symbol: string;
  timeframe: string;
  edgeScore: number;
  verdict: string;
  verdictColor: string;
  fitnessIS: number;
  fitnessOOS: number;
  totalTrades: number;
  winRate: number;
  totalPnl: number;
  avgPips: number;
  profitFactor: number;
  maxConsecutiveLoss: number;
}

function computeProfitFactor(trades: TradeOrder[]): number {
  const grossProfit = trades.filter(t => t.pnlMoney > 0).reduce((s, t) => s + t.pnlMoney, 0);
  const grossLoss = Math.abs(trades.filter(t => t.pnlMoney < 0).reduce((s, t) => s + t.pnlMoney, 0));
  return grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999 : 0;
}

function maxConsecutiveLosses(trades: TradeOrder[]): number {
  let max = 0, current = 0;
  for (const t of trades) {
    if (t.pnlMoney < 0) { current++; max = Math.max(max, current); }
    else current = 0;
  }
  return max;
}

export function StrategyComparisonTable() {
  const { strategies, analyses, trades: tradesMap, selectedStrategyIds } = useAppStore();
  const selected = strategies.filter(s => selectedStrategyIds.includes(s.id));

  const rows = useMemo<StrategyRow[]>(() => {
    const unsorted = selected.map(s => {
      const analysis = analyses.get(s.id);
      const trades = tradesMap.get(s.id) || [];
      const wins = trades.filter(t => t.pnlMoney > 0).length;

      return {
        id: s.id,
        rank: 0,
        name: s.name,
        symbol: s.setup.symbol,
        timeframe: s.setup.timeframe,
        edgeScore: analysis?.overallScore || 0,
        verdict: analysis?.verdictLabel || '—',
        verdictColor: analysis?.verdictColor || 'muted',
        fitnessIS: s.fitness.IS * 100,
        fitnessOOS: s.fitness.OOS * 100,
        totalTrades: trades.length,
        winRate: trades.length > 0 ? (wins / trades.length) * 100 : 0,
        totalPnl: trades.reduce((s, t) => s + t.pnlMoney, 0),
        avgPips: trades.length > 0 ? trades.reduce((s, t) => s + t.pnlPips, 0) / trades.length : 0,
        profitFactor: computeProfitFactor(trades),
        maxConsecutiveLoss: maxConsecutiveLosses(trades),
      };
    });

    return unsorted
      .sort((a, b) => b.edgeScore - a.edgeScore)
      .map((r, i) => ({ ...r, rank: i + 1 }));
  }, [selected, analyses, tradesMap]);

  const exportCSV = () => {
    const headers = ['Rank', 'Nombre', 'Símbolo', 'TF', 'Edge Score', 'Veredicto', 'Fitness IS%', 'Fitness OOS%', 'Trades', 'Win Rate%', 'P&L Total', 'Avg Pips', 'Profit Factor', 'Max Pérdidas Consec.'];
    const csvRows = rows.map(r => [
      r.rank, r.name, r.symbol, r.timeframe,
      r.edgeScore.toFixed(1), r.verdict,
      r.fitnessIS.toFixed(1), r.fitnessOOS.toFixed(1),
      r.totalTrades, r.winRate.toFixed(1), r.totalPnl.toFixed(2),
      r.avgPips.toFixed(1), r.profitFactor.toFixed(2), r.maxConsecutiveLoss,
    ]);

    const csv = [headers.join(','), ...csvRows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `edge_comparison_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (selected.length < 2) return null;

  const verdictColorClass = (color: string) => {
    switch (color) {
      case 'success': return 'text-success';
      case 'warning': return 'text-warning';
      case 'danger': return 'text-destructive';
      default: return 'text-accent';
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-accent" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Comparación de Estrategias ({selected.length})
          </h3>
        </div>
        <button
          onClick={exportCSV}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-surface-2 hover:bg-surface-3 rounded transition-colors"
        >
          <Download className="w-3 h-3" />
          Exportar CSV
        </button>
      </div>

      {/* Help text */}
      <div className="text-[10px] text-muted-foreground space-y-1">
        <p><span className="font-medium text-foreground">Comparación:</span> Ranking de estrategias por Edge Score. Permite comparar múltiples estrategias simultáneamente.</p>
        <p><span className="font-medium text-foreground">Veredicto:</span> strong_edge (&gt;70), moderate_edge (55-70), weak_edge (40-55), monkey (&lt;40).</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="border-b border-border/50">
              <th className="text-left py-2 px-2 text-muted-foreground">#</th>
              <th className="text-left py-2 px-2 text-muted-foreground">Estrategia</th>
              <th className="text-left py-2 px-2 text-muted-foreground">Edge</th>
              <th className="text-left py-2 px-2 text-muted-foreground">Veredicto</th>
              <th className="text-left py-2 px-2 text-muted-foreground">IS%</th>
              <th className="text-left py-2 px-2 text-muted-foreground">OOS%</th>
              <th className="text-left py-2 px-2 text-muted-foreground">Trades</th>
              <th className="text-left py-2 px-2 text-muted-foreground">Win%</th>
              <th className="text-left py-2 px-2 text-muted-foreground">P&L</th>
              <th className="text-left py-2 px-2 text-muted-foreground">Avg Pips</th>
              <th className="text-left py-2 px-2 text-muted-foreground">PF</th>
              <th className="text-left py-2 px-2 text-muted-foreground">Max L</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className={`border-b border-border/20 hover:bg-surface-1/50 ${row.rank === 1 ? 'bg-primary/5' : ''}`}>
                <td className="py-2 px-2">
                  {row.rank === 1 ? <Trophy className="w-3.5 h-3.5 text-accent inline" /> : row.rank}
                </td>
                <td className="py-2 px-2 font-medium">
                  <div>{row.name.substring(0, 25)}</div>
                  <div className="text-muted-foreground text-[10px]">{row.symbol} {row.timeframe}</div>
                </td>
                <td className="py-2 px-2 font-bold text-primary">{row.edgeScore.toFixed(1)}</td>
                <td className={`py-2 px-2 ${verdictColorClass(row.verdictColor)}`}>{row.verdict}</td>
                <td className="py-2 px-2">{row.fitnessIS.toFixed(1)}</td>
                <td className="py-2 px-2">{row.fitnessOOS.toFixed(1)}</td>
                <td className="py-2 px-2">{row.totalTrades}</td>
                <td className="py-2 px-2">{row.winRate.toFixed(1)}</td>
                <td className={`py-2 px-2 ${row.totalPnl >= 0 ? 'text-success' : 'text-destructive'}`}>
                  ${row.totalPnl.toFixed(0)}
                </td>
                <td className={`py-2 px-2 ${row.avgPips >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {row.avgPips.toFixed(1)}
                </td>
                <td className="py-2 px-2">{row.profitFactor.toFixed(2)}</td>
                <td className="py-2 px-2 text-destructive">{row.maxConsecutiveLoss}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-3 pt-2 border-t border-border/30">
        <div className="text-center">
          <p className="text-[10px] text-muted-foreground uppercase">Mejor Score</p>
          <p className="text-sm font-mono font-bold text-primary">{Math.max(...rows.map(r => r.edgeScore)).toFixed(1)}</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] text-muted-foreground uppercase">Promedio</p>
          <p className="text-sm font-mono font-bold">{(rows.reduce((s, r) => s + r.edgeScore, 0) / rows.length).toFixed(1)}</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] text-muted-foreground uppercase">Con Ventaja</p>
          <p className="text-sm font-mono font-bold text-success">{rows.filter(r => r.edgeScore >= 35).length}/{rows.length}</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] text-muted-foreground uppercase">Sin Ventaja</p>
          <p className="text-sm font-mono font-bold text-destructive">{rows.filter(r => r.edgeScore < 35).length}/{rows.length}</p>
        </div>
      </div>
    </motion.div>
  );
}
