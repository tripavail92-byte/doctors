// Design tokens for the Health OS theme.
// Teal primary + slate secondary + gold accent, with per-edition accent
// overrides so each product edition gets a distinct highlight color.

export const palette = {
  // Core brand
  primary: '#0E7C74', // teal
  secondary: '#16262B', // slate
  accent: '#C79A3A', // gold (default)

  // Neutral surfaces
  background: '#F5F7F8',
  paper: '#FFFFFF',
  textPrimary: '#16262B',
  textSecondary: '#5A6B70',
  divider: '#E2E8EA',
} as const;

// Per-edition accent colors. `default` maps to the base gold accent.
export const editionAccents = {
  default: palette.accent,
  specialty: '#6E2C57',
  lab: '#2E8B57',
  pharmacy: '#C77A1E',
  hospital: '#1E5FA8',
} as const;

export type Edition = keyof typeof editionAccents;

// Typography families: a serif for headings, system sans for body.
export const fonts = {
  heading: '"Georgia", "Times New Roman", serif',
  body: '"Inter", "Segoe UI", "Roboto", "Helvetica", "Arial", sans-serif',
} as const;