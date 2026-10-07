/**
 * Ambient festive effects engine.
 *
 * This is a framework-agnostic DOM controller (no React) that paints a fixed,
 * pointer-events:none backdrop layer behind Headlamp's UI with per-theme
 * particles: snow for Christmas, fireworks/sparkles for Diwali & New Year, and
 * color splashes for Holi.
 *
 * Design constraints:
 *  - All nodes live in a single container (#festive-fx) appended to <body>,
 *    so teardown is a single remove().
 *  - All timers are tracked and cleared on stop() to avoid leaks when the user
 *    switches themes or disables effects.
 *  - Motion is fully disabled under prefers-reduced-motion (and via a CSS
 *    media query) so the plugin stays accessible.
 *  - The injected <style> is scoped under #festive-fx class names so it cannot
 *    affect Headlamp's own components.
 */

type EffectKind = 'snow' | 'fireworks' | 'splash';

const CONTAINER_ID = 'festive-fx';
const STYLE_ID = 'festive-fx-style';

/** Map a registered theme name to the kind of particle effect it uses. */
const THEME_EFFECTS: Record<string, EffectKind> = {
  Christmas: 'snow',
  Diwali: 'fireworks',
  'New Year': 'fireworks',
  Holi: 'splash',
};

const FIREWORK_HUES = ['#ffb627', '#ff7b00', '#ff5da2', '#ffd166', '#4ade80', '#58a6ff'];
const SPLASH_HUES = ['#e91e63', '#00bcd4', '#8bc34a', '#ff9800', '#9c27b0', '#ffeb3b'];

let timers: number[] = [];
let activeEffect: EffectKind | null = null;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function track(id: number): number {
  timers.push(id);
  return id;
}

function ensureStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}

function getContainer(): HTMLElement {
  let el = document.getElementById(CONTAINER_ID);
  if (!el) {
    el = document.createElement('div');
    el.id = CONTAINER_ID;
    el.setAttribute('aria-hidden', 'true');
    document.body.insertBefore(el, document.body.firstChild);
  }
  return el;
}

/* ------------------------------ snow ------------------------------------ */

function startSnow(layer: HTMLElement): void {
  const FLAKES = 40;
  for (let i = 0; i < FLAKES; i++) {
    const flake = document.createElement('span');
    flake.className = 'ff-snow';
    const size = 2 + Math.random() * 5;
    flake.style.left = Math.random() * 100 + 'vw';
    flake.style.width = size + 'px';
    flake.style.height = size + 'px';
    flake.style.setProperty('--drift', (Math.random() * 60 - 30).toFixed(0) + 'px');
    flake.style.animationDuration = 6 + Math.random() * 8 + 's';
    flake.style.animationDelay = -Math.random() * 12 + 's';
    layer.appendChild(flake);
  }
}

/* --------------------------- fireworks ---------------------------------- */

function scheduleFireworks(layer: HTMLElement): void {
  const loop = () => {
    const delay = 1400 + Math.random() * 2200;
    track(
      window.setTimeout(() => {
        if (document.getElementById(CONTAINER_ID) !== layer) return;
        burst(layer);
        if (Math.random() < 0.4) {
          track(
            window.setTimeout(() => {
              if (document.getElementById(CONTAINER_ID) === layer) burst(layer);
            }, 300 + Math.random() * 400),
          );
        }
        loop();
      }, delay),
    );
  };
  loop();
}

function burst(layer: HTMLElement): void {
  const hue = FIREWORK_HUES[Math.floor(Math.random() * FIREWORK_HUES.length)];
  const leftVw = 8 + Math.random() * 84;
  const topVh = 8 + Math.random() * 30;

  const node = document.createElement('div');
  node.className = 'ff-burst';
  node.style.left = leftVw + 'vw';
  node.style.top = topVh + 'vh';

  const flash = document.createElement('span');
  flash.className = 'ff-flash';
  flash.style.color = hue;
  node.appendChild(flash);

  const COUNT = 26;
  const radius = 80 + Math.random() * 50;
  for (let i = 0; i < COUNT; i++) {
    const angle = (Math.PI * 2 * i) / COUNT + (Math.random() - 0.5) * 0.15;
    const dist = radius * (0.82 + Math.random() * 0.3);
    const spark = document.createElement('span');
    spark.className = 'ff-spark';
    spark.style.color = hue;
    spark.style.setProperty('--dx', Math.cos(angle) * dist + 'px');
    spark.style.setProperty('--dy', Math.sin(angle) * dist + 'px');
    spark.style.setProperty('--gy', 26 + Math.random() * 20 + 'px');
    node.appendChild(spark);
  }

  layer.appendChild(node);
  track(window.setTimeout(() => node.remove(), 1800));
}

/* ---------------------------- splash ------------------------------------ */

