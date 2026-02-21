/**
 * Nature theme (tweakcn) – design tokens for the Expo app.
 * Matches apps/api globals.css :root (Tailwind v4 nature theme).
 */
export const nature = {
  background: "#f3efe8",
  foreground: "#3a2e2a",
  card: "#f3efe8",
  cardForeground: "#3a2e2a",
  primary: "#2e7d32",
  primaryForeground: "#ffffff",
  secondary: "#f3efe8",
  secondaryForeground: "#3a2e2a",
  muted: "#ece7de",
  mutedForeground: "#6d5a52",
  accent: "#dcebdc",
  accentForeground: "#2e7d32",
  destructive: "#c62828",
  destructiveForeground: "#ffffff",
  border: "rgba(58,46,42,0.16)",
  input: "rgba(58,46,42,0.22)",
  ring: "#2e7d32",
  link: "#2e7d32",
  iosGroupedBackground: "#f3efe8",
  iosSurface: "#f3efe8",
  iosSeparator: "rgba(58,46,42,0.16)",
  iosTabBar: "#f3efe8",
  iosTintMuted: "#dcebdc",
} as const;

export type NatureTheme = typeof nature;
