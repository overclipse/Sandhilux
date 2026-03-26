import { useId } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Cell,
  ResponsiveContainer,
} from "recharts";
import type { DailyUptime } from "../types/api";

interface Props {
  data: DailyUptime[];
  slaTarget?: number;
}

const AMBER = "#eab308";
const GRID = "rgba(30, 41, 59, 0.4)";
const TICK = "#475569";
const NEUTRAL = "#64748b";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as DailyUptime;
  return (
    <div
      style={{
        background: "rgba(12, 18, 34, 0.95)",
        backdropFilter: "blur(16px)",
        border: "1px solid rgba(100, 116, 139, 0.25)",
        borderRadius: 10,
        padding: "10px 14px",
        fontSize: 12,
        boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
      }}
    >
      <div style={{ color: TICK, fontSize: 11 }}>{d.date}</div>
      <div
        style={{
          color: "#f1f5f9",
          fontWeight: 600,
          marginTop: 3,
          fontSize: 14,
        }}
      >
        {d.uptime.toFixed(2)}%
      </div>
    </div>
  );
}

export function UptimeChart({ data, slaTarget = 99 }: Props) {
  const uid = useId().replace(/:/g, "");
  const neutralId = `neutralBar-${uid}`;
  const redId = `redBar-${uid}`;

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={neutralId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={NEUTRAL} stopOpacity={0.45} />
            <stop offset="100%" stopColor={NEUTRAL} stopOpacity={0.12} />
          </linearGradient>
          <linearGradient id={redId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={AMBER} stopOpacity={0.7} />
            <stop offset="100%" stopColor={AMBER} stopOpacity={0.2} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fill: TICK, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: TICK, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          domain={[80, 100]}
          unit="%"
          width={42}
        />
        <ReferenceLine
          y={slaTarget}
          stroke={NEUTRAL}
          strokeDasharray="4 3"
          strokeOpacity={0.4}
          strokeWidth={1}
          label={{
            value: `SLA ${slaTarget}%`,
            fill: TICK,
            fontSize: 10,
            position: "right",
          }}
        />
        <Tooltip
          content={<CustomTooltip />}
          wrapperStyle={{ outline: "none" }}
          cursor={{ fill: "rgba(255,255,255,0.03)" }}
        />
        <Bar
          dataKey="uptime"
          radius={[4, 4, 0, 0]}
          maxBarSize={36}
          isAnimationActive={true}
        >
          {data.map((entry, i) => (
            <Cell
              key={i}
              fill={
                entry.uptime >= slaTarget
                  ? `url(#${neutralId})`
                  : `url(#${redId})`
              }
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
