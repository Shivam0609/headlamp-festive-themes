/**
 * Ambient festive effects engine (richer visuals).
 *
 * Framework-agnostic DOM controller (no React) that paints a fixed,
 * pointer-events:none overlay ON TOP of Headlamp's UI with per-theme particles.
 * The visuals are ported/adapted from the project's static festive themes
 * (scripts/static/themes/*): layered firework shells with trailing, gravity-
 * drooping sparks (Diwali / New Year), snow + a soft aurora glow (Christmas),
 * and gulal powder puffs + drifting color clouds (Holi). New Year also gets
 * falling confetti + streamers.
 *
 * Design constraints (unchanged):
 *  - All nodes live in a single container (#festive-fx) → teardown is one remove().
 *  - All timers tracked and cleared on stop() to avoid leaks on theme switch.
 *  - Motion fully disabled under prefers-reduced-motion (JS guard + CSS query).
 *  - Injected <style> scoped under #festive-fx so it cannot affect Headlamp.
 *  - Overlay sits above the opaque app shell (z-index) but pointer-events:none,
 *    so the UI stays fully clickable.
 */

type EffectKind = 'diwali' | 'christmas' | 'holi' | 'newyear';

const CONTAINER_ID = 'festive-fx';
const STYLE_ID = 'festive-fx-style';

/** Map a registered theme name to its effect kind. */
const THEME_EFFECTS: Record<string, EffectKind> = {
  Diwali: 'diwali',
  Christmas: 'christmas',
  Holi: 'holi',
  'New Year': 'newyear',
};

