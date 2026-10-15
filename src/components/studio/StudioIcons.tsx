import type { SVGProps } from "react";

export type IconName =
  | "arrow"
  | "diagonal"
  | "spark"
  | "upload"
  | "image"
  | "check"
  | "play"
  | "pause"
  | "plus"
  | "close"
  | "menu"
  | "download"
  | "video"
  | "music"
  | "layers"
  | "grid"
  | "settings"
  | "card"
  | "logout"
  | "chevron"
  | "ratio"
  | "lock"
  | "paperclip"
  | "model";
const paths: Record<IconName, React.ReactNode> = {
  arrow: (
    <>
      <path d="M4 12h15M13 5l7 7-7 7" />
    </>
  ),
  diagonal: (
    <>
      <path d="M5 19 19 5M5 5h14v14" />
    </>
  ),
  spark: (
    <>
      <path d="m12 2 2.7 7.3L22 12l-7.3 2.7L12 22l-2.7-7.3L2 12l7.3-2.7L12 2Z" />
    </>
  ),
  upload: (
    <>
      <path d="M12 16V3m-5 5 5-5 5 5M4 15v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5" />
    </>
  ),
  image: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path d="m3 16 5-5 4 4 3-3 6 6" />
      <circle cx="15.5" cy="7.5" r="1" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  play: <path d="m9 5 11 7-11 7V5Z" />,
  pause: (
    <>
      <path d="M8 5v14M16 5v14" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  menu: <path d="M4 8h16M4 16h16" />,
  download: <path d="M12 3v13m-5-5 5 5 5-5M4 17v4h16v-4" />,
  video: (
    <>
      <rect x="3" y="5" width="13" height="14" rx="3" />
      <path d="m16 10 5-3v10l-5-3" />
    </>
  ),
  music: (
    <>
      <path d="M9 18V5l11-2v13M9 9l11-2" />
      <ellipse cx="6" cy="18" rx="3" ry="3" />
      <ellipse cx="17" cy="16" rx="3" ry="3" />
    </>
  ),
  layers: (
    <>
      <path d="m12 3 10 6-10 6L2 9l10-6Zm-9 12 9 6 9-6M3 12l9 6 9-6" />
    </>
  ),
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  settings: (
    <>
      <path d="M4 7h16M4 17h16" />
      <circle cx="9" cy="7" r="3" />
      <circle cx="16" cy="17" r="3" />
    </>
  ),
  card: (
    <>
      <rect x="2" y="4" width="20" height="16" rx="3" />
      <path d="M2 10h20M6 16h4" />
    </>
  ),
  logout: <path d="M9 3H4v18h5m5-14 5 5-5 5M9 12h10" />,
  chevron: <path d="m6 9 6 6 6-6" />,
  ratio: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M7 10v4h4" />
    </>
  ),
  lock: (
    <>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </>
  ),
  paperclip: <path d="m20 11-8.5 8.5a5 5 0 0 1-7-7L13 4a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3L14 7" />,
  model: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M9 9h6v6H9zM9 1v3M15 1v3M9 20v3M15 20v3M1 9h3M1 15h3M20 9h3M20 15h3" />
    </>
  ),
};
export function Icon({
  name,
  ...props
}: SVGProps<SVGSVGElement> & { name: IconName }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
export function Brand({ className = "" }: { className?: string }) {
  return (
    <span className={`studio-brand ${className}`}>
      <span className="studio-brand-mark">
        <Icon name="spark" />
      </span>
      <span>
        image<span className="studio-brand-two">2</span>ad
        <span className="studio-brand-dot">®</span>
      </span>
    </span>
  );
}
