import { create } from 'zustand';
import type { SQXStrategy } from './sqx-parser';
import type { EdgeAnalysis } from './statistics';
import type { TradeOrder, DailyEquityPoint } from './binary-parser';

export interface DatasetInfo {
  id: string;
  name: string;
  fileName: string;
  strategies: string[];
}

interface AppState {
  strategies: SQXStrategy[];
  analyses: Map<string, EdgeAnalysis>;
  trades: Map<string, TradeOrder[]>;
  equityCurves: Map<string, DailyEquityPoint[]>;
  datasets: DatasetInfo[];
  activeDatasetId: string | null;
  selectedStrategyIds: string[];
  isLoading: boolean;

  addStrategies: (strategies: SQXStrategy[]) => void;
  removeStrategy: (id: string) => void;
  clearAll: () => void;
  setAnalysis: (strategyId: string, analysis: EdgeAnalysis) => void;
  setTrades: (strategyId: string, trades: TradeOrder[]) => void;
  setEquityCurve: (strategyId: string, curve: DailyEquityPoint[]) => void;
  setSelectedStrategies: (ids: string[]) => void;
  toggleStrategySelection: (id: string) => void;
  setLoading: (loading: boolean) => void;
  addDataset: (dataset: DatasetInfo) => void;
  setActiveDataset: (id: string | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  strategies: [],
  analyses: new Map(),
  trades: new Map(),
  equityCurves: new Map(),
  datasets: [],
  activeDatasetId: null,
  selectedStrategyIds: [],
  isLoading: false,

  addStrategies: (newStrategies) =>
    set((state) => ({
      strategies: [...state.strategies, ...newStrategies],
      selectedStrategyIds: [
        ...state.selectedStrategyIds,
        ...newStrategies.map((s) => s.id),
      ],
    })),

  removeStrategy: (id) =>
    set((state) => ({
      strategies: state.strategies.filter((s) => s.id !== id),
      selectedStrategyIds: state.selectedStrategyIds.filter((sid) => sid !== id),
    })),

  clearAll: () =>
    set({ strategies: [], analyses: new Map(), trades: new Map(), equityCurves: new Map(), selectedStrategyIds: [] }),

  setAnalysis: (strategyId, analysis) =>
    set((state) => {
      const newAnalyses = new Map(state.analyses);
      newAnalyses.set(strategyId, analysis);
      return { analyses: newAnalyses };
    }),

  setTrades: (strategyId, trades) =>
    set((state) => {
      const newTrades = new Map(state.trades);
      newTrades.set(strategyId, trades);
      return { trades: newTrades };
    }),

  setEquityCurve: (strategyId, curve) =>
    set((state) => {
      const newCurves = new Map(state.equityCurves);
      newCurves.set(strategyId, curve);
      return { equityCurves: newCurves };
    }),

  setSelectedStrategies: (ids) => set({ selectedStrategyIds: ids }),

  toggleStrategySelection: (id) =>
    set((state) => ({
      selectedStrategyIds: state.selectedStrategyIds.includes(id)
        ? state.selectedStrategyIds.filter((sid) => sid !== id)
        : [...state.selectedStrategyIds, id],
    })),

  setLoading: (loading) => set({ isLoading: loading }),

  addDataset: (dataset) =>
    set((state) => ({ datasets: [...state.datasets, dataset] })),

  setActiveDataset: (id) => set({ activeDatasetId: id }),
}));
