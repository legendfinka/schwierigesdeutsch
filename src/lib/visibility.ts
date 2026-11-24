type Checked = { verified?: { checked?: readonly string[] } };

/**
 * Parts of an entry that must be verified before it may appear in a production build.
 * Everything else (translation, example …) can still be shown, but the UI must not
 * present it as verified: use isChecked().
 */
export const REQUIRED_CHECKS = {
  noun: ['gender', 'plural'],
  quiz: ['answer', 'explanation'],
  sentence: ['roles', 'translation'],
} as const;

/** True when the entry has a `verified` record. */
export function isVerified(data: { verified?: unknown }): boolean {
  return data.verified !== undefined;
}

/** True when the verification covered this part (e.g. "example"). */
export function isChecked(data: Checked, field: string): boolean {
  return data.verified?.checked?.includes(field) ?? false;
}

/**
 * Unverified content is shown only in dev (with an "unreviewed" badge), never in a
 * production build. In production an entry also needs every `required` part checked.
 * Pass `import.meta.env.DEV` as `dev`.
 */
export function isVisible(
  data: Checked & { verified?: unknown },
  dev: boolean,
  required: readonly string[] = [],
): boolean {
  return dev || (isVerified(data) && required.every((f) => isChecked(data, f)));
}
