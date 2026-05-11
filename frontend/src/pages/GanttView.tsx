import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { apiFetch } from "../api/client";
import type { WorkItem, WorkItemRelation } from "../api/types";

function startOf(ts: string | null) {
  if (!ts) return null;
  return new Date(`${ts}T00:00:00`);
}

function addDays(from: Date, days: number) {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return d;
}

function daysBetween(a: Date, b: Date): number {
  return Math.max(1, Math.ceil((b.getTime() - a.getTime()) / 86400000));
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}

function fmtRu(date: Date): string {
  return date.toLocaleDateString("ru-RU", { day: "2-digit", month: "short" });
}

function buildWeeklyTicks(min: Date, max: Date): Date[] {
  const ticks: Date[] = [];
  const cur = new Date(min);
  cur.setHours(0, 0, 0, 0);
  const day = cur.getDay();
  const shift = day === 0 ? 6 : day - 1;
  cur.setDate(cur.getDate() - shift);
  while (cur <= max) {
    if (cur >= min) ticks.push(new Date(cur));
    cur.setDate(cur.getDate() + 7);
  }
  return ticks;
}

function priorityLabel(raw: string): string {
  const map: Record<string, string> = {
    low: "низкий",
    medium: "средний",
    high: "высокий",
    critical: "критический",
  };
  return map[raw] || raw || "—";
}

function ganttBarClass(priorityRaw: string): string {
  const p = (priorityRaw || "").toLowerCase();
  if (p === "critical") return "g-bar g-bar--critical";
  if (p === "high") return "g-bar g-bar--high";
  if (p === "low") return "g-bar g-bar--low";
  return "g-bar g-bar--medium";
}

function computeRange(items: WorkItem[]) {
  const dates: Date[] = [];
  items.forEach((w) => {
    const st = startOf(w.start_date);
    const du = startOf(w.due_date);
    if (st) dates.push(st);
    if (du) dates.push(du);
  });
  if (!dates.length) {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    const e = addDays(t, 14);
    return { min: t, max: e, spanDays: 15 };
  }
  const ms = dates.map((d) => d.getTime());
  const minTs = Math.min(...ms);
  const maxTs = Math.max(...ms);
  const min = new Date(minTs);
  const max = new Date(maxTs);
  max.setHours(23, 59, 59, 999);
  const spanDays = Math.max(
    1,
    Math.ceil((max.getTime() - min.getTime()) / 86400000) + 1,
  );
  return { min, max: addDays(min, spanDays), spanDays };
}

