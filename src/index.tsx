/**
 * Headlamp Festive Themes plugin — entry point.
 *
 * What it does:
 *  1. Registers four festive color themes (Diwali, Christmas, Holi, New Year)
 *     via `registerAppTheme`. They appear in Settings > General > Theme.
 *  2. Replaces the Headlamp logo with a theme-aware festive "doodle" (icon +
 *     wordmark + greeting) via `registerAppLogo` while a festive theme is
 *     active, falling back to the default wordmark otherwise.
 *  3. Adds an app bar action (top-right) that lets the user toggle ambient
 *     festive effects (snow / fireworks / color splashes) on or off, and
 *     auto-matches the effect to the active festive theme.
 *  4. Applies an admin-chosen festive theme. An operator sets the per-festival
 *     theme in a mounted config file
 *     (/plugins/headlamp_festive_themes/festive-config) via Helm values, plus a
 *     `mode`:
 *       - "auto"   → soft auto-apply: the theme is written to Headlamp's
 *                    localStorage and the page reloads once (guarded) so it
 *                    takes effect without any click. If the user later picks a
 *                    different theme we respect that until the admin changes the
 *                    config again.
 *       - "prompt" → an animated opt-in banner invites the user to apply it.
 *     Either way we write the theme into Headlamp's localStorage and reload,
 *     because a late `{ default: true }` registration loses the race against
 *     Headlamp's synchronous theme load. See themeStorage.ts,
 *     FestiveThemePrompt.tsx and HELM-DEFAULT-THEME.md.
 *
 * Docs used:
 *  - Plugin functionality (registerAppTheme, registerAppBarAction, registerAppLogo):
 *    https://headlamp.dev/docs/latest/development/plugins/functionality
 *  - Getting started (shared deps: react, @mui/material, react-redux):
 *    https://headlamp.dev/docs/latest/development/plugins/getting-started
 */
import { registerAppBarAction } from '@kinvolk/headlamp-plugin/lib';
import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { IconButton, Tooltip } from '@mui/material';
import { Icon } from '@iconify/react';

import { registerFestiveThemes, FESTIVE_THEMES } from './themes';
import { startEffectsForTheme, stopEffects } from './effects';
import { applyContrastFix } from './contrast';
import { registerFestiveLogo } from './logo';
import { FestiveThemePrompt } from './FestiveThemePrompt';
import { resolveAutoApply } from './themeStorage';

// Register the color themes immediately on plugin load. (Synchronous so the
// Theme picker always works, even if the admin default-config fetch below
// fails or is slow.)
registerFestiveThemes();

// Register the theme-aware festive "doodle" logo (icon + wordmark + greeting).
// Falls back to the default Headlamp wordmark when no festive theme is active.
registerFestiveLogo();

// Admin-controlled per-festival theme is delivered via the mounted
// festive-config file. Its `mode` decides how:
//   - "auto"   → FestiveAutoApply (below) writes localStorage + reloads once.
//   - "prompt" → FestiveThemePrompt (below) shows an opt-in banner.
// Forcing a default via a late `{ default: true }` registration never worked:
// it loses the race against Headlamp's synchronous theme load, so users landed
// on the built-in default (dark). Writing the preference key + reloading has no
// race. See themeStorage.ts + HELM-DEFAULT-THEME.md.

const FESTIVE_NAMES = FESTIVE_THEMES.map(t => t.name) as string[];

/**
 * Try to read the currently selected theme name from Headlamp's Redux store.
 * Headlamp persists the chosen theme name under the UI/theme slice; the exact
 * path has shifted across versions, so we probe a few known shapes and fall
 * back to the DOM/localStorage. Returns undefined if it cannot be determined.
 */
function useActiveThemeName(): string | undefined {
  return useSelector((state: any) => {
    const ui = state?.ui ?? state?.config?.ui ?? {};
    return (
      ui?.theme?.name ??
      ui?.theme ??
      ui?.themeName ??
      state?.theme?.name ??
      undefined
    );
  });
}

