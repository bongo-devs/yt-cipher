import { InstrumentedLRU } from "./instrumentedCache.ts";

export interface PotCacheEntry {
  token: string;
  mintedAt: number;
}

// key = the content binding the token was minted for (visitorData or videoId)
const cacheSizeEnv = Deno.env.get("POT_CACHE_SIZE");
const maxCacheSize = cacheSizeEnv ? parseInt(cacheSizeEnv, 10) : 200;
export const potCache = new InstrumentedLRU<PotCacheEntry>("pot", maxCacheSize);
