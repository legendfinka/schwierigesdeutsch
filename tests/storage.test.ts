import { describe, expect, it } from 'vitest';
import {
  BACKUP_KEY,
  CURRENT_VERSION,
  STORAGE_KEY,
  createStore,
  detectStorage,
  emptyProgress,
  memoryKV,
  migrate,
  parseProgress,
  type KV,
  type Progress,
} from '../src/lib/storage';

const card = { due: 1_700_000_000_000, interval: 3, ease: 2.5, reps: 2, lapses: 0 };
const sample = (): Progress => ({
  version: 1,
  srs: { 'noun:tisch': { ...card } },
  quiz: { 'cases-dat-001': { correct: 2, wrong: 1, last: 1_700_000_000_000 } },
  settings: {},
});
const raw = (data: unknown) => JSON.stringify(data);

function flakyKV(opts: { get?: Error; set?: Error; remove?: Error } = {}) {
  const inner = memoryKV();
  const kv: KV & { inner: KV } = {
    inner,
    getItem: (k) => {
      if (opts.get) throw opts.get;
      return inner.getItem(k);
    },
    setItem: (k, v) => {
      if (opts.set) throw opts.set;
      inner.setItem(k, v);
    },
    removeItem: (k) => {
      if (opts.remove) throw opts.remove;
      inner.removeItem(k);
    },
  };
  return kv;
}
const named = (name: string) => Object.assign(new Error(name), { name });

describe('parseProgress', () => {
  it('nothing saved → empty', () => {
    expect(parseProgress(null)).toEqual({ progress: emptyProgress(), status: 'empty', dropped: 0 });
    expect(parseProgress('').status).toBe('empty');
  });

  it('valid data → ok, unchanged', () => {
    expect(parseProgress(raw(sample()))).toEqual({ progress: sample(), status: 'ok', dropped: 0 });
  });

  it('broken JSON → reset to empty', () => {
    const r = parseProgress('{"version":1,"srs":');
    expect(r.status).toBe('reset');
    expect(r.progress).toEqual(emptyProgress());
  });

  it('JSON that is not an object → reset', () => {
    for (const text of ['42', 'null', '[]', '"hi"', 'true']) {
      expect(parseProgress(text).status, text).toBe('reset');
    }
  });

  it('missing or bad version → reset', () => {
    for (const version of [undefined, 0, -1, 1.5, '1', null]) {
      expect(parseProgress(raw({ ...sample(), version })).status, String(version)).toBe('reset');
    }
  });

  it('newer version → read as empty, marked "newer"', () => {
    const r = parseProgress(raw({ ...sample(), version: CURRENT_VERSION + 1 }));
    expect(r.status).toBe('newer');
    expect(r.progress).toEqual(emptyProgress());
  });

  it('one bad entry → dropped, the rest kept', () => {
    const data = sample();
    (data.srs as Record<string, unknown>)['noun:bad'] = { ...card, interval: -1 };
    (data.srs as Record<string, unknown>)['noun:also-bad'] = 'nope';
    const r = parseProgress(raw(data));
    expect(r.status).toBe('repaired');
    expect(r.dropped).toBe(2);
    expect(r.progress.srs).toEqual(sample().srs);
    expect(r.progress.quiz).toEqual(sample().quiz);
  });

  it('a whole section of the wrong type → that section empty, others kept', () => {
    const r = parseProgress(raw({ ...sample(), srs: [1, 2, 3] }));
    expect(r.status).toBe('repaired');
    expect(r.progress.srs).toEqual({});
    expect(r.progress.quiz).toEqual(sample().quiz);
  });

  it('missing sections are fine (treated as empty)', () => {
    const r = parseProgress(raw({ version: 1 }));
    expect(r).toEqual({ progress: emptyProgress(), status: 'ok', dropped: 0 });
  });

  it('rejects out-of-range SRS values', () => {
    for (const bad of [
      { ...card, ease: 1.0 },
      { ...card, ease: 9 },
      { ...card, due: -5 },
      { ...card, reps: 1.5 },
      { ...card, interval: 99999 },
    ]) {
      const r = parseProgress(raw({ ...sample(), srs: { x: bad } }));
      expect(r.progress.srs, JSON.stringify(bad)).toEqual({});
    }
  });

  it('drops dangerous and invalid keys without touching prototypes', () => {
    const text = `{"version":1,"srs":{"__proto__":${raw(card)},"":${raw(card)},"ok":${raw(card)}}}`;
    const r = parseProgress(text);
    expect(Object.keys(r.progress.srs)).toEqual(['ok']);
    expect(r.dropped).toBe(2);
    expect(({} as Record<string, unknown>).due).toBeUndefined();
  });

  it('strips unknown fields instead of failing', () => {
    const r = parseProgress(raw({ ...sample(), extra: 1, srs: { a: { ...card, extra: 2 } } }));
    expect(r.status).toBe('ok');
    expect(r.progress.srs.a).toEqual(card);
    expect('extra' in r.progress).toBe(false);
  });
});

