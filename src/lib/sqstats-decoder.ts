// ============ SQSTATS DECODER ============
// Decodifica las estadísticas codificadas en base64 del formato SQStats
// Formato: Java Serialization Stream con campos de trading

interface SQStatsData {
  netProfit: number;
  grossProfit: number;
  grossLoss: number;
  maxDrawdown: number;
  drawdownPercent: number;
  profitFactor: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  breakEvenTrades: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
  avgTrade: number;
  maxDrawdownMoney: number;
  recoveryFactor: number;
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  ulcerIndex: number;
  ulcerPerformanceIndex: number;
  exposurePercent: number;
  exposureBars: number;
  startEquity: number;
  endEquity: number;
  dateFirstTrade: number;
  dateLastTrade: number;
  stagnationTrades: number;
  maxStagnation: number;
  rinaIndex: number;
  qualityScore: number;
  edgeRatio: number;
}

function decodeBase64(str: string): Uint8Array {
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function stripJavaFraming(buffer: ArrayBuffer): Uint8Array {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  const raw: number[] = [];
  
  let pos = 4;
  
  while (pos < bytes.length) {
    if (bytes[pos] === 0x7A) {
      const blockLen = view.getUint32(pos + 1, false);
      pos += 5;
      for (let i = 0; i < blockLen && pos + i < bytes.length; i++) {
        raw.push(bytes[pos + i]);
      }
      pos += blockLen;
    } else {
      break;
    }
  }
  
  return new Uint8Array(raw);
}

const METRIC_FIELD_MAP: Record<string, number> = {
  // Field names from SQStats format (short codes)
  'NetProfit': 0,
  'GrossProfit': 1,
  'GrossLoss': 2,
  'MaxDrawdown': 3,
  'DrawdownPercent': 4,
  'ProfitFactor': 5,
  'TotalTrades': 6,
  'WinningTrades': 7,
  'LosingTrades': 8,
  'BreakEvenTrades': 9,
  'WinRate': 10,
  'AvgWin': 11,
  'AvgLoss': 12,
  'MaxConsecutiveWins': 13,
  'MaxConsecutiveLosses': 14,
  'AvgTrade': 15,
  'MaxDrawdownMoney': 16,
  'RecoveryFactor': 17,
  'SharpeRatio': 18,
  'SortinoRatio': 19,
  'CalmarRatio': 20,
  'UlcerIndex': 21,
  'UlcerPerformanceIndex': 22,
  'ExposurePosition': 23,
  'ExposureBars': 24,
  'StartEquity': 25,
  'EndEquity': 26,
  'DateFirstTrade': 27,
  'DateLastTrade': 28,
  'StagnationTrades': 29,
  'MaxStagnation': 30,
  'RINAIndex': 31,
  'StrategyQualityScore': 32,
  'EdgeRatio': 33,
};

export function decodeSQStats(base64String: string): SQStatsData | null {
  try {
    const binary = decodeBase64(base64String);
    const raw = stripJavaFraming(binary.buffer);
    
    if (raw.length < 10) return null;
    
    const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
    const data: SQStatsData = {
      netProfit: 0,
      grossProfit: 0,
      grossLoss: 0,
      maxDrawdown: 0,
      drawdownPercent: 0,
      profitFactor: 0,
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      breakEvenTrades: 0,
      winRate: 0,
      avgWin: 0,
      avgLoss: 0,
      maxConsecutiveWins: 0,
      maxConsecutiveLosses: 0,
      avgTrade: 0,
      maxDrawdownMoney: 0,
      recoveryFactor: 0,
      sharpeRatio: 0,
      sortinoRatio: 0,
      calmarRatio: 0,
      ulcerIndex: 0,
      ulcerPerformanceIndex: 0,
      exposurePercent: 0,
      exposureBars: 0,
      startEquity: 0,
      endEquity: 0,
      dateFirstTrade: 0,
      dateLastTrade: 0,
      stagnationTrades: 0,
      maxStagnation: 0,
      rinaIndex: 0,
      qualityScore: 0,
      edgeRatio: 0,
    };
    
    // Try to parse based on Java object format
    // Skip header bytes and try to read doubles at known positions
    let pos = 0;
    
    // Find object start marker (0x70 = TC_OBJECT)
    while (pos < raw.length - 1 && raw[pos] !== 0x70) {
      pos++;
    }
    
    if (pos >= raw.length - 1) {
      // Fallback: just try to read doubles at various offsets
      for (let i = 0; i < raw.length - 8; i += 8) {
        try {
          const val = view.getFloat64(i, false);
          if (!isNaN(val) && isFinite(val)) {
            // Heuristic mapping
            if (data.totalTrades === 0 && val > 0 && val < 100000) {
              data.totalTrades = Math.round(val);
            } else if (data.netProfit === 0 && Math.abs(val) > 1) {
              data.netProfit = val;
            } else if (data.maxDrawdown === 0 && val > 0 && val < 100) {
              data.maxDrawdown = val;
            }
          }
        } catch {
          // Skip
        }
      }
      return data;
    }
    
    // Read object fields - format is complex Java serialization
    // Try simple double array approach for now
    const doubles: number[] = [];
    for (let i = 0; i < raw.length - 8; i++) {
      try {
        const val = view.getFloat64(i, false);
        if (!isNaN(val) && isFinite(val) && Math.abs(val) > 0.0001) {
          doubles.push(val);
        }
      } catch {
        // Skip
      }
    }
    
    // Extract meaningful values from doubles array
    // Common patterns in SQStats:
    // - Total trades is usually small integer (10-10000)
    // - Net profit is often largest positive value
    // - Max drawdown is negative or small positive
    // - Win rate is 0-1 range
    
    if (doubles.length > 0) {
      // Find total trades (integer-like value in reasonable range)
      const intDoubles = doubles.filter(d => d > 0 && d < 100000 && d === Math.floor(d));
      if (intDoubles.length > 0) {
        data.totalTrades = Math.round(intDoubles[0]);
      }
      
      // Find net profit (typically largest positive or negative)
      const sortedDoubles = [...doubles].sort((a, b) => b - a);
      if (sortedDoubles.length > 0) {
        data.netProfit = sortedDoubles[0];
        data.endEquity = sortedDoubles[0];
      }
      
      // Find max drawdown (usually negative or small)
      const negativeDoubles = doubles.filter(d => d < 0 && d > -100000);
      if (negativeDoubles.length > 0) {
        data.maxDrawdownMoney = Math.abs(Math.min(...negativeDoubles));
      }
      
      // Win rate is between 0 and 1
      const winRates = doubles.filter(d => d >= 0 && d <= 1 && d !== 0);
      if (winRates.length > 0) {
        data.winRate = winRates[0];
      }
    }
    
    return data;
  } catch (e) {
    console.error('Failed to decode SQStats:', e);
    return null;
  }
}

export function extractStatsFromSettingsXml(xml: string): Record<string, number> {
  const result: Record<string, number> = {};
  
  // Find all stats entries
  const statsRegex = /<stats_([^>]+)\s+type="com\.strategyquant\.tradinglib\.SQStats">\s*<SQStats[^>]*e="b64">([^<]+)<\/SQStats>/g;
  let match;
  
  while ((match = statsRegex.exec(xml)) !== null) {
    const statsKey = match[1];
    const base64Data = match[2];
    const decoded = decodeSQStats(base64Data);
    
    if (decoded) {
      result[`${statsKey}_netProfit`] = decoded.netProfit;
      result[`${statsKey}_totalTrades`] = decoded.totalTrades;
      result[`${statsKey}_maxDrawdownMoney`] = decoded.maxDrawdownMoney;
      result[`${statsKey}_winRate`] = decoded.winRate;
      result[`${statsKey}_endEquity`] = decoded.endEquity;
    }
  }
  
  return result;
}

export function extractPrimaryStats(xml: string): SQStatsData | null {
  const statsRegex = /<stats_([^>]+)\s+type="com\.strategyquant\.tradinglib\.SQStats">\s*<SQStats[^>]*e="b64">([^<]+)<\/SQStats>/g;
  let match;
  let mainStats: SQStatsData | null = null;
  
  // Get the first stats entry (usually main IS stats)
  while ((match = statsRegex.exec(xml)) !== null) {
    const decoded = decodeSQStats(match[2]);
    if (decoded && decoded.totalTrades > 0) {
      if (!mainStats || decoded.totalTrades > mainStats.totalTrades) {
        mainStats = decoded;
      }
    }
  }
  
  return mainStats;
}