function FestiveEffectsToggle() {
  const activeThemeName = useActiveThemeName();
  const isFestive = !!activeThemeName && FESTIVE_NAMES.includes(activeThemeName);

  // User's on/off preference, remembered across reloads.
  const [enabled, setEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('festive-effects-enabled') !== 'false';
    } catch {
      return true;
    }
  });

  // Start/stop effects whenever the theme or the toggle changes.
  // startEffectsForTheme() already calls stopEffects() internally, so it is
  // idempotent and safe to call on re-render. We intentionally do NOT tear
  // down in a cleanup that runs on every dependency change / re-render —
  // doing so (combined with Redux-driven re-renders and React StrictMode's
  // mount/unmount/mount) removes the backdrop layer right after it is created,
  // which is why effects flashed once and then vanished.
  useEffect(() => {
    if (isFestive && enabled) {
      startEffectsForTheme(activeThemeName);
    } else {
      stopEffects();
    }
  }, [activeThemeName, isFestive, enabled]);

  // Tear down only when the component truly unmounts.
  useEffect(() => {
    return () => stopEffects();
  }, []);

  // Keep the selected-item contrast overrides in sync with the active theme.
  // This runs for every theme (not gated by the effects toggle): it applies
  // the fix for festive themes and clears it for non-festive ones.
  useEffect(() => {
    applyContrastFix(activeThemeName);
  }, [activeThemeName]);

  // Hide the toggle entirely when a non-festive theme is active.
  if (!isFestive) return null;

  const toggle = () => {
    setEnabled(prev => {
      const next = !prev;
      try {
        localStorage.setItem('festive-effects-enabled', String(next));
      } catch {
        /* ignore storage errors (private mode, etc.) */
      }
      return next;
    });
  };

  return (
    <Tooltip
      title={
        enabled
          ? `Festive effects on (${activeThemeName}) — click to turn off`
          : `Festive effects off — click to turn on`
      }
    >
      <IconButton
        aria-label={enabled ? 'Turn festive effects off' : 'Turn festive effects on'}
        aria-pressed={enabled}
        onClick={toggle}
        size="medium"
        color="inherit"
        sx={{
          // Keep the icon clearly visible on the dark festive navbar in BOTH
          // states. The thin "-outline" glyph previously vanished when off, so
          // the button looked empty. Instead use the SAME solid icon always and
          // show on/off via opacity, so it is always legible.
          color: 'inherit',
          opacity: enabled ? 1 : 0.55,
        }}
      >
        <Icon icon="icon-park-solid:effects" width="22" height="22" />
      </IconButton>
    </Tooltip>
  );
}

registerAppBarAction(<FestiveEffectsToggle />);

// Opt-in prompt to apply the admin-configured festive theme (mode: "prompt").
// Rendered via an app bar action (a convenient always-mounted host); the
// component itself renders a bottom-right Snackbar, not an app-bar button, and
// returns null when there is no admin default, mode is not "prompt", or the
// user already decided.
registerAppBarAction(<FestiveThemePrompt />);

/**
 * Headless host for soft auto-apply (mode: "auto"). Renders nothing; on mount
 * it resolves the admin config and, if the admin theme changed (or this is the
 * first visit), writes it to Headlamp's storage and reloads the page once.
 *
 * The reload is guarded per session inside resolveAutoApply(), so a single
 * config change causes at most one reload per tab — never a loop. If the user
 * later switches themes themselves, resolveAutoApply() records that override
 * and stays out of the way until the admin changes the config again.
 */
function FestiveAutoApply() {
  useEffect(() => {
    let cancelled = false;
    void resolveAutoApply().then(({ needsReload }) => {
      if (cancelled || !needsReload) return;
      // Full reload so Headlamp re-reads the theme preference we just wrote.
      window.location.reload();
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}

// Always-mounted host for the auto-apply effect. No-op unless mode is "auto".
registerAppBarAction(<FestiveAutoApply />);
