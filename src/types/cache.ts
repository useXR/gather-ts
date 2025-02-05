// types/cache.ts
export interface ICacheEntry {
    hash: string;
    tokens: number;
    lastUpdated: string;
  }
  
  export interface ITokenCache {
    [key: string]: ICacheEntry;
  }
  
  export interface ICacheStats {
    totalEntries: number;
    oldestEntry: string | null;
    newestEntry: string | null;
    totalSize: number;
  }