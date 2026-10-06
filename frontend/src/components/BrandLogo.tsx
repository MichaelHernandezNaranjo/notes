import { useId } from 'react';

/** App logo: same artwork as /favicon.svg (gradient rounded square, white page with folded corner, three lines). */
export function BrandLogo({ className = '', translucent = false }: { className?: string; translucent?: boolean }) {
  const id = useId();
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#10b981" />
          <stop offset="0.55" stopColor="#3b82f6" />
          <stop offset="1" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill={translucent ? 'rgba(255,255,255,0.2)' : `url(#${id})`} />
      <path d="M39 14H24a5 5 0 0 0-5 5v26a5 5 0 0 0 5 5h16a5 5 0 0 0 5-5V20z" fill="#fff" fillOpacity="0.96" />
      <path d="M39 14v6h6" fill="none" stroke="#3b82f6" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M26 30h13M26 36h13M26 42h8" fill="none" stroke="#3b82f6" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}
