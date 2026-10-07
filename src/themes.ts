/**
 * Festive color themes for Headlamp.
 *
 * Each theme is registered with `registerAppTheme` from
 * `@kinvolk/headlamp-plugin/lib`. After registration they appear in the
 * "Theme" dropdown under General Settings.
 *
 * API reference: registerAppTheme / AppTheme
 *   https://headlamp.dev/docs/latest/development/plugins/functionality (App Theme)
 *
 * Palettes are ported from the project's existing festive stylesheets
 * (scripts/static/themes/*). AppTheme uses an MUI base palette, so we map the
 * CSS custom properties onto MUI palette fields: background.default/paper,
 * text.primary/secondary, primary/secondary main, plus success/warning.
 */
import { registerAppTheme } from '@kinvolk/headlamp-plugin/lib';

export type FestiveThemeName =
  | 'Diwali'
  | 'Christmas'
  | 'Holi'
  | 'New Year';

/**
 * The AppTheme type is intentionally broad here. The published type exposes
 * `name`, `base`, `primary`, `secondary`, and an optional MUI `palette`
 * override (plus `terminal`). We keep the object literal and let the plugin
 * lib validate it at registration time.
 */
export const FESTIVE_THEMES = [
  {
    name: 'Diwali',
    base: 'dark' as const,
    primary: '#ffb627', // marigold gold
    secondary: '#ff5da2', // festive pink
    palette: {
      mode: 'dark',
      background: { default: '#1a1033', paper: '#251648' },
      text: { primary: '#fdf3dd', secondary: '#e4c9a0' },
      primary: { main: '#ffb627' },
      secondary: { main: '#ff5da2' },
      success: { main: '#4ade80' },
      warning: { main: '#ff7b00' },
      divider: '#4a2f7a',
    },
  },
  {
    name: 'Christmas',
    base: 'dark' as const,
    primary: '#6fd3ff', // frosty cyan
    secondary: '#e5484d', // holly red
    palette: {
      mode: 'dark',
      background: { default: '#0a1526', paper: '#0f1e36' },
      text: { primary: '#eef6ff', secondary: '#b8cfe6' },
      primary: { main: '#6fd3ff' },
      secondary: { main: '#e5484d' },
      success: { main: '#3fb6a0' },
      warning: { main: '#ffd166' },
      divider: '#27456e',
    },
  },
  {
    name: 'Holi',
    base: 'light' as const,
    primary: '#e91e63', // vivid magenta
    secondary: '#00bcd4', // bright cyan
    palette: {
      mode: 'light',
      background: { default: '#fff7fb', paper: '#ffffff' },
      text: { primary: '#2a1a2e', secondary: '#6b4a63' },
      primary: { main: '#e91e63' },
      secondary: { main: '#00bcd4' },
      success: { main: '#43a047' },
      warning: { main: '#ffb300' },
      divider: '#f0c6dd',
    },
  },
  {
    name: 'New Year',
    base: 'dark' as const,
    primary: '#ffd700', // champagne gold
    secondary: '#8a5cff', // midnight violet
    palette: {
      mode: 'dark',
      background: { default: '#0b0b1a', paper: '#14142b' },
      text: { primary: '#f5f3ff', secondary: '#c7c3e0' },
      primary: { main: '#ffd700' },
      secondary: { main: '#8a5cff' },
      success: { main: '#4ade80' },
      warning: { main: '#ff9f1c' },
      divider: '#2c2c52',
    },
  },
] as const;

/** Register every festive theme with Headlamp. */
export function registerFestiveThemes(): void {
  for (const theme of FESTIVE_THEMES) {
    // Cast to the plugin lib's AppTheme shape; fields map onto MUI palette.
    registerAppTheme(theme as unknown as Parameters<typeof registerAppTheme>[0]);
  }
}
