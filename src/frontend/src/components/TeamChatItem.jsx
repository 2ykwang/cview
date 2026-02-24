import { getAvatarColor } from './Avatar';

function relativeTime(ts) {
  const now = new Date();
  const date = new Date(ts);
  const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function StackAvatars({ members }) {
  const shown = members.slice(0, 3);
  return (
    <div style={{ position: 'relative', width: '48px', height: '48px', flexShrink: 0 }}>
      {shown.map((name, i) => (
        <div
          key={name}
          style={{
            position: 'absolute',
            width: '28px', height: '28px', borderRadius: '50%',
            background: getAvatarColor(name),
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: '12px', fontWeight: '700',
            border: '2px solid #17212b',
            left: i * 12, top: i * 10, zIndex: shown.length - i,
          }}
        >
          {name[0].toUpperCase()}
        </div>
      ))}
    </div>
  );
}

export default function TeamChatItem({ team, onClick, isHovered, onMouseEnter, onMouseLeave }) {
  const { teamName, members = [], lastActivity, sessionCount, preview } = team;
  const shownMembers = members.slice(0, 3).join(' · ');
  const extra = members.length > 3 ? ` +${members.length - 3} more` : '';

  return (
    <button
      style={{ ...styles.item, ...(isHovered ? styles.itemHover : {}) }}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <StackAvatars members={members} />
      <div style={styles.body}>
        <div style={styles.row1}>
          <span style={styles.title}>{teamName}</span>
          <span style={styles.time}>{relativeTime(lastActivity)}</span>
        </div>
        <div style={styles.members}>{shownMembers}{extra}</div>
        <div style={styles.preview}>{preview || 'No messages'}</div>
      </div>
      <div style={styles.badge}>{members.length} members</div>
    </button>
  );
}

const styles = {
  item: { display: 'flex', alignItems: 'center', gap: '12px', width: '100%', padding: '12px 16px', border: 'none', borderBottom: '1px solid #1c2733', background: 'transparent', cursor: 'pointer', textAlign: 'left', transition: 'background 0.1s' },
  itemHover: { background: '#1f2936' },
  body: { flex: 1, minWidth: 0 },
  row1: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '2px' },
  title: { fontSize: '15px', fontWeight: '600', color: '#e8e8e8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 },
  time: { fontSize: '12px', color: '#6c7883', marginLeft: '8px', flexShrink: 0 },
  members: { fontSize: '12px', color: '#5ab3ef', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  preview: { fontSize: '13px', color: '#6c7883', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  badge: { fontSize: '11px', color: '#6c7883', flexShrink: 0 },
};
