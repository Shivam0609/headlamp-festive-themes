/**
 * Headlamp Festive Themes plugin — entry point.
 *
 * What it does:
 *  1. Registers four festive color themes (Diwali, Christmas, Holi, New Year)
 *     via `registerAppTheme`. They appear in Settings > General > Theme.
 *  2. Adds an app bar action (top-right) that lets the user toggle ambient
 *     festive effects (snow / fireworks / color splashes) on or off, and
 *     auto-matches the effect to the active festive theme.
 *
 * Docs used:
 *  - Plugin functionality (registerAppTheme, registerAppBarAction):
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

// Register the color themes immediately on plugin load.
registerFestiveThemes();

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
  useEffect(() => {
    if (isFestive && enabled) {
      startEffectsForTheme(activeThemeName);
    } else {
      stopEffects();
    }
    return () => stopEffects();
  }, [activeThemeName, isFestive, enabled]);

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
        aria-label="Toggle festive effects"
        onClick={toggle}
        size="medium"
        color="inherit"
      >
        <Icon icon={enabled ? 'mdi:party-popper' : 'mdi:party-popper-outline'} />
      </IconButton>
    </Tooltip>
  );
}

registerAppBarAction(<FestiveEffectsToggle />);
