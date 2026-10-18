import { useId } from 'react';

// A shaded basketball: orange leather lit from the upper left, pebble grain,
// the four black seams, and a soft rim shadow
export default function Basketball({ size = 30 }: { size?: number }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden="true"
      style={{ flex: 'none', filter: 'drop-shadow(0 2px 6px rgb(0 0 0 / 0.55)) drop-shadow(0 0 10px rgb(255 140 50 / 0.25))' }}
    >
      <defs>
        <radialGradient id={`${id}-leather`} cx="0.36" cy="0.32" r="0.75">
          <stop offset="0" stopColor="#ffb066" />
          <stop offset="0.45" stopColor="#f07a22" />
          <stop offset="0.85" stopColor="#b84a0c" />
          <stop offset="1" stopColor="#7a2e06" />
        </radialGradient>
        <radialGradient id={`${id}-shine`} cx="0.32" cy="0.26" r="0.32">
          <stop offset="0" stopColor="#fff3e0" stopOpacity="0.55" />
          <stop offset="1" stopColor="#fff3e0" stopOpacity="0" />
        </radialGradient>
        <pattern id={`${id}-grain`} width="3" height="3" patternUnits="userSpaceOnUse">
          <circle cx="1.5" cy="1.5" r="0.55" fill="#5a2004" opacity="0.22" />
        </pattern>
        <clipPath id={`${id}-ball`}>
          <circle cx="32" cy="32" r="29" />
        </clipPath>
      </defs>
      <circle cx="32" cy="32" r="29" fill={`url(#${id}-leather)`} />
      <circle cx="32" cy="32" r="29" fill={`url(#${id}-grain)`} />
      <g
        clipPath={`url(#${id}-ball)`}
        fill="none"
        stroke="#1d0d04"
        strokeWidth="2.4"
        strokeLinecap="round"
      >
        {/* Center seams */}
        <path d="M32 3 C27 20 27 44 32 61" />
        <path d="M3 32 C20 28 44 28 61 32" />
        {/* Side seams curving around the ball */}
        <path d="M12 11 C22 20 23 44 12 53" />
        <path d="M52 11 C42 20 41 44 52 53" />
      </g>
      <circle cx="32" cy="32" r="29" fill={`url(#${id}-shine)`} />
      <circle cx="32" cy="32" r="28.6" fill="none" stroke="#3d1503" strokeOpacity="0.6" strokeWidth="1.2" />
    </svg>
  );
}
