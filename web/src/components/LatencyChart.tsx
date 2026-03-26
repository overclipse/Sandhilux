import { useMemo, useId } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import type { LatencyPoint } from "../types/api";

interface Props {
  data: LatencyPoint[];
  threshold?: number;
}

const BLUE = "#3b82f6";
const PURPLE = "#8b5cf6";
const RED = "#ef4444";
const GREEN = "#22c55e";
const GRID = "rgba(30, 41, 59, 0.4)";
const TICK = "#475569";

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div
      style={{
        background: "rgba(12, 18, 34, 0.95)",
        backdropFilter: "blur(16px)",
        border: "1px solid rgba(59, 130, 246, 0.25)",
        borderRadius: 10,
        padding: "10px 14px",
        fontSize: 12,
        boxShadow:
          "0 8px 32px rgba(0,0,0,0.5), 0 0 20px rgba(59, 130, 246, 0.08)",
      }}
    >
      <div style={{ color: TICK, marginBottom: 4, fontSize: 11 }}>
        {d.fullTime}
      </div>
      <div style={{ color: "#f1f5f9", fontWeight: 600, fontSize: 14 }}>
        {d.latency}
        <span style={{ color: TICK, fontWeight: 400, fontSize: 11 }}>ms</span>
      </div>
      {d.status_code != null && d.status_code > 0 && (
        <div
          style={{
            color: d.status_code >= 400 ? RED : GREEN,
            fontSize: 11,
            marginTop: 3,
          }}
        >
          HTTP {d.status_code}
        </div>
      )}
    </div>
  );
}

export function LatencyChart({ data, threshold }: Props) {
  const uid = useId().replace(/:/g, "");
  const gradientId = `latFill-${uid}`;
  const strokeId = `latStroke-${uid}`;

  const formatted = useMemo(
    () =>
      data.map((p) => ({
        ...p,
        time: formatTime(p.time),
        fullTime: new Date(p.time).toLocaleString("en-GB"),
      })),
    [data],
  );

  // Compute nice tick interval — show ~8-12 labels max
  const tickInterval = Math.max(0, Math.floor(formatted.length / 10) - 1);

  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart
        data={formatted}
        margin={{ top: 8, right: 16, bottom: 0, left: 0 }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={BLUE} stopOpacity={0.25} />
            <stop offset="50%" stopColor={PURPLE} stopOpacity={0.08} />
            <stop offset="100%" stopColor={BLUE} stopOpacity={0} />
          </linearGradient>
          <linearGradient id={strokeId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={BLUE} />
            <stop offset="100%" stopColor={PURPLE} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis
          dataKey="time"
          tick={{ fill: TICK, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          interval={tickInterval}
        />
        <YAxis
          tick={{ fill: TICK, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          unit="ms"
          width={52}
          domain={["auto", "auto"]}
        />
        <Tooltip
          content={<CustomTooltip />}
          wrapperStyle={{ outline: "none" }}
          cursor={{ stroke: "rgba(59,130,246,0.2)", strokeWidth: 1 }}
        />
        {threshold && (
          <ReferenceLine
            y={threshold}
            stroke={RED}
            strokeDasharray="6 3"
            strokeOpacity={0.5}
            label={{
              value: `${threshold}ms`,
              fill: RED,
              fontSize: 11,
              position: "right",
            }}
          />
        )}
        {!threshold && (
          <>
            <ReferenceLine
              y={500}
              stroke={GREEN}
              strokeDasharray="4 3"
              strokeOpacity={0.35}
            />
            <ReferenceLine
              y={1000}
              stroke={RED}
              strokeDasharray="6 3"
              strokeOpacity={0.45}
            />
          </>
        )}
        <Area
          type="monotone"
          dataKey="latency"
          fill={`url(#${gradientId})`}
          stroke={`url(#${strokeId})`}
          strokeWidth={2}
          dot={false}
          activeDot={{
            r: 5,
            fill: BLUE,
            stroke: "rgba(59, 130, 246, 0.3)",
            strokeWidth: 6,
          }}
          isAnimationActive={true}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
