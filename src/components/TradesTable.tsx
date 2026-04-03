import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ArrowUpDown, ArrowUp, ArrowDown, Filter, X } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import type { TradeOrder } from '@/lib/binary-parser';

type SortField = 'orderNumber' | 'fillTime' | 'pnlMoney' | 'pnlPips' | 'durationBars';
type SortDir = 'asc' | 'desc';

interface Filters {
  direction: 'all' | 'long' | 'short';
  result: 'all' | 'win' | 'loss';
  dateFrom: string;
  dateTo: string;
  pnlMin: string;
  pnlMax: string;
}

const DEFAULT_FILTERS: Filters = {
  direction: 'all',
  result: 'all',
  dateFrom: '',
  dateTo: '',
  pnlMin: '',
  pnlMax: '',
};

export function TradesTable() {
  const { strategies, trades: tradesMap, selectedStrategyIds } = useAppStore();
  const strategy = strategies.find(s => selectedStrategyIds.includes(s.id));
  const trades = strategy ? tradesMap.get(strategy.id) : undefined;

  const [sortField, setSortField] = useState<SortField>('orderNumber');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [page, setPage] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const pageSize = 25;

  const filtered = useMemo(() => {
    if (!trades?.length) return [];
    return trades.filter(t => {
      if (filters.direction !== 'all' && t.direction !== filters.direction) return false;
      if (filters.result === 'win' && t.pnlMoney <= 0) return false;
      if (filters.result === 'loss' && t.pnlMoney >= 0) return false;
      if (filters.dateFrom) {
        const from = new Date(filters.dateFrom).getTime();
        if (t.fillTime < from) return false;
      }
      if (filters.dateTo) {
        const to = new Date(filters.dateTo).getTime() + 86400000;
        if (t.fillTime > to) return false;
      }
      if (filters.pnlMin !== '' && t.pnlMoney < parseFloat(filters.pnlMin)) return false;
      if (filters.pnlMax !== '' && t.pnlMoney > parseFloat(filters.pnlMax)) return false;
      return true;
    });
  }, [trades, filters]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const mul = sortDir === 'asc' ? 1 : -1;
      return mul * ((a[sortField] as number) - (b[sortField] as number));
    });
  }, [filtered, sortField, sortDir]);

  const paged = sorted.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(sorted.length / pageSize);

  if (!trades?.length) return null;

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
    setPage(0);
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 opacity-30" />;
    return sortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />;
  };

  const formatDate = (ts: number) => {
    if (!ts || ts < 1e12) return '—';
    return new Date(ts).toISOString().slice(0, 16).replace('T', ' ');
  };

  const hasActiveFilters = filters.direction !== 'all' || filters.result !== 'all' ||
    filters.dateFrom || filters.dateTo || filters.pnlMin || filters.pnlMax;

  // Summary stats (from filtered set)
  const wins = filtered.filter(t => t.pnlMoney > 0).length;
  const totalPnl = filtered.reduce((s, t) => s + t.pnlMoney, 0);
  const avgPips = filtered.length > 0 ? filtered.reduce((s, t) => s + t.pnlPips, 0) / filtered.length : 0;

  const updateFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters(f => ({ ...f, [key]: value }));
    setPage(0);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Tabla de Operaciones ({filtered.length}{filtered.length !== trades.length ? ` / ${trades.length}` : ''})
        </h3>
        <div className="flex items-center gap-3">
          <div className="flex gap-4 text-xs font-mono">
            <span className="text-success">Wins: {wins} ({filtered.length > 0 ? (wins / filtered.length * 100).toFixed(1) : 0}%)</span>
            <span className={totalPnl >= 0 ? 'text-success' : 'text-destructive'}>
              P&L: ${totalPnl.toFixed(2)}
            </span>
            <span className={avgPips >= 0 ? 'text-success' : 'text-destructive'}>
              Avg: {avgPips.toFixed(1)} pips
            </span>
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${
              hasActiveFilters ? 'bg-primary/20 text-primary' : 'bg-surface-2 hover:bg-surface-3 text-muted-foreground'
            }`}
          >
            <Filter className="w-3 h-3" />
            Filtros
          </button>
        </div>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="flex flex-wrap gap-3 p-3 bg-surface-1 rounded border border-border/30">
          <label className="flex flex-col gap-1 text-[10px] text-muted-foreground">
            <span>Dirección</span>
            <select
              value={filters.direction}
              onChange={e => updateFilter('direction', e.target.value as Filters['direction'])}
              className="bg-surface-2 border border-border rounded px-2 py-1 text-xs font-mono"
            >
              <option value="all">Todas</option>
              <option value="long">Long</option>
              <option value="short">Short</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[10px] text-muted-foreground">
            <span>Resultado</span>
            <select
              value={filters.result}
              onChange={e => updateFilter('result', e.target.value as Filters['result'])}
              className="bg-surface-2 border border-border rounded px-2 py-1 text-xs font-mono"
            >
              <option value="all">Todos</option>
              <option value="win">Ganadores</option>
              <option value="loss">Perdedores</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[10px] text-muted-foreground">
            <span>Fecha desde</span>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={e => updateFilter('dateFrom', e.target.value)}
              className="bg-surface-2 border border-border rounded px-2 py-1 text-xs font-mono"
            />
          </label>
          <label className="flex flex-col gap-1 text-[10px] text-muted-foreground">
            <span>Fecha hasta</span>
            <input
              type="date"
              value={filters.dateTo}
              onChange={e => updateFilter('dateTo', e.target.value)}
              className="bg-surface-2 border border-border rounded px-2 py-1 text-xs font-mono"
            />
          </label>
          <label className="flex flex-col gap-1 text-[10px] text-muted-foreground">
            <span>P&L mín ($)</span>
            <input
              type="number"
              value={filters.pnlMin}
              onChange={e => updateFilter('pnlMin', e.target.value)}
              placeholder="-∞"
              className="bg-surface-2 border border-border rounded px-2 py-1 text-xs font-mono w-20"
            />
          </label>
          <label className="flex flex-col gap-1 text-[10px] text-muted-foreground">
            <span>P&L máx ($)</span>
            <input
              type="number"
              value={filters.pnlMax}
              onChange={e => updateFilter('pnlMax', e.target.value)}
              placeholder="+∞"
              className="bg-surface-2 border border-border rounded px-2 py-1 text-xs font-mono w-20"
            />
          </label>
          {hasActiveFilters && (
            <button
              onClick={() => { setFilters(DEFAULT_FILTERS); setPage(0); }}
              className="self-end flex items-center gap-1 px-2 py-1 text-xs text-destructive bg-destructive/10 rounded hover:bg-destructive/20"
            >
              <X className="w-3 h-3" />
              Limpiar
            </button>
          )}
        </motion.div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="border-b border-border/50">
              {([
                ['orderNumber', '#'],
                ['fillTime', 'Entrada'],
                ['direction', 'Dir'],
                ['entryPrice', 'P. Entrada'],
                ['closePrice', 'P. Salida'],
                ['pnlPips', 'Pips'],
                ['pnlMoney', 'P&L ($)'],
                ['durationBars', 'Barras'],
              ] as [string, string][]).map(([key, label]) => (
                <th
                  key={key}
                  className="text-left py-2 px-2 text-muted-foreground cursor-pointer hover:text-foreground select-none"
                  onClick={() => ['direction', 'entryPrice', 'closePrice'].includes(key) ? null : toggleSort(key as SortField)}
                >
                  <span className="flex items-center gap-1">
                    {label}
                    {!['direction', 'entryPrice', 'closePrice'].includes(key) && <SortIcon field={key as SortField} />}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.map((trade) => (
              <tr key={trade.orderNumber} className="border-b border-border/20 hover:bg-surface-1/50">
                <td className="py-1.5 px-2">{trade.orderNumber}</td>
                <td className="py-1.5 px-2 text-muted-foreground">{formatDate(trade.fillTime)}</td>
                <td className="py-1.5 px-2">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                    trade.direction === 'long' ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive'
                  }`}>
                    {trade.direction === 'long' ? 'LONG' : 'SHORT'}
                  </span>
                </td>
                <td className="py-1.5 px-2">{trade.entryPrice.toFixed(5)}</td>
                <td className="py-1.5 px-2">{trade.closePrice.toFixed(5)}</td>
                <td className={`py-1.5 px-2 ${trade.pnlPips >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {trade.pnlPips >= 0 ? '+' : ''}{trade.pnlPips.toFixed(1)}
                </td>
                <td className={`py-1.5 px-2 ${trade.pnlMoney >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {trade.pnlMoney >= 0 ? '+' : ''}{trade.pnlMoney.toFixed(2)}
                </td>
                <td className="py-1.5 px-2 text-muted-foreground">{trade.durationBars}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Página {page + 1} de {totalPages}</span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-2 py-1 bg-surface-2 rounded hover:bg-surface-3 disabled:opacity-30"
            >
              ← Anterior
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-2 py-1 bg-surface-2 rounded hover:bg-surface-3 disabled:opacity-30"
            >
              Siguiente →
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}
