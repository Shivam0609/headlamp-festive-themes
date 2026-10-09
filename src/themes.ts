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
// NOTE: `registerAppTheme` exists at runtime in the Headlamp plugin host but is
// not present in this SDK version's type declarations (unlike registerAppLogo /
// registerAppBarAction). Importing it by name therefore fails type-checking
// (TS2305). We pull it off the module namespace with a cast so `npm run tsc`
// stays clean without relying on the missing declaration. The build itself
// (webpack/babel) never needed this — it strips types — but tsc does.
import * as HeadlampLib from '@kinvolk/headlamp-plugin/lib';

type RegisterAppTheme = (theme: unknown, options?: unknown) => void;
const registerAppTheme = (HeadlampLib as unknown as {
  registerAppTheme: RegisterAppTheme;
}).registerAppTheme;

export type FestiveThemeName = 'Diwali' | 'Christmas' | 'Holi' | 'New Year';

/** AppTheme definitions using Headlamp's flat theme shape. */
export const FESTIVE_THEMES = [
  {
    // Diwali — deep-indigo night sky, marigold gold + diya-flame accents.
    // Palette matched to scripts/static/themes/diwali/diwali.css.
    name: 'Diwali',
    base: 'dark',
    primary: '#ffb627', // --accent-color (marigold gold)
    secondary: '#ff5da2', // --purple-color (festive pink)
    text: { primary: '#fdf3dd' }, // --text-primary
    link: { color: '#ffd166' }, // --accent-hover
    background: {
      default: '#1a1033', // --bg-primary
      surface: '#251648', // --bg-secondary
      muted: '#32205e', // --bg-tertiary
    },
    sidebar: {
      background: '#120a24',
      color: '#e4c9a0', // --text-secondary
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
    // Christmas — icy midnight blue, frosty cyan + holly red/gold.
    // Palette matched to scripts/static/themes/christmas/christmas.css.
    name: 'Christmas',
    base: 'dark',
    primary: '#6fd3ff', // --accent-color (frosty cyan)
    secondary: '#e5484d', // --purple-color (holly red)
    text: { primary: '#eef6ff' }, // --text-primary (snow white)
    link: { color: '#a5e6ff' }, // --accent-hover
    background: {
      default: '#0a1526', // --bg-primary (icy midnight blue)
      surface: '#0f1e36', // --bg-secondary
      muted: '#15294a', // --bg-tertiary
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
    // Holi — the only LIGHT festive theme: a bright, color-dusted daytime look
    // with vivid magenta. Palette matched to scripts/static/themes/holi/holi.css.
    name: 'Holi',
    base: 'light',
    primary: '#ff2e97', // --accent-color (vivid Holi magenta)
    secondary: '#8a4fff', // --purple-color
    text: { primary: '#2a2140' }, // --text-primary (charcoal-violet)
    link: { color: '#ff5fb0' }, // --accent-hover
    background: {
      default: '#fdf6ef', // --bg-primary (soft color-dusted off-white)
      surface: '#fbeee4', // --bg-secondary
      muted: '#f4e2d6', // --bg-tertiary
    },
    // Keep the sidebar/navbar calm and dark so the dense tables stay readable
    // (the saturated color lives in the toggled gulal particles, not the chrome).
    sidebar: {
      background: '#2a2140',
      color: '#efe7f5',
      selectedBackground: '#ff2e97',
      selectedColor: '#ffffff',
      actionBackground: '#3c3357',
    },
    navbar: {
      background: '#2a2140',
      color: '#fdf6ef',
    },
    radius: 10,
    buttonTextTransform: 'none',
  },
  {
    // New Year — glamorous midnight party: near-black with champagne gold,
    // platinum silver + a magenta pop. Matched to
    // scripts/static/themes/newyear/newyear.css.
    name: 'New Year',
    base: 'dark',
    primary: '#ffd700', // --accent-color (champagne gold)
    secondary: '#b388ff', // --purple-color
    text: { primary: '#fdf7e6' }, // --text-primary
    link: { color: '#ffe780' }, // --accent-hover
    background: {
      default: '#0a0a12', // --bg-primary (near-black)
      surface: '#12121f', // --bg-secondary
      muted: '#1b1b2e', // --bg-tertiary
    },
    sidebar: {
      background: '#07070e',
      color: '#d8dde6', // --text-secondary (platinum)
      selectedBackground: '#ffd700',
      selectedColor: '#0a0a12',
      actionBackground: '#1b1b2e',
    },
    navbar: {
      background: '#07070e',
      color: '#fdf7e6',
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
