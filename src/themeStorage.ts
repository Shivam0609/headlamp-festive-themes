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

/**
 * The admin theme NAME we last auto-applied on this browser. Lets us detect
 * when the admin changes `defaultTheme` (apply the new one once) vs. when the
 * config is unchanged (leave the user alone).
 */
const ADMIN_APPLIED_KEY = 'festive-admin-applied';

/**
 * Set to 'true' once we observe the user has manually switched to a theme that
 * differs from the admin theme we auto-applied (and the admin config has NOT
 * changed). While set, soft auto-apply backs off until the admin changes the
 * config again (which clears this flag).
 */
const USER_OVERRIDE_KEY = 'festive-user-override';

/**
 * Session-scoped guard so a single config change triggers at most one reload.
 * Session storage is per-tab and cleared when the tab closes, so each fresh
 * visit can auto-apply once but we never loop within a session.
 */
const RELOAD_GUARD_KEY = 'festive-auto-reloaded';

/** How the admin default should be delivered to users. */
export type FestiveMode = 'auto' | 'prompt';

/** Default when the config omits/mis-specifies `mode`. */
const DEFAULT_MODE: FestiveMode = 'prompt';

interface FestiveConfig {
  defaultTheme?: string;
  /** 'auto' = soft auto-apply on reload; 'prompt' = opt-in banner. */
  mode?: FestiveMode;
}

export type FestiveTheme = (typeof FESTIVE_THEMES)[number];

/** Resolved admin intent: which theme, and how to deliver it. */
export interface AdminDefault {
  theme: FestiveTheme;
  mode: FestiveMode;
}

/** Normalize an arbitrary config value into a known mode (defaults to prompt). */
function normalizeMode(mode: unknown): FestiveMode {
  return mode === 'auto' || mode === 'prompt' ? mode : DEFAULT_MODE;
}

/**
 * Fetch the admin config and resolve it to a known theme + delivery mode.
 * Returns null if there is no admin default, the fetch fails, or the named
 * theme is unknown. Safe no-op on any error.
 */
export async function getAdminDefault(): Promise<AdminDefault | null> {
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
    return null;
  }

  return { theme, mode: normalizeMode(cfg?.mode) };
}

/**
 * Fetch the admin config and resolve it to one of our known themes.
 * Returns the matching theme object, or null if there is no admin default,
 * the fetch fails, or the named theme is unknown. Safe no-op on any error.
 */
export async function getAdminDefaultTheme(): Promise<FestiveTheme | null> {
  const admin = await getAdminDefault();
  return admin?.theme ?? null;
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
  const admin = await getAdminDefault();
  if (!admin) return null;
  // In 'auto' mode the theme is applied silently (see resolveAutoApply); the
  // opt-in banner only appears in 'prompt' mode.
  if (admin.mode !== 'prompt') return null;
  const theme = admin.theme;
  if (hasDecided(theme.name)) return null;
  if (getStoredThemeName() === theme.name) return null;
  return theme;
}

/* -------------------------------------------------------------------------- */
/* Soft auto-apply                                                            */
/* -------------------------------------------------------------------------- */

function readLocal(key: string): string | undefined {
  try {
    return localStorage.getItem(key) ?? undefined;
  } catch {
    return undefined;
  }
}

function writeLocal(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore storage errors (private mode, etc.) */
  }
}

function removeLocal(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/** Mark/read the per-tab reload guard so we reload at most once per session. */
function hasReloadedThisSession(): boolean {
  try {
    return sessionStorage.getItem(RELOAD_GUARD_KEY) === 'true';
  } catch {
    // No sessionStorage → treat as "already reloaded" so we never risk a loop.
    return true;
  }
}

function markReloadedThisSession(): void {
  try {
    sessionStorage.setItem(RELOAD_GUARD_KEY, 'true');
  } catch {
    /* ignore */
  }
}

/**
 * Outcome of {@link resolveAutoApply}:
 *  - `{ needsReload: true }`  → storage was updated; caller should reload once.
 *  - `{ needsReload: false }` → nothing to do (already applied / user override).
 */
export interface AutoApplyResult {
  needsReload: boolean;
}

/**
 * Soft auto-apply the admin default theme.
 *
 * Behavior (soft default — respects the user between config changes):
 *  1. No admin default, or mode !== 'auto'            → no-op.
 *  2. Admin theme differs from the one we last applied → the admin changed the
 *     config (or first run): write it, record it, clear any user-override flag,
 *     and request a single guarded reload.
 *  3. Admin theme unchanged, but the stored theme differs from it → the user
 *     switched themes themselves: remember that override and stay out of the
 *     way until the admin changes the config again.
 *  4. Otherwise (admin theme already active)           → no-op.
 *
 * The reload is guarded by a per-session flag so a config change triggers at
 * most one reload per tab, never a loop.
 */
export async function resolveAutoApply(): Promise<AutoApplyResult> {
  const admin = await getAdminDefault();
  if (!admin || admin.mode !== 'auto') return { needsReload: false };

  const adminName = admin.theme.name;
  const lastApplied = readLocal(ADMIN_APPLIED_KEY);
  const stored = getStoredThemeName();

  // (2) Admin config changed (or first run) → apply once.
  if (adminName !== lastApplied) {
    // If it's already the active theme, just record intent — no reload needed.
    if (stored === adminName) {
      writeLocal(ADMIN_APPLIED_KEY, adminName);
      removeLocal(USER_OVERRIDE_KEY);
      return { needsReload: false };
    }

    const ok = applyThemeToStorage(admin.theme);
    writeLocal(ADMIN_APPLIED_KEY, adminName);
    removeLocal(USER_OVERRIDE_KEY);

    if (ok && !hasReloadedThisSession()) {
      markReloadedThisSession();
      return { needsReload: true };
    }
    return { needsReload: false };
  }

  // (3) Config unchanged. If the stored theme no longer matches the admin
  // theme, the user chose something else — record and respect it.
  if (stored !== adminName) {
    writeLocal(USER_OVERRIDE_KEY, 'true');
    return { needsReload: false };
  }

  // (4) Admin theme already active and unchanged — nothing to do.
  return { needsReload: false };
}
