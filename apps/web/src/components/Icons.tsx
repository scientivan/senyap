import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;
const base = { viewBox: "0 0 24 24", "aria-hidden": true } as const;

export const LockIcon = (p: P) => (
  <svg {...base} {...p}>
    <path fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" d="M7 11V8a5 5 0 0 1 10 0v3" />
    <rect x="4.5" y="11" width="15" height="10" rx="2.5" fill="currentColor" />
  </svg>
);
export const EyeIcon = (p: P) => (
  <svg {...base} {...p}>
    <path fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
    <circle cx="12" cy="12" r="3" fill="currentColor" />
  </svg>
);
export const GlobeIcon = (p: P) => (
  <svg {...base} {...p}>
    <g fill="none" stroke="currentColor" strokeWidth="2.2">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.8 3 2.8 15 0 18M12 3c-2.8 3-2.8 15 0 18" />
    </g>
  </svg>
);
export const CheckIcon = (p: P) => (
  <svg {...base} {...p}>
    <path fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>
);
export const ArrowIcon = (p: P) => (
  <svg {...base} {...p}>
    <path fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" d="M5 12h13M13 6l6 6-6 6" />
  </svg>
);
export const FlaskIcon = (p: P) => (
  <svg {...base} {...p}>
    <path fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" d="M9 3h6M10 3v6L4.5 19a1.5 1.5 0 0 0 1.3 2h12.4a1.5 1.5 0 0 0 1.3-2L14 9V3" />
  </svg>
);
export const ScaleIcon = (p: P) => (
  <svg {...base} {...p}>
    <g fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 4v16M6 20h12M5 8h14" />
      <path d="M5 8 2.5 14a3 3 0 0 0 5 0L5 8ZM19 8l-2.5 6a3 3 0 0 0 5 0L19 8Z" />
    </g>
  </svg>
);
export const KeyIcon = (p: P) => (
  <svg {...base} {...p}>
    <g fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <circle cx="8" cy="15" r="4" />
      <path d="m11 12 8-8M16 7l2 2M14 9l2 2" />
    </g>
  </svg>
);
export const SpinnerIcon = (p: P) => (
  <svg {...base} {...p}>
    <path fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" d="M12 3a9 9 0 1 0 9 9" />
  </svg>
);

export const Logo = ({ size = 26 }: { size?: number }) => (
  <svg viewBox="0 0 26 26" width={size} height={size} aria-hidden>
    <rect x="2" y="5" width="4" height="16" rx="2" fill="#AE9970" />
    <rect x="8.5" y="8" width="4" height="10" rx="2" fill="#C1272D" />
    <rect x="15" y="10.5" width="4" height="5" rx="2" fill="#C1272D" />
    <rect x="21.5" y="12" width="2.5" height="2" rx="1" fill="#C1272D" />
  </svg>
);