const DIWALI_HUES = ['#ffb627', '#ff7b00', '#ff5da2', '#ffd166', '#4ade80', '#58a6ff'];
const NY_HUES = ['#ffd700', '#ffe780', '#ffffff', '#d8dde6', '#ff4fa3', '#b388ff'];
const HOLI_HUES = ['#ff2e97', '#ff9f1c', '#19b36b', '#8a4fff', '#28c2ff', '#ffd600', '#ff5a5a'];

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

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Is our layer still the live one? Guards async spawns after teardown. */
function isLive(layer: HTMLElement): boolean {
  return document.getElementById(CONTAINER_ID) === layer;
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

/* ===================== shared aerial firework burst ====================== */

/**
 * A realistic aerial shell: a central flash plus one or two concentric rings of
 * trailed sparks that fly outward and droop with gravity. Used by Diwali and
 * New Year (hue palette differs per theme).
 */
function burstAt(layer: HTMLElement, leftVw: number, topVh: number, hue: string): void {
  if (!isLive(layer)) return;
  const node = document.createElement('div');
  node.className = 'ff-burst';
  node.style.left = leftVw + 'vw';
  node.style.top = topVh + 'vh';

  const flash = document.createElement('span');
  flash.className = 'ff-flash';
  flash.style.color = hue;
  node.appendChild(flash);

  const rings = [
    { count: 26, radius: rand(85, 130), dur: 1.5 },
    { count: 16, radius: rand(45, 70), dur: 1.2 },
  ];
  for (const ring of rings) {
    for (let i = 0; i < ring.count; i++) {
      const angle = (Math.PI * 2 * i) / ring.count + rand(-0.08, 0.08);
      const dist = ring.radius * rand(0.82, 1.12);
      const spark = document.createElement('span');
      spark.className = 'ff-spark';
      spark.style.color = hue;
      spark.style.setProperty('--dx', Math.cos(angle) * dist + 'px');
      spark.style.setProperty('--dy', Math.sin(angle) * dist + 'px');
      spark.style.setProperty('--gy', rand(24, 46) + 'px');
      spark.style.setProperty('--dur', ring.dur + 's');
      spark.style.setProperty('--ang', (angle * 180) / Math.PI + 'deg');
      node.appendChild(spark);
    }
  }
  layer.appendChild(node);
  track(window.setTimeout(() => node.remove(), 1900));
}

/** A rising rocket that streaks up to an apex, then detonates into a burst. */
function launchRocket(layer: HTMLElement, hue: string): void {
  const leftVw = rand(8, 92);
  const apexVh = rand(8, 34);
  const launchVh = apexVh + rand(18, 32);

  const rocket = document.createElement('span');
  rocket.className = 'ff-rocket';
  rocket.style.left = leftVw + 'vw';
  rocket.style.top = launchVh + 'vh';
  rocket.style.color = hue;
  rocket.style.setProperty('--rise', `-${launchVh - apexVh}vh`);
  layer.appendChild(rocket);

  track(
    window.setTimeout(() => {
      rocket.remove();
      burstAt(layer, leftVw, apexVh, hue);
    }, 650),
  );
}

/* ============================= Diwali ==================================== */

function startDiwali(layer: HTMLElement): void {
  // Floating diya sparkles drifting upward.
  for (let i = 0; i < 26; i++) {
    const s = document.createElement('span');
    s.className = 'ff-sparkle';
    const size = rand(3, 8);
    const hue = pick(['#ffb627', '#ff7b00', '#ff5da2', '#ffd166']);
    s.style.left = rand(0, 100) + 'vw';
    s.style.width = size + 'px';
    s.style.height = size + 'px';
    s.style.color = hue;
    s.style.background = hue;
    s.style.animationDuration = rand(7, 16) + 's';
    s.style.animationDelay = -rand(0, 16) + 's';
    layer.appendChild(s);
  }
  // Periodic firework shells launched by rockets.
  const loop = () => {
    track(
      window.setTimeout(() => {
        if (!isLive(layer)) return;
        launchRocket(layer, pick(DIWALI_HUES));
        if (Math.random() < 0.4) {
          track(
            window.setTimeout(() => {
              if (isLive(layer)) launchRocket(layer, pick(DIWALI_HUES));
            }, rand(300, 700)),
          );
        }
        loop();
      }, rand(1400, 3600)),
    );
  };
  loop();
}

/* ============================ New Year =================================== */

function startNewYear(layer: HTMLElement): void {
  // Falling confetti.
  for (let i = 0; i < 70; i++) {
    const c = document.createElement('span');
    c.className = 'ff-confetti';
    c.style.left = rand(0, 100) + 'vw';
    c.style.background = pick(NY_HUES);
    const w = rand(5, 10);
    c.style.width = w + 'px';
    c.style.height = (Math.random() < 0.3 ? 4 : rand(8, 15)) + 'px';
    c.style.animationDuration = rand(6, 13) + 's';
    c.style.animationDelay = -rand(0, 13) + 's';
    c.style.setProperty('--drift', rand(10, 50) + 'px');
    c.style.setProperty('--spin', rand(180, 720) + 'deg');
    layer.appendChild(c);
  }
  // Periodic gold/silver bursts.
  const loop = () => {
    track(
      window.setTimeout(() => {
        if (!isLive(layer)) return;
        burstAt(layer, rand(10, 90), rand(8, 34), pick(NY_HUES));
        loop();
      }, rand(2000, 4800)),
    );
  };
  loop();
}

/* ============================ Christmas ================================== */

function startChristmas(layer: HTMLElement): void {
  // Soft aurora glow near the top.
  const aurora = document.createElement('div');
  aurora.className = 'ff-aurora';
  layer.appendChild(aurora);

  // Falling, swaying snow.
  for (let i = 0; i < 46; i++) {
    const flake = document.createElement('span');
    flake.className = 'ff-snow';
    const size = rand(2, 7);
    flake.style.left = rand(0, 100) + 'vw';
    flake.style.width = size + 'px';
    flake.style.height = size + 'px';
    flake.style.setProperty('--drift', rand(-30, 30).toFixed(0) + 'px');
    flake.style.animationDuration = rand(6, 14) + 's';
    flake.style.animationDelay = -rand(0, 14) + 's';
    layer.appendChild(flake);
  }
  // Occasional gentle twinkle star-bursts.
  const loop = () => {
    track(
      window.setTimeout(() => {
        if (!isLive(layer)) return;
        twinkle(layer);
        loop();
      }, rand(2600, 5200)),
    );
  };
  loop();
}

function twinkle(layer: HTMLElement): void {
  const node = document.createElement('div');
  node.className = 'ff-burst';
  node.style.left = rand(10, 90) + 'vw';
  node.style.top = rand(6, 30) + 'vh';
  const hue = pick(['#a5e6ff', '#ffffff', '#6fd3ff']);
  const flash = document.createElement('span');
  flash.className = 'ff-flash';
  flash.style.color = hue;
  node.appendChild(flash);
  for (let i = 0; i < 10; i++) {
    const angle = (Math.PI * 2 * i) / 10;
    const dist = rand(30, 55);
    const spark = document.createElement('span');
    spark.className = 'ff-spark';
    spark.style.color = hue;
    spark.style.setProperty('--dx', Math.cos(angle) * dist + 'px');
    spark.style.setProperty('--dy', Math.sin(angle) * dist + 'px');
    spark.style.setProperty('--gy', '8px');
    spark.style.setProperty('--dur', '1.3s');
    spark.style.setProperty('--ang', (angle * 180) / Math.PI + 'deg');
    node.appendChild(spark);
  }
  layer.appendChild(node);
  track(window.setTimeout(() => node.remove(), 1500));
}

/* ============================== Holi ===================================== */

function startHoli(layer: HTMLElement): void {
  // Falling color specks.
  for (let i = 0; i < 90; i++) {
    const s = document.createElement('span');
    s.className = 'ff-speck';
    s.style.left = rand(0, 100) + 'vw';
    s.style.background = pick(HOLI_HUES);
    const size = rand(4, 10);
    s.style.width = size + 'px';
    s.style.height = size + 'px';
    s.style.animationDuration = rand(6, 14) + 's';
    s.style.animationDelay = -rand(0, 14) + 's';
    s.style.setProperty('--drift', rand(12, 52) + 'px');
    layer.appendChild(s);
  }
  // Periodic gulal powder puffs.
  const loop = () => {
    track(
      window.setTimeout(() => {
        if (!isLive(layer)) return;
        puff(layer);
        if (Math.random() < 0.4) {
          track(
            window.setTimeout(() => {
              if (isLive(layer)) puff(layer);
            }, rand(250, 650)),
          );
        }
        loop();
      }, rand(1400, 3600)),
    );
  };
  loop();
}

function puff(layer: HTMLElement): void {
  if (!isLive(layer)) return;
  const hue = pick(HOLI_HUES);
  const hue2 = Math.random() < 0.5 ? pick(HOLI_HUES) : hue;
  const node = document.createElement('div');
  node.className = 'ff-puff';
  node.style.left = rand(12, 88) + 'vw';
  node.style.top = rand(14, 62) + 'vh';
  const grains = 26;
  const radius = rand(60, 110);
  for (let i = 0; i < grains; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = radius * rand(0.3, 1);
    const grain = document.createElement('span');
    grain.className = 'ff-grain';
    grain.style.setProperty('--dx', Math.cos(angle) * dist + 'px');
    grain.style.setProperty('--dy', Math.sin(angle) * dist + 'px');
    grain.style.setProperty('--dur', rand(1.5, 2.4) + 's');
    grain.style.background = i % 2 === 0 ? hue : hue2;
    const sz = rand(10, 24);
    grain.style.width = sz + 'px';
    grain.style.height = sz + 'px';
    grain.style.margin = -sz / 2 + 'px';
    node.appendChild(grain);
  }
  layer.appendChild(node);
  track(window.setTimeout(() => node.remove(), 2600));
}

/* ============================== public =================================== */

/** Start the ambient effect for a theme. Replaces any running effect. */
export function startEffectsForTheme(themeName: string | undefined | null): void {
  stopEffects();
  if (!themeName) return;
  const kind = THEME_EFFECTS[themeName];
  if (!kind) return;

  ensureStyle();
  const layer = getContainer();
  activeEffect = kind;

  if (prefersReducedMotion()) {
    // Palette + contrast only; no particles.
    stopEffects();
    return;
  }

  if (kind === 'diwali') startDiwali(layer);
  else if (kind === 'newyear') startNewYear(layer);
  else if (kind === 'christmas') startChristmas(layer);
  else if (kind === 'holi') startHoli(layer);
}

/** Tear down all effects: clear timers and remove the overlay. */
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

/** Scoped CSS for the overlay and particles. */
const CSS = `
#${CONTAINER_ID} {
  position: fixed;
  inset: 0;
  pointer-events: none;        /* never intercept clicks — purely decorative */
  overflow: hidden;
  /* Headlamp's app shell paints opaque theme-colored backgrounds, so a
     behind-content layer (z-index:0) is fully covered. Overlay ABOVE the app;
     pointer-events:none keeps the whole UI clickable. Below MUI modals (1300). */
  z-index: 1200;
}

/* ---- shared aerial burst ---- */
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
  animation: ff-sparkburst var(--dur, 1.4s) cubic-bezier(0.15,0.6,0.3,1) forwards;
}
#${CONTAINER_ID} .ff-spark::before {
  content: ""; position: absolute; left: 50%; top: 50%;
  width: 2px; height: 16px; border-radius: 2px;
  background: linear-gradient(to top, currentColor, transparent);
  transform: translate(-50%, 0) rotate(calc(var(--ang, 0deg) - 90deg));
  transform-origin: top center; opacity: 0.7;
}
@keyframes ff-sparkburst {
  0% { transform: translate(0,0) scale(1.1); opacity: 1; }
  70% { opacity: 1; }
  100% { transform: translate(var(--dx), calc(var(--dy) + var(--gy))) scale(0.3); opacity: 0; }
}
#${CONTAINER_ID} .ff-rocket {
  position: absolute; width: 3px; height: 10px; border-radius: 2px;
  box-shadow: 0 0 8px 3px currentColor, 0 10px 10px -2px currentColor;
  animation: ff-launch 0.7s ease-out forwards;
}
@keyframes ff-launch {
  0% { transform: translateY(0) scaleY(1); opacity: 1; }
  85% { opacity: 1; }
  100% { transform: translateY(var(--rise)) scaleY(0.5); opacity: 0; }
}

/* ---- Diwali sparkles ---- */
#${CONTAINER_ID} .ff-sparkle {
  position: absolute; bottom: -12px; border-radius: 50%; opacity: 0;
  filter: blur(0.3px); box-shadow: 0 0 8px 2px currentColor;
  animation-name: ff-float; animation-timing-function: ease-in-out;
  animation-iteration-count: infinite;
}
@keyframes ff-float {
  0% { transform: translateY(0) scale(0.6); opacity: 0; }
  12% { opacity: 0.9; }
  50% { transform: translateY(-52vh) scale(1); opacity: 1; }
  88% { opacity: 0.8; }
  100% { transform: translateY(-104vh) scale(0.5); opacity: 0; }
}

/* ---- Christmas snow + aurora ---- */
#${CONTAINER_ID} .ff-snow {
  position: absolute; top: -4vh; border-radius: 50%; background: #ffffff;
  box-shadow: 0 0 4px 1px rgba(255,255,255,0.6); opacity: 0;
  animation-name: ff-fall; animation-timing-function: linear;
  animation-iteration-count: infinite;
}
@keyframes ff-fall {
  0% { transform: translateY(0) translateX(0); opacity: 0; }
  10% { opacity: 0.9; }
  50% { transform: translateY(52vh) translateX(var(--drift)); opacity: 1; }
  90% { opacity: 0.85; }
  100% { transform: translateY(108vh) translateX(calc(var(--drift) * -1)); opacity: 0; }
}
#${CONTAINER_ID} .ff-aurora {
  position: absolute; top: -12vh; left: 50%; transform: translateX(-50%);
  width: 92vw; height: 38vh; pointer-events: none;
  background: radial-gradient(ellipse at center,
    rgba(47,158,68,0.10) 0%, rgba(122,209,163,0.05) 42%, transparent 72%);
  animation: ff-aurora 9s ease-in-out infinite;
}
@keyframes ff-aurora {
  0%, 100% { opacity: 0.6; transform: translateX(-50%) scale(1); }
  50% { opacity: 1; transform: translateX(-50%) scale(1.05); }
}

/* ---- New Year confetti ---- */
#${CONTAINER_ID} .ff-confetti {
  position: absolute; top: -4vh; border-radius: 1px; opacity: 0.9;
  animation-name: ff-confetti; animation-timing-function: linear;
  animation-iteration-count: infinite;
}
@keyframes ff-confetti {
  0% { transform: translateY(0) translateX(0) rotate(0); opacity: 0; }
  10% { opacity: 0.95; }
  100% { transform: translateY(110vh) translateX(var(--drift)) rotate(var(--spin)); opacity: 0.4; }
}

/* ---- Holi specks + powder puffs ---- */
#${CONTAINER_ID} .ff-speck {
  position: absolute; top: -4vh; border-radius: 50%; opacity: 0;
  animation-name: ff-fall; animation-timing-function: linear;
  animation-iteration-count: infinite;
}
#${CONTAINER_ID} .ff-puff { position: absolute; width: 0; height: 0; }
#${CONTAINER_ID} .ff-grain {
  position: absolute; left: 0; top: 0; border-radius: 50%;
  filter: blur(2px); opacity: 0;
  animation: ff-grain var(--dur, 2s) ease-out forwards;
}
@keyframes ff-grain {
  0% { transform: translate(0,0) scale(0.4); opacity: 0; }
  20% { opacity: 0.75; }
  100% { transform: translate(var(--dx), var(--dy)) scale(1.1); opacity: 0; }
}

@media (prefers-reduced-motion: reduce) {
  #${CONTAINER_ID} { display: none !important; }
}
`;
