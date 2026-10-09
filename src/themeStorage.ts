/**
 * Opt-in festive default: config fetch + localStorage theme persistence.
 *
 * WHY THIS EXISTS
 * ---------------
 * We cannot *force* a default theme reliably: Headlamp decides the active theme
 * synchronously at app load, but our admin config lives in a file that can only
 * be read asynchronously (fetch). By the time the fetch resolves, Headlamp has
 * already picked its built-in default (dark) and written it to localStorage, so
 * a late `registerAppTheme(theme, { default: true })` is ignored.
 *
 * Instead of fighting that race, we present an opt-in prompt (see
 * FestiveThemePrompt). When the user clicks "Apply", we write the chosen festive
 * theme NAME into the localStorage key Headlamp treats as the user's explicit
 * theme preference, then reload so Headlamp picks it up. This is a user-consented
 * action, so there is no race and no override of a real preference behind the
 * user's back.
 *
 * STORAGE KEY (confirmed against Headlamp source — frontend themeSlice/themes.ts)
 * ------------------------------------------------------------------------------
 * The source of truth is `localStorage.headlampThemePreference`, a PLAIN STRING
 * of the theme NAME (not JSON). Headlamp's `setTheme(name)` does exactly:
 *     localStorage.headlampThemePreference = name
 * and `getThemeName()` precedence is: forceTheme → headlampThemePreference →
 * OS/backend default.
 *
 * The key `cached-current-theme` is NOT the source of truth — it is a derived
 * cache that `useCurrentAppTheme()` REWRITES on every render from the resolved
 * theme name. Writing it does nothing (it gets overwritten on the next load),
 * which is exactly why earlier attempts "set a value but stayed on dark".
 *
 * These key names are app-version-sensitive. If a future Headlamp release renames
 * `headlampThemePreference`, the Apply button becomes a no-op (writes are guarded
 * in try/catch) — worst case "nothing happens on click", never a crash.
 */
import { FESTIVE_THEMES } from './themes';

/** Served path of the admin config (extensionless on purpose — WAF rule). */
const CONFIG_URL = '/plugins/headlamp_festive_themes/festive-config';

/**
 * Headlamp's user theme-preference key — a PLAIN STRING theme name. This is the
 * key `getThemeName()` reads (after forceTheme) and that `setTheme()` writes.
 */
export const THEME_STORAGE_KEY = 'headlampThemePreference';

/**
 * Headlamp's derived theme cache (full JSON theme object). Not authoritative —
 * Headlamp rewrites it each render from the resolved name. We clear it on apply
 * so a stale cached object can't briefly flash the old theme before the name is
 * re-resolved.
 */
const CACHE_THEME_KEY = 'cached-current-theme';

/** Legacy/typo key observed once in DevTools; cleared on apply to avoid confusion. */
const STRAY_THEME_KEY = 'cached current theme';

/** Our own per-theme "the user already decided" marker. */
const DECIDED_PREFIX = 'festive-theme-prompt-decided:';

interface FestiveConfig {
  defaultTheme?: string;
}

export type FestiveTheme = (typeof FESTIVE_THEMES)[number];

/**
 * Fetch the admin config and resolve it to one of our known themes.
 * Returns the matching theme object, or null if there is no admin default,
 * the fetch fails, or the named theme is unknown. Safe no-op on any error.
 */
export async function getAdminDefaultTheme(): Promise<FestiveTheme | null> {
  let cfg: FestiveConfig | null = null;
  try {
    const res = await fetch(CONFIG_URL, { cache: 'no-store' });
    if (!res.ok) return null; // 404/403/etc → no admin default configured
    cfg = (await res.json()) as FestiveConfig;
  } catch {
    return null; // network error / invalid JSON / offline / blocked
  }

  const name = cfg?.defaultTheme;
  if (!name) return null;

  const theme = FESTIVE_THEMES.find(t => t.name === name) ?? null;
  if (!theme) {
    // eslint-disable-next-line no-console
    console.warn(
      `[festive-themes] festive-config defaultTheme "${name}" is not a known theme; ignoring.`,
    );
  }
  return theme;
}

/**
 * Read Headlamp's currently-stored user theme preference, if any. This is a
 * plain string theme name (e.g. "Diwali" / "dark"), not JSON.
 */
export function getStoredThemeName(): string | undefined {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

/**
 * Has the user already decided (applied or dismissed) the prompt for THIS
 * theme? Keyed by theme name so switching festivals (Diwali → Christmas)
 * re-prompts, but the same festival never nags twice.
 */
export function hasDecided(themeName: string): boolean {
  try {
    return localStorage.getItem(DECIDED_PREFIX + themeName) === 'true';
  } catch {
    return false;
  }
}

/** Record that the user has decided for this theme (applied or dismissed). */
export function markDecided(themeName: string): void {
  try {
    localStorage.setItem(DECIDED_PREFIX + themeName, 'true');
  } catch {
    /* ignore storage errors (private mode, etc.) */
  }
}

/**
 * Write the chosen festive theme into Headlamp's storage key and mark the
 * prompt decided. Returns true if the write succeeded. The caller is expected
 * to reload the page so Headlamp re-reads the key on next load.
 */
export function applyThemeToStorage(theme: FestiveTheme): boolean {
  try {
    // Authoritative write: the theme NAME as a plain string. This is what
    // Headlamp's getThemeName() reads as the user's explicit preference, so it
    // survives reload and takes precedence over the OS/default fallback.
    localStorage.setItem(THEME_STORAGE_KEY, theme.name);

    // Clear the derived cache + the stray spaced key so no stale object flashes
    // the previous theme before Headlamp re-resolves from the name on load.
    // Both are non-authoritative; removing them is safe.
    try {
      localStorage.removeItem(CACHE_THEME_KEY);
      localStorage.removeItem(STRAY_THEME_KEY);
    } catch {
      /* ignore */
    }

    markDecided(theme.name);
    return true;
  } catch {
    return false;
  }
}

/**
 * Decide whether the opt-in prompt should be shown for the admin default.
 * Returns the theme to prompt for, or null when we should stay quiet:
 *  - no admin default configured / unknown theme
 *  - the user already decided for this theme
 *  - the admin default theme is already the active stored theme
 */
export async function resolvePromptTheme(): Promise<FestiveTheme | null> {
  const theme = await getAdminDefaultTheme();
  if (!theme) return null;
  if (hasDecided(theme.name)) return null;
  if (getStoredThemeName() === theme.name) return null;
  return theme;
}
