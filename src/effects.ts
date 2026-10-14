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

type EffectKind =
  | 'diwali'
  | 'christmas'
  | 'holi'
  | 'newyear'
  | 'dussehra'
  | 'eid'
  | 'halloween';

const CONTAINER_ID = 'festive-fx';
const STYLE_ID = 'festive-fx-style';

/** Map a registered theme name to its effect kind. */
const THEME_EFFECTS: Record<string, EffectKind> = {
  Diwali: 'diwali',
  Christmas: 'christmas',
  Holi: 'holi',
  'New Year': 'newyear',
  Dussehra: 'dussehra',
  Eid: 'eid',
  Halloween: 'halloween',
};

// DOM particle palettes. (Diwali/New Year fireworks use the HSL *_FW_HUES
// arrays with the canvas engine; these drive the DOM confetti/specks/sparkles.)
const NY_HUES = ['#ffd700', '#ffe780', '#ffffff', '#d8dde6', '#ff4fa3', '#b388ff'];
const HOLI_HUES = ['#ff2e97', '#ff9f1c', '#19b36b', '#8a4fff', '#28c2ff', '#ffd600', '#ff5a5a'];
// Dussehra: warm bonfire ember colors (the burning Ravana effigy).
const DUSSEHRA_HUES = ['#ff9a1f', '#ff6a00', '#e4342b', '#ffd166', '#ffb347'];

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

/* ===================== canvas firework engine =========================== */
/**
 * Canvas-based firework particle system, ported from the realism demo with the
 * approved tuning (Willow shape, 185 sparks/shell, gravity 0.078, drag 0.96,
 * spread 5.6, trail 0.82, crackle on). Used by Diwali and New Year. Real
 * physics: each spark has velocity, air drag, gravity, size/hue/life jitter,
 * and a staggered fade; shells are launched by rising rockets and detonate at
 * an apex. Everything draws to a single <canvas> inside #festive-fx, additively
 * blended for glow. Teardown cancels the RAF loop and removes the canvas.
 */

// Approved demo settings (see demo/fireworks-demo.html), tuned down for
// performance so the overlay does not steal frame budget from the Headlamp UI
// (notably during scroll). sparks/crackle were the dominant cost; halving them
// roughly halves per-frame work with little visible difference on moving shells.
const FW = {
  sparks: 90, // was 185 — per-shell particle count (linear CPU cost)
  gravity: 0.078, // px/frame^2 (dt-scaled)
  drag: 0.96, // velocity retained per frame
  speed: 5.6, // initial spread speed
  trail: 0.82, // 0..1 — higher = longer trails (lower per-frame clear alpha)
  shape: 'willow' as const,
  crackle: true,
  crackleChance: 0.05, // was 0.12 — crackle spawns 6 extra sparks per death
};

/**
 * Target frame interval for the canvas loop. We throttle to ~30fps: fireworks
 * read fine at 30fps and this halves per-frame paint/composite cost vs 60fps.
 * The physics are dt-scaled, so motion speed is unchanged.
 */
const FRAME_INTERVAL_MS = 1000 / 30;

/**
 * How long after the last scroll event we keep the canvas paused. Pausing the
 * RAF loop WHILE the user scrolls frees the compositor to move the UI smoothly;
 * we resume shortly after scrolling stops. Visually unnoticeable, decisive for
 * scroll smoothness.
 */
const SCROLL_PAUSE_MS = 180;

interface Spark {
  x: number;
  y: number;
  px: number; // previous x (for the short motion-blur tail)
  py: number; // previous y
  vx: number;
  vy: number;
  life: number;
  decay: number;
  size: number;
  hue: number; // HSL hue
  light: number; // HSL lightness
  willow: boolean;
  canCrackle: boolean;
}
interface Flash {
  x: number;
  y: number;
  life: number;
  hue: number;
}
interface Rocket {
  x: number;
  y: number;
  targetY: number;
  hue: number;
}

// Hues (HSL) tuned per theme: Diwali warm/mixed, New Year gold/platinum/pink.
const DIWALI_FW_HUES = [45, 32, 330, 48, 140, 210];
const NY_FW_HUES = [48, 45, 300, 265, 150, 210];

interface CanvasFx {
  canvas: HTMLCanvasElement;
  raf: number;
  stop: () => void;
}
let canvasFx: CanvasFx | null = null;

