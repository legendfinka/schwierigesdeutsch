import type { Loader } from 'astro/loaders';
import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectEntries, type RawFile } from './json-entries';

type WatchHandler = (event: string, changed: string) => void;
// One handler per folder, so reloads don't stack listeners.
const handlers = new Map<string, WatchHandler>();

// Loads all .json files in a folder and its subfolders. A file holds one entry or a list.
export function jsonDir(dir: string): Loader {
  return {
    name: 'json-dir',
    load: async ({ store, parseData, logger, config, watcher }) => {
      const base = join(fileURLToPath(config.root), dir);

      const doSync = async () => {
        const files: RawFile[] = [];
        if (existsSync(base)) {
          // Subfolders count too, e.g. nouns/a1/food.json.
          const names = await readdir(base, { recursive: true });
          for (const file of names.filter((f) => f.endsWith('.json')).sort()) {
            const text = await readFile(join(base, file), 'utf8');
            try {
              files.push({ file, raw: JSON.parse(text) });
            } catch (cause) {
              throw new Error(`${dir}/${file}: invalid JSON`, { cause });
            }
          }
        }
        const entries = collectEntries(dir, files);
        store.clear();
        for (const { id, item, file } of entries) {
          const filePath = join(dir, file); // Astro wants it relative
          const data = await parseData({ id, data: item, filePath });
          store.set({ id, data, filePath });
        }
        if (files.length === 0) logger.info(`no files in ${dir}`);
      };

      // One sync at a time, so fast edits can't leave stale data.
      let queue: Promise<void> = Promise.resolve();
      const sync = () => (queue = queue.catch(() => undefined).then(doSync));

      await sync();

      if (watcher) {
        const previous = handlers.get(dir);
        if (previous) watcher.off('all', previous);
        const handler: WatchHandler = (_event, changed) => {
          if (changed.startsWith(base + sep) && changed.endsWith('.json')) {
            sync().catch((e: unknown) => logger.error(String(e)));
          }
        };
        handlers.set(dir, handler);
        watcher.add(base);
        watcher.on('all', handler);
      }
    },
  };
}
