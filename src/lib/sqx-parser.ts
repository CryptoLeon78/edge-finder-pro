import JSZip from 'jszip';

// ============ TYPES ============

export interface SQXStrategy {
  id: string;
  fileName: string;
  name: string;
  appVersion: string;
  engine: string;
  // Data setup
  setup: DataSetup;
  // Strategy logic
  rules: StrategyRules;
  // Money management
  moneyManagement: MoneyManagement;
  // Performance metrics from settings.xml
  metrics: StrategyMetrics;
  // OOS ranges
  oosRanges: DateRange[];
  // Fitness scores
  fitness: FitnessScores;
  // Raw XML for future use
  rawSettingsXml: string;
  rawStrategyXml: string;
  rawLastSettingsXml: string;
}

export interface DataSetup {
  dateFrom: string;
  dateTo: string;
  symbol: string;
  timeframe: string;
  spread: number;
  commission: number;
  swapLong: number;
  swapShort: number;
  testPrecision: number;
  session: string;
}

export interface DateRange {
  dateFrom: string;
  dateTo: string;
}

export interface StrategyRules {
  signals: SignalInfo[];
  entryRules: RuleInfo[];
  exitRules: RuleInfo[];
}

export interface SignalInfo {
  variable: string;
  indicatorKey: string;
  indicatorName: string;
  displayFormula: string;
  parameters: Record<string, string>;
}

export interface RuleInfo {
  name: string;
  type: string;
  direction: 'long' | 'short' | 'both';
  orderType: string;
  indicators: string[];
}

export interface MoneyManagement {
  type: string;
  initialCapital: number;
  parameters: Record<string, string>;
}

export interface FitnessScores {
  IS: number;
  FS: number;
  OOS: number;
  [key: string]: number;
}

export interface StrategyMetrics {
  // All metrics extracted from the binary-encoded stats
  [key: string]: number | string;
}

// ============ PARSER ============

const generateId = () => Math.random().toString(36).substring(2, 15);

export async function parseSQXFile(file: File): Promise<SQXStrategy> {
  const zip = await JSZip.loadAsync(file);
  
  const settingsXml = await extractText(zip, 'settings.xml');
  const strategyXml = await extractText(zip, 'strategy_Portfolio.xml');
  const lastSettingsXml = await extractText(zip, 'lastSettings.xml');

  const settingsDoc = parseXml(settingsXml);
  const strategyDoc = parseXml(strategyXml);
  const lastSettingsDoc = parseXml(lastSettingsXml);

  const strategyFile = strategyDoc.querySelector('StrategyFile');
  const appVersion = strategyFile?.getAttribute('AppVersion') || 'Unknown';
  
  const strategyEl = strategyDoc.querySelector('Strategy');
  const engine = strategyEl?.getAttribute('engine') || 'Unknown';

  const setup = parseDataSetup(lastSettingsDoc);
  const rules = parseStrategyRules(strategyDoc);
  const moneyManagement = parseMoneyManagement(lastSettingsDoc);
  const oosRanges = parseOOSRanges(lastSettingsDoc);
  const fitness = parseFitnessScores(settingsXml);
  const metrics = parseMetricsFromSettings(settingsXml);

  // Derive strategy name from filename or result group
  const resultGroup = settingsDoc.querySelector('ResultsGroup');
  const resultName = resultGroup?.getAttribute('ResultName') || file.name.replace('.sqx', '');

  return {
    id: generateId(),
    fileName: file.name,
    name: resultName,
    appVersion,
    engine,
    setup,
    rules,
    moneyManagement,
    metrics,
    oosRanges,
    fitness,
    rawSettingsXml: settingsXml,
    rawStrategyXml: strategyXml,
    rawLastSettingsXml: lastSettingsXml,
  };
}

async function extractText(zip: JSZip, path: string): Promise<string> {
  const file = zip.file(path);
  if (!file) return '';
  return file.async('text');
}

function parseXml(xmlString: string): Document {
  const parser = new DOMParser();
  return parser.parseFromString(xmlString, 'text/xml');
}

function parseDataSetup(doc: Document): DataSetup {
  const setup = doc.querySelector('Setup');
  const chart = doc.querySelector('Chart');
  const commission = doc.querySelector('Commissions Method Param[key="Commission"]');
  const swap = doc.querySelector('Swap');

  return {
    dateFrom: setup?.getAttribute('dateFrom') || '',
    dateTo: setup?.getAttribute('dateTo') || '',
    symbol: chart?.getAttribute('symbol') || '',
    timeframe: chart?.getAttribute('timeframe') || '',
    spread: parseFloat(chart?.getAttribute('spread') || '0'),
    commission: parseFloat(commission?.textContent || '0'),
    swapLong: parseFloat(swap?.getAttribute('long') || '0'),
    swapShort: parseFloat(swap?.getAttribute('short') || '0'),
    testPrecision: parseInt(setup?.getAttribute('testPrecision') || '0'),
    session: setup?.getAttribute('session') || 'No Session',
  };
}

