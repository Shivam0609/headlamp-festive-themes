# Headlamp Festive Themes

A [Headlamp](https://headlamp.dev) plugin that adds seasonal festive themes to
the Kubernetes web UI, plus optional ambient effects (snow, fireworks, color
splashes).

Built against the official plugin docs:
[Plugins](https://headlamp.dev/docs/latest/development/plugins) ·
[Functionality / API](https://headlamp.dev/docs/latest/development/plugins/functionality) ·
[Getting Started](https://headlamp.dev/docs/latest/development/plugins/getting-started) ·
[Building & Shipping](https://headlamp.dev/docs/latest/development/plugins/building).

## What it does

1. **Festive color themes** — registers four themes with
   [`registerAppTheme`](https://headlamp.dev/docs/latest/development/plugins/functionality):
   - **Diwali** (dark, marigold gold + pink)
   - **Christmas** (dark, frosty cyan + holly red)
   - **Holi** (light, magenta + cyan)
   - **New Year** (dark, champagne gold + violet)

   After the plugin loads, pick one under **Settings → General → Theme**.

2. **Ambient effects** — an app bar action (top-right, added with
   [`registerAppBarAction`](https://headlamp.dev/docs/latest/development/plugins/functionality))
   lets you toggle festive effects. The effect auto-matches the active theme:
   snow for Christmas, fireworks for Diwali / New Year, color splashes for Holi.
   The toggle only appears while a festive theme is selected, and the on/off
   choice is remembered in `localStorage`.

Effects respect `prefers-reduced-motion`: when the OS requests reduced motion,
no animated particles are shown. All effect markup lives in a single
`pointer-events: none` backdrop layer (`#festive-fx`) with CSS scoped under
that id, so Headlamp's own UI is never affected.

## How it works

| File | Responsibility |
|------|----------------|
| `src/index.tsx` | Registers themes, registers the app bar toggle, reads the active theme from the Redux store, starts/stops effects. |
| `src/themes.ts` | The four `registerAppTheme` definitions (MUI palette overrides). |
| `src/effects.ts` | Framework-agnostic DOM engine for snow / fireworks / splash, with tracked timers and reduced-motion handling. |

### Shared dependencies

Per the Headlamp docs, these are provided by Headlamp at runtime and are **not**
bundled: `react`, `react-redux`, `@mui/material`, `@iconify/react`,
`lodash`, `notistack`, `recharts`. They are imported normally but excluded from
the build, so they are intentionally **not** listed in `dependencies`.

## Development

Prerequisites: Node.js >= 22, npm >= 11, and a running Headlamp instance.

```bash
npm install
npm run start     # builds + watches; makes the plugin available to Headlamp
```

In **Headlamp Desktop**, enable **Settings → Plugins → Plugin Development Mode**
to load the plugin from your local dev directory.

Quality tooling (provided by `@kinvolk/headlamp-plugin`):

```bash
npm run tsc       # type check
npm run lint      # lint
npm run format    # format
```

## Build & install

```bash
npm run build
npm run package   # produces headlamp-festive-themes-0.1.0.tar.gz
```

Install into Headlamp's plugin directory by extracting the tarball:

| OS | Plugin directory |
|----|------------------|
| macOS / Linux | `$HOME/.config/Headlamp/plugins` |
| Windows | `%APPDATA%/Headlamp/Config/plugins` |

```bash
# macOS / Linux
mkdir -p ~/.config/Headlamp/plugins
tar xzf headlamp-festive-themes-0.1.0.tar.gz -C ~/.config/Headlamp/plugins
```

For in-cluster deployments, extract into the directory passed to Headlamp's
`-plugins-dir` flag (default `/headlamp/plugins`), or bake the plugin into a
container image and mount it with an init container (see the
[Building & Shipping guide](https://headlamp.dev/docs/latest/development/plugins/building)).

## Notes & limitations

- The active-theme lookup in `useActiveThemeName` probes a few Redux store
  shapes because the exact path has varied across Headlamp versions. If a
  future version moves it, update that selector; the effects simply stay off
  until a festive theme is detected.
- Effects are purely cosmetic DOM overlays and do not touch cluster data.
