import { color, fontWeight } from '../styles/tokens';

const PALETTE = [
  color.accent,
  color.toolAgent,
  color.success,
  color.warning,
  color.danger,
  color.textDim,
];

export function getAvatarColor(agentName) {
  if (!agentName) return color.textMuted;
  const hash = agentName.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return PALETTE[hash % PALETTE.length];
}

export default function Avatar({ agentName, size = 32 }) {
  const bg = getAvatarColor(agentName);
  const initial = (agentName || '?')[0].toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: bg, display: 'flex', alignItems: 'center',
      justifyContent: 'center', color: '#0d1217',
      fontSize: Math.round(size * 0.44), fontWeight: fontWeight.bold, flexShrink: 0,
    }}>
      {initial}
    </div>
  );
}
