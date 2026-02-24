const FIXED = {
  'team-lead': '#6B7280',
  'planner': '#3B82F6',
  'frontend-dev': '#10B981',
  'senior-engineer': '#F59E0B',
};
const PALETTE = ['#8B5CF6', '#EF4444', '#EC4899'];

export function getAvatarColor(agentName) {
  if (!agentName) return '#6B7280';
  if (FIXED[agentName]) return FIXED[agentName];
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
      justifyContent: 'center', color: '#fff',
      fontSize: Math.round(size * 0.44), fontWeight: '700', flexShrink: 0,
    }}>
      {initial}
    </div>
  );
}
