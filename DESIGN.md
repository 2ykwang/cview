---
name: cview
description: Local Claude Code session viewer — quiet, neutral chat UI inspired by Toss
mood: trustworthy, neutral, minimal — one brand color, everything else greyscale
typography:
  family: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
  mono: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace"
  scale:
    xs: 11px
    sm: 12px
    base: 13px
    md: 14px
    lg: 15px
    xl: 17px
    "2xl": 20px
  weight:
    regular: 400
    medium: 500
    semibold: 600
    bold: 700
  leading: { tight: 1.35, body: 1.55, relaxed: 1.7 }
spacing:
  unit: 4px
radius:
  xs: 4px
  sm: 6px
  md: 10px
  lg: 14px
  xl: 18px
  bubble: "6px 18px 18px 18px"
  bubble_user: "18px 6px 18px 18px"
  pill: 999px
shadow:
  xs: "0 1px 2px rgba(0, 0, 0, 0.04)"
  sm: "0 2px 6px rgba(0, 0, 0, 0.05)"
  md: "0 8px 24px rgba(0, 0, 0, 0.06)"
motion:
  fast: 100ms
  base: 160ms
  ease: "cubic-bezier(0.2, 0.8, 0.2, 1)"
themes:
  light:
    bg:           "#ffffff"
    bg_alt:       "#f9fafb"
    surface:      "#ffffff"
    surface_2:    "#f2f4f6"
    surface_3:    "#e5e8eb"
    border:       "#e5e8eb"
    border_strong: "#d1d6db"
    text:         "#191f28"
    text_dim:     "#4e5968"
    text_muted:   "#8b95a1"
    text_faint:   "#b0b8c1"
    accent:       "#3182f6"
    accent_hover: "#1b64da"
    accent_bg:    "#e8f3ff"
    user_bubble:  "#3182f6"
    user_bubble_text: "#ffffff"
    agent_bubble: "#f2f4f6"
    success:      "#0ac674"
    warning:      "#ff9500"
    danger:       "#f04452"
    diff_add_bg:  "#e6f7ed"
    diff_add_fg:  "#0a7c4d"
    diff_del_bg:  "#fde7e9"
    diff_del_fg:  "#b8313a"
    code_bg:      "#f2f4f6"
    code_fg:      "#3182f6"
  dark:
    bg:           "#17171c"
    bg_alt:       "#1c1c22"
    surface:      "#23232a"
    surface_2:    "#2a2a33"
    surface_3:    "#32323c"
    border:       "#2a2a33"
    border_strong: "#3d3d48"
    text:         "#e5e8eb"
    text_dim:     "#b0b8c1"
    text_muted:   "#8b95a1"
    text_faint:   "#6b7480"
    accent:       "#4593fc"
    accent_hover: "#6aa9ff"
    accent_bg:    "#15243a"
    user_bubble:  "#3182f6"
    user_bubble_text: "#ffffff"
    agent_bubble: "#2a2a33"
    success:      "#3acc8a"
    warning:      "#ffaa1d"
    danger:       "#ff6675"
    diff_add_bg:  "#0e2415"
    diff_add_fg:  "#3acc8a"
    diff_del_bg:  "#2d1015"
    diff_del_fg:  "#ff6675"
    code_bg:      "#1c1c22"
    code_fg:      "#6aa9ff"
---

# cview — Visual Design

A local viewer for Claude Code session JSONL files. The UI is a quiet chat
messenger that tries to feel like a trustworthy banking app: a single brand
blue, everything else neutral grey, very little decoration.

## Core principle

**One color, lots of greys.** If you find yourself reaching for green / yellow
/ purple to highlight different kinds of tool calls, stop — that's noise. The
brand blue (`accent`) is reserved for: links, active states, user bubbles,
focus rings, and a handful of intentional emphasis points. Everything else
uses the greyscale.

Status colors (`success`, `warning`, `danger`) exist but are used sparingly:
status badges, errors, diff hunks. Never to "make a section pop."

## Themes

Two themes, both first-class:

- **Light** — default for users who have not picked a preference.
- **Dark** — opt-in or `prefers-color-scheme: dark`.

Themes are toggled by setting `data-theme="light"` / `data-theme="dark"` on
`<html>`. The current choice is stored in `localStorage` under the key
`cview-theme`. Both themes share the same token names; only values differ.

When adding a new color, define it in **both** themes in `index.css` `:root`
and `[data-theme="dark"]`. Never inline a hex value in a component — always
use the CSS variable or its mirror in `styles/tokens.js`.

## Surface hierarchy

1. `bg` — page background.
2. `surface` — cards, list rows, headers.
3. `surface-2` / `surface-3` — elevated cards inside bubbles.

Borders use `border` for divisions inside the same layer and `border-strong`
for the outer edges of elevated cards. In light mode prefer borders over
shadows; in dark mode you can rely on surface lifts.

## Bubbles

Asymmetric corners with a small tail. User bubble uses the brand blue with
white text; agent bubble uses `agent-bubble` (light grey in light theme,
dark grey in dark theme). Inside a group of consecutive messages from the
same sender within 60 seconds, only the first shows the avatar + name and
only the last shows the tail.

## Tool cards

A tool card is a compact, **neutral** card with a 3px left border. The left
border is **`border-strong` for every tool** (no per-tool color). What
distinguishes tools is the icon and the header text, not the color.

The `Agent` / `Task` card is the exception — it has a brand-blue left border
because it's the entry point to a subagent transcript and we want it to be
visually inviting. Even there, fill stays neutral.

Inside tool cards, code blocks use `code-bg` / `code-fg`; diff hunks use the
diff palette. No other status colors.

## Teammate messages (legacy)

Older sessions emit `<teammate-message color="...">` tags. The renderer
respects the `color` attribute but maps each value to a **muted tint**, not a
saturated fill, so the inbox doesn't look like a rainbow:

| tag color | mapped tint     |
|-----------|-----------------|
| red       | danger tint     |
| green     | success tint    |
| blue      | accent tint     |
| yellow    | warning tint    |
| purple    | accent tint     |
| cyan      | accent tint     |
| gray      | neutral surface |

These cards still have a thin colored left border but their fill is always
neutral.

## Hover / focus

- List rows: hover lifts to `surface-2`, transition `motion.fast`.
- Buttons: hover brightens text from `text-dim` to `text`; border can move from
  `border` to `border-strong`. Never colorize the background.
- Focus ring: 1px outline in `accent` (`box-shadow: 0 0 0 1px var(--accent)`).

## Do not

- Don't introduce a second accent color. One blue, that's it.
- Don't paint large areas with `accent`. It's for emphasis, not fill.
- Don't reach for purple/yellow/green to differentiate things. Use icons,
  labels, layout — not hue.
- Don't add drop shadows under bubbles. Cards on a list can use `shadow-xs`
  in light mode only.
- Don't render `attachment` records (hook results, deferred-tool updates)
  inline — these are noise from the user's perspective.

## Implementation map

- CSS tokens: `src/frontend/src/index.css` `:root` (light) and
  `[data-theme="dark"]` (dark).
- JS tokens (CSS var references): `src/frontend/src/styles/tokens.js`.
- Theme toggle / persistence: `src/frontend/src/hooks/useTheme.js`,
  `src/frontend/src/components/ThemeToggle.jsx`.
