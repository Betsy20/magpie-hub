const KEYS = {
  sources: "magpiehub:sources",
  sourcesSig: "magpiehub:sources-sig",
  stars: "magpiehub:stars",
  live: "magpiehub:live",
  intro: "magpiehub:intro-seen"
} as const;

export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* 隐私模式下忽略 */
  }
}

export const storageKeys = KEYS;

/** 读一个字符串数组，坏数据（null/对象/旧格式）一律当空，避免整页崩掉。 */
export function readStringArray(key: string): string[] {
  const value = readJson<unknown>(key, []);
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}
