const trim = (p: string) => p.replace(/\/+$/, '') || '/';

// "/nouns" and "/nouns/" are the same page; sub-pages count too.
export function isCurrentPath(href: string, here: string, home: string): boolean {
  const h = trim(href);
  const p = trim(here);
  if (h === p) return true;
  return h !== trim(home) && p.startsWith(`${h}/`);
}
