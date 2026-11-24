export type RawFile = { file: string; raw: unknown };
export type RawEntry = { id: string; item: Record<string, unknown>; file: string };

/**
 * Flattens parsed JSON files (each one entry or an array of entries) into a list,
 * checking that every entry is an object with a unique string `id`.
 * Pure, so it can be tested without Astro.
 */
export function collectEntries(dir: string, files: RawFile[]): RawEntry[] {
  const seen = new Map<string, string>();
  const out: RawEntry[] = [];
  for (const { file, raw } of files) {
    const items = Array.isArray(raw) ? raw : [raw];
    items.forEach((item: unknown, index) => {
      const where = `${dir}/${file}${Array.isArray(raw) ? ` [#${index}]` : ''}`;
      if (typeof item !== 'object' || item === null || Array.isArray(item)) {
        throw new Error(`${where}: entry must be an object`);
      }
      const entry = item as Record<string, unknown>;
      const id = entry.id;
      if (typeof id !== 'string' || id === '') throw new Error(`${where}: entry without a string id`);
      const first = seen.get(id);
      if (first !== undefined) throw new Error(`${where}: duplicate id "${id}" (also in ${first})`);
      seen.set(id, `${dir}/${file}`);
      out.push({ id, item: entry, file });
    });
  }
  return out;
}
