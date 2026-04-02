import { useCallback, useRef, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Database, Upload, X, Link2, ChevronDown } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';

export interface DatasetRecord {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Dataset {
  id: string;
  name: string;
  fileName: string;
  records: DatasetRecord[];
  dateRange: { from: Date; to: Date };
  symbol: string;
}

function parseCSVDataset(text: string, fileName: string): Dataset {
  const lines = text.trim().split('\n');
  if (lines.length < 2) throw new Error('CSV vacío o sin datos');

  const header = lines[0].toLowerCase();
  const separator = header.includes(';') ? ';' : ',';
  const cols = header.split(separator).map(c => c.trim());

  // Auto-detect column indices
  const dateIdx = cols.findIndex(c => /date|time|fecha|datetime/.test(c));
  const openIdx = cols.findIndex(c => /^open$|apertura/.test(c));
  const highIdx = cols.findIndex(c => /^high$|máximo|maximo/.test(c));
  const lowIdx = cols.findIndex(c => /^low$|mínimo|minimo/.test(c));
  const closeIdx = cols.findIndex(c => /^close$|cierre/.test(c));
  const volIdx = cols.findIndex(c => /vol/.test(c));

  if (dateIdx < 0 || closeIdx < 0) {
    throw new Error('CSV debe contener columnas "Date" y "Close" como mínimo');
  }

  const records: DatasetRecord[] = [];

  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(separator).map(p => p.trim());
    if (parts.length <= dateIdx) continue;

    const dateStr = parts[dateIdx];
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) continue;

    records.push({
      date,
      open: openIdx >= 0 ? parseFloat(parts[openIdx]) || 0 : 0,
      high: highIdx >= 0 ? parseFloat(parts[highIdx]) || 0 : 0,
      low: lowIdx >= 0 ? parseFloat(parts[lowIdx]) || 0 : 0,
      close: parseFloat(parts[closeIdx]) || 0,
      volume: volIdx >= 0 ? parseFloat(parts[volIdx]) || 0 : 0,
    });
  }

  if (records.length === 0) throw new Error('No se pudieron parsear registros del CSV');

  records.sort((a, b) => a.date.getTime() - b.date.getTime());

  // Try to extract symbol from filename
  const symbol = fileName.replace(/\.csv$/i, '').replace(/[_\-\s]/g, ' ').split(' ')[0].toUpperCase();

  return {
    id: Math.random().toString(36).substring(2, 15),
    name: `${symbol} (${records.length} barras)`,
    fileName,
    records,
    dateRange: { from: records[0].date, to: records[records.length - 1].date },
    symbol,
  };
}

