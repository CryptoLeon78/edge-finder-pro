// ============ BINARY PARSERS FOR SQX FILES ============

export interface TradeOrder {
  orderNumber: number;
  direction: 'long' | 'short';
  orderType: string; // 'stop' | 'market' | 'limit' | 'trailing' | 'unknown'
  signalTime: number; // ms timestamp
  fillTime: number;
  closeTime: number;
  lots: number;
  signalPrice: number;
  entryPrice: number;
  fillPrice: number;
  closePrice: number;
  highPrice: number;
  lowPrice: number;
  durationBars: number;
  pnlMoney: number;
  pnlPercent: number;
  pnlPips: number;
}

export interface DailyEquityPoint {
  timestamp: number; // ms
  equity: number;
}

const ORDER_TYPE_MAP: Record<number, string> = {
  2: 'market',
  3: 'stop',
  4: 'limit',
  16: 'trailing',
};

const RECORD_SIZE = 149;
const MARKER = new Uint8Array([0x04, 0x03, 0x02, 0x01]);

/**
 * Strip Java serialization framing (ACED0005 + 7A block wrappers)
 * to get the raw data stream.
 */
function stripJavaFraming(buffer: ArrayBuffer): Uint8Array {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  const raw: number[] = [];
  
  // Skip ACED0005 magic (4 bytes)
  let pos = 4;
  
  while (pos < bytes.length) {
    if (bytes[pos] === 0x7A) {
      // TC_BLOCKDATALONG: 7A + 4-byte big-endian length
      const blockLen = view.getUint32(pos + 1, false);
      pos += 5;
      for (let i = 0; i < blockLen && pos + i < bytes.length; i++) {
        raw.push(bytes[pos + i]);
      }
      pos += blockLen;
    } else {
      // End of stream or unknown marker
      break;
    }
  }
  
  return new Uint8Array(raw);
}

/**
 * Find the byte pattern 04030201 in the raw stream
 */
function findFirstMarker(data: Uint8Array): number {
  for (let i = 0; i <= data.length - 4; i++) {
    if (data[i] === 0x04 && data[i + 1] === 0x03 && data[i + 2] === 0x02 && data[i + 3] === 0x01) {
      return i;
    }
  }
  return -1;
}

/**
 * Parse orders.bin from an SQX ZIP file.
 * Format: Java serialized stream wrapping fixed 149-byte trade records.
 */
export function parseOrdersBin(buffer: ArrayBuffer): TradeOrder[] {
  const raw = stripJavaFraming(buffer);
  const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
  const trades: TradeOrder[] = [];
  
  // Find first record marker
  const start = findFirstMarker(raw);
  if (start < 0) return trades;
  
  let pos = start;
  
  while (pos + RECORD_SIZE <= raw.length) {
    // Verify marker
    if (raw[pos] !== 0x04 || raw[pos + 1] !== 0x03 || raw[pos + 2] !== 0x02 || raw[pos + 3] !== 0x01) {
      // Try to find next marker
      const next = findFirstMarker(raw.subarray(pos + 1));
      if (next < 0) break;
      pos += 1 + next;
      continue;
    }
    
    let rp = pos + 4;
    
    const orderNumber = view.getUint32(rp, false); rp += 4;
    /* skip val2 */ rp += 4;
    const dirByte = raw[rp]; rp += 1;
    const typeByte = raw[rp]; rp += 1;
    /* skip flag */ rp += 1;
    
    const signalTime = Number(view.getBigInt64(rp, false)); rp += 8;
    const lots = raw[rp]; rp += 1;
    const signalPrice = view.getFloat32(rp, false); rp += 4;
    const entryPrice = view.getFloat32(rp, false); rp += 4;
    const fillTime = Number(view.getBigInt64(rp, false)); rp += 8;
    const fillPrice = view.getFloat32(rp, false); rp += 4;
    const closeTime = Number(view.getBigInt64(rp, false)); rp += 8;
    const closePrice = view.getFloat32(rp, false); rp += 4;
    const highPrice = view.getFloat32(rp, false); rp += 4;
    const lowPrice = view.getFloat32(rp, false); rp += 4;
    const durationBars = view.getUint16(rp, false); rp += 2;
    const pnlMoney = view.getFloat32(rp, false); rp += 4;
    const pnlPercent = view.getFloat32(rp, false); rp += 4;
    /* skip pnlPercent2 */ rp += 4;
    const pnlPips = view.getFloat32(rp, false); rp += 4;
    
    // Validate: direction must be 1 or 2, entry price in reasonable range
    if ((dirByte === 1 || dirByte === 2) && entryPrice > 0.01 && entryPrice < 100000) {
      trades.push({
        orderNumber,
        direction: dirByte === 1 ? 'long' : 'short',
        orderType: ORDER_TYPE_MAP[typeByte] || 'unknown',
        signalTime,
        fillTime,
        closeTime,
        lots,
        signalPrice,
        entryPrice,
        fillPrice,
        closePrice,
        highPrice,
        lowPrice,
        durationBars,
        pnlMoney,
        pnlPercent,
        pnlPips,
      });
    }
    
    pos += RECORD_SIZE;
  }
  
  return trades;
}

/**
 * Parse dailyEquity.bin from an SQX ZIP file.
 * Format: Java serialized stream with 4-byte count, then 16-byte records (8b timestamp + 8b double).
 */
export function parseDailyEquityBin(buffer: ArrayBuffer): DailyEquityPoint[] {
  const raw = stripJavaFraming(buffer);
  const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
  const points: DailyEquityPoint[] = [];
  
  if (raw.length < 4) return points;
  
  const count = view.getUint32(0, false);
  let pos = 4;
  
  for (let i = 0; i < count && pos + 16 <= raw.length; i++) {
    const timestamp = Number(view.getBigInt64(pos, false));
    const equity = view.getFloat64(pos + 8, false);
    pos += 16;
    
    // Validate timestamp range (2010-2030)
    if (timestamp > 1262304000000 && timestamp < 1893456000000) {
      points.push({ timestamp, equity });
    }
  }
  
  return points;
}

/**
 * Build cumulative equity curve from trade P&L data.
 */
export function buildEquityCurveFromTrades(trades: TradeOrder[], initialCapital: number): { time: number; equity: number }[] {
  const curve: { time: number; equity: number }[] = [{ time: trades[0]?.fillTime || 0, equity: initialCapital }];
  
  let cumEquity = initialCapital;
  for (const trade of trades) {
    cumEquity += trade.pnlMoney;
    curve.push({ time: trade.closeTime, equity: cumEquity });
  }
  
  return curve;
}
