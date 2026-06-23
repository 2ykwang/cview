import { WrenchIcon } from './Icon';
import { color, radius, fontSize, space } from '../styles/tokens';

// Placeholder for record types cview doesn't render as a bubble. Surfaced (not
// dropped) so new Claude Code schema stays visible. Pure metadata/telemetry
// types are filtered upstream (STREAM_SKIP_TYPES); whatever reaches here is
// something meaningful we don't have a dedicated card for yet.
export default function UnsupportedMessage({ type }) {
  return (
    <div style={s.row}>
      <span style={s.chip} title={`Unsupported record type: ${type}`}>
        <WrenchIcon size={11} />
        unavailable · {type}
      </span>
    </div>
  );
}

const s = {
  row: { display: 'flex', justifyContent: 'center', margin: '6px 0' },
  chip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: space.px3,
    padding: '2px 10px',
    borderRadius: radius.pill,
    background: color.surface,
    border: `1px solid ${color.border}`,
    color: color.textMuted,
    fontSize: fontSize.xs,
  },
};
