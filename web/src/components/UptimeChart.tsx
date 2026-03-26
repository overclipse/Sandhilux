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
}

const GREEN = "#22c55e";
const RED = "#ef4444";
const GRID = "rgba(30, 41, 59, 0.4)";
const TICK = "#475569";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as DailyUptime;
  const isGood = d.uptime >= 95;
  return (
    <div
      style={{
        background: "rgba(12, 18, 34, 0.95)",
        backdropFilter: "blur(16px)",
        border: `1px solid ${isGood ? "rgba(34, 197, 94, 0.25)" : "rgba(239, 68, 68, 0.25)"}`,
        borderRadius: 10,
        padding: "10px 14px",
        fontSize: 12,
        boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
      }}
    >
      <div style={{ color: TICK, fontSize: 11 }}>{d.date}</div>
      <div
        style={{
          color: isGood ? GREEN : RED,
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

export function UptimeChart({ data }: Props) {
  const uid = useId().replace(/:/g, "");
  const greenId = `greenBar-${uid}`;
  const redId = `redBar-${uid}`;

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={greenId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={GREEN} stopOpacity={0.9} />
            <stop offset="100%" stopColor={GREEN} stopOpacity={0.35} />
          </linearGradient>
          <linearGradient id={redId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={RED} stopOpacity={0.9} />
            <stop offset="100%" stopColor={RED} stopOpacity={0.35} />
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
          y={99}
          stroke={GREEN}
          strokeDasharray="4 3"
          strokeOpacity={0.35}
        />
        <ReferenceLine
          y={95}
          stroke={RED}
          strokeDasharray="6 3"
          strokeOpacity={0.45}
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
              fill={entry.uptime >= 95 ? `url(#${greenId})` : `url(#${redId})`}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
