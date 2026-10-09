/**
 * Opt-in festive theme prompt.
 *
 * Shows an animated snackbar/banner in the bottom-right when an admin has
 * configured a default festive theme (via the mounted festive-config file) AND
 * the current user has not already decided about it. The user can:
 *   - Apply  → writes the theme into Headlamp's localStorage and reloads so the
 *              festive theme takes effect. (See themeStorage.applyThemeToStorage.)
 *   - Dismiss → records the decision so we never nag again for THIS festival.
 *
 * This is the deliberate replacement for the old "force a soft default after an
 * async fetch" approach, which lost a race against Headlamp's synchronous
 * theme-load and so never took effect (user always landed on dark). An opt-in
 * click has no race: the user acts after the config has resolved, and the write
 * is to the exact key Headlamp reads on load.
 *
 * The banner is keyed per theme name, so switching festivals re-prompts, but the
 * same festival only ever prompts once per user.
 */
import { forwardRef, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  IconButton,
  Paper,
  Slide,
  Snackbar,
  Typography,
} from '@mui/material';
import type { SlideProps } from '@mui/material';
import { Icon } from '@iconify/react';

import {
  applyThemeToStorage,
  markDecided,
  resolvePromptTheme,
  type FestiveTheme,
} from './themeStorage';

/** Per-theme festive accent used to tint the banner + a matching glyph. */
const THEME_ICON: Record<string, string> = {
  Diwali: 'mdi:diya-lamp',
  Christmas: 'mdi:pine-tree',
  Holi: 'mdi:palette',
  'New Year': 'mdi:party-popper',
};

/** A short, warm greeting per festival for the banner headline. */
const THEME_GREETING: Record<string, string> = {
  Diwali: 'Happy Diwali!',
  Christmas: 'Merry Christmas!',
  Holi: 'Happy Holi!',
  'New Year': 'Happy New Year!',
};

/**
 * Named slide-up transition for the Snackbar. Defined as a forwardRef component
 * (rather than an inline arrow) so it satisfies MUI's `TransitionComponent`
 * typing under strict TS — the transition must forward its ref to the child.
 */
const SlideUp = forwardRef<HTMLDivElement, SlideProps>(function SlideUp(props, ref) {
  return <Slide {...props} direction="up" ref={ref} />;
});

export function FestiveThemePrompt() {
  // The theme to prompt for, resolved once from the admin config on mount.
  const [theme, setTheme] = useState<FestiveTheme | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void resolvePromptTheme().then(resolved => {
      if (cancelled || !resolved) return;
      setTheme(resolved);
      setOpen(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const accent = theme?.primary ?? '#ffb627';
  const greeting = useMemo(
    () => (theme ? THEME_GREETING[theme.name] ?? 'Festive theme available' : ''),
    [theme],
  );
  const glyph = theme ? THEME_ICON[theme.name] ?? 'mdi:party-popper' : '';

  if (!theme) return null;

  const onApply = () => {
    const ok = applyThemeToStorage(theme);
    setOpen(false);
    if (ok) {
      // Reload so Headlamp re-reads the theme key we just wrote. A full reload
      // is the simplest reliable way to re-trigger the app's theme selection.
      window.location.reload();
    }
  };

  const onDismiss = () => {
    // Remember the decision so this festival never prompts again for this user.
    markDecided(theme.name);
    setOpen(false);
  };

  return (
    <Snackbar
      open={open}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      // Stay until the user decides — this is an intentional, dismissible choice.
      TransitionComponent={SlideUp}
    >
      <Paper
        elevation={8}
        className="festive-theme-prompt"
        sx={{
          position: 'relative',
          overflow: 'hidden',
          maxWidth: 360,
          p: 2,
          pr: 5,
          borderRadius: 2,
          borderLeft: `4px solid ${accent}`,
          // Subtle animated sheen so the banner reads as "festive" without being
          // noisy. Respects reduced-motion via the media query below.
          '&::after': {
            content: '""',
            position: 'absolute',
            inset: 0,
            background: `radial-gradient(120px 60px at 100% 0%, ${accent}22, transparent 70%)`,
            animation: 'festive-prompt-sheen 3.2s ease-in-out infinite',
            pointerEvents: 'none',
          },
          '@keyframes festive-prompt-sheen': {
            '0%, 100%': { opacity: 0.5 },
            '50%': { opacity: 1 },
          },
          '@media (prefers-reduced-motion: reduce)': {
            '&::after': { animation: 'none' },
          },
        }}
      >
        <IconButton
          aria-label="Dismiss festive theme prompt"
          size="small"
          onClick={onDismiss}
          sx={{ position: 'absolute', top: 4, right: 4 }}
        >
          <Icon icon="mdi:close" width="18" height="18" />
        </IconButton>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1 }}>
          <Box
            sx={{
              display: 'inline-flex',
              color: accent,
              animation: 'festive-prompt-pop 2.4s ease-in-out infinite',
              '@keyframes festive-prompt-pop': {
                '0%, 100%': { transform: 'scale(1) rotate(0deg)' },
                '50%': { transform: 'scale(1.15) rotate(-6deg)' },
              },
              '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
            }}
          >
            <Icon icon={glyph} width="26" height="26" />
          </Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            {greeting}
          </Typography>
        </Box>

        <Typography variant="body2" sx={{ mb: 1.5, opacity: 0.85 }}>
          Try the <strong>{theme.name}</strong> theme to celebrate. You can switch
          back anytime from Settings.
        </Typography>

        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
          <Button size="small" onClick={onDismiss} color="inherit">
            Not now
          </Button>
          <Button
            size="small"
            variant="contained"
            onClick={onApply}
            sx={{
              bgcolor: accent,
              color: theme.base === 'light' ? '#fff' : '#1a1033',
              '&:hover': { bgcolor: accent, filter: 'brightness(0.92)' },
            }}
          >
            Apply {theme.name}
          </Button>
        </Box>
      </Paper>
    </Snackbar>
  );
}
