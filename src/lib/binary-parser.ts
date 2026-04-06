// ============ BINARY PARSER FOR SQX BUILD 142+ ============
// Handles the new Java serialization format used in SQ Build 142+

export interface TradeOrder {
  orderNumber: number;
  direction: 'long' | 'short';
  orderType: string;
  signalTime: number;
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
  timestamp: number;
  equity: number;
}

function decodeBase64(str: string): Uint8Array {
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function stripJavaFramingBuild142(buffer: ArrayBuffer): Uint8Array {
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
    } else if (bytes[pos] === 0x71) {
      pos += 1;
      if (bytes[pos] === 0x77) pos += 1;
    } else if (bytes[pos] === 0x73) {
      pos += 2;
      const nameLen = view.getUint16(pos, false);
      pos += 2 + nameLen + 8;
    } else if (bytes[pos] === 0x72) {
      pos += 2;
      const strLen = view.getUint16(pos, false);
      pos += 2 + strLen;
    } else if (bytes[pos] === 0x70) {
      pos += 1;
    } else if (bytes[pos] === 0x78) {
      pos += 1;
    } else if (bytes[pos] === 0x01 || bytes[pos] === 0x02) {
      raw.push(bytes[pos]);
      pos += 1;
    } else {
      pos += 1;
    }
  }
  
  return new Uint8Array(raw);
}

function findPattern(data: Uint8Array, pattern: number[]): number {
  for (let i = 0; i <= data.length - pattern.length; i++) {
    let found = true;
    for (let j = 0; j < pattern.length; j++) {
      if (data[i + j] !== pattern[j]) {
        found = false;
        break;
      }
    }
    if (found) return i;
  }
  return -1;
}