describe('migrate', () => {
  it('runs each step up to the current version', () => {
    const out = migrate({ version: 1, a: 1 }, 3, {
      1: (d) => ({ ...d, version: 2, b: 2 }),
      2: (d) => ({ ...d, version: 3, c: 3 }),
    });
    expect(out).toEqual({ version: 3, a: 1, b: 2, c: 3 });
  });
  it('leaves current data alone', () => {
    expect(migrate({ version: 1, a: 1 }, 1, {})).toEqual({ version: 1, a: 1 });
  });
  it('throws on a missing step', () => {
    expect(() => migrate({ version: 1 }, 2, {})).toThrow(/no migration from version 1/);
  });
  it('throws when a step returns the wrong version (no endless loop)', () => {
    expect(() => migrate({ version: 1 }, 2, { 1: (d) => d })).toThrow(/did not produce 2/);
  });
});

describe('createStore', () => {
  it('saves and loads a round trip', () => {
    const store = createStore(memoryKV());
    expect(store.persistent).toBe(true);
    expect(store.load().status).toBe('empty');
    expect(store.save(sample())).toEqual({ ok: true, dropped: 0 });
    expect(store.load()).toEqual({ progress: sample(), status: 'ok', dropped: 0 });
  });

  it('update edits in place or with a returned value', () => {
    const store = createStore(memoryKV());
    store.update((p) => {
      p.srs['noun:kind'] = { ...card };
    });
    const r = store.update((p) => ({ ...p, quiz: { q1: { correct: 1, wrong: 0, last: 1 } } }));
    expect(r.ok).toBe(true);
    expect(Object.keys(store.load().progress.srs)).toEqual(['noun:kind']);
    expect(Object.keys(store.load().progress.quiz)).toEqual(['q1']);
  });

  it('one bad card is dropped, the rest is still saved', () => {
    const store = createStore(memoryKV());
    const p = sample();
    p.srs['noun:bad'] = { ...card, ease: 9 };
    expect(store.save(p)).toEqual({ ok: true, dropped: 1 });
    expect(store.load().progress).toEqual(sample());
  });

  it('refuses progress that is not progress at all', () => {
    const store = createStore(memoryKV());
    expect(store.save({ ...sample(), version: 7 } as unknown as Progress)).toEqual({
      ok: false,
      reason: 'invalid',
    });
    expect(store.save(null as unknown as Progress)).toEqual({ ok: false, reason: 'invalid' });
  });

  it('save drops the same unsafe keys load would drop', () => {
    const store = createStore(memoryKV());
    const p = sample();
    p.srs['constructor'] = { ...card };
    expect(store.save(p)).toEqual({ ok: true, dropped: 1 });
    expect(store.load()).toEqual({ progress: sample(), status: 'ok', dropped: 0 });
  });

  it('keeps a backup of unreadable data before it gets overwritten', () => {
    const kv = memoryKV();
    kv.setItem(STORAGE_KEY, '{broken');
    const store = createStore(kv);
    expect(store.load().status).toBe('reset');
    expect(kv.getItem(BACKUP_KEY)).toBe('{broken');
    store.save(sample());
    expect(kv.getItem(BACKUP_KEY)).toBe('{broken');
  });

  it('keeps a backup when repairing drops entries', () => {
    const kv = memoryKV();
    const damaged = raw({ ...sample(), srs: [1, 2] });
    kv.setItem(STORAGE_KEY, damaged);
    const store = createStore(kv);
    expect(store.load().status).toBe('repaired');
    expect(kv.getItem(BACKUP_KEY)).toBe(damaged);
  });

  it('does not rewrite an unchanged backup on every load', () => {
    const kv = memoryKV();
    kv.setItem(STORAGE_KEY, '{broken');
    let writes = 0;
    const counting: KV = {
      getItem: (k) => kv.getItem(k),
      setItem: (k, v) => {
        if (k === BACKUP_KEY) writes++;
        kv.setItem(k, v);
      },
      removeItem: (k) => kv.removeItem(k),
    };
    const store = createStore(counting);
    store.load();
    store.load();
    store.load();
    expect(writes).toBe(1);
  });

  it('never overwrites data from a newer version, but the session still works', () => {
    const kv = memoryKV();
    const newer = raw({ version: CURRENT_VERSION + 1, srs: {}, future: true });
    kv.setItem(STORAGE_KEY, newer);
    const store = createStore(kv);
    expect(store.load().status).toBe('newer');
    expect(store.outdated).toBe(true);
    expect(store.persistent).toBe(false);
    expect(store.save(sample())).toEqual({ ok: false, reason: 'newer-version' });
    store.update((p) => {
      p.srs['noun:kind'] = { ...card };
    });
    expect(Object.keys(store.load().progress.srs).sort()).toEqual(['noun:kind', 'noun:tisch']);
    expect(store.reset()).toEqual({ ok: false, reason: 'newer-version' });
    expect(kv.getItem(STORAGE_KEY)).toBe(newer);
  });

  it('save or reset before any load still never touches newer data', () => {
    const kv = memoryKV();
    const newer = raw({ version: CURRENT_VERSION + 1 });
    kv.setItem(STORAGE_KEY, newer);
    expect(createStore(kv).save(sample())).toEqual({ ok: false, reason: 'newer-version' });
    expect(createStore(kv).reset()).toEqual({ ok: false, reason: 'newer-version' });
    expect(kv.getItem(STORAGE_KEY)).toBe(newer);
  });

  it('notices a newer version saved by another tab mid-session', () => {
    const kv = memoryKV();
    const store = createStore(kv);
    store.load();
    expect(store.save(sample())).toEqual({ ok: true, dropped: 0 });
    const newer = raw({ version: CURRENT_VERSION + 1 });
    kv.setItem(STORAGE_KEY, newer);
    expect(store.save(sample())).toEqual({ ok: false, reason: 'newer-version' });
    expect(kv.getItem(STORAGE_KEY)).toBe(newer);
  });

  it('works in memory when no storage is available', () => {
    const store = createStore(null);
    expect(store.persistent).toBe(false);
    expect(store.save(sample())).toEqual({ ok: true, dropped: 0 });
    expect(store.load().progress).toEqual(sample());
  });

  it('falls back to memory when reading throws (blocked storage)', () => {
    const store = createStore(flakyKV({ get: named('SecurityError') }));
    expect(store.load().status).toBe('empty');
    expect(store.persistent).toBe(false);
    expect(store.save(sample())).toEqual({ ok: true, dropped: 0 });
    expect(store.load().progress).toEqual(sample());
  });

  it('full storage: reports it, keeps the session in memory, leaves stored data alone', () => {
    const kv = memoryKV();
    createStore(kv).save(sample());
    const full: KV = {
      getItem: (k) => kv.getItem(k),
      setItem: () => {
        throw named('QuotaExceededError');
      },
      removeItem: (k) => kv.removeItem(k),
    };
    const store = createStore(full);
    const first = store.update((p) => {
      p.srs['noun:a'] = { ...card };
    });
    expect(first).toMatchObject({ ok: false, reason: 'quota' });
    expect(store.persistent).toBe(false);
    store.update((p) => {
      p.srs['noun:b'] = { ...card };
    });
    expect(Object.keys(store.load().progress.srs).sort()).toEqual([
      'noun:a',
      'noun:b',
      'noun:tisch',
    ]);
    expect(createStore(kv).load().progress).toEqual(sample());
  });

  it('recognizes quota errors by legacy code, even if not an Error', () => {
    for (const thrown of [{ code: 22 }, { code: 1014 }, { name: 'NS_ERROR_DOM_QUOTA_REACHED' }]) {
      const store = createStore({
        getItem: () => null,
        setItem: () => {
          throw thrown;
        },
        removeItem: () => undefined,
      });
      expect(store.save(sample()), JSON.stringify(thrown)).toEqual({ ok: false, reason: 'quota' });
    }
  });

  it('falls back to memory when writing fails for another reason', () => {
    const store = createStore(flakyKV({ set: named('SecurityError') }));
    expect(store.save(sample())).toEqual({ ok: false, reason: 'unavailable' });
    expect(store.persistent).toBe(false);
    expect(store.load().progress).toEqual(sample());
  });

  it('reset deletes progress', () => {
    const store = createStore(memoryKV());
    store.save(sample());
    expect(store.reset()).toEqual({ ok: true, dropped: 0 });
    expect(store.load().status).toBe('empty');
  });

  it('a fresh empty progress is never shared between calls', () => {
    const a = emptyProgress();
    a.srs.x = { ...card };
    expect(emptyProgress().srs).toEqual({});
  });
});

describe('detectStorage', () => {
  it('returns working storage', () => {
    const ls = memoryKV();
    expect(detectStorage({ localStorage: ls })).toBe(ls);
    expect(ls.getItem('__sd_probe__')).toBeNull();
  });
  it('null when there is no localStorage', () => {
    expect(detectStorage({})).toBeNull();
  });
  it('null when accessing localStorage throws', () => {
    const scope = Object.defineProperty({}, 'localStorage', {
      get() {
        throw named('SecurityError');
      },
    });
    expect(detectStorage(scope)).toBeNull();
  });
  it('null when writing throws (Safari private mode)', () => {
    expect(detectStorage({ localStorage: flakyKV({ set: named('QuotaExceededError') }) })).toBeNull();
  });
});
