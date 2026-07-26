import { useProjects, usePrompts, useUsageEvents, useUsageSummary } from "@repo/api-client";
import type { UsageEvent } from "@repo/types";
import { Badge, Button, cn } from "@repo/ui";
import { IconDownload, IconTrendingDown, IconTrendingUp } from "@tabler/icons-react";
import { useMemo, useState } from "react";

type PeriodOption = "7d" | "30d" | string;

type PromptCostRow = {
  key: string;
  label: string;
  calls: number;
  avgTokens: number;
  totalCostUsd: number;
};

function currentMonthPeriod(now = new Date()): string {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function periodToRange(period: string, now = new Date()): { from: string; to: string } {
  const relative = /^(\d+)d$/.exec(period);
  if (relative) {
    const days = Number(relative[1]);
    return {
      from: new Date(now.getTime() - days * 86_400_000).toISOString(),
      to: now.toISOString(),
    };
  }
  if (/^\d{4}-\d{2}$/.test(period)) {
    const [year, month] = period.split("-").map(Number);
    return {
      from: new Date(Date.UTC(year, month - 1, 1)).toISOString(),
      to: new Date(Date.UTC(year, month, 1)).toISOString(),
    };
  }
  return {
    from: new Date(now.getTime() - 7 * 86_400_000).toISOString(),
    to: now.toISOString(),
  };
}

function periodLabel(period: string): string {
  if (period === "7d") return "Last 7 days";
  if (period === "30d") return "Last 30 days";
  if (/^\d{4}-\d{2}$/.test(period)) {
    const [year, month] = period.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString(undefined, {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
  }
  return period;
}

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

function groupEventsByDay(
  events: UsageEvent[],
): { date: string; requests: number; costUsd: number }[] {
  const map = new Map<string, { date: string; requests: number; costUsd: number }>();
  for (const event of events) {
    const date = dayKey(event.timestamp);
    const row = map.get(date) ?? { date, requests: 0, costUsd: 0 };
    row.requests += 1;
    row.costUsd += event.costUsd;
    map.set(date, row);
  }
  return [...map.values()]
    .map((row) => ({
      ...row,
      costUsd: Math.round(row.costUsd * 1e6) / 1e6,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function averageLatencyMs(events: UsageEvent[]): number | null {
  if (events.length === 0) return null;
  const total = events.reduce((sum, e) => sum + e.latencyMs, 0);
  return Math.round(total / events.length);
}

function successRate(events: UsageEvent[]): number | null {
  if (events.length === 0) return null;
  const ok = events.filter((e) => e.status === "success").length;
  return Math.round((ok / events.length) * 1000) / 10;
}

function topPromptsByCost(
  events: UsageEvent[],
  promptNameById: Map<string, string>,
): PromptCostRow[] {
  const map = new Map<
    string,
    { key: string; label: string; calls: number; tokens: number; totalCostUsd: number }
  >();

  for (const event of events) {
    const key = event.promptId ?? `model:${event.model}`;
    const label = event.promptId
      ? (promptNameById.get(event.promptId) ?? event.promptId)
      : event.model;
    const row = map.get(key) ?? {
      key,
      label,
      calls: 0,
      tokens: 0,
      totalCostUsd: 0,
    };
    row.calls += 1;
    row.tokens += event.inputTokens + event.outputTokens;
    row.totalCostUsd += event.costUsd;
    map.set(key, row);
  }

  return [...map.values()]
    .map((row) => ({
      key: row.key,
      label: row.label,
      calls: row.calls,
      avgTokens: Math.round(row.tokens / row.calls),
      totalCostUsd: Math.round(row.totalCostUsd * 1e6) / 1e6,
    }))
    .sort((a, b) => b.totalCostUsd - a.totalCostUsd)
    .slice(0, 8);
}

/** Half-vs-half delta for the current series (mock-style trend chip). */
function seriesDelta(values: number[]): number | null {
  if (values.length < 4) return null;
  const mid = Math.floor(values.length / 2);
  const first = values.slice(0, mid);
  const second = values.slice(mid);
  const avg = (xs: number[]) => xs.reduce((s, v) => s + v, 0) / xs.length;
  const a = avg(first);
  const b = avg(second);
  if (a === 0) return null;
  return Math.round(((b - a) / a) * 1000) / 10;
}

function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value);
}

function formatLatency(ms: number | null): string {
  if (ms === null) return "—";
  return `${ms}ms`;
}

function formatCompact(n: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: n >= 10_000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(n);
}

function formatShortDay(isoDate: string): string {
  const [, month, day] = isoDate.split("-");
  return `${month}/${day}`;
}

function exportEventsCsv(events: UsageEvent[], filename: string) {
  const headers = [
    "id",
    "timestamp",
    "provider",
    "model",
    "promptId",
    "inputTokens",
    "outputTokens",
    "latencyMs",
    "costUsd",
    "status",
  ];
  const rows = events.map((e) =>
    [
      e.id,
      e.timestamp,
      e.provider,
      e.model,
      e.promptId ?? "",
      e.inputTokens,
      e.outputTokens,
      e.latencyMs,
      e.costUsd,
      e.status,
    ]
      .map((cell) => {
        const raw = String(cell);
        return /[",\n]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw;
      })
      .join(","),
  );
  const blob = new Blob([[headers.join(","), ...rows].join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function TrendDelta({
  value,
  invertGood,
}: {
  value: number | null;
  invertGood?: boolean;
}) {
  if (value === null || Number.isNaN(value)) return null;
  const up = value >= 0;
  const good = invertGood ? !up : up;
  const Icon = up ? IconTrendingUp : IconTrendingDown;
  return (
    <span
      className={cn(
        "mt-0.5 flex items-center gap-0.5 text-2xs",
        good ? "text-success" : "text-destructive",
      )}
    >
      <Icon className="size-3" aria-hidden />
      {up ? "+" : ""}
      {value}% vs prior half
    </span>
  );
}

export default function App() {
  const { data: projects = [] } = useProjects();
  const [projectId, setProjectId] = useState("");
  const [period, setPeriod] = useState<PeriodOption>("7d");

  const effectiveProjectId = projectId || projects[0]?.id || "";
  const monthPeriod = currentMonthPeriod();
  const range = useMemo(() => periodToRange(period), [period]);

  const { data: prompts = [] } = usePrompts({ projectId: effectiveProjectId });
  const promptNameById = useMemo(() => new Map(prompts.map((p) => [p.id, p.name])), [prompts]);

  const {
    data: summary,
    isLoading: loadingSummary,
    isError: summaryError,
  } = useUsageSummary({
    projectId: effectiveProjectId,
    period,
  });

  const {
    data: events = [],
    isLoading: loadingEvents,
    isError: eventsError,
  } = useUsageEvents({
    projectId: effectiveProjectId,
    from: range.from,
    to: range.to,
  });

  const avgLatency = useMemo(() => averageLatencyMs(events), [events]);
  const rate = useMemo(() => successRate(events), [events]);
  const chartData = useMemo(() => groupEventsByDay(events), [events]);
  const topPrompts = useMemo(
    () => topPromptsByCost(events, promptNameById),
    [events, promptNameById],
  );
  const maxProviderCost = useMemo(
    () => Math.max(0, ...(summary?.byProvider.map((p) => p.costUsd) ?? [0])),
    [summary],
  );

  const callsDelta = useMemo(() => seriesDelta(chartData.map((d) => d.requests)), [chartData]);
  const costDelta = useMemo(() => seriesDelta(chartData.map((d) => d.costUsd)), [chartData]);
  const latencyDelta = useMemo(() => {
    const byDay = new Map<string, number[]>();
    for (const e of events) {
      const key = dayKey(e.timestamp);
      const list = byDay.get(key) ?? [];
      list.push(e.latencyMs);
      byDay.set(key, list);
    }
    const series = [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, xs]) => xs.reduce((s, v) => s + v, 0) / xs.length);
    return seriesDelta(series);
  }, [events]);

  const maxBar = Math.max(1, ...chartData.map((d) => d.requests));
  const tickIndexes =
    chartData.length <= 5
      ? chartData.map((_, i) => i)
      : [
          0,
          Math.floor((chartData.length - 1) / 3),
          Math.floor(((chartData.length - 1) * 2) / 3),
          chartData.length - 1,
        ];

  const loading = loadingSummary || loadingEvents;
  const hasError = summaryError || eventsError;
  const fieldClass =
    "h-8 rounded-md border border-border bg-background px-2.5 text-sm text-foreground";

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#12151f] text-foreground">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[15px] font-medium text-foreground">Usage — {periodLabel(period)}</h2>
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Project"
              className={cn(fieldClass, "min-w-36")}
              value={effectiveProjectId}
              onChange={(e) => setProjectId(e.target.value)}
            >
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Period"
              className={cn(fieldClass, "min-w-36")}
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value={monthPeriod}>This month ({monthPeriod})</option>
            </select>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-8 border border-input bg-secondary text-primary hover:bg-muted"
              disabled={events.length === 0}
              onClick={() => exportEventsCsv(events, `usage-${effectiveProjectId}-${period}.csv`)}
            >
              <IconDownload className="size-3.5" aria-hidden />
              Export CSV
            </Button>
          </div>
        </header>

        {hasError ? (
          <p className="text-sm text-destructive" role="alert">
            Failed to load usage data. Try again or check the API connection.
          </p>
        ) : null}

        <section
          aria-labelledby="usage-kpis-heading"
          className="grid grid-cols-2 gap-2 lg:grid-cols-4"
        >
          <h3 id="usage-kpis-heading" className="sr-only">
            Key metrics
          </h3>
          <div className="rounded-lg bg-background px-3 py-2.5">
            <h3 className="sr-only">Total requests</h3>
            <p
              className="font-mono text-lg font-medium tabular-nums text-foreground"
              aria-live="polite"
            >
              {loading ? "…" : formatCompact(summary?.totalRequests ?? 0)}
            </p>
            <p className="text-2xs text-muted-foreground/70">Total calls</p>
            <TrendDelta value={callsDelta} />
          </div>
          <div className="rounded-lg bg-background px-3 py-2.5">
            <h3 className="sr-only">Total cost</h3>
            <p
              className="font-mono text-lg font-medium tabular-nums text-foreground"
              aria-live="polite"
            >
              {loading ? "…" : formatUsd(summary?.totalCostUsd ?? 0)}
            </p>
            <p className="text-2xs text-muted-foreground/70" aria-hidden>
              Total cost
            </p>
            <TrendDelta value={costDelta} />
          </div>
          <div className="rounded-lg bg-background px-3 py-2.5">
            <h3 className="sr-only">Avg latency</h3>
            <p
              className="font-mono text-lg font-medium tabular-nums text-foreground"
              aria-live="polite"
            >
              {loading ? "…" : formatLatency(avgLatency)}
            </p>
            <p className="text-2xs text-muted-foreground/70" aria-hidden>
              Avg latency
            </p>
            <TrendDelta value={latencyDelta} invertGood />
          </div>
          <div className="rounded-lg bg-background px-3 py-2.5">
            <h3 className="sr-only">Success rate</h3>
            <p
              className="font-mono text-lg font-medium tabular-nums text-foreground"
              aria-live="polite"
            >
              {loading || rate === null ? "…" : `${rate}%`}
            </p>
            <p className="text-2xs text-muted-foreground/70" aria-hidden>
              Success rate
            </p>
          </div>
        </section>

        <section
          aria-labelledby="daily-calls-heading"
          className="rounded-[10px] border border-border bg-background p-3"
        >
          <h3
            id="daily-calls-heading"
            className="mb-2.5 text-2xs font-medium uppercase tracking-wide text-muted-foreground/70"
          >
            Daily calls
          </h3>
          <div role="img" aria-label="Usage over time" className="space-y-1.5">
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading chart…</p>
            ) : chartData.length === 0 ? (
              <p className="text-sm text-muted-foreground">No events to chart for this period.</p>
            ) : (
              <>
                <div className="flex h-20 items-end gap-1">
                  {chartData.map((day, index) => {
                    const heightPct = Math.max(6, Math.round((day.requests / maxBar) * 100));
                    const isLast = index === chartData.length - 1;
                    return (
                      <div
                        key={day.date}
                        title={`${day.date}: ${day.requests.toLocaleString()} calls`}
                        className="min-w-0 flex-1 rounded-t-sm bg-primary"
                        style={{
                          height: `${heightPct}%`,
                          opacity: isLast ? 0.45 : 0.75,
                        }}
                      />
                    );
                  })}
                </div>
                <div className="flex justify-between text-2xs text-muted-foreground/70">
                  {tickIndexes.map((i) => (
                    <span key={chartData[i].date}>{formatShortDay(chartData[i].date)}</span>
                  ))}
                </div>
              </>
            )}
          </div>
        </section>

        <section
          aria-labelledby="top-prompts-heading"
          className="rounded-[10px] border border-border bg-background p-3"
        >
          <h3
            id="top-prompts-heading"
            className="mb-2 text-2xs font-medium uppercase tracking-wide text-muted-foreground/70"
          >
            Top prompts by cost
          </h3>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : topPrompts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No usage in this period.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-border text-2xs uppercase tracking-wide text-muted-foreground/70">
                    <th className="px-2 py-1.5 font-medium">Prompt</th>
                    <th className="px-2 py-1.5 font-medium">Calls</th>
                    <th className="px-2 py-1.5 font-medium">Avg tokens</th>
                    <th className="px-2 py-1.5 font-medium">Total cost</th>
                  </tr>
                </thead>
                <tbody>
                  {topPrompts.map((row) => (
                    <tr key={row.key} className="border-b border-border/40 last:border-0">
                      <td className="px-2 py-1.5 font-mono text-xs text-muted-foreground">
                        {row.label}
                      </td>
                      <td className="px-2 py-1.5 text-sm tabular-nums text-foreground">
                        {row.calls.toLocaleString()}
                      </td>
                      <td className="px-2 py-1.5 text-sm tabular-nums text-foreground">
                        {row.avgTokens.toLocaleString()}
                      </td>
                      <td className="px-2 py-1.5 text-sm tabular-nums text-foreground">
                        {formatUsd(row.totalCostUsd)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section
          aria-labelledby="provider-breakdown-heading"
          className="rounded-[10px] border border-border bg-background p-3"
        >
          <h3
            id="provider-breakdown-heading"
            className="mb-2.5 text-2xs font-medium uppercase tracking-wide text-muted-foreground/70"
          >
            By provider
          </h3>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading breakdown…</p>
          ) : !summary?.byProvider.length ? (
            <p className="text-sm text-muted-foreground">No usage in this period.</p>
          ) : (
            <ul className="space-y-3" aria-label="Provider breakdown">
              {summary.byProvider.map((row) => {
                const widthPct =
                  maxProviderCost > 0 ? Math.max(4, (row.costUsd / maxProviderCost) * 100) : 0;
                return (
                  <li key={row.provider} className="space-y-1">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="font-medium capitalize">{row.provider}</span>
                      <Badge variant="secondary" className="rounded-full text-2xs font-normal">
                        {row.requests} req
                      </Badge>
                    </div>
                    <div
                      className="h-1.5 rounded-full bg-secondary"
                      role="img"
                      aria-label={`${row.provider} cost ${formatUsd(row.costUsd)}`}
                    >
                      <div
                        className="h-1.5 rounded-full bg-primary/80"
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                    <p className="text-2xs text-muted-foreground">{formatUsd(row.costUsd)}</p>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
