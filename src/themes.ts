/**
 * Festive color themes for Headlamp.
 *
 * Each theme is registered with `registerAppTheme` from
 * `@kinvolk/headlamp-plugin/lib`. After registration they appear in the
 * "Theme" section under Settings -> General.
 *
 * IMPORTANT: Headlamp's AppTheme is a FLAT structure (not a raw MUI palette).
 * Valid fields: name, base, primary, secondary, text.primary, link.color,
 * background.{default,surface,muted}, sidebar.{...}, navbar.{...}, radius,
 * buttonTextTransform, fontFamily. Any field you omit inherits from `base`.
 * Passing a nested MUI `palette`/`background.paper`/`success` etc. is invalid
 * and makes registerAppTheme throw, which disables the whole plugin.
 *
 * Reference (Tutorial 9 - AppTheme object):
 *   https://headlamp.dev/docs/latest/tutorials/plugin-development/getting-started/applying-custom-themes/
 */
import { registerAppTheme } from '@kinvolk/headlamp-plugin/lib';

export type FestiveThemeName = 'Diwali' | 'Christmas' | 'Holi' | 'New Year';

/** AppTheme definitions using Headlamp's flat theme shape. */
export const FESTIVE_THEMES = [
  {
    name: 'Diwali',
    base: 'dark',
    primary: '#ffb627', // marigold gold
    secondary: '#ff5da2', // festive pink
    text: { primary: '#fdf3dd' },
    link: { color: '#ffd166' },
    background: {
      default: '#1a1033',
      surface: '#251648',
      muted: '#32205e',
    },
    sidebar: {
      background: '#120a24',
      color: '#e4c9a0',
      selectedBackground: '#ffb627',
      selectedColor: '#1a1033',
      actionBackground: '#32205e',
    },
    navbar: {
      background: '#120a24',
      color: '#fdf3dd',
    },
    radius: 8,
    buttonTextTransform: 'none',
  },
  {
    name: 'Christmas',
    base: 'dark',
    primary: '#6fd3ff', // frosty cyan
    secondary: '#e5484d', // holly red
    text: { primary: '#eef6ff' },
    link: { color: '#a5e6ff' },
    background: {
      default: '#0a1526',
      surface: '#0f1e36',
      muted: '#15294a',
    },
    sidebar: {
      background: '#071021',
      color: '#b8cfe6',
      selectedBackground: '#e5484d',
      selectedColor: '#ffffff',
      actionBackground: '#15294a',
    },
    navbar: {
      background: '#071021',
      color: '#eef6ff',
    },
    radius: 8,
    buttonTextTransform: 'none',
  },
  {
    name: 'Holi',
    base: 'light',
    primary: '#e91e63', // vivid magenta
    secondary: '#00bcd4', // bright cyan
    text: { primary: '#2a1a2e' },
    link: { color: '#c2185b' },
    background: {
      default: '#fff7fb',
      surface: '#ffffff',
      muted: '#fdeff6',
    },
    sidebar: {
      background: '#2a1a2e',
      color: '#f3d9e8',
      selectedBackground: '#e91e63',
      selectedColor: '#ffffff',
      actionBackground: '#3d2742',
    },
    navbar: {
      background: '#2a1a2e',
      color: '#fff7fb',
    },
    radius: 10,
    buttonTextTransform: 'none',
  },
  {
    name: 'New Year',
    base: 'dark',
    primary: '#ffd700', // champagne gold
    secondary: '#8a5cff', // midnight violet
    text: { primary: '#f5f3ff' },
    link: { color: '#c7b6ff' },
    background: {
      default: '#0b0b1a',
      surface: '#14142b',
      muted: '#1d1d3d',
    },
    sidebar: {
      background: '#07070f',
      color: '#c7c3e0',
      selectedBackground: '#ffd700',
      selectedColor: '#0b0b1a',
      actionBackground: '#1d1d3d',
    },
    navbar: {
      background: '#07070f',
      color: '#f5f3ff',
    },
    radius: 8,
    buttonTextTransform: 'none',
  },
] as const;

/** Register every festive theme with Headlamp. */
export function registerFestiveThemes(): void {
  for (const theme of FESTIVE_THEMES) {
    try {
      registerAppTheme(theme as unknown as Parameters<typeof registerAppTheme>[0]);
    } catch (err) {
      // Never let one bad theme take down the whole plugin.
      // eslint-disable-next-line no-console
      console.error(`[festive-themes] failed to register "${theme.name}":`, err);
    }
  }
}
