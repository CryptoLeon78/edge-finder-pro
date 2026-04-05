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

/**
 * Detect if the file is MetaTrader 5 format:
 * Lines like: 2023.01.02	00:00:00	1.06690	1.07225	1.06580	1.07150	12345	0	12
 * or with spaces: 2023.01.02 00:00:00 1.06690 1.07225 1.06580 1.07150 12345 0 12
 */
function tryParseMT5Line(line: string): DatasetRecord | null {
  // Split by tabs or multiple spaces
  const parts = line.trim().split(/[\t]+|\s{2,}/);
  
  // MT5 format can be: DATE TIME OPEN HIGH LOW CLOSE TICKVOL VOL SPREAD
  // or DATE\tTIME\tOPEN\tHIGH\tLOW\tCLOSE\tTICKVOL\tVOL\tSPREAD
  // Sometimes DATE and TIME are space-separated within the same "field"
  
  if (parts.length >= 7) {
    // Try: parts[0]=date, parts[1]=time, parts[2]=open, ...
    const dateStr = parts[0];
    const timeStr = parts[1];
    
    // Validate date format: YYYY.MM.DD or YYYY-MM-DD or YYYY/MM/DD
    if (/^\d{4}[.\-/]\d{2}[.\-/]\d{2}$/.test(dateStr)) {
      const normalizedDate = dateStr.replace(/\./g, '-');
      const dateTimeStr = timeStr && /^\d{2}:\d{2}/.test(timeStr)
        ? `${normalizedDate}T${timeStr}`
        : normalizedDate;
      
      const date = new Date(dateTimeStr);
      if (isNaN(date.getTime())) return null;
      
      const open = parseFloat(parts[2]);
      const high = parseFloat(parts[3]);
      const low = parseFloat(parts[4]);
      const close = parseFloat(parts[5]);
      const volume = parseFloat(parts[6]) || 0;
      
      if (isNaN(open) || isNaN(close) || open <= 0) return null;
      
      return { date, open, high, low, close, volume };
    }
  }
  
  // Also try single-space split for "2023.01.02 00:00:00 1.06690 1.07225 ..."
  const spaceParts = line.trim().split(/\s+/);
  if (spaceParts.length >= 8) {
    const dateStr = spaceParts[0];
    const timeStr = spaceParts[1];
    
    if (/^\d{4}[.\-/]\d{2}[.\-/]\d{2}$/.test(dateStr) && /^\d{2}:\d{2}/.test(timeStr)) {
      const normalizedDate = dateStr.replace(/\./g, '-');
      const date = new Date(`${normalizedDate}T${timeStr}`);
      if (isNaN(date.getTime())) return null;
      
      const open = parseFloat(spaceParts[2]);
      const high = parseFloat(spaceParts[3]);
      const low = parseFloat(spaceParts[4]);
      const close = parseFloat(spaceParts[5]);
      const volume = parseFloat(spaceParts[6]) || 0;
      
      if (isNaN(open) || isNaN(close) || open <= 0) return null;
      
      return { date, open, high, low, close, volume };
    }
  }
  
  return null;
}

function parseCSVDataset(text: string, fileName: string): Dataset {
  const lines = text.trim().split('\n').filter(l => l.trim().length > 0);
  if (lines.length < 2) throw new Error('Archivo vacío o sin datos');

  const records: DatasetRecord[] = [];

  // First: try MT5 format on the first data line (skip potential headers)
  let startLine = 0;
  const firstLine = lines[0].trim();
  
  // Check if first line is a header (contains letters like "Date", "Open", etc.)
  const isHeader = /[a-zA-Z]/.test(firstLine) && !/^\d{4}[.\-/]/.test(firstLine);
  if (isHeader) startLine = 1;

  // Try MT5 format on first data line
  const testLine = lines[startLine];
  const mt5Test = tryParseMT5Line(testLine);
  
  if (mt5Test) {
    // Parse as MT5 format
    for (let i = startLine; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith('#')) continue;
      const record = tryParseMT5Line(line);
      if (record) records.push(record);
    }
  } else {
    // Fall back to CSV parsing
    const header = lines[0].toLowerCase();
    const separator = header.includes('\t') ? '\t' : header.includes(';') ? ';' : ',';
    const cols = header.split(separator).map(c => c.trim());

    const dateIdx = cols.findIndex(c => /date|time|fecha|datetime/.test(c));
    const openIdx = cols.findIndex(c => /^open$|apertura/.test(c));
    const highIdx = cols.findIndex(c => /^high$|máximo|maximo/.test(c));
    const lowIdx = cols.findIndex(c => /^low$|mínimo|minimo/.test(c));
    const closeIdx = cols.findIndex(c => /^close$|cierre/.test(c));
    const volIdx = cols.findIndex(c => /vol/.test(c));

    if (dateIdx < 0 || closeIdx < 0) {
      throw new Error('No se detectó formato MT5 ni CSV con columnas "Date" y "Close"');
    }

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(separator).map(p => p.trim());
      if (parts.length <= dateIdx) continue;

      const dateStr = parts[dateIdx].replace(/\./g, '-');
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
  }

  if (records.length === 0) throw new Error('No se pudieron parsear registros del archivo');

  records.sort((a, b) => a.date.getTime() - b.date.getTime());

  // Extract symbol from filename
  const symbol = fileName.replace(/\.(csv|txt)$/i, '').replace(/[_\-\s]/g, ' ').split(' ')[0].toUpperCase();

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
  const { datasets, addDataset, setParsedDataset, parsedDatasets, setActiveDataset, activeDatasetId, strategies } = useAppStore();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);

  const handleFile = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (!['csv', 'txt'].includes(ext || '')) {
        toast({ title: 'Error', description: 'Se aceptan archivos CSV y TXT', variant: 'destructive' });
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

        // Store parsed records in the zustand store
        setParsedDataset(dataset.id, dataset);

        setActiveDataset(dataset.id);

        toast({
          title: 'Dataset cargado',
          description: `${dataset.name}: ${dataset.records.length} registros (${dataset.dateRange.from.toISOString().slice(0, 10)} → ${dataset.dateRange.to.toISOString().slice(0, 10)})`,
        });
      } catch (err) {
        toast({ title: 'Error al parsear archivo', description: String(err), variant: 'destructive' });
      }
    }
  }, [addDataset, setParsedDataset, setActiveDataset, toast]);

  const activeDataset = useMemo(() => {
    if (!activeDatasetId) return null;
    return datasets.find(d => d.id === activeDatasetId) || null;
  }, [datasets, activeDatasetId]);

  // Walk-forward coverage check
  const coverageInfo = useMemo(() => {
    if (!activeDatasetId) return null;
    const ds = parsedDatasets.get(activeDatasetId);
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
  }, [activeDatasetId, strategies, parsedDatasets]);

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
            <input ref={inputRef} type="file" accept=".csv,.txt" multiple className="hidden" onChange={(e) => handleFile(e.target.files)} />
            <Upload className="w-4 h-4 text-info mx-auto mb-1" />
            <p className="text-xs text-muted-foreground">Cargar datos históricos (CSV/TXT — MetaTrader 5 soportado)</p>
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
                        className={`h-1.5 rounded-full transition-all ${
                          c.coverage > 80 ? 'bg-success' : c.coverage > 50 ? 'bg-warning' : 'bg-destructive'
                        }`}
                        style={{ width: `${Math.min(100, c.coverage)}%` }}
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
