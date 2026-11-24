// Progress in localStorage. Broken data never crashes the app (see CLAUDE.md).
import { z } from 'zod';

export const STORAGE_KEY = 'sd:v1';
export const BACKUP_KEY = 'sd:v1:backup';
export const CURRENT_VERSION = 1;

export const SrsStateSchema = z.object({
  due: z.number().int().nonnegative(), // ms timestamp
  interval: z.number().nonnegative().max(36500), // days
  ease: z.number().min(1.3).max(5),
  reps: z.number().int().nonnegative(), // correct in a row
  lapses: z.number().int().nonnegative(), // times forgotten
});

export const QuizResultSchema = z.object({
  correct: z.number().int().nonnegative(),
  wrong: z.number().int().nonnegative(),
  last: z.number().int().nonnegative(), // ms timestamp
});

// New settings need defaults, or old data breaks.
export const SettingsSchema = z.object({});

const ItemId = z.string().min(1).max(200);

export const ProgressSchema = z.object({
  version: z.literal(CURRENT_VERSION),
  srs: z.record(ItemId, SrsStateSchema),
  quiz: z.record(ItemId, QuizResultSchema),
  settings: SettingsSchema,
});

export type SrsState = z.infer<typeof SrsStateSchema>;
export type QuizResult = z.infer<typeof QuizResultSchema>;
export type Progress = z.infer<typeof ProgressSchema>;

export function emptyProgress(): Progress {
  return { version: CURRENT_VERSION, srs: {}, quiz: {}, settings: {} };
}

type Data = Record<string, unknown>;
// Migration n turns version n into n + 1.
export type Migration = (data: Data) => Data;

export const MIGRATIONS: Readonly<Record<number, Migration>> = {};

// Throws if a step is missing or wrong.
export function migrate(
  data: Data,
  current: number = CURRENT_VERSION,
  migrations: Readonly<Record<number, Migration>> = MIGRATIONS,
): Data {
  let out = data;
  while ((out.version as number) < current) {
    const from = out.version as number;
    const step = migrations[from];
    if (!step) throw new Error(`no migration from version ${from}`);
    out = step(out);
    if (out.version !== from + 1) throw new Error(`migration ${from} did not produce ${from + 1}`);
  }
  return out;
}

// newer = saved by a newer site version, so we never overwrite it.
export type LoadStatus = 'empty' | 'ok' | 'repaired' | 'reset' | 'newer';

export interface LoadResult {
  progress: Progress;
  status: LoadStatus;
  dropped: number;
}

const isPlainObject = (v: unknown): v is Data =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

// Keep good entries, count bad ones.
function salvage<T>(value: unknown, schema: z.ZodType<T>): { entries: Record<string, T>; dropped: number } {
  if (value === undefined) return { entries: {}, dropped: 0 };
  if (!isPlainObject(value)) return { entries: {}, dropped: 1 };
  let dropped = 0;
  const kept: Array<[string, T]> = [];
  for (const [key, entry] of Object.entries(value)) {
    const parsed = schema.safeParse(entry);
    if (UNSAFE_KEYS.has(key) || !ItemId.safeParse(key).success || !parsed.success) {
      dropped++;
      continue;
    }
    kept.push([key, parsed.data]);
  }
  return { entries: Object.fromEntries(kept), dropped };
}

// Never throws.
export function parseProgress(raw: string | null): LoadResult {
  const reset = (): LoadResult => ({ progress: emptyProgress(), status: 'reset', dropped: 0 });
  if (raw === null || raw === '') return { progress: emptyProgress(), status: 'empty', dropped: 0 };

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return reset();
  }
  if (!isPlainObject(data)) return reset();

  const version = data.version;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) return reset();
  if (version > CURRENT_VERSION) return { progress: emptyProgress(), status: 'newer', dropped: 0 };

  let current: Data;
  try {
    current = migrate(data);
  } catch {
    return reset();
  }

  const srs = salvage(current.srs, SrsStateSchema);
  const quiz = salvage(current.quiz, QuizResultSchema);
  const settings = SettingsSchema.safeParse(current.settings ?? {});
  const dropped = srs.dropped + quiz.dropped + (settings.success ? 0 : 1);

  return {
    progress: {
      version: CURRENT_VERSION,
      srs: srs.entries,
      quiz: quiz.entries,
      settings: settings.success ? settings.data : {},
    },
    status: dropped > 0 ? 'repaired' : 'ok',
    dropped,
  };
}

export interface KV {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

// Fallback when localStorage is blocked. Also used in tests.
export function memoryKV(): KV {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, String(v)),
    removeItem: (k) => void map.delete(k),
  };
}

// Reading or writing can throw (blocked cookies, Safari private mode), so probe both.
export function detectStorage(scope: object = globalThis): KV | null {
  try {
    const ls = (scope as { localStorage?: KV }).localStorage;
    if (!ls) return null;
    const probe = '__sd_probe__';
    ls.setItem(probe, '1');
    ls.removeItem(probe);
    return ls;
  } catch {
    return null;
  }
}

export type SaveResult =
  | { ok: true }
  | { ok: false; reason: 'newer-version' | 'invalid' | 'quota' | 'unavailable' };

export interface Store {
  readonly persistent: boolean; // false = memory only, lost on close
  load(): LoadResult;
  save(progress: Progress): SaveResult;
  update(change: (progress: Progress) => Progress | void): SaveResult & { progress: Progress };
  reset(): SaveResult;
}

const isQuotaError = (e: unknown): boolean =>
  e instanceof Error &&
  (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED');

export function createStore(kv: KV | null = detectStorage(), key: string = STORAGE_KEY): Store {
  let backend: KV = kv ?? memoryKV();
  let persistent = kv !== null;
  let readOnly = false;

  const fallBackToMemory = () => {
    backend = memoryKV();
    persistent = false;
  };

  const read = (k: string): string | null => {
    try {
      return backend.getItem(k);
    } catch {
      fallBackToMemory();
      return null;
    }
  };

  const store: Store = {
    get persistent() {
      return persistent;
    },

    load() {
      const raw = read(key);
      const result = parseProgress(raw);
      readOnly = result.status === 'newer';
      if (result.status === 'reset' && raw !== null) {
        try {
          backend.setItem(key === STORAGE_KEY ? BACKUP_KEY : `${key}:backup`, raw);
        } catch {
          // No room for a backup.
        }
      }
      return result;
    },

    save(progress) {
      if (readOnly) return { ok: false, reason: 'newer-version' };
      const valid = ProgressSchema.safeParse(progress);
      if (!valid.success) return { ok: false, reason: 'invalid' };
      try {
        backend.setItem(key, JSON.stringify(valid.data));
        return { ok: true };
      } catch (e) {
        if (isQuotaError(e)) return { ok: false, reason: 'quota' };
        fallBackToMemory();
        backend.setItem(key, JSON.stringify(valid.data));
        return { ok: false, reason: 'unavailable' };
      }
    },

    update(change) {
      const { progress } = store.load();
      const next = change(progress) ?? progress;
      return { ...store.save(next), progress: next };
    },

    reset() {
      if (readOnly) return { ok: false, reason: 'newer-version' };
      try {
        backend.removeItem(key);
        return { ok: true };
      } catch {
        fallBackToMemory();
        return { ok: false, reason: 'unavailable' };
      }
    },
  };
  return store;
}
