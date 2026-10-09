/**
 * Festive "doodle" logo for Headlamp.
 *
 * Replaces the Headlamp logo with a theme-aware festive lockup (icon + the
 * "Headlamp" wordmark + an always-on greeting) while a festive theme is active,
 * and falls back to a plain "Headlamp" wordmark otherwise. Registered via
 * `registerAppLogo`.
 *
 * API: registerAppLogo(component) — the component receives AppLogoProps:
 *   { logoType: 'large' | 'small'; themeName?: string; className?: string }
 *   - 'large' = sidebar expanded / app bar; 'small' = sidebar collapsed.
 *   Docs: https://headlamp.dev/docs/latest/tutorials/plugin-development/getting-started/applying-custom-themes/
 *
 * IMPORTANT: Headlamp passes the *base* ('light'|'dark') in themeName, not our
 * custom theme name. To know which FESTIVE theme is active we read the
 * `data-festive-theme` attribute that the plugin sets on <html> (see
 * contrast.ts / index.tsx). That attribute is only present while one of our
 * themes is selected, so it also doubles as the "is a festive theme active?"
 * signal. If it is absent we render the default Headlamp wordmark.
 *
 * All SVGs are inline (no bundled assets) and animate with CSS keyframes that
 * are injected once and disabled under prefers-reduced-motion.
 */
import { registerAppLogo } from '@kinvolk/headlamp-plugin/lib';
import { useEffect, useState } from 'react';

type FestiveKey = 'Diwali' | 'Christmas' | 'Holi' | 'New Year';

interface AppLogoProps {
  logoType?: 'large' | 'small';
  themeName?: string;
  className?: string;
  [key: string]: unknown;
}

const GREETINGS: Record<FestiveKey, string> = {
  Diwali: 'Happy Diwali',
  Christmas: 'Merry Christmas',
  Holi: 'Happy Holi',
  'New Year': 'Happy New Year',
};

const ACCENT: Record<FestiveKey, { a: string; b: string }> = {
  Diwali: { a: '#ffb627', b: '#ff5da2' },
  Christmas: { a: '#6fd3ff', b: '#e5484d' },
  Holi: { a: '#ff2e97', b: '#8a4fff' },
  'New Year': { a: '#ffd700', b: '#b388ff' },
};

const STYLE_ID = 'festive-logo-style';
const ATTR = 'data-festive-theme';

/* ----------------------------- SVG icons -------------------------------- */

function DiwaliIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <defs>
        <radialGradient id="ffl-dfl" cx="50%" cy="30%" r="65%">
          <stop offset="0%" stopColor="#fff6cf" />
          <stop offset="55%" stopColor="#ffb627" />
          <stop offset="100%" stopColor="#ff7b00" />
        </radialGradient>
      </defs>
      <path d="M7 31 C7 37 15 41 24 41 C33 41 41 37 41 31 Z" fill="#c0603a" />
      <path d="M7 31 C7 34 15 35 24 35 C33 35 41 34 41 31 Z" fill="#e49050" />
      <g style={{ transformOrigin: '24px 26px', animation: 'ffl-flick 1.6s ease-in-out infinite' }}>
        <path d="M24 9 C27 16 30 18 30 24 a6 6 0 0 1-12 0 C18 18 21 16 24 9 Z" fill="url(#ffl-dfl)" />
      </g>
      <circle cx="12" cy="23" r="1.8" fill="#ffd166" style={{ animation: 'ffl-twinkle 2s infinite' }} />
      <circle cx="36" cy="21" r="1.8" fill="#ff5da2" style={{ animation: 'ffl-twinkle 2.4s infinite .4s' }} />
    </svg>
  );
}

function ChristmasIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <g style={{ transformOrigin: '24px 44px', animation: 'ffl-bob 3s ease-in-out infinite' }}>
        <path d="M24 7 L32 20 H28 L36 32 H30 L39 43 H9 L18 32 H12 L20 20 H16 Z" fill="#2a8a5a" />
        <rect x="21" y="43" width="6" height="4" fill="#6b4423" />
        <path
          d="M24 3 l1.5 3.1 3.4.5-2.5 2.4.6 3.4-3-1.6-3 1.6.6-3.4-2.5-2.4 3.4-.5Z"
          fill="#ffd166"
          style={{ animation: 'ffl-twinkle 2.2s infinite' }}
        />
        <circle cx="20" cy="27" r="1.7" fill="#e5484d" />
        <circle cx="28" cy="31" r="1.7" fill="#6fd3ff" />
        <circle cx="24" cy="37" r="1.7" fill="#ffd166" />
      </g>
      <circle cx="10" cy="12" r="1.4" fill="#fff" style={{ animation: 'ffl-fall 3s linear infinite' }} />
      <circle cx="38" cy="9" r="1.4" fill="#fff" style={{ animation: 'ffl-fall 3.6s linear infinite .6s' }} />
    </svg>
  );
}

function HoliIcon({ size }: { size: number }) {
  const hues = ['#ff2e97', '#ffd600', '#28c2ff', '#19b36b', '#8a4fff', '#ff7b00', '#ff5a5a'];
  const grains = [];
  for (let i = 0; i < 16; i++) {
    const a = (Math.PI * 2 * i) / 16 + (i % 2 ? 0.3 : -0.2);
    const d = 11 + (i % 3) * 5;
    const x = 24 + Math.cos(a) * d;
    const y = 24 + Math.sin(a) * d;
    const r = 1.4 + (i % 3) * 1.1;
    grains.push(
      <circle
        key={i}
        cx={+x.toFixed(1)}
        cy={+y.toFixed(1)}
        r={r}
        fill={hues[i % hues.length]}
        opacity="0.9"
        style={{ animation: `ffl-holiGrain 2.6s ease-out infinite ${(i * 0.13).toFixed(2)}s` }}
      />,
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <defs>
        <radialGradient id="ffl-hcloud" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ff2e97" stopOpacity=".55" />
          <stop offset="45%" stopColor="#8a4fff" stopOpacity=".30" />
          <stop offset="100%" stopColor="#28c2ff" stopOpacity="0" />
        </radialGradient>
        <filter id="ffl-hblur">
          <feGaussianBlur stdDeviation="1.1" />
        </filter>
      </defs>
      <circle cx="24" cy="24" r="20" fill="url(#ffl-hcloud)" style={{ animation: 'ffl-holiCloud 3.4s ease-in-out infinite' }} />
      <g filter="url(#ffl-hblur)">{grains}</g>
      <circle cx="24" cy="24" r="4.5" fill="#fff" opacity="0.85" />
      <circle cx="24" cy="24" r="4.5" fill="#ff2e97" opacity="0.5" />
    </svg>
  );
}

function NewYearIcon({ size }: { size: number }) {
  const cx = 26;
  const cy = 19;
  const hues = ['#ffd700', '#ff4fa3', '#b388ff', '#6fe3b0', '#ffe780', '#58a6ff', '#ffffff'];
  const N = 15;
  const streaks = [];
  const tips = [];
  for (let i = 0; i < N; i++) {
    const a = -Math.PI * 1.05 + (Math.PI * 1.25 * i) / (N - 1) + (i % 2 ? 0.06 : -0.06);
    const len = 13 + (i % 3) * 3;
    const ex = cx + Math.cos(a) * len;
    const ey = cy + Math.sin(a) * len;
    const mx = cx + Math.cos(a) * len * 0.55;
    const my = cy + Math.sin(a) * len * 0.55 + 3.2;
    const h = hues[i % hues.length];
    streaks.push(
      <path
        key={`s${i}`}
        d={`M${cx} ${cy} Q${mx.toFixed(1)} ${my.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}`}
        fill="none"
        stroke={h}
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.9"
      />,
    );
    tips.push(
      <circle
        key={`t${i}`}
        cx={+ex.toFixed(1)}
        cy={+ey.toFixed(1)}
        r="1.6"
        fill={h}
        style={{ animation: `ffl-twinkle 1.6s infinite ${(i * 0.05).toFixed(2)}s` }}
      />,
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <defs>
        <radialGradient id="ffl-nyflash" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="45%" stopColor="#fff6cf" />
          <stop offset="100%" stopColor="#ffd700" stopOpacity="0" />
        </radialGradient>
      </defs>
      <path
        d={`M9 44 Q16 32 ${cx} ${cy}`}
        fill="none"
        stroke="#ffe780"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeDasharray="2 3"
        opacity="0.55"
        style={{ animation: 'ffl-nyTrail 2.6s ease-in infinite' }}
      />
      <g style={{ transformOrigin: `${cx}px ${cy}px`, animation: 'ffl-nyPulse 2.6s ease-out infinite' }}>{streaks}</g>
      {tips}
      <circle cx={cx} cy={cy} r="6" fill="url(#ffl-nyflash)" style={{ animation: 'ffl-nyFlash 2.6s ease-out infinite' }} />
      <circle cx={cx} cy={cy} r="2" fill="#ffffff" style={{ animation: 'ffl-twinkle 1.8s infinite' }} />
    </svg>
  );
}

function FestiveIcon({ theme, size }: { theme: FestiveKey; size: number }) {
  switch (theme) {
    case 'Diwali':
      return <DiwaliIcon size={size} />;
    case 'Christmas':
      return <ChristmasIcon size={size} />;
    case 'Holi':
      return <HoliIcon size={size} />;
    case 'New Year':
      return <NewYearIcon size={size} />;
  }
}

/* --------------------------- the logo component ------------------------- */

/** Read the active festive theme from the <html data-festive-theme> attribute. */
function useFestiveTheme(): FestiveKey | null {
  const read = (): FestiveKey | null => {
    const v = document.documentElement.getAttribute(ATTR);
    return v && v in GREETINGS ? (v as FestiveKey) : null;
  };
  const [theme, setTheme] = useState<FestiveKey | null>(read);
  useEffect(() => {
    const obs = new MutationObserver(() => setTheme(read()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: [ATTR] });
    return () => obs.disconnect();
  }, []);
  return theme;
}

function ensureStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = LOGO_CSS;
  document.head.appendChild(style);
}

/**
 * SBS Software logo, inlined (not loaded from sbs-software.com) so it works
 * offline and is not blocked by CSP/WAF. The gradient/clip IDs are suffixed
 * so multiple instances on the page (e.g. large + small) never collide.
 * Original: https://sbs-software.com/wp-content/themes/sopra/assets/imgs/sbs-logo.svg
 */
function SbsLogo({ height = 24, idSuffix = 'a' }: { height?: number; idSuffix?: string }) {
  const s = (id: string) => `${id}_${idSuffix}`;
  // Preserve aspect ratio from the 73x25 viewBox.
  const width = (73 / 25) * height;
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 73 25"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="SBS Software"
      role="img"
      // The "SBS" letters use currentColor (see paths below) so they adapt to
      // the navbar: dark text on light themes, light on dark themes. `color`
      // inherits from the surrounding Headlamp app-bar text.
      style={{ color: 'inherit' }}
    >
      <g clipPath={`url(#${s('clip0')})`}>
        <path
          d="M52.2833 17.9503C53.1875 18.0274 53.9853 18.0789 54.6767 18.0789C55.3682 18.0789 55.8469 17.9246 56.1128 17.5902C56.3787 17.2559 56.4851 16.7159 56.4851 15.9701C56.4851 15.2243 56.299 14.6842 55.9267 14.4014C55.5543 14.1185 55.0225 13.9642 54.3044 13.9642H52.2567L52.2833 17.9503ZM52.2301 11.3153H54.4906C55.1288 11.3153 55.5543 11.1868 55.7937 10.9039C56.033 10.621 56.1394 10.1581 56.1394 9.48945C56.1394 8.82081 56.0064 8.35791 55.7139 8.10074C55.448 7.84358 54.9693 7.68927 54.3044 7.68927L52.2035 7.76642V11.3153H52.2301ZM54.3842 5.06616C57.9212 5.06616 59.703 6.5063 59.703 9.36087C59.703 10.1581 59.5168 10.801 59.1711 11.3153C58.8254 11.8297 58.3733 12.2154 57.868 12.4726V12.6012C59.3573 13.2184 60.1019 14.2985 60.1019 15.8672C60.1019 17.7445 59.5168 19.0818 58.3467 19.8533C57.3095 20.4962 56.0596 20.8306 54.5438 20.8306C53.0279 20.8306 51.0866 20.702 48.7197 20.4191L48.8261 13.4498L48.7197 5.40048C51.0068 5.16903 52.895 5.06616 54.3842 5.06616Z"
          fill="currentColor"
        />
        <path
          d="M45.3688 13.9385C45.2359 13.6813 45.0497 13.4241 44.8104 13.1927C44.571 12.9612 44.3317 12.7555 44.1455 12.6012C43.9594 12.4469 43.6934 12.2669 43.3477 12.1126C43.002 11.9326 42.736 11.804 42.5499 11.7011C42.3637 11.5982 42.0712 11.4696 41.6989 11.3411C41.3532 11.1868 40.9277 11.0067 40.449 10.801C39.9969 10.5953 39.5714 10.3638 39.1991 10.0809C38.8533 9.82377 38.6672 9.48946 38.6672 9.1037C38.6672 8.69224 38.7736 8.43507 39.0129 8.28077C39.2523 8.10075 39.6246 8.0236 40.1033 8.0236C41.3 8.0236 42.7892 8.1779 44.571 8.51222L44.6774 8.53794L45.2625 5.5805L45.1827 5.55479C44.2785 5.32334 43.4275 5.1176 42.6563 5.01473C41.885 4.91187 41.167 4.83472 40.5288 4.83472C38.747 4.83472 37.3375 5.24619 36.3535 6.06912C35.3696 6.89206 34.8643 7.97217 34.8643 9.33516C34.8643 10.6981 35.3961 11.7783 36.4333 12.5755C36.8322 12.8841 37.4971 13.2698 38.4012 13.6813C39.3054 14.0928 39.9171 14.3756 40.2628 14.5299C40.4224 14.6071 40.6085 14.6842 40.8479 14.8128C41.0606 14.9157 41.2202 15.0186 41.3532 15.1214C41.4595 15.1986 41.6191 15.3272 41.8053 15.5072C41.9648 15.6615 42.0446 15.8672 42.0446 16.1501C42.0446 16.793 41.9116 17.2045 41.6191 17.3588C41.3266 17.5388 40.9543 17.616 40.5553 17.616C39.0395 17.616 37.3641 17.2559 35.5557 16.5616L35.4493 16.5101L35.4227 16.613C35.0504 17.8474 34.7845 18.5932 34.7047 18.8504C34.6249 19.0304 34.5717 19.1847 34.5451 19.3133L34.5186 19.3904L35.343 19.7505C35.8482 19.9819 36.5397 20.2134 37.4705 20.4448C38.3747 20.6763 39.2788 20.7791 40.1298 20.7791C41.8053 20.7791 43.2147 20.3419 44.2519 19.4676C45.3156 18.5932 45.8475 17.4102 45.8475 15.9958C45.8475 15.25 45.688 14.5557 45.3688 13.9385Z"
          fill="currentColor"
        />
        <path
          d="M72.5212 13.9385C72.3882 13.6813 72.202 13.4241 71.9627 13.1927C71.7234 12.9612 71.484 12.7555 71.2979 12.6012C71.1117 12.4469 70.8458 12.2669 70.5 12.1126C70.1543 11.9325 69.8884 11.804 69.7022 11.7011C69.5161 11.5982 69.2235 11.4696 68.8512 11.3411C68.5055 11.1868 68.08 11.0067 67.6013 10.801C67.1492 10.5953 66.7237 10.3638 66.3514 10.0809C66.0057 9.82377 65.8195 9.48946 65.8195 9.1037C65.8195 8.69224 65.9259 8.43507 66.1653 8.28077C66.4046 8.10075 66.7769 8.0236 67.2556 8.0236C68.4523 8.0236 69.9416 8.1779 71.7234 8.51222L71.8297 8.53793L72.4148 5.5805L72.335 5.55479C71.4308 5.32334 70.5798 5.1176 69.8086 5.01473C69.0374 4.91187 68.3194 4.83472 67.6811 4.83472C65.8993 4.83472 64.4898 5.24619 63.5059 6.06912C62.5219 6.89206 62.0166 7.97216 62.0166 9.33515C62.0166 10.6981 62.5485 11.7783 63.5857 12.5755C63.9846 12.8841 64.6494 13.2698 65.5536 13.6813C66.4578 14.0928 67.0694 14.3756 67.4152 14.5299C67.5747 14.6071 67.7609 14.6842 68.0002 14.8128C68.213 14.9157 68.3725 15.0186 68.5055 15.1214C68.6119 15.1986 68.7714 15.3272 68.9576 15.5072C69.1172 15.6615 69.197 15.8672 69.197 16.1501C69.197 16.793 69.064 17.2045 68.7714 17.3588C68.4789 17.5388 68.1066 17.616 67.7077 17.616C66.1918 17.616 64.5164 17.2559 62.7081 16.5616L62.6017 16.5101L62.5751 16.613C62.2028 17.8474 61.9368 18.5932 61.8571 18.8504C61.7773 19.0304 61.7241 19.1847 61.6975 19.3133L61.6709 19.3904L62.4953 19.7505C63.0006 19.9819 63.692 20.2134 64.6228 20.4448C65.527 20.6763 66.4312 20.7791 67.2822 20.7791C68.9576 20.7791 70.3671 20.3419 71.4042 19.4676C72.468 18.5932 72.9999 17.4102 72.9999 15.9958C72.9999 15.25 72.8403 14.5557 72.5212 13.9385Z"
          fill="currentColor"
        />
        <path d="M6.43555 12.4212L12.8447 6.19775L19.2804 12.4212L12.8447 18.6447L6.43555 12.4212Z" fill={`url(#${s('p0')})`} />
        <path d="M19.2804 24.8683L12.8447 18.6448L19.2804 12.4214L25.7161 18.6448L19.2804 24.8683Z" fill={`url(#${s('p1')})`} />
        <path d="M6.4357 12.4214L12.8448 18.6448L6.4357 24.8683L0 18.6448L6.4357 12.4214Z" fill={`url(#${s('p2')})`} />
        <path d="M6.43555 6.19775L12.8447 0L19.2804 6.19775L12.8447 12.4212L6.43555 6.19775Z" fill={`url(#${s('p3')})`} />
        <path d="M19.2804 18.6447L12.8447 12.4212L19.2804 6.19775L25.7161 12.4212L19.2804 18.6447Z" fill={`url(#${s('p4')})`} />
        <path d="M6.4357 6.19775L12.8448 12.4212L6.4357 18.6447L0 12.4212L6.4357 6.19775Z" fill={`url(#${s('p5')})`} />
      </g>
      <defs>
        <linearGradient id={s('p0')} x1="12.858" y1="6.19775" x2="12.858" y2="18.6318" gradientUnits="userSpaceOnUse">
          <stop stopColor="#59BFFF" />
          <stop offset="1" stopColor="#1039B4" />
        </linearGradient>
        <linearGradient id={s('p1')} x1="12.8447" y1="18.6448" x2="25.7028" y2="18.6448" gradientUnits="userSpaceOnUse">
          <stop stopColor="#73DDFF" />
          <stop offset="1" stopColor="#0180DD" />
        </linearGradient>
        <linearGradient id={s('p2')} x1="12.8448" y1="18.6448" x2="-0.0132971" y2="18.6448" gradientUnits="userSpaceOnUse">
          <stop stopColor="#017EDD" />
          <stop offset="1" stopColor="#9DECFF" />
        </linearGradient>
        <linearGradient id={s('p3')} x1="12.858" y1="0" x2="12.858" y2="12.4341" gradientUnits="userSpaceOnUse">
          <stop offset="0.3" stopColor="#FFD315" />
          <stop offset="0.38" stopColor="#FFCD1E" />
          <stop offset="0.52" stopColor="#FFBD36" />
          <stop offset="0.69" stopColor="#FFA35E" />
          <stop offset="0.88" stopColor="#FF7F94" />
          <stop offset="1" stopColor="#FF67B9" />
        </linearGradient>
        <linearGradient id={s('p4')} x1="12.8447" y1="12.4212" x2="25.7028" y2="12.4212" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FF00B1" />
          <stop offset="0.14" stopColor="#F600B2" />
          <stop offset="0.37" stopColor="#DE00B5" />
          <stop offset="0.66" stopColor="#B600BA" />
          <stop offset="1" stopColor="#7F00C1" />
        </linearGradient>
        <linearGradient id={s('p5')} x1="12.8448" y1="12.4212" x2="-0.0132971" y2="12.4212" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FF00B1" />
          <stop offset="0.14" stopColor="#F600B2" />
          <stop offset="0.37" stopColor="#DE00B5" />
          <stop offset="0.66" stopColor="#B600BA" />
          <stop offset="1" stopColor="#7F00C1" />
        </linearGradient>
        <clipPath id={s('clip0')}>
          <rect width="73" height="24.8681" fill="white" />
        </clipPath>
      </defs>
    </svg>
  );
}