export function GanttView() {
  const { projectId } = useParams();
  const pid = Number(projectId);

  const { data: items } = useQuery({
    queryKey: ["work-items", pid],
    enabled: !!pid,
    queryFn: () => apiFetch<WorkItem[]>(`/projects/${pid}/work-items/`),
  });

  const { data: relations } = useQuery({
    queryKey: ["relations", pid],
    enabled: !!pid,
    queryFn: () =>
      apiFetch<WorkItemRelation[]>(`/projects/${pid}/relations/`),
  });

  const range = computeRange(items ?? []);
  const ticks = buildWeeklyTicks(range.min, range.max);
  const today = startOf(new Date().toISOString().slice(0, 10));

  function barGeom(wi: WorkItem): { leftPct: number; widthPct: number } {
    const stRaw = wi.start_date
      ? startOf(wi.start_date)!
      : wi.due_date
        ? addDays(startOf(wi.due_date)!, -3)
        : range.min;
    const endRaw =
      wi.due_date && wi.start_date
        ? startOf(wi.due_date)!
        : wi.due_date
          ? startOf(wi.due_date)!
          : wi.start_date
            ? addDays(startOf(wi.start_date)!, 3)
            : addDays(range.min, 7);
    const st = Math.max(stRaw.getTime(), range.min.getTime());
    const en = Math.max(endRaw.getTime(), st + 86400000);
    const msSpan = Math.max(range.max.getTime() - range.min.getTime(), 86400000);
    const left = (st - range.min.getTime()) / msSpan;
    const width = (en - st) / msSpan;
    return {
      leftPct: Math.round(left * 1000) / 10,
      widthPct: Math.max(2, Math.round(width * 1000) / 10),
    };
  }

  const withDates = (items ?? []).filter((w) => w.start_date || w.due_date);
  const precedes =
    (relations ?? []).filter((r) => r.relation_type === "precedes") ?? [];
  const byId = new Map((items ?? []).map((w) => [w.id, w]));
  const totalDays = Math.max(1, daysBetween(range.min, range.max));
  const todayPct =
    today && today >= range.min && today <= range.max
      ? clamp(((today.getTime() - range.min.getTime()) / (range.max.getTime() - range.min.getTime())) * 100, 0, 100)
      : null;

  return (
    <div className="stack">
      <div className="section-head">
        <h2>Диаграмма Гантта</h2>
        <p className="section-subtitle" style={{ maxWidth: "60ch" }}>
          План-график задач проекта по датам старта и дедлайна. Цвет полосы = приоритет.
          <span
            style={{
              marginLeft: "0.5rem",
              fontFamily: "var(--font-mono)",
              fontSize: "0.78rem",
            }}
          >
            {range.min.toLocaleDateString("ru-RU")} —{" "}
            {range.max.toLocaleDateString("ru-RU")}
          </span>
        </p>
      </div>

      <div className="hint-banner" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
        <span>
          <span aria-hidden>▬</span> Если полос не видно, задайте даты задач во вкладке «Задачи».
        </span>
        <span className="muted" style={{ fontSize: "0.8rem" }}>
          Шаг сетки: 1 неделя · Период: {totalDays} дн.
        </span>
      </div>

      <div className="card gantt stack">
        <div className="g-legend">
          <span className="g-legend-item">
            <i className="g-dot g-dot--critical" /> критический
          </span>
          <span className="g-legend-item">
            <i className="g-dot g-dot--high" /> высокий
          </span>
          <span className="g-legend-item">
            <i className="g-dot g-dot--medium" /> средний
          </span>
          <span className="g-legend-item">
            <i className="g-dot g-dot--low" /> низкий
          </span>
        </div>
        <div className="g-scale">
          {ticks.map((t) => {
            const pct =
              ((t.getTime() - range.min.getTime()) /
                (range.max.getTime() - range.min.getTime())) *
              100;
            return (
              <div key={t.toISOString()} className="g-scale-tick" style={{ left: `${pct}%` }}>
                <span>{fmtRu(t)}</span>
              </div>
            );
          })}
        </div>
        {withDates.length ? (
          withDates.map((w) => {
            const geo = barGeom(w);
            const st = w.start_date ? startOf(w.start_date) : null;
            const en = w.due_date ? startOf(w.due_date) : null;
            const dur = st && en ? `${daysBetween(st, addDays(en, 1))} дн.` : "—";
            return (
              <div key={w.id} className="g-row">
                <div className="g-label" title={w.title}>
                  <div>
                    <span style={{ opacity: 0.55 }}>#{w.id}</span>{" "}
                    {w.title.length > 32 ? `${w.title.slice(0, 31)}…` : w.title}
                  </div>
                  <div className="g-meta">
                    {w.start_date || "—"} → {w.due_date || "—"} · {dur} ·{" "}
                    {priorityLabel(w.priority)}
                  </div>
                </div>
                <div className="g-track">
                  {todayPct !== null ? (
                    <div className="g-today" style={{ left: `${todayPct}%` }} />
                  ) : null}
                  <div
                    className={ganttBarClass(w.priority)}
                    title={`${w.start_date ?? "—"} → ${w.due_date ?? "—"}`}
                    style={{
                      position: "absolute",
                      left: `${geo.leftPct}%`,
                      width: `${geo.widthPct}%`,
                      top: 0,
                      height: "100%",
                    }}
                  />
                </div>
              </div>
            );
          })
        ) : (
          <div className="empty-state" style={{ border: "none", background: "transparent" }}>
            Нет задач с датами — откройте «Задачи» и укажите старт или дедлайн.
          </div>
        )}
      </div>

      {precedes.length ? (
        <div className="card stack">
          <div className="card-title">Зависимости (предшествует)</div>
          <div className="table-wrap" style={{ border: "none" }}>
            <table className="table">
              <tbody>
                {precedes.map((r) => (
                  <tr key={r.id}>
                    <td style={{ fontFamily: "var(--font-mono)" }}>
                      #{r.from_item} {byId.get(r.from_item)?.title ?? ""}
                    </td>
                    <td style={{ color: "var(--text-muted)" }}>→</td>
                    <td style={{ fontFamily: "var(--font-mono)" }}>
                      #{r.to_item} {byId.get(r.to_item)?.title ?? ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
