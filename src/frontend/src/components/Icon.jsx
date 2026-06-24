function IconBase({ children, size = 14, strokeWidth = 1.9, style, fill = 'none' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={fill}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ display: 'block', flexShrink: 0, ...style }}
    >
      {children}
    </svg>
  );
}

export function ArrowLeftIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M19 12H5" />
      <path d="m12 19-7-7 7-7" />
    </IconBase>
  );
}

export function FolderIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </IconBase>
  );
}

export function FileIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z" />
      <path d="M14 2v5h5" />
    </IconBase>
  );
}

export function EditIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M12 20h9" />
      <path d="m16.5 3.5 4 4L8 20l-4 1 1-4Z" />
    </IconBase>
  );
}

export function PencilIcon(props) {
  return (
    <IconBase {...props}>
      <path d="m12 20 9-9-3-3-9 9-1 4z" />
      <path d="M16 5l3 3" />
      <path d="M4 20h4" />
    </IconBase>
  );
}

export function SendIcon(props) {
  return (
    <IconBase {...props}>
      <path d="m22 2-7 20-4-9-9-4z" />
      <path d="M22 2 11 13" />
    </IconBase>
  );
}

export function MegaphoneIcon(props) {
  return (
    <IconBase {...props}>
      <path d="m3 11 12-5v12L3 13z" />
      <path d="M6 13v5a2 2 0 0 0 2 2h1" />
      <path d="M15 9a3 3 0 0 1 0 6" />
    </IconBase>
  );
}

export function PowerIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M12 2v8" />
      <path d="M6.2 6.2a8 8 0 1 0 11.3 0" />
    </IconBase>
  );
}

export function BotIcon(props) {
  return (
    <IconBase {...props}>
      <rect x="4" y="7" width="16" height="12" rx="3" />
      <path d="M9 12h.01M15 12h.01" />
      <path d="M12 7V4" />
    </IconBase>
  );
}

export function ClipboardIcon(props) {
  return (
    <IconBase {...props}>
      <rect x="6" y="4" width="12" height="16" rx="2" />
      <path d="M9 4h6v3H9z" />
    </IconBase>
  );
}

export function RefreshIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M20 11a8 8 0 0 0-14.7-4M4 13a8 8 0 0 0 14.7 4" />
      <path d="M3 3v5h5M16 16h5v5" />
    </IconBase>
  );
}

export function UsersIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
      <circle cx="9.5" cy="8" r="3" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16.5 5.13a3 3 0 0 1 0 5.74" />
    </IconBase>
  );
}

export function TrashIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="m19 6-1 14H6L5 6" />
      <path d="M10 11v6M14 11v6" />
    </IconBase>
  );
}

export function SearchIcon(props) {
  return (
    <IconBase {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </IconBase>
  );
}

export function WrenchIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M14 4a5 5 0 0 0 6 6l-7 7a2 2 0 1 1-3-3l7-7a5 5 0 0 0-3-3z" />
    </IconBase>
  );
}

export function MessageIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H5l-2 2v-7.5A8.5 8.5 0 1 1 21 11.5Z" />
    </IconBase>
  );
}

export function MoonIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 1 0 9.8 9.8z" />
    </IconBase>
  );
}

export function ExportIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M12 3v12" />
      <path d="m8 7 4-4 4 4" />
      <path d="M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" />
    </IconBase>
  );
}

export function DownloadIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M12 3v12" />
      <path d="m6 11 6 6 6-6" />
      <path d="M5 21h14" />
    </IconBase>
  );
}

export function CameraIcon(props) {
  return (
    <IconBase {...props}>
      <path d="M4 7h4l2-2h4l2 2h4a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z" />
      <circle cx="12" cy="13" r="4" />
    </IconBase>
  );
}

// GitHub mark — filled, so it bypasses IconBase's stroke styling.
export function GithubIcon({ size = 14, style }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true" style={{ display: 'block', flexShrink: 0, ...style }}>
      <path d="M12 .5C5.37.5 0 5.78 0 12.29c0 5.2 3.44 9.6 8.21 11.16.6.11.82-.25.82-.56v-2.17c-3.34.71-4.04-1.58-4.04-1.58-.55-1.36-1.33-1.73-1.33-1.73-1.09-.73.08-.71.08-.71 1.2.08 1.83 1.21 1.83 1.21 1.07 1.79 2.81 1.27 3.5.97.11-.76.42-1.27.76-1.56-2.67-.3-5.47-1.31-5.47-5.81 0-1.28.47-2.33 1.24-3.15-.13-.3-.54-1.51.11-3.15 0 0 1.01-.32 3.3 1.2.96-.26 1.98-.39 3-.4 1.02 0 2.04.14 3 .4 2.28-1.52 3.29-1.2 3.29-1.2.65 1.64.24 2.85.12 3.15.77.82 1.23 1.87 1.23 3.15 0 4.51-2.81 5.5-5.49 5.79.43.36.81 1.09.81 2.2v3.26c0 .31.22.68.82.56A12.01 12.01 0 0 0 24 12.29C24 5.78 18.63.5 12 .5z" />
    </svg>
  );
}
