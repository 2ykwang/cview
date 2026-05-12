// JS-side mirror of the CSS variables in index.css.
// Always resolves via var(...) so theme changes (data-theme) take effect
// without re-rendering inline styles.
//
// See DESIGN.md for token rules. Per design, all tool cards use the same
// neutral border color — `Agent` / `Task` is the only exception (uses accent).

const v = (name) => `var(--${name})`;

export const color = {
  bg: v('bg'),
  bgAlt: v('bg-alt'),
  surface: v('surface'),
  surface3: v('surface-3'),
  border: v('border'),

  text: v('text'),
  textDim: v('text-dim'),
  textMuted: v('text-muted'),
  textFaint: v('text-faint'),

  accent: v('accent'),
  accentBg: v('accent-bg'),

  userBubble: v('user-bubble'),
  userBubbleText: v('user-bubble-text'),
  agentBubble: v('agent-bubble'),

  success: v('success'),
  warning: v('warning'),
  danger: v('danger'),

  toolAgent: v('accent'),

  thinking: v('text-dim'),
  thinkingBg: v('bg-alt'),
  thinkingBorder: v('border'),

  diffAddBg: v('diff-add-bg'),
  diffAddFg: v('diff-add-fg'),
  diffDelBg: v('diff-del-bg'),
  diffDelFg: v('diff-del-fg'),

  codeBg: v('code-bg'),
  codeFg: v('code-fg'),

  // Tool cards collapse to a single neutral border — see DESIGN.md.
  toolSend: v('border-strong'),
  toolBash: v('border-strong'),
  toolFile: v('border-strong'),
};

export const radius = {
  xs: 4,
  sm: 6,
  md: 10,
  lg: 14,
  xl: 18,
  pill: 999,
  bubbleIn: '6px 18px 18px 18px',
  bubbleOut: '18px 6px 18px 18px',
};

export const space = {
  px1: 2,
  px2: 4,
  px3: 6,
  px4: 8,
  px5: 12,
  px6: 16,
  px7: 20,
  px8: 24,
  px9: 32,
};

export const fontSize = {
  xs: 11,
  sm: 12,
  base: 13,
  md: 14,
  lg: 15,
  xl: 17,
  xxl: 20,
};

export const fontWeight = {
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
};

export const shadow = {
  xs: v('shadow-xs'),
  sm: v('shadow-sm'),
};

export const motion = {
  fast: v('motion-fast'),
  base: v('motion-base'),
};

export const font = {
  body: v('font-body'),
  mono: v('font-mono'),
};