export function parseOrdersBin(buffer: ArrayBuffer): TradeOrder[] {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const trades: TradeOrder[] = [];
  
  try {
    const raw = stripJavaFramingBuild142(buffer);
    const rawView = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
    
    const recordMarker = [0x03, 0x02, 0x04, 0x01];
    let pos = findPattern(raw, recordMarker);
    
    if (pos < 0) {
      return tryParseDirect(bytes, view, trades);
    }
    
    while (pos >= 0 && pos + 140 < raw.length) {
      const markerCheck = raw[pos] === 0x03 && raw[pos+1] === 0x02 && raw[pos+2] === 0x04 && raw[pos+3] === 0x01;
      
      if (!markerCheck) {
        pos = findPattern(raw.slice(pos + 1), recordMarker);
        if (pos >= 0) pos += 1;
        continue;
      }
      
      let rp = pos + 4;
      
      try {
        const orderNumber = rawView.getUint32(rp, false); rp += 4;
        rp += 4; // skip
        const direction = raw[rp]; rp += 1;
        const typeByte = raw[rp]; rp += 1;
        rp += 1; // skip flag
        
        const signalTime = Number(rawView.getBigInt64(rp, false)); rp += 8;
        const lots = raw[rp]; rp += 1;
        const signalPrice = rawView.getFloat32(rp, false); rp += 4;
        const entryPrice = rawView.getFloat32(rp, false); rp += 4;
        const fillTime = Number(rawView.getBigInt64(rp, false)); rp += 8;
        const fillPrice = rawView.getFloat32(rp, false); rp += 4;
        const closeTime = Number(rawView.getBigInt64(rp, false)); rp += 8;
        const closePrice = rawView.getFloat32(rp, false); rp += 4;
        const highPrice = rawView.getFloat32(rp, false); rp += 4;
        const lowPrice = rawView.getFloat32(rp, false); rp += 4;
        const durationBars = rawView.getUint16(rp, false); rp += 2;
        const pnlMoney = rawView.getFloat32(rp, false); rp += 4;
        const pnlPercent = rawView.getFloat32(rp, false); rp += 4;
        rp += 4;
        const pnlPips = rawView.getFloat32(rp, false); rp += 4;
        
        if ((direction === 1 || direction === 2) && entryPrice > 0.01 && entryPrice < 100000) {
          trades.push({
            orderNumber,
            direction: direction === 1 ? 'long' : 'short',
            orderType: typeByte === 2 ? 'market' : typeByte === 3 ? 'stop' : typeByte === 4 ? 'limit' : 'unknown',
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
      } catch (e) {
        // Skip invalid record
      }
      
      pos = findPattern(raw.slice(rp), recordMarker);
      if (pos >= 0) pos += rp;
    }
  } catch (e) {
    console.error('Error parsing orders.bin:', e);
  }
  
  if (trades.length === 0) {
    return tryParseDirect(bytes, view, trades);
  }
  
  return trades;
}

function tryParseDirect(bytes: Uint8Array, view: DataView, trades: TradeOrder[]): TradeOrder[] {
  const ORDER_TYPE_MAP: Record<number, string> = {
    2: 'market',
    3: 'stop',
    4: 'limit',
    16: 'trailing',
  };
  
  const RECORD_SIZE = 149;
  
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
      pos++;
    }
  }
  
  const rawArr = new Uint8Array(raw);
  const rawView = new DataView(rawArr.buffer, rawArr.byteOffset, rawArr.byteLength);
  
  for (let i = 0; i < rawArr.length - RECORD_SIZE; i += RECORD_SIZE) {
    if (rawArr[i] === 0x04 && rawArr[i+1] === 0x03 && rawArr[i+2] === 0x02 && rawArr[i+3] === 0x01) {
      let rp = i + 4;
      
      try {
        const orderNumber = rawView.getUint32(rp, false); rp += 4;
        rp += 4;
        const dirByte = rawArr[rp]; rp += 1;
        const typeByte = rawArr[rp]; rp += 1;
        rp += 1;
        
        const signalTime = Number(rawView.getBigInt64(rp, false)); rp += 8;
        const lots = rawArr[rp]; rp += 1;
        const signalPrice = rawView.getFloat32(rp, false); rp += 4;
        const entryPrice = rawView.getFloat32(rp, false); rp += 4;
        const fillTime = Number(rawView.getBigInt64(rp, false)); rp += 8;
        const fillPrice = rawView.getFloat32(rp, false); rp += 4;
        const closeTime = Number(rawView.getBigInt64(rp, false)); rp += 8;
        const closePrice = rawView.getFloat32(rp, false); rp += 4;
        const highPrice = rawView.getFloat32(rp, false); rp += 4;
        const lowPrice = rawView.getFloat32(rp, false); rp += 4;
        const durationBars = rawView.getUint16(rp, false); rp += 2;
        const pnlMoney = rawView.getFloat32(rp, false); rp += 4;
        const pnlPercent = rawView.getFloat32(rp, false); rp += 4;
        rp += 4;
        const pnlPips = rawView.getFloat32(rp, false); rp += 4;
        
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
      } catch (e) {
        // Skip
      }
    }
  }
  
  return trades;
}

export function parseDailyEquityBin(buffer: ArrayBuffer, initialCapital = 100000): DailyEquityPoint[] {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
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
    } else if (bytes[pos] === 0x71) {
      pos += 1;
      if (bytes[pos] === 0x77) pos += 1;
    } else if (bytes[pos] === 0x73) {
      pos += 2;
      const nameLen = view.getUint16(pos, false);
      pos += 2 + nameLen + 8;
    } else if (bytes[pos] === 0x72) {
      pos += 2;
      const strLen = view.getUint16(pos, false);
      pos += 2 + strLen;
    } else if (bytes[pos] === 0x70 || bytes[pos] === 0x78) {
      pos += 1;
    } else {
      pos += 1;
    }
  }
  
  if (raw.length < 20) return [];
  
  const rawView = new DataView(new Uint8Array(raw).buffer, new Uint8Array(raw).byteOffset, new Uint8Array(raw).byteLength);
  const points: DailyEquityPoint[] = [];
  
  const count = rawView.getUint32(0, false);
  let offset = 4;
  
  for (let i = 0; i < count && offset + 16 <= raw.length; i++) {
    const timestamp = Number(rawView.getBigInt64(offset, false));
    const pnlAccumulated = rawView.getFloat64(offset + 8, false);
    const equity = pnlAccumulated + initialCapital;
    offset += 16;
    
    if (timestamp > 1262304000000 && timestamp < 1893456000000) {
      points.push({ timestamp, equity });
    }
  }
  
  return points;
}

export function buildEquityCurveFromTrades(trades: TradeOrder[], initialCapital: number): { time: number; equity: number }[] {
  const curve: { time: number; equity: number }[] = [{ time: trades[0]?.fillTime || 0, equity: initialCapital }];
  
  let cumEquity = initialCapital;
  for (const trade of trades) {
    cumEquity += trade.pnlMoney;
    curve.push({ time: trade.closeTime, equity: cumEquity });
  }
  
  return curve;
}
