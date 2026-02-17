/**
 * Nature theme (tweakcn) – design tokens for the Expo app.
 * Matches apps/api globals.css :root (Tailwind v4 nature theme).
 */
export const nature = {
  background: "#f8f5f0",
  foreground: "#3e2723",
  card: "#f8f5f0",
  cardForeground: "#3e2723",
  primary: "#2e7d32",
  primaryForeground: "#ffffff",
  secondary: "#e8f5e9",
  secondaryForeground: "#1b5e20",
  muted: "#f0e9e0",
  mutedForeground: "#6d4c41",
  accent: "#c8e6c9",
  accentForeground: "#1b5e20",
  destructive: "#c62828",
  destructiveForeground: "#ffffff",
  border: "#e0d6c9",
  input: "#e0d6c9",
  ring: "#2e7d32",
  link: "#2e7d32",
} as const;

export type NatureTheme = typeof nature;
