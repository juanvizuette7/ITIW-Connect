type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const categoryCache = new Map<string, CacheEntry<unknown>>();
const professionalAiScoreCache = new Map<string, CacheEntry<number>>();

const ONE_HOUR_MS = 60 * 60 * 1000;
const THIRTY_MINUTES_MS = 30 * 60 * 1000;

function getFromCache<T>(store: Map<string, CacheEntry<unknown>>, key: string): T | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() >= entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.value as T;
}

function setInCache<T>(
  store: Map<string, CacheEntry<unknown>>,
  key: string,
  value: T,
  ttlMs: number,
) {
  store.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  });
}

export function getCachedCategories<T>(): T | null {
  return getFromCache<T>(categoryCache, "all");
}

export function setCachedCategories<T>(value: T) {
  setInCache(categoryCache, "all", value, ONE_HOUR_MS);
}

export function clearCategoriesCache() {
  categoryCache.clear();
}

export function getCachedProfessionalAiScore(professionalId: string): number | null {
  return getFromCache<number>(professionalAiScoreCache, professionalId);
}

export function setCachedProfessionalAiScore(professionalId: string, value: number) {
  setInCache(professionalAiScoreCache, professionalId, value, THIRTY_MINUTES_MS);
}

export function invalidateProfessionalAiScore(professionalId: string) {
  professionalAiScoreCache.delete(professionalId);
}

export function clearProfessionalAiScoreCache() {
  professionalAiScoreCache.clear();
}

