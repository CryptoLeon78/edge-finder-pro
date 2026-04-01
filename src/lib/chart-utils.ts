// Chart color palette and utility functions - no hardcoded values in components

export const CHART_COLORS = {
  primary: 'hsl(160, 84%, 39%)',
  primaryLight: 'hsl(160, 84%, 50%)',
  primaryDim: 'hsl(160, 84%, 25%)',
  accent: 'hsl(38, 92%, 50%)',
  accentLight: 'hsl(38, 92%, 60%)',
  danger: 'hsl(0, 72%, 51%)',
  dangerLight: 'hsl(0, 72%, 60%)',
  info: 'hsl(210, 100%, 56%)',
  infoLight: 'hsl(210, 100%, 66%)',
  muted: 'hsl(215, 12%, 52%)',
  grid: 'hsl(220, 14%, 18%)',
  background: 'hsl(220, 20%, 7%)',
  text: 'hsl(210, 20%, 72%)',
  textDim: 'hsl(210, 12%, 45%)',
} as const;

export const STRATEGY_PALETTE = [
  CHART_COLORS.primary,
  CHART_COLORS.accent,
  CHART_COLORS.info,
  'hsl(280, 70%, 55%)',
  'hsl(340, 75%, 55%)',
  'hsl(190, 80%, 50%)',
  'hsl(60, 80%, 50%)',
  'hsl(120, 60%, 45%)',
] as const;

export function getStrategyColor(index: number): string {
  return STRATEGY_PALETTE[index % STRATEGY_PALETTE.length];
}

export function formatNumber(value: number, decimals = 2): string {
  if (Math.abs(value) >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (Math.abs(value) >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return value.toFixed(decimals);
}

export function formatPercent(value: number, decimals = 1): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

export function formatPips(value: number): string {
  return `${value.toFixed(1)} pips`;
}

export const CHART_TOOLTIP_STYLE = {
  contentStyle: {
    backgroundColor: 'hsl(220, 18%, 12%)',
    border: '1px solid hsl(220, 14%, 22%)',
    borderRadius: '8px',
    color: 'hsl(210, 20%, 92%)',
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '12px',
  },
  itemStyle: { color: 'hsl(210, 20%, 80%)' },
  labelStyle: { color: 'hsl(210, 20%, 92%)', fontWeight: 600 },
} as const;
