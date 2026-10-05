import type { ReactNode } from 'react';
import { formatBytes } from '../../utils/format';

export function StatCard({ label, value, hint, tone = 'neutral' }: { label: string; value: ReactNode; hint?: ReactNode; tone?: 'neutral' | 'good' | 'warn' | 'bad' }) {
  const color = { neutral: 'text-neutral-900', good: 'text-emerald-700', warn: 'text-amber-700', bad: 'text-red-700' }[tone];
  return (
    <div className="rounded-lg border border-border-subtle bg-bg-base p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${color}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-neutral-500">{hint}</p>}
    </div>
  );
}

/** Colour by how full it is: green below 80 %, amber up to 100 %, red when over the limit. */
export function usageTone(used: number, quota: number | null): 'good' | 'warn' | 'bad' {
  if (quota === null || quota <= 0) return 'good';
  const pct = used / quota;
  return pct >= 1 ? 'bad' : pct >= 0.8 ? 'warn' : 'good';
}

export function UsageBar({ used, quota, unlimitedLabel, className = '' }: { used: number; quota: number | null; unlimitedLabel: string; className?: string }) {
  const tone = usageTone(used, quota);
  const bar = { good: 'bg-emerald-500', warn: 'bg-amber-500', bad: 'bg-red-500' }[tone];
  const pct = quota && quota > 0 ? Math.min(100, (used / quota) * 100) : 0;
  return (
    <div className={className}>
      <div className="flex items-baseline justify-between gap-2 text-xs text-neutral-700">
        <span>{formatBytes(used)}</span>
        <span className="text-neutral-500">{quota === null ? unlimitedLabel : `${formatBytes(quota)} · ${Math.round((used / Math.max(quota, 1)) * 100)}%`}</span>
      </div>
      <div
        className="mt-1 h-2 overflow-hidden rounded-full bg-neutral-200"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={quota ?? undefined}
        aria-valuenow={used}
      >
        <div className={`h-full rounded-full transition-all ${bar}`} style={{ width: quota === null ? '0%' : `${pct}%` }} />
      </div>
    </div>
  );
}

/** Dependency-free bar chart (SVG). Bars carry a tooltip with their label and value. */
export function BarChart({ values, labels, color = '#3b82f6', height = 90, ariaLabel }: { values: number[]; labels: string[]; color?: string; height?: number; ariaLabel: string }) {
  const max = Math.max(1, ...values);
  const width = 300;
  const gap = 2;
  const barW = Math.max(2, width / Math.max(values.length, 1) - gap);
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-24 w-full" role="img" aria-label={ariaLabel} preserveAspectRatio="none">
      <line x1="0" y1={height - 0.5} x2={width} y2={height - 0.5} stroke="#d0d7de" strokeWidth="1" />
      {values.map((v, i) => {
        const h = (v / max) * (height - 6);
        return (
          <rect key={i} x={i * (barW + gap)} y={height - h - 1} width={barW} height={Math.max(h, v > 0 ? 2 : 0)} rx="1.5" fill={color}>
            <title>{`${labels[i]}: ${v}`}</title>
          </rect>
        );
      })}
    </svg>
  );
}
