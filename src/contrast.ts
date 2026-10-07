/**
 * Contrast safety net for the festive themes.
 *
 * Headlamp's flat AppTheme lets us set a `sidebar.selectedBackground` and
 * `sidebar.selectedColor`, but in practice the SELECTED sidebar item's label
 * (`.MuiListItemButton-root.Mui-selected .MuiListItemText-primary`) and its
 * icon do not always pick up `selectedColor` — MUI auto-derives a colour that
 * can be unreadable against our custom backgrounds (e.g. dark text on a dark
 * nested-selected pill, or light text on a bright gold pill).
 *
 * Rather than fight MUI's per-state derivation (which the flat AppTheme can't
 * fully reach), we inject one scoped stylesheet that forces readable colours on
 * the known-risky selected states. It is active ONLY while a festive theme is
 * selected, keyed off a `data-festive-theme="<name>"` attribute we set on
 * <html>. When the user picks a non-festive theme we remove both the attribute
 * and the stylesheet, so Headlamp's own themes are never affected.
 *
 * Verified selectors (from DevTools against this Headlamp build):
 *   a.MuiButtonBase-root.MuiListItemButton-root.Mui-selected
 *     > div.MuiListItemText-root
 *       > span.MuiTypography-root.MuiListItemText-primary
 */
import { FESTIVE_THEMES } from './themes';

const STYLE_ID = 'festive-contrast-style';
const ATTR = 'data-festive-theme';

/** Build the per-theme CSS rules that force readable selected-item colours. */
function buildCss(): string {
  return FESTIVE_THEMES.map(theme => {
    const sel = `html[${ATTR}="${theme.name}"]`;
    const selectedColor = theme.sidebar.selectedColor;
    const idleColor = theme.sidebar.color;
    return `
/* ${theme.name}: selected sidebar item (top-level and nested) must stay readable */
${sel} .MuiListItemButton-root.Mui-selected,
${sel} .MuiListItemButton-root.Mui-selected .MuiListItemText-primary,
${sel} .MuiListItemButton-root.Mui-selected .MuiTypography-root,
${sel} .MuiListItemButton-root.Mui-selected .MuiSvgIcon-root,
${sel} .MuiListItemButton-root.Mui-selected svg {
  color: ${selectedColor} !important;
  fill: ${selectedColor} !important;
}
/* Keep hovered (not selected) items using the normal idle sidebar colour so
   hover never produces an unreadable combination either. */
${sel} .MuiListItemButton-root:hover:not(.Mui-selected) .MuiListItemText-primary,
${sel} .MuiListItemButton-root:hover:not(.Mui-selected) .MuiSvgIcon-root {
  color: ${idleColor} !important;
  fill: ${idleColor} !important;
}`;
  }).join('\n');
}

function ensureStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = buildCss();
  document.head.appendChild(style);
}

const FESTIVE_NAMES = new Set(FESTIVE_THEMES.map(t => t.name as string));

/**
 * Reflect the active theme onto <html data-festive-theme> and ensure the
 * contrast stylesheet exists. Call this whenever the active theme changes.
 * Passing a non-festive (or undefined) name clears the attribute so the
 * overrides stop applying.
 */
export function applyContrastFix(themeName: string | undefined | null): void {
  const root = document.documentElement;
  if (themeName && FESTIVE_NAMES.has(themeName)) {
    ensureStyle();
    root.setAttribute(ATTR, themeName);
  } else {
    root.removeAttribute(ATTR);
  }
}