export function DatasetUploader() {
  const inputRef = useRef<HTMLInputElement>(null);
  const { datasets, addDataset, setActiveDataset, activeDatasetId, strategies } = useAppStore();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);

  const handleFile = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    for (const file of Array.from(files)) {
      if (!file.name.endsWith('.csv')) {
        toast({ title: 'Error', description: 'Solo se aceptan archivos CSV', variant: 'destructive' });
        continue;
      }

      try {
        const text = await file.text();
        const dataset = parseCSVDataset(text, file.name);

        addDataset({
          id: dataset.id,
          name: dataset.name,
          fileName: dataset.fileName,
          strategies: [],
        });

        // Store parsed records in a global map for access
        (window as any).__datasets = (window as any).__datasets || new Map();
        (window as any).__datasets.set(dataset.id, dataset);

        setActiveDataset(dataset.id);

        toast({
          title: 'Dataset cargado',
          description: `${dataset.name}: ${dataset.records.length} registros (${dataset.dateRange.from.toISOString().slice(0, 10)} → ${dataset.dateRange.to.toISOString().slice(0, 10)})`,
        });
      } catch (err) {
        toast({ title: 'Error al parsear CSV', description: String(err), variant: 'destructive' });
      }
    }
  }, [addDataset, setActiveDataset, toast]);

  const activeDataset = useMemo(() => {
    if (!activeDatasetId) return null;
    return datasets.find(d => d.id === activeDatasetId) || null;
  }, [datasets, activeDatasetId]);

  // Walk-forward coverage check
  const coverageInfo = useMemo(() => {
    if (!activeDatasetId) return null;
    const ds = (window as any).__datasets?.get(activeDatasetId) as Dataset | undefined;
    if (!ds) return null;

    return strategies.map(s => {
      const stratFrom = new Date(s.setup.dateFrom);
      const stratTo = new Date(s.setup.dateTo);
      const dsFrom = ds.dateRange.from;
      const dsTo = ds.dateRange.to;

      const overlap = Math.max(0,
        Math.min(stratTo.getTime(), dsTo.getTime()) - Math.max(stratFrom.getTime(), dsFrom.getTime())
      );
      const stratRange = stratTo.getTime() - stratFrom.getTime();
      const coveragePct = stratRange > 0 ? (overlap / stratRange) * 100 : 0;

      return {
        name: s.name,
        symbol: s.setup.symbol,
        coverage: coveragePct,
        dsSymbol: ds.symbol,
        symbolMatch: s.setup.symbol.toUpperCase().includes(ds.symbol) || ds.symbol.includes(s.setup.symbol.toUpperCase()),
      };
    });
  }, [activeDatasetId, strategies]);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-4 space-y-3">
      <div className="flex items-center justify-between cursor-pointer" onClick={() => setIsOpen(!isOpen)}>
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-info" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Dataset Histórico
          </h3>
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <div className="space-y-3">
          {/* Upload area */}
          <div
            onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
            className="border border-dashed border-border/60 hover:border-info/50 rounded p-4 text-center cursor-pointer transition-colors"
          >
            <input ref={inputRef} type="file" accept=".csv" multiple className="hidden" onChange={(e) => handleFile(e.target.files)} />
            <Upload className="w-4 h-4 text-info mx-auto mb-1" />
            <p className="text-xs text-muted-foreground">Cargar CSV de datos históricos (OHLCV)</p>
          </div>

          {/* Dataset list */}
          {datasets.length > 0 && (
            <div className="space-y-1.5">
              {datasets.map(ds => (
                <div
                  key={ds.id}
                  className={`flex items-center justify-between p-2 rounded text-xs cursor-pointer transition-colors ${
                    activeDatasetId === ds.id ? 'bg-info/10 border border-info/30' : 'bg-surface-1 hover:bg-surface-2'
                  }`}
                  onClick={(e) => { e.stopPropagation(); setActiveDataset(ds.id); }}
                >
                  <div className="flex items-center gap-2">
                    <Database className="w-3 h-3 text-info" />
                    <span className="font-medium">{ds.name}</span>
                  </div>
                  {activeDatasetId === ds.id && <span className="text-info text-[10px]">ACTIVO</span>}
                </div>
              ))}
            </div>
          )}

          {/* Coverage info */}
          {coverageInfo && coverageInfo.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] text-muted-foreground uppercase font-semibold">Cobertura Walk-Forward</p>
              {coverageInfo.map((c, i) => (
                <div key={i} className="flex items-center justify-between p-2 bg-surface-1 rounded text-xs">
                  <div className="flex items-center gap-2">
                    <Link2 className={`w-3 h-3 ${c.symbolMatch ? 'text-success' : 'text-warning'}`} />
                    <span className="truncate max-w-[120px]">{c.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {!c.symbolMatch && (
                      <span className="text-[10px] text-warning">⚠ símbolo</span>
                    )}
                    <div className="w-16 bg-surface-2 rounded-full h-1.5">
                      <div
                        className="h-1.5 rounded-full transition-all"
                        style={{
                          width: `${Math.min(100, c.coverage)}%`,
                          backgroundColor: c.coverage > 80 ? 'hsl(160, 84%, 39%)' : c.coverage > 50 ? 'hsl(38, 92%, 50%)' : 'hsl(0, 72%, 51%)',
                        }}
                      />
                    </div>
                    <span className="font-mono text-[10px]">{c.coverage.toFixed(0)}%</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
