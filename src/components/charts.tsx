import type { ReactNode } from "react";

type Point = { label: string; value: number };

/** Simple area/line chart in pure SVG using theme tokens. */
export function AreaChart({
  data,
  height = 140,
  tone = "primary",
}: {
  data: Point[];
  height?: number;
  tone?: "primary" | "up" | "down";
}) {
  if (!data.length) return <EmptyChart height={height} />;
  const W = 600;
  const H = height;
  const pad = 24;
  const max = Math.max(1, ...data.map((d) => d.value));
  const step = data.length > 1 ? (W - pad * 2) / (data.length - 1) : 0;
  const pts = data.map((d, i) => {
    const x = pad + i * step;
    const y = H - pad - (d.value / max) * (H - pad * 2);
    return [x, y] as const;
  });
  const line = pts.map(([x, y], i) => (i === 0 ? `M${x},${y}` : `L${x},${y}`)).join(" ");
  const area = `${line} L${pts[pts.length - 1][0]},${H - pad} L${pts[0][0]},${H - pad} Z`;
  const stroke = `chart-line-${tone === "primary" ? "primary" : tone}`;
  const fill = `chart-area-${tone === "primary" ? "primary" : tone}`;
  return (
    <div className="chart-frame">
      <svg viewBox={`0 0 ${W} ${H}`} className="chart-grid w-full" preserveAspectRatio="none">
        <path d={area} className={fill} />
        <path d={line} className={stroke} fill="none" strokeWidth={1.5} />
        {pts.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={2} className={stroke} fill="currentColor" />
        ))}
        <text x={pad} y={H - 6} className="chart-axis">
          {data[0]?.label}
        </text>
        <text x={W - pad} y={H - 6} textAnchor="end" className="chart-axis">
          {data[data.length - 1]?.label}
        </text>
      </svg>
    </div>
  );
}

export function BarChart({
  data,
  height = 140,
  tone = "primary",
}: {
  data: Point[];
  height?: number;
  tone?: "primary" | "up" | "down";
}) {
  if (!data.length) return <EmptyChart height={height} />;
  const W = 600;
  const H = height;
  const pad = 24;
  const max = Math.max(1, ...data.map((d) => d.value));
  const bw = ((W - pad * 2) / data.length) * 0.7;
  const gap = ((W - pad * 2) / data.length) * 0.3;
  const fill = `chart-area-${tone === "primary" ? "primary" : tone}`;
  const stroke = `chart-line-${tone === "primary" ? "primary" : tone}`;
  return (
    <div className="chart-frame">
      <svg viewBox={`0 0 ${W} ${H}`} className="chart-grid w-full" preserveAspectRatio="none">
        {data.map((d, i) => {
          const x = pad + i * (bw + gap) + gap / 2;
          const h = (d.value / max) * (H - pad * 2);
          const y = H - pad - h;
          return (
            <g key={i}>
              <rect x={x} y={y} width={bw} height={h} className={`${fill} ${stroke}`} />
              <text
                x={x + bw / 2}
                y={H - 6}
                textAnchor="middle"
                className="chart-axis"
              >
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function Funnel({
  steps,
}: {
  steps: { label: string; value: number }[];
}) {
  const max = Math.max(1, ...steps.map((s) => s.value));
  return (
    <div className="chart-frame space-y-2">
      {steps.map((s, i) => {
        const pct = (s.value / max) * 100;
        return (
          <div key={i} className="flex items-center gap-3">
            <span className="w-28 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              {s.label}
            </span>
            <div className="relative h-6 flex-1 border border-border bg-surface">
              <div
                className="chart-area-primary h-full border-r border-primary"
                style={{ width: `${pct}%` }}
              />
              <span className="absolute inset-0 flex items-center px-2 font-mono text-[11px]">
                {s.value}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function KPI({
  label,
  value,
  hint,
  trend,
}: {
  label: string;
  value: string;
  hint?: string;
  trend?: "up" | "down" | "flat";
}) {
  const arrow = trend === "up" ? "▲" : trend === "down" ? "▼" : "•";
  const tone =
    trend === "up"
      ? "text-signal-up"
      : trend === "down"
        ? "text-signal-down"
        : "text-muted-foreground";
  return (
    <div className="border border-border bg-surface p-3">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {label}
        </p>
        <span className={`font-mono text-[10px] ${tone}`}>{arrow}</span>
      </div>
      <p className="mt-1 font-mono text-xl font-bold tabular-nums">{value}</p>
      {hint ? (
        <p className="mt-0.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function EmptyChart({ height = 140 }: { height?: number }) {
  return (
    <div
      className="chart-frame flex items-center justify-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground"
      style={{ height }}
    >
      No data yet
    </div>
  );
}

export function ChartHeader({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        {title}
      </p>
      {right}
    </div>
  );
}