function parseStrategyRules(doc: Document): StrategyRules {
  const signals: SignalInfo[] = [];
  const entryRules: RuleInfo[] = [];
  const exitRules: RuleInfo[] = [];

  // Parse signals
  doc.querySelectorAll('signal').forEach(signalEl => {
    const variable = signalEl.getAttribute('variable') || '';
    const item = signalEl.querySelector('Item');
    if (item) {
      const params: Record<string, string> = {};
      item.querySelectorAll('Param').forEach(p => {
        params[p.getAttribute('key') || ''] = p.textContent || '';
      });
      signals.push({
        variable,
        indicatorKey: item.getAttribute('key') || '',
        indicatorName: item.getAttribute('name') || '',
        displayFormula: item.getAttribute('display') || '',
        parameters: params,
      });
    }
  });

  // Parse entry/exit rules
  doc.querySelectorAll('Rule').forEach(ruleEl => {
    const name = ruleEl.getAttribute('name') || '';
    const type = ruleEl.getAttribute('type') || '';
    const indicators: string[] = [];
    
    ruleEl.querySelectorAll('Item[key]').forEach(item => {
      const key = item.getAttribute('key') || '';
      if (key && key !== 'AND' && key !== 'OR' && key !== 'Not' && key !== 'Boolean' && key !== 'BooleanVariable') {
        indicators.push(item.getAttribute('name') || key);
      }
    });

    const isEntry = name.toLowerCase().includes('entry');
    const isExit = name.toLowerCase().includes('exit');
    const direction = name.toLowerCase().includes('long') ? 'long' as const :
                     name.toLowerCase().includes('short') ? 'short' as const : 'both' as const;

    const orderItem = ruleEl.querySelector('Item[key="EnterAtStop"], Item[key="EnterAtMarket"], Item[key="EnterAtLimit"]');
    const orderType = orderItem?.getAttribute('key')?.replace('EnterAt', '') || 'unknown';

    const rule: RuleInfo = { name, type, direction, orderType, indicators };
    
    if (isEntry) entryRules.push(rule);
    else if (isExit) exitRules.push(rule);
  });

  return { signals, entryRules, exitRules };
}

function parseMoneyManagement(doc: Document): MoneyManagement {
  const initialCapitalEl = doc.querySelector('InitialCapital');
  const initialCapital = parseFloat(initialCapitalEl?.textContent || '100000');

  // Find the active MM method
  const methods = doc.querySelectorAll('MoneyManagement Method');
  let activeType = 'FixedSize';
  const parameters: Record<string, string> = {};

  methods.forEach(method => {
    if (method.getAttribute('use') === 'true') {
      activeType = method.getAttribute('type') || 'FixedSize';
      method.querySelectorAll('Param').forEach(p => {
        parameters[p.getAttribute('key') || ''] = p.textContent || '';
      });
    }
  });

  return { type: activeType, initialCapital, parameters };
}

function parseOOSRanges(doc: Document): DateRange[] {
  const ranges: DateRange[] = [];
  doc.querySelectorAll('OutOfSample Range').forEach(range => {
    ranges.push({
      dateFrom: range.getAttribute('dateFrom') || '',
      dateTo: range.getAttribute('dateTo') || '',
    });
  });
  return ranges;
}

function parseFitnessScores(xml: string): FitnessScores {
  const scores: FitnessScores = { IS: 0, FS: 0, OOS: 0 };
  const fitnessMatch = xml.match(/<Fitnesses\s+([^>]+)\/>/);
  if (fitnessMatch) {
    const attrs = fitnessMatch[1];
    const attrRegex = /(\w+)="([^"]+)"/g;
    let match;
    while ((match = attrRegex.exec(attrs)) !== null) {
      scores[match[1]] = parseFloat(match[2]);
    }
  }
  return scores;
}