function FestiveLogo(props: AppLogoProps) {
  const festive = useFestiveTheme();
  const isSmall = props.logoType === 'small';

  useEffect(() => {
    if (festive) ensureStyle();
  }, [festive]);

  // Non-festive theme → SBS logo only (keeps branding, no festive motifs).
  if (!festive) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center' }} className={props.className}>
        <SbsLogo height={isSmall ? 20 : 24} idSuffix="plain" />
      </span>
    );
  }

  const accent = ACCENT[festive];

  // Collapsed sidebar → icon only (the full lockup won't fit).
  if (isSmall) {
    return (
      <span style={{ display: 'inline-flex' }} className={`ffl-logo ${props.className ?? ''}`}>
        <FestiveIcon theme={festive} size={32} />
      </span>
    );
  }

  // Expanded / app bar → full doodle lockup: festive icon + SBS logo + greeting.
  return (
    <span
      className={`ffl-logo ${props.className ?? ''}`}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}
    >
      <FestiveIcon theme={festive} size={40} />
      <span style={{ display: 'flex', flexDirection: 'column', gap: 3, lineHeight: 1.05 }}>
        <SbsLogo height={24} idSuffix="festive" />
        <span style={{ fontSize: 12, fontWeight: 650, letterSpacing: '.3px', color: accent.a }}>
          {GREETINGS[festive]}
        </span>
      </span>
    </span>
  );
}