function scheduleSplash(layer: HTMLElement): void {
  const loop = () => {
    const delay = 700 + Math.random() * 1400;
    track(
      window.setTimeout(() => {
        if (document.getElementById(CONTAINER_ID) !== layer) return;
        splash(layer);
        loop();
      }, delay),
    );
  };
  loop();
}

function splash(layer: HTMLElement): void {
  const hue = SPLASH_HUES[Math.floor(Math.random() * SPLASH_HUES.length)];
  const blob = document.createElement('span');
  blob.className = 'ff-splash';
  const size = 60 + Math.random() * 160;
  blob.style.left = Math.random() * 100 + 'vw';
  blob.style.top = Math.random() * 100 + 'vh';
  blob.style.width = size + 'px';
  blob.style.height = size + 'px';
  blob.style.background = hue;
  layer.appendChild(blob);
  track(window.setTimeout(() => blob.remove(), 1400));
}

/* ------------------------------ public ---------------------------------- */

/**
 * Start the ambient effect for a given theme name. Replaces any running
 * effect. Does nothing if the theme has no effect mapping.
 */
export function startEffectsForTheme(themeName: string | undefined | null): void {
  stopEffects();
  if (!themeName) return;
  const kind = THEME_EFFECTS[themeName];
  if (!kind) return;

  ensureStyle();
  const layer = getContainer();
  activeEffect = kind;

  // Respect reduced-motion: keep the (empty) layer out entirely.
  if (prefersReducedMotion()) {
    stopEffects();
    return;
  }

  if (kind === 'snow') startSnow(layer);
  else if (kind === 'fireworks') scheduleFireworks(layer);
  else if (kind === 'splash') scheduleSplash(layer);
}

/** Tear down all effects: clear timers and remove the backdrop layer. */
export function stopEffects(): void {
  timers.forEach(id => window.clearTimeout(id));
  timers = [];
  const el = document.getElementById(CONTAINER_ID);
  if (el) el.remove();
  activeEffect = null;
}

export function getActiveEffect(): EffectKind | null {
  return activeEffect;
}

/** Scoped CSS for the backdrop layer and particles. */
const CSS = `
#${CONTAINER_ID} {
  position: fixed;
  inset: 0;
  pointer-events: none;        /* never intercept clicks — purely decorative */
  overflow: hidden;
  /* Headlamp's app shell paints opaque theme-colored backgrounds, so a
     behind-content layer (z-index:0) is fully covered and the effects are
     invisible. Overlay ABOVE the app instead; pointer-events:none above keeps
     the whole UI clickable. Just under MUI modals/tooltips (1300+). */
  z-index: 1200;
}
#${CONTAINER_ID} .ff-snow {
  position: absolute;
  top: -4vh;
  border-radius: 50%;
  background: #ffffff;
  box-shadow: 0 0 4px 1px rgba(255,255,255,0.6);
  opacity: 0;
  animation-name: ff-fall;
  animation-timing-function: linear;
  animation-iteration-count: infinite;
}
@keyframes ff-fall {
  0%   { transform: translateY(0) translateX(0); opacity: 0; }
  10%  { opacity: 0.9; }
  50%  { transform: translateY(52vh) translateX(var(--drift)); opacity: 1; }
  90%  { opacity: 0.85; }
  100% { transform: translateY(108vh) translateX(calc(var(--drift) * -1)); opacity: 0; }
}
#${CONTAINER_ID} .ff-burst { position: absolute; width: 0; height: 0; }
#${CONTAINER_ID} .ff-flash {
  position: absolute; left: -6px; top: -6px; width: 12px; height: 12px;
  border-radius: 50%; box-shadow: 0 0 24px 10px currentColor;
  animation: ff-flash 0.45s ease-out forwards;
}
@keyframes ff-flash {
  0% { transform: scale(0.4); opacity: 1; }
  100% { transform: scale(2.2); opacity: 0; }
}
#${CONTAINER_ID} .ff-spark {
  position: absolute; left: 0; top: 0; width: 4px; height: 4px;
  border-radius: 50%; box-shadow: 0 0 8px 2px currentColor;
  animation: ff-sparkburst 1.4s cubic-bezier(0.15,0.6,0.3,1) forwards;
}
@keyframes ff-sparkburst {
  0% { transform: translate(0,0) scale(1.1); opacity: 1; }
  70% { opacity: 1; }
  100% { transform: translate(var(--dx), calc(var(--dy) + var(--gy))) scale(0.3); opacity: 0; }
}
#${CONTAINER_ID} .ff-splash {
  position: absolute; border-radius: 50%;
  opacity: 0; filter: blur(1px);
  animation: ff-splash 1.4s ease-out forwards;
}
@keyframes ff-splash {
  0% { transform: scale(0.2); opacity: 0; }
  25% { opacity: 0.55; }
  100% { transform: scale(1.3); opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
  #${CONTAINER_ID} { display: none !important; }
}
`;