function parseMetricsFromSettings(xml: string): StrategyMetrics {
  const metrics: StrategyMetrics = {};
  
  // Extract from Fingerprint element - most reliable source
  const fingerprintMatch = xml.match(/<Fingerprint[^>]*trades="(\d+)"[^>]*profit="([^"]+)"[^>]*drawdown="([^"]+)"/);
  if (fingerprintMatch) {
    metrics['TotalTrades'] = parseInt(fingerprintMatch[1]);
    metrics['NetProfit'] = parseFloat(fingerprintMatch[2]);
    metrics['MaxDrawdownMoney'] = parseFloat(fingerprintMatch[3]);
    metrics['Fitness'] = parseFloat(fingerprintMatch[3]); // for backward compat
  }

  // Also extract individual trade direction stats
  const statsRegex = /<stats_([^>]+)\s+type="com\.strategyquant\.tradinglib\.SQStats">\s*<SQStats[^>]*e="b64">([^<]+)<\/SQStats>/g;
  let match;
  while ((match = statsRegex.exec(xml)) !== null) {
    const statsKey = match[1];
    // For now, just store the raw base64 for later processing
    metrics[`${statsKey}_raw`] = match[2];
  }
  
  // Extract additional values from SpecialValuesMap
  const backtestDurationMatch = xml.match(/<BacktestDuration[^>]*type="Double">([^<]+)</);
  if (backtestDurationMatch) {
    metrics['BacktestDuration'] = parseFloat(backtestDurationMatch[1]);
  }

  // Add default metric names initialized to 0 for compatibility
  const metricNames = [
    'NetProfitOOS', 'SortinoRatio', 'DDRecoveryTrades', 'EoFPerc',
    'DDCurrentMonth', 'OOSPatternScore', 'EquityAngle', 'UlcerPerformanceIndex',
    'DDRecencyScore', 'TSWinLossRatio', 'MFEMAERatio', 'SLPipsMin',
    'EdgeRatioInPips', 'NetProfitIS', 'TPPipsMin', 'MaxNewHighDuration',
    'ExitQuality', 'ExposurePosition', 'SterlingRatio', 'AverageStagnationTrades',
    'SLPipsP95', 'VaRat95', 'DaysInDDPreviousMonth', 'OOSEfficiencyScore',
    'RetDDCurrentYear', 'Parameters', 'CapitalAllocatedPerStrategy',
    'DrawdownTradesPercent', 'ExitComplexity', 'NewPeakTradesPercent',
    'DDPerMonth', 'ISPerformanceScore', 'StagnationTrades',
    'AvgDrawdownRecoveryTrades', 'OOSRobustnessScore', 'OOSConsistencyIndex',
    'TPEfficiencyScore', 'OOSProfitScore', 'EoFTimePerc',
    'HCScalingWinLossRate', 'SecondLongestStagnation', 'AverageMFEPLDifference',
    'StreaksDeviationFrom1', 'SLCoefficientVariation', 'TotalMFE',
    'UlcerIndexNew', 'DDHealthScore', 'TemplateColumn', 'DDTwoMonthsAgo',
    'IsSLLimiting', 'RetDD3YearsAgo', 'ConditionalDiversificationScore',
    'RINAIndex', 'StrategyQualityScore', 'ThirdLongestStagnation',
    'NegativeStreaksPct80', 'DaysInDDTwoMonthsAgo', 'AverageMAEPLDifference',
    'StreaksPct95', 'EoDTimePerc', 'EquitySlope', 'ExposureBarsPercent',
    'TrailingStopPerc', 'AvgDrawdown', 'TPPipsP75', 'OutOfSampleAverage',
    'DDMaxRecoveryTrades', 'CVaRat95', 'DDThreeMonthsAgo', 'SLPipsMax',
    'RecoveryFactor', 'DaysBetweenDD', 'SLConsistencyIndex', 'IsRRLimiting',
    'MAEEfficiencyScore', 'RetDD4YearsAgo', 'DDPreviousMonth', 'RRRatioMedian',
    'AvgPctDrawdown', 'CAGRDrawdownOptimizedScore', 'AvgPercentTrade',
    'CurrentDDStatus', 'OOSDrawdownScore', 'DrawdownsPerMonth',
    'DaysInDDCurrentMonth', 'ReplacedExitPerc', 'TPPipsMax', 'ExitSignalPerc',
    'StreaksPct80', 'DaysInDDThreeMonthsAgo', 'PositiveStreaksPct95',
    'TradesSinceLastDD', 'TPPipsP95', 'SLPipsP50',
    'FutureConfidenceScoreFCS', 'IS_OOS_DegradationScore', 'LimitingFactor',
    'RetDD1YearAgo', 'ProfitTargetPerc', 'ExposureBars', 'UlcerIndex',
    'PositiveStreaksPct80', 'MaxTSIntradayDrawdown', 'RetDD2YearsAgo',
    'DaysInCurrentDD', 'SLPipsP75', 'OpenDrawdownPct', 'AvgDaysBetweenDrawdowns',
    'SLPerc', 'TotalTrades', 'NetProfit', 'MaxDrawdownMoney',
  ];

  metricNames.forEach(name => {
    if (!(name in metrics)) {
      metrics[name] = 0;
    }
  });

  return metrics;
}

// ============ MULTI-FILE PARSING ============

export async function parseSQXFiles(files: File[]): Promise<SQXStrategy[]> {
  const strategies = await Promise.all(files.map(f => parseSQXFile(f)));
  return strategies;
}
