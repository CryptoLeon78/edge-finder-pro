import { useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { Upload, FileArchive, X } from 'lucide-react';
import JSZip from 'jszip';
import { parseSQXFiles } from '@/lib/sqx-parser';
import { analyzeEdge } from '@/lib/statistics';
import { parseOrdersBin, parseDailyEquityBin } from '@/lib/binary-parser';
import { useAppStore } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';

export function FileUploader() {
  const inputRef = useRef<HTMLInputElement>(null);
  const { addStrategies, setAnalysis, setTrades, setEquityCurve, setLoading, isLoading } = useAppStore();
  const { toast } = useToast();

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const sqxFiles = Array.from(files).filter(f => f.name.endsWith('.sqx'));
    if (sqxFiles.length === 0) {
      toast({ title: 'Error', description: 'Solo se aceptan archivos .sqx', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const strategies = await parseSQXFiles(sqxFiles);
      addStrategies(strategies);

      // Parse binary data and run analysis for each strategy
      for (let i = 0; i < strategies.length; i++) {
        const strategy = strategies[i];
        const file = sqxFiles[i];

        // Analysis
        const analysis = analyzeEdge(strategy);
        setAnalysis(strategy.id, analysis);

        // Parse binary files from ZIP
        try {
          const zip = await JSZip.loadAsync(file);

          // orders.bin
          const ordersFile = zip.file('orders.bin');
          if (ordersFile) {
            const buffer = await ordersFile.async('arraybuffer');
            const trades = parseOrdersBin(buffer);
            if (trades.length > 0) setTrades(strategy.id, trades);
          }

          // dailyEquity.bin (find in any subfolder)
          const equityFiles = Object.keys(zip.files).filter(n => n.toLowerCase().includes('equity'));
          if (equityFiles.length > 0) {
            const eqFile = zip.file(equityFiles[0]);
            if (eqFile) {
              const buffer = await eqFile.async('arraybuffer');
              const curve = parseDailyEquityBin(buffer);
              if (curve.length > 0) setEquityCurve(strategy.id, curve);
            }
          }
        } catch (binErr) {
          console.warn('Binary parse warning:', binErr);
        }
      }

      toast({
        title: `${strategies.length} estrategia(s) cargada(s)`,
        description: strategies.map(s => s.name).join(', '),
      });
    } catch (error) {
      toast({ title: 'Error al parsear', description: String(error), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [addStrategies, setAnalysis, setTrades, setEquityCurve, setLoading, toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed border-border/60 hover:border-primary/50 rounded-lg p-8 text-center cursor-pointer transition-colors group"
      >
        <input ref={inputRef} type="file" accept=".sqx" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            ) : (
              <Upload className="w-5 h-5 text-primary" />
            )}
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Arrastra archivos .sqx o haz clic para seleccionar</p>
            <p className="text-xs text-muted-foreground mt-1">Strategy Quant X Build 139 • Múltiples archivos soportados</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export function StrategyList() {
  const { strategies, analyses, trades, selectedStrategyIds, toggleStrategySelection, removeStrategy } = useAppStore();

  if (strategies.length === 0) return null;

  return (
    <div className="glass-card p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        Estrategias Cargadas ({strategies.length})
      </h3>
      <div className="space-y-2">
        {strategies.map((strategy, idx) => {
          const analysis = analyses.get(strategy.id);
          const tradeCount = trades.get(strategy.id)?.length || 0;
          const isSelected = selectedStrategyIds.includes(strategy.id);

          return (
            <motion.div
              key={strategy.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
              className={`flex items-center gap-3 p-3 rounded-md cursor-pointer transition-colors ${
                isSelected ? 'bg-surface-2 border border-primary/30' : 'bg-surface-1 hover:bg-surface-2 border border-transparent'
              }`}
              onClick={() => toggleStrategySelection(strategy.id)}
            >
              <FileArchive className="w-4 h-4 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{strategy.name}</p>
                <p className="text-xs text-muted-foreground">
                  {strategy.setup.symbol} • {strategy.setup.timeframe} • {tradeCount > 0 ? `${tradeCount} trades` : strategy.engine}
                </p>
              </div>
              {analysis && (
                <span className={`text-xs font-mono font-semibold ${
                  analysis.verdict === 'strong_edge' ? 'text-success' :
                  analysis.verdict === 'moderate_edge' ? 'text-warning' :
                  analysis.verdict === 'weak_edge' ? 'text-accent' :
                  'text-destructive'
                }`}>
                  {analysis.overallScore.toFixed(0)}
                </span>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); removeStrategy(strategy.id); }}
                className="p-1 rounded hover:bg-destructive/20 transition-colors"
              >
                <X className="w-3 h-3 text-muted-foreground" />
              </button>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