/** Register the festive doodle logo with Headlamp. */
export function registerFestiveLogo(): void {
  registerAppLogo(FestiveLogo as unknown as Parameters<typeof registerAppLogo>[0]);
}

const LOGO_CSS = `
@keyframes ffl-flick { 0%,100%{ transform: scaleY(1) translateY(0); opacity:1 } 50%{ transform: scaleY(1.12) translateY(-1px); opacity:.85 } }
@keyframes ffl-twinkle { 0%,100%{ opacity:.4 } 50%{ opacity:1 } }
@keyframes ffl-bob { 0%,100%{ transform: translateY(0) rotate(-3deg) } 50%{ transform: translateY(-2px) rotate(3deg) } }
@keyframes ffl-shimmer { 0%{ background-position:0% center } 100%{ background-position:220% center } }
@keyframes ffl-fall { 0%{ transform: translateY(-6px); opacity:0 } 20%{ opacity:1 } 100%{ transform: translateY(22px); opacity:0 } }
@keyframes ffl-holiGrain { 0%{ transform: scale(.3); opacity:0 } 25%{ opacity:.95 } 100%{ transform: scale(1.25); opacity:.15 } }
@keyframes ffl-holiCloud { 0%,100%{ transform: scale(1); opacity:.8 } 50%{ transform: scale(1.08); opacity:1 } }
@keyframes ffl-nyPulse { 0%{ transform: scale(.5); opacity:.4 } 30%{ transform: scale(1.08); opacity:1 } 100%{ transform: scale(1); opacity:.9 } }
@keyframes ffl-nyFlash { 0%{ transform: scale(.3); opacity:0 } 22%{ transform: scale(1.3); opacity:1 } 55%{ opacity:.5 } 100%{ transform: scale(1); opacity:.25 } }
@keyframes ffl-nyTrail { 0%{ stroke-dashoffset:28; opacity:0 } 18%{ opacity:.7 } 30%,100%{ stroke-dashoffset:0; opacity:0 } }
/* Disable all festive-logo motion under reduced-motion. The animated nodes are
   inline-styled, so we need !important to override. The .ffl-logo wrapper
   scopes this so it only affects our logo. */
@media (prefers-reduced-motion: reduce) {
  .ffl-logo *, .ffl-logo { animation: none !important; }
}
`;
