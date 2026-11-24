import type { Loader } from 'astro/loaders';
import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Loads every `*.json` file in a folder. Each file holds one entry or an array
 * of entries; every entry needs a unique string `id`. Lets content be grouped
 * by topic (e.g. quizzes/cases-dative.json) in one consistent format.
 */
export function jsonDir(dir: string): Loader {
  return {
    name: 'json-dir',
    load: async ({ store, parseData, logger, config, watcher }) => {
      const base = join(fileURLToPath(config.root), dir);

      const sync = async () => {
        store.clear();
        if (!existsSync(base)) return;
        const files = (await readdir(base)).filter((f) => f.endsWith('.json')).sort();
        const seen = new Set<string>();
        for (const file of files) {
          const filePath = join(dir, file); // Astro wants paths relative to the root
          const raw: unknown = JSON.parse(await readFile(join(base, file), 'utf8'));
          const items = Array.isArray(raw) ? raw : [raw];
          for (const item of items as Array<Record<string, unknown>>) {
            const id = item.id;
            if (typeof id !== 'string') throw new Error(`${dir}/${file}: entry without a string id`);
            if (seen.has(id)) throw new Error(`${dir}/${file}: duplicate id "${id}"`);
            seen.add(id);
            const data = await parseData({ id, data: item, filePath });
            store.set({ id, data, filePath });
          }
        }
        if (files.length === 0) logger.info(`no files in ${dir}`);
      };

      await sync();

      // Reload in `astro dev` when a JSON file in this folder changes.
      watcher?.add(base);
      watcher?.on('all', (_event, changed) => {
        if (changed.startsWith(base) && changed.endsWith('.json')) {
          sync().catch((e: unknown) => logger.error(String(e)));
        }
      });
    },
  };
}