/** Start the canvas firework loop inside `layer` using the given HSL hues. */
function startCanvasFireworks(layer: HTMLElement, hues: number[]): void {
  const canvas = document.createElement('canvas');
  canvas.className = 'ff-canvas';
  layer.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Cap device-pixel-ratio at 1 for the effects canvas. On HiDPI screens the
  // default (2) means ~4x the pixels to fill + additively blend every frame,
  // which is the dominant GPU cost. Fireworks are moving/blurred, so 1x looks
  // nearly identical while cutting fill cost by up to ~75%.
  const dpr = 1;
  const resize = () => {
    canvas.width = Math.floor(innerWidth * dpr);
    canvas.height = Math.floor(innerHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  window.addEventListener('resize', resize);

  const sparks: Spark[] = [];
  const flashes: Flash[] = [];
  const rockets: Rocket[] = [];

  function spawnShell(x: number, y: number): void {
    const baseHue = pick(hues);
    for (let i = 0; i < FW.sparks; i++) {
      const ang = Math.random() * Math.PI * 2;
      // Filled sphere: dense core, thinner edge (sqrt distribution).
      const r = FW.speed * Math.sqrt(Math.random()) * rand(0.85, 1.15);
      sparks.push({
        x,
        y,
        px: x,
        py: y,
        vx: Math.cos(ang) * r,
        vy: Math.sin(ang) * r,
        life: 1,
        decay: rand(0.006, 0.016) * (FW.shape === 'willow' ? 0.6 : 1),
        size: rand(1, 3.2),
        hue: baseHue + rand(-12, 12),
        light: rand(55, 75),
        willow: FW.shape === 'willow',
        canCrackle: FW.crackle && Math.random() < FW.crackleChance,
      });
    }
    flashes.push({ x, y, life: 1, hue: baseHue });
  }

  function launchAuto(): void {
    const x = rand(innerWidth * 0.12, innerWidth * 0.88);
    const y = rand(innerHeight * 0.08, innerHeight * 0.42);
    rockets.push({ x, y: y + rand(120, 240), targetY: y, hue: pick(hues) });
  }

  let last = performance.now();
  let autoTimer = 0;
  let raf = 0;

  // Loop control: pause while the user is actively scrolling and while the tab
  // is hidden, so the overlay never competes with the UI for frame budget when
  // it matters most. `paused` short-circuits the simulation; the RAF keeps
  // ticking cheaply (no draw) so we resume instantly when scrolling stops.
  let paused = false;
  let scrollTimer = 0;

  function frame(now: number): void {
    // Always schedule the next tick first (cheap no-op path when paused).
    raf = window.requestAnimationFrame(frame);

    if (paused) {
      // Keep `last` current so dt does not spike when we resume.
      last = now;
      return;
    }

    // Throttle to ~30fps: skip frames until the target interval has elapsed.
    const elapsed = now - last;
    if (elapsed < FRAME_INTERVAL_MS) return;

    const dt = Math.min(2, elapsed / 16.67);
    last = now;

    // IMPORTANT: this canvas sits ON TOP of the Headlamp UI. We must NOT paint
    // a translucent black "fade" rectangle each frame (the old demo trail
    // technique) — on an overlay that stacks into an opaque black sheet that
    // hides the whole app. Instead we fully CLEAR the transparent canvas every
    // frame and let each spark's own alpha (life) fade it out. Trails are drawn
    // per-spark below as short local tails, so there is still motion blur
    // without ever darkening the UI.
    ctx!.clearRect(0, 0, innerWidth, innerHeight);
    ctx!.globalCompositeOperation = 'lighter';

    // rockets
    for (let i = rockets.length - 1; i >= 0; i--) {
      const r = rockets[i];
      r.y -= 6 * dt;
      ctx!.beginPath();
      ctx!.fillStyle = 'hsl(' + r.hue + ',90%,70%)';
      ctx!.arc(r.x, r.y, 2, 0, Math.PI * 2);
      ctx!.fill();
      if (r.y <= r.targetY) {
        spawnShell(r.x, r.targetY);
        rockets.splice(i, 1);
      }
    }
    // flashes
    for (let i = flashes.length - 1; i >= 0; i--) {
      const f = flashes[i];
      f.life -= 0.08 * dt;
      if (f.life <= 0) {
        flashes.splice(i, 1);
        continue;
      }
      ctx!.beginPath();
      ctx!.fillStyle = 'hsla(' + f.hue + ',90%,85%,' + f.life + ')';
      ctx!.arc(f.x, f.y, 14 * f.life + 2, 0, Math.PI * 2);
      ctx!.fill();
    }
    // sparks
    const dragF = Math.pow(FW.drag, dt);
    for (let i = sparks.length - 1; i >= 0; i--) {
      const p = sparks[i];
      p.px = p.x;
      p.py = p.y;
      p.vx *= dragF;
      p.vy = p.vy * dragF + FW.gravity * dt * (p.willow ? 1.6 : 1);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= p.decay * dt;
      if (p.life <= 0) {
        if (p.canCrackle) {
          for (let k = 0; k < 6; k++) {
            const a = Math.random() * Math.PI * 2;
            const s = rand(0.5, 1.4);
            sparks.push({
              x: p.x,
              y: p.y,
              px: p.x,
              py: p.y,
              vx: Math.cos(a) * s,
              vy: Math.sin(a) * s,
              life: 1,
              decay: rand(0.04, 0.08),
              size: 1.4,
              hue: p.hue,
              light: 90,
              willow: false,
              canCrackle: false,
            });
          }
        }
        sparks.splice(i, 1);
        continue;
      }
      const alpha = Math.max(0, p.life);
      // Short motion-blur tail: a thin line from the previous to current
      // position (local, so it never darkens the UI like a full-screen fade).
      ctx!.strokeStyle = 'hsla(' + p.hue + ',95%,' + p.light + '%,' + alpha * 0.5 + ')';
      ctx!.lineWidth = p.size * 0.9;
      ctx!.beginPath();
      ctx!.moveTo(p.px, p.py);
      ctx!.lineTo(p.x, p.y);
      ctx!.stroke();
      // The bright spark head.
      ctx!.beginPath();
      ctx!.fillStyle = 'hsla(' + p.hue + ',95%,' + p.light + '%,' + alpha + ')';
      ctx!.arc(p.x, p.y, p.size * (0.4 + p.life * 0.6), 0, Math.PI * 2);
      ctx!.fill();
    }

    autoTimer -= dt;
    if (autoTimer <= 0) {
      launchAuto();
      autoTimer = rand(90, 200); // cadence between shells (frames) — longer = lighter
    }
    // Note: the next frame is scheduled at the TOP of frame(), not here.
  }

  // --- pause-on-scroll ---------------------------------------------------
  // Scrolling is the hot path for jank: pausing the canvas while the user
  // scrolls lets the compositor move the UI without blending a repainting,
  // full-screen layer every frame. We resume shortly after scrolling stops.
  const onScroll = () => {
    paused = true;
    if (scrollTimer) window.clearTimeout(scrollTimer);
    scrollTimer = window.setTimeout(() => {
      paused = false;
    }, SCROLL_PAUSE_MS);
  };
  // Capture scrolls from any scroller (Headlamp scrolls inner containers, not
  // just window), hence capture:true + passive for zero scroll-perf impact.
  window.addEventListener('scroll', onScroll, { capture: true, passive: true });

  // --- pause-when-hidden -------------------------------------------------
  const onVisibility = () => {
    paused = document.hidden;
    if (!document.hidden) last = performance.now();
  };
  document.addEventListener('visibilitychange', onVisibility);

  raf = window.requestAnimationFrame(frame);

  canvasFx = {
    canvas,
    raf,
    // `raf` is reassigned each frame via the closure above; cancel the latest
    // and remove every listener we added so nothing leaks on theme switch.
    stop: () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('scroll', onScroll, { capture: true } as EventListenerOptions);
      document.removeEventListener('visibilitychange', onVisibility);
      if (scrollTimer) window.clearTimeout(scrollTimer);
      canvas.remove();
    },
  };
}

/* ============================= Diwali ==================================== */

function startDiwali(layer: HTMLElement): void {
  // A few floating diya sparkles for ambient twinkle (kept sparse — the sky
  // lanterns below are now the main upward motif).
  for (let i = 0; i < 6; i++) {
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

  // Floating sky lanterns (kandeel) that rise gently from the bottom and drift
  // off the top — released periodically, often a small cluster of 1-3. Ported
  // from the reference Diwali theme (saasrt-versions diwali.effects.js/.css).
  const scheduleLantern = () => {
    track(
      window.setTimeout(() => {
        if (!isLive(layer)) return;
        const n = 1 + Math.floor(Math.random() * 2); // 1-2 at a time
        for (let i = 0; i < n; i++) {
          track(
            window.setTimeout(() => {
              if (isLive(layer)) spawnSkyLantern(layer);
            }, i * rand(500, 1100)),
          );
        }
        scheduleLantern();
      }, rand(8000, 16000)),
    );
  };
  scheduleLantern();

  // Canvas-based firework shells with real physics (approved demo settings).
  startCanvasFireworks(layer, DIWALI_FW_HUES);
}

/**
 * A glowing Kongming sky lantern that rises from below the viewport, sways side
 * to side as it ascends, and fades near the top. Shape is pure CSS (see the
 * .ff-lantern rules): a domed canopy tapering to a narrow open mouth with a
 * warm flame glowing inside. Festive paper colors from the reference.
 */
function spawnSkyLantern(layer: HTMLElement): void {
  const palette = [
    { body: '#e23b3b', light: '#ff8a6b' }, // red
    { body: '#2fb6a8', light: '#8ff0e4' }, // teal
    { body: '#f3ead2', light: '#fff6dc' }, // cream
    { body: '#f2b23b', light: '#ffe08a' }, // gold
    { body: '#eef1f4', light: '#ffffff' }, // white
    { body: '#ef73a8', light: '#ffc0dc' }, // pink
  ];
  const c = pick(palette);

  const lantern = document.createElement('span');
  lantern.className = 'ff-lantern';
  lantern.setAttribute('aria-hidden', 'true');
  lantern.style.left = rand(5, 93) + 'vw';
  lantern.style.setProperty('--scale', String(rand(0.8, 1.7)));
  lantern.style.setProperty('--body', c.body);
  lantern.style.setProperty('--light', c.light);
  lantern.style.animationDuration = rand(13, 22) + 's';
  lantern.style.setProperty('--sway', rand(10, 34) + 'px');

  lantern.innerHTML =
    '<span class="ff-lantern-canopy"><span class="ff-lantern-flame"></span></span>' +
    '<span class="ff-lantern-mouth"></span>';

  layer.appendChild(lantern);
  track(window.setTimeout(() => lantern.remove(), 23000));
}

/* ============================ New Year =================================== */

function startNewYear(layer: HTMLElement): void {
  // Falling confetti — kept sparse so it reads as a light scatter, not a storm
  // over the tables (the bursts/ball-drop are the focal celebration).
  for (let i = 0; i < 14; i++) {
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
  // Canvas-based firework shells with real physics (approved demo settings).
  startCanvasFireworks(layer, NY_FW_HUES);
}

/* ============================ Christmas ================================== */

function startChristmas(layer: HTMLElement): void {
  // Soft aurora glow near the top.
  const aurora = document.createElement('div');
  aurora.className = 'ff-aurora';
  layer.appendChild(aurora);

  // Falling, swaying snow (moderate — gentle, not a blizzard over the tables).
  for (let i = 0; i < 18; i++) {
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
  // Falling color specks — kept sparse so they read as ambient dusting, not
  // clutter over the dense tables (the saturated colour comes from the puffs).
  for (let i = 0; i < 15; i++) {
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

/* ============================= Dussehra ================================= */

/**
 * Dussehra: rising bonfire embers from the burning Ravana effigy, drifting up
 * and off the top of the viewport with a slight horizontal sway. Pure CSS
 * animation per ember (see .ff-ember), so it is cheap and self-contained.
 */
function startDussehra(layer: HTMLElement): void {
  for (let i = 0; i < 40; i++) {
    const e = document.createElement('span');
    e.className = 'ff-ember';
    const size = rand(3, 8);
    const c = pick(DUSSEHRA_HUES);
    e.style.left = rand(0, 100) + 'vw';
    e.style.width = size + 'px';
    e.style.height = size + 'px';
    e.style.background = c;
    e.style.boxShadow = `0 0 8px 2px ${c}`;
    e.style.setProperty('--drift', rand(-40, 40) + 'px');
    e.style.animationDuration = rand(5, 12) + 's';
    e.style.animationDelay = -rand(0, 12) + 's';
    layer.appendChild(e);
  }
}

/* =============================== Eid ==================================== */

/**
 * Eid al-Fitr: a calm, serene scatter of twinkling gold stars that drift gently
 * upward and fade (no fireworks). Pure CSS per-star animation (see .ff-star).
 */
function startEid(layer: HTMLElement): void {
  for (let i = 0; i < 16; i++) {
    const s = document.createElement('span');
    s.className = 'ff-star';
    const size = rand(2, 6);
    s.style.left = rand(0, 100) + 'vw';
    s.style.width = size + 'px';
    s.style.height = size + 'px';
    s.style.animationDuration = rand(8, 18) + 's';
    s.style.animationDelay = -rand(0, 18) + 's';
    layer.appendChild(s);
  }
}

/* ============================= Halloween ================================ */

/**
 * Halloween: floating ghosts rising and bobbing, bats flapping across, and
 * drifting orange embers. Ghost/bat shapes are inline SVG; embers are CSS dots.
 */
function startHalloween(layer: HTMLElement): void {
  // Floating ghosts.
  for (let i = 0; i < 6; i++) {
    const g = document.createElement('span');
    g.className = 'ff-ghost';
    g.style.left = rand(0, 92) + 'vw';
    const scale = 0.7 + Math.random() * 0.8;
    g.style.setProperty('--sway', rand(12, 38) + 'px');
    g.style.animationDuration = rand(14, 24) + 's';
    g.style.animationDelay = -rand(0, 18) + 's';
    g.innerHTML =
      `<svg width="${(34 * scale).toFixed(0)}" height="${(44 * scale).toFixed(0)}" viewBox="0 0 34 44">` +
      '<path d="M4 20 Q4 4 17 4 Q30 4 30 20 L30 40 L26 36 L22 40 L18 36 L14 40 L10 36 L6 40 Z" fill="rgba(255,255,255,0.86)"/>' +
      '<circle cx="12" cy="18" r="2.4" fill="#1a1026"/>' +
      '<circle cx="22" cy="18" r="2.4" fill="#1a1026"/>' +
      '<ellipse cx="17" cy="25" rx="2" ry="3" fill="#1a1026" opacity="0.7"/>' +
      '</svg>';
    layer.appendChild(g);
  }
  // Flying bats.
  for (let i = 0; i < 4; i++) {
    const b = document.createElement('span');
    b.className = 'ff-bat';
    b.style.top = rand(6, 56) + 'vh';
    const scale = 0.6 + Math.random() * 0.8;
    b.style.animationDuration = rand(9, 17) + 's';
    b.style.animationDelay = -rand(0, 12) + 's';
    b.innerHTML =
      `<svg width="${(36 * scale).toFixed(0)}" height="${(16 * scale).toFixed(0)}" viewBox="0 0 36 16">` +
      '<path d="M18 8 Q10 0 2 6 Q6 6 7 10 Q11 6 18 10 Q25 6 29 10 Q30 6 34 6 Q26 0 18 8 Z" fill="#0c0712"/>' +
      '</svg>';
    layer.appendChild(b);
  }
  // Drifting embers.
  for (let i = 0; i < 16; i++) {
    const e = document.createElement('span');
    e.className = 'ff-hw-ember';
    const size = rand(2, 5);
    e.style.left = rand(0, 100) + 'vw';
    e.style.width = size + 'px';
    e.style.height = size + 'px';
    e.style.animationDuration = rand(7, 16) + 's';
    e.style.animationDelay = -rand(0, 16) + 's';
    layer.appendChild(e);
  }
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
  else if (kind === 'dussehra') startDussehra(layer);
  else if (kind === 'eid') startEid(layer);
  else if (kind === 'halloween') startHalloween(layer);
}

/** Tear down all effects: clear timers, stop the canvas loop, remove overlay. */
export function stopEffects(): void {
  timers.forEach(id => window.clearTimeout(id));
  timers = [];
  if (canvasFx) {
    canvasFx.stop();
    canvasFx = null;
  }
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
  /* COMPOSITOR ISOLATION (the main scroll-lag fix): promote the overlay to its
     own GPU layer and stop its paints/layout from invalidating the UI layer.
     - will-change/transform:translateZ(0) forces a dedicated composited layer,
       so scrolling the UI does not force the browser to re-blend this layer
       against moving content on the same layer.
     - contain: strict isolates layout/paint/size so nothing inside can trigger
       reflow/repaint of Headlamp's tree.
     Together these let the UI scroll on its own layer while the effects live on
     theirs — the decisive change for scroll smoothness. */
  will-change: transform;
  transform: translateZ(0);
  contain: strict;
}

/* ---- canvas firework layer (Diwali / New Year) ---- */
#${CONTAINER_ID} .ff-canvas {
  position: absolute; inset: 0; width: 100%; height: 100%;
  pointer-events: none;
  /* Keep the canvas on its own composited layer too. */
  will-change: transform;
  transform: translateZ(0);
}

/* ---- shared aerial burst (Christmas twinkle still uses this) ---- */
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
  /* Dropped filter: blur() here — animated blur forces costly per-frame
     repaints. A tighter box-shadow keeps the glow at a fraction of the cost. */
  box-shadow: 0 0 6px 1px currentColor;
  animation-name: ff-float; animation-timing-function: ease-in-out;
  animation-iteration-count: infinite;
  will-change: transform, opacity;
}
@keyframes ff-float {
  0% { transform: translateY(0) scale(0.6); opacity: 0; }
  12% { opacity: 0.9; }
  50% { transform: translateY(-52vh) scale(1); opacity: 1; }
  88% { opacity: 0.8; }
  100% { transform: translateY(-104vh) scale(0.5); opacity: 0; }
}

/* ---- Diwali sky lanterns (kandeel) — ported from the reference theme ---- */
/* A domed canopy that tapers to a narrow open mouth, with a warm flame inside.
   --body / --light / --scale / --sway are set per-instance from JS. The lantern
   rises from below the viewport, sways, and fades near the top. */
#${CONTAINER_ID} .ff-lantern {
  position: absolute;
  bottom: -14vh;
  width: calc(26px * var(--scale, 1));
  height: calc(40px * var(--scale, 1));
  opacity: 0;
  transform-origin: center bottom;
  animation-name: ff-skyrise;
  animation-timing-function: ease-in;
  animation-iteration-count: 1;
  animation-fill-mode: forwards;
  filter: drop-shadow(0 2px 10px rgba(255, 140, 40, 0.55));
  will-change: transform, opacity;
}
/* Canopy: dome on top tapering to a narrow base (sky-lantern silhouette). */
#${CONTAINER_ID} .ff-lantern-canopy {
  position: absolute; left: 0; right: 0; top: 0; height: 82%;
  background: radial-gradient(ellipse 60% 45% at 50% 78%,
    var(--light, #fff6dc) 0%,
    color-mix(in srgb, var(--light, #ffd27a) 60%, var(--body)) 42%,
    var(--body, #e23b3b) 78%);
  border-radius: 50% 50% 32% 32% / 62% 62% 38% 38%;
  clip-path: polygon(16% 0, 84% 0, 100% 42%, 70% 100%, 30% 100%, 0 42%);
  box-shadow: inset 0 -6px 10px rgba(0, 0, 0, 0.18),
              inset 0 4px 10px rgba(255, 255, 255, 0.35);
  animation: ff-lantern-breathe 3.5s ease-in-out infinite;
}
/* Warm flame glow at the open mouth. */
#${CONTAINER_ID} .ff-lantern-flame {
  position: absolute; left: 50%; bottom: 6%; width: 34%; height: 26%;
  transform: translateX(-50%);
  background: radial-gradient(circle at 50% 60%,
    #fff3c0 0%, #ffb037 55%, rgba(255, 123, 0, 0) 75%);
  border-radius: 50%;
  animation: ff-lantern-flicker 0.9s ease-in-out infinite;
}
/* Small open ring at the base. */
#${CONTAINER_ID} .ff-lantern-mouth {
  position: absolute; left: 50%; bottom: 8%; width: 36%; height: 10%;
  transform: translateX(-50%);
  background: color-mix(in srgb, var(--body, #e23b3b) 70%, #000 30%);
  border-radius: 50%;
  box-shadow: 0 0 6px 1px rgba(255, 160, 50, 0.7);
}
@keyframes ff-lantern-breathe {
  0%, 100% { transform: scaleX(1); }
  50% { transform: scaleX(1.04); }
}
@keyframes ff-lantern-flicker {
  0%, 100% { opacity: 0.85; transform: translateX(-50%) scale(1); }
  50% { opacity: 1; transform: translateX(-50%) scale(1.12); }
}
@keyframes ff-skyrise {
  0% { transform: translateY(0) translateX(0) rotate(-2deg); opacity: 0; }
  12% { opacity: 0.96; }
  50% { transform: translateY(-58vh) translateX(var(--sway)) rotate(2deg); opacity: 1; }
  85% { opacity: 0.85; }
  100% { transform: translateY(-120vh) translateX(calc(var(--sway) * -1)) rotate(-2deg); opacity: 0; }
}

/* ---- Christmas snow + aurora ---- */
#${CONTAINER_ID} .ff-snow {
  position: absolute; top: -4vh; border-radius: 50%; background: #ffffff;
  box-shadow: 0 0 4px 1px rgba(255,255,255,0.6); opacity: 0;
  animation-name: ff-fall; animation-timing-function: linear;
  animation-iteration-count: infinite;
  will-change: transform, opacity;
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
  will-change: transform, opacity;
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
  will-change: transform, opacity;
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

/* ---- Dussehra bonfire embers ---- */
#${CONTAINER_ID} .ff-ember {
  position: absolute; bottom: -12px; border-radius: 50%; opacity: 0;
  animation-name: ff-ember-rise; animation-timing-function: ease-in;
  animation-iteration-count: infinite;
  will-change: transform, opacity;
}
@keyframes ff-ember-rise {
  0% { transform: translateY(0) translateX(0) scale(1); opacity: 0; }
  12% { opacity: 1; }
  70% { opacity: 0.9; }
  100% { transform: translateY(-105vh) translateX(var(--drift, 20px)) scale(0.3); opacity: 0; }
}

/* ---- Eid twinkling gold stars (calm, rising) ---- */
#${CONTAINER_ID} .ff-star {
  position: absolute; bottom: -10px; border-radius: 50%;
  background: #ffe9a8; box-shadow: 0 0 8px 2px #ffe9a8; opacity: 0;
  animation-name: ff-star-float; animation-timing-function: ease-in-out;
  animation-iteration-count: infinite;
  will-change: transform, opacity;
}
@keyframes ff-star-float {
  0% { transform: translateY(0) scale(0.6); opacity: 0; }
  15% { opacity: 0.9; }
  50% { transform: translateY(-48vh) scale(1); opacity: 1; }
  85% { opacity: 0.8; }
  100% { transform: translateY(-100vh) scale(0.5); opacity: 0; }
}

/* ---- Halloween ghosts / bats / embers ---- */
#${CONTAINER_ID} .ff-ghost {
  position: absolute; bottom: -60px; opacity: 0;
  filter: drop-shadow(0 0 10px rgba(255,255,255,0.35));
  animation-name: ff-ghost-rise; animation-timing-function: ease-in;
  animation-iteration-count: infinite; will-change: transform, opacity;
}
@keyframes ff-ghost-rise {
  0% { transform: translateY(0) translateX(0) scale(0.9); opacity: 0; }
  15% { opacity: 0.85; }
  50% { transform: translateY(-52vh) translateX(var(--sway, 20px)) scale(1); opacity: 0.9; }
  85% { opacity: 0.7; }
  100% { transform: translateY(-108vh) translateX(calc(var(--sway, 20px) * -1)) scale(0.85); opacity: 0; }
}
#${CONTAINER_ID} .ff-bat {
  position: absolute; left: 0;
  animation-name: ff-bat-fly; animation-timing-function: linear;
  animation-iteration-count: infinite; will-change: transform;
}
@keyframes ff-bat-fly {
  0% { transform: translateX(-8vw) translateY(0); }
  100% { transform: translateX(112vw) translateY(-6vh); }
}
#${CONTAINER_ID} .ff-bat svg { animation: ff-bat-flap 0.35s ease-in-out infinite; transform-origin: center; }
@keyframes ff-bat-flap { 0%,100% { transform: scaleY(1); } 50% { transform: scaleY(0.6); } }
#${CONTAINER_ID} .ff-hw-ember {
  position: absolute; bottom: -10px; border-radius: 50%;
  background: #ff9a3c; box-shadow: 0 0 6px 1px #ff9a3c; opacity: 0;
  animation-name: ff-hw-ember-float; animation-timing-function: ease-in-out;
  animation-iteration-count: infinite; will-change: transform, opacity;
}
@keyframes ff-hw-ember-float {
  0% { transform: translateY(0) scale(0.6); opacity: 0; }
  20% { opacity: 0.9; }
  100% { transform: translateY(-80vh) scale(0.4); opacity: 0; }
}

@media (prefers-reduced-motion: reduce) {
  #${CONTAINER_ID} { display: none !important; }
}
`;
