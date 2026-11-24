type Checked = { verified?: { checked?: readonly string[] } };

// What must be checked before an entry ships to production.
export const REQUIRED_CHECKS = {
  noun: ['gender', 'plural'],
  quiz: ['answer', 'explanation'],
  sentence: ['roles', 'translation'],
} as const;

export function isVerified(data: { verified?: unknown }): boolean {
  return data.verified !== undefined;
}

export function isChecked(data: Checked, field: string): boolean {
  return data.verified?.checked?.includes(field) ?? false;
}

// Dev shows everything. Production needs a verified record with all required parts.
export function isVisible(
  data: Checked & { verified?: unknown },
  dev: boolean,
  required: readonly string[] = [],
): boolean {
  return dev || (isVerified(data) && required.every((f) => isChecked(data, f)));
}
