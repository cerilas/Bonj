type InstagramIconProps = {
  className?: string;
};

export function InstagramIcon({ className = "" }: InstagramIconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="4.15" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="17.45" cy="6.75" r="1.05" fill="currentColor" />
    </svg>
  );
}
