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

const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const ItemId = z
  .string()
  .min(1)
  .max(200)
  .refine((k) => !UNSAFE_KEYS.has(k));

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

function salvage<T>(value: unknown, schema: z.ZodType<T>): { entries: Record<string, T>; dropped: number } {
  if (value === undefined) return { entries: {}, dropped: 0 };
  if (!isPlainObject(value)) return { entries: {}, dropped: 1 };
  let dropped = 0;
  const kept: Array<[string, T]> = [];
  for (const [key, entry] of Object.entries(value)) {
    const parsed = schema.safeParse(entry);
    if (!ItemId.safeParse(key).success || !parsed.success) {
      dropped++;
      continue;
    }
    kept.push([key, parsed.data]);
  }
  return { entries: Object.fromEntries(kept), dropped };
}

// Same rules for load and save, so a save can never write what a load would drop.
function normalize(data: Data): { progress: Progress; dropped: number } {
  const srs = salvage(data.srs, SrsStateSchema);
  const quiz = salvage(data.quiz, QuizResultSchema);
  const settings = SettingsSchema.safeParse(data.settings ?? {});
  return {
    progress: {
      version: CURRENT_VERSION,
      srs: srs.entries,
      quiz: quiz.entries,
      settings: settings.success ? settings.data : {},
    },
    dropped: srs.dropped + quiz.dropped + (settings.success ? 0 : 1),
  };
}

function isNewerVersion(raw: string | null): boolean {
  if (!raw) return false;
  try {
    const data: unknown = JSON.parse(raw);
    return (
      isPlainObject(data) && Number.isInteger(data.version) && (data.version as number) > CURRENT_VERSION
    );
  } catch {
    return false;
  }
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

  const { progress, dropped } = normalize(current);
  return { progress, status: dropped > 0 ? 'repaired' : 'ok', dropped };
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
  | { ok: true; dropped: number }
  | { ok: false; reason: 'newer-version' | 'invalid' | 'quota' | 'unavailable' };

export interface Store {
  readonly persistent: boolean; // false = memory only, lost on close
  readonly outdated: boolean; // a newer site version owns the saved data
  load(): LoadResult;
  save(progress: Progress): SaveResult;
  update(change: (progress: Progress) => Progress | void): SaveResult & { progress: Progress };
  reset(): SaveResult;
}

// Old browsers only set the legacy codes.
const isQuotaError = (e: unknown): boolean => {
  if (typeof e !== 'object' || e === null) return false;
  const { name, code } = e as { name?: unknown; code?: unknown };
  return (
    name === 'QuotaExceededError' ||
    name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    code === 22 ||
    code === 1014
  );
};

export function createStore(kv: KV | null = detectStorage(), key: string = STORAGE_KEY): Store {
  const backupKey = `${key}:backup`;
  let backend: KV = kv ?? memoryKV();
  let persistent = kv !== null;
  let outdated = false;

  // Later writes go to memory, so the session still works.
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

  // Another tab may have saved a newer version at any time, so check before each write.
  const checkNewer = (raw: string | null = persistent ? read(key) : null) => {
    if (!outdated && persistent && isNewerVersion(raw)) {
      outdated = true;
      fallBackToMemory();
    }
  };

  const keepBackup = (raw: string) => {
    try {
      if (backend.getItem(backupKey) !== raw) backend.setItem(backupKey, raw);
    } catch {
      // No room for a backup.
    }
  };

  const store: Store = {
    get persistent() {
      return persistent;
    },
    get outdated() {
      return outdated;
    },

    load() {
      const raw = read(key);
      const result = parseProgress(raw);
      if (result.status === 'newer') {
        checkNewer(raw);
        return result;
      }
      if ((result.status === 'reset' || result.status === 'repaired') && raw !== null) {
        keepBackup(raw);
      }
      return result;
    },

    save(progress) {
      checkNewer();
      if (!isPlainObject(progress) || progress.version !== CURRENT_VERSION) {
        return { ok: false, reason: 'invalid' };
      }
      const { progress: clean, dropped } = normalize(progress);
      const text = JSON.stringify(clean);
      try {
        backend.setItem(key, text);
      } catch (e) {
        fallBackToMemory();
        backend.setItem(key, text);
        return { ok: false, reason: isQuotaError(e) ? 'quota' : 'unavailable' };
      }
      if (outdated) return { ok: false, reason: 'newer-version' };
      return { ok: true, dropped };
    },

    update(change) {
      const { progress } = store.load();
      const next = change(progress) ?? progress;
      return { ...store.save(next), progress: next };
    },

    reset() {
      checkNewer();
      try {
        backend.removeItem(key);
      } catch {
        fallBackToMemory();
        return { ok: false, reason: 'unavailable' };
      }
      return outdated ? { ok: false, reason: 'newer-version' } : { ok: true, dropped: 0 };
    },
  };
  return store;
}
