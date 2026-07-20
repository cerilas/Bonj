import type { ReactNode } from "react";

export type UiIconName =
  | "arrow-down-right"
  | "arrow-left"
  | "arrow-right"
  | "arrow-up-right"
  | "check"
  | "close"
  | "copy"
  | "link"
  | "logout"
  | "moon"
  | "plus"
  | "refresh"
  | "search"
  | "shield"
  | "sun";

type UiIconProps = {
  name: UiIconName;
  className?: string;
};

export function UiIcon({ name, className = "" }: UiIconProps) {
  const paths: Record<UiIconName, ReactNode> = {
    "arrow-down-right": <><path d="M6 6l12 12" /><path d="M9 18h9V9" /></>,
    "arrow-left": <><path d="M19 12H5" /><path d="m10 7-5 5 5 5" /></>,
    "arrow-right": <><path d="M5 12h14" /><path d="m14 7 5 5-5 5" /></>,
    "arrow-up-right": <><path d="M6 18 18 6" /><path d="M9 6h9v9" /></>,
    check: <path d="m5 12 4.2 4.2L19 6.5" />,
    close: <><path d="M6 6l12 12" /><path d="M18 6 6 18" /></>,
    copy: <><rect x="8" y="8" width="11" height="11" rx="2" /><path d="M16 8V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h1" /></>,
    link: <><path d="M9.5 14.5 14.5 9.5" /><path d="M7.2 16.8 5.8 18.2a3.5 3.5 0 0 1-5-5l3.4-3.4a3.5 3.5 0 0 1 5 0" transform="translate(3 0)" /><path d="m16.8 7.2 1.4-1.4a3.5 3.5 0 0 0-5-5L9.8 4.2a3.5 3.5 0 0 0 0 5" transform="translate(0 3)" /></>,
    logout: <><path d="M10 5H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4" /><path d="M13 8l4 4-4 4" /><path d="M8 12h9" /></>,
    moon: <path d="M19.4 15.5A8 8 0 0 1 8.5 4.6 8 8 0 1 0 19.4 15.5Z" />,
    plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
    refresh: <><path d="M20 7v5h-5" /><path d="M18.2 16.5A8 8 0 1 1 20 12" /></>,
    search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m15.5 15.5 4 4" /></>,
    shield: <><path d="M12 3 5 6v5c0 4.7 2.8 8 7 10 4.2-2 7-5.3 7-10V6l-7-3Z" /><path d="m9 12 2 2 4-4" /></>,
    sun: <><circle cx="12" cy="12" r="3.5" /><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42" /></>,
  };

  return (
    <svg
      className={`ui-icon ${className}`.trim()}
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {paths[name]}
    </svg>
  );
}
