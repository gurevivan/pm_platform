import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiFetch } from "../api/client";
import type { Project, UserBrief } from "../api/types";

export function CreateProjectPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [cadence, setCadence] = useState<Project["cadence"]>(null);
  const [weeklyReportEnabled, setWeeklyReportEnabled] = useState(false);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false);
  const [executorIds, setExecutorIds] = useState<number[]>([]);
  const [watcherIds, setWatcherIds] = useState<number[]>([]);
  const [executorQuery, setExecutorQuery] = useState("");
  const [watcherQuery, setWatcherQuery] = useState("");
  const [knownUsers, setKnownUsers] = useState<Record<number, UserBrief>>({});

  const { data: executorSuggestions } = useQuery({
    queryKey: ["users-directory", "exec", executorQuery],
    queryFn: () =>
      apiFetch<UserBrief[]>(`/users/?q=${encodeURIComponent(executorQuery.trim())}`),
    enabled: executorQuery.trim().length >= 2,
  });

  const { data: watcherSuggestions } = useQuery({
    queryKey: ["users-directory", "watch", watcherQuery],
    queryFn: () =>
      apiFetch<UserBrief[]>(`/users/?q=${encodeURIComponent(watcherQuery.trim())}`),
    enabled: watcherQuery.trim().length >= 2,
  });

  const create = useMutation({
    mutationFn: () =>
      apiFetch<Project>(`/projects/`, {
        method: "POST",
        json: {
          name,
          description,
          cadence,
          weekly_report_enabled: weeklyReportEnabled,
          analytics_enabled: analyticsEnabled,
          executor_user_ids: executorIds,
          watcher_user_ids: watcherIds,
        },
      }),
    onSuccess: (project) => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      navigate(`/projects/${project.id}/tasks`);
    },
  });

  function userLabel(u: UserBrief | undefined): string {
    if (!u) return "пользователь";
    return u.short_fio || u.username;
  }

  function addExecutor(u: UserBrief) {
    setKnownUsers((prev) => ({ ...prev, [u.id]: u }));
    setExecutorIds((prev) => (prev.includes(u.id) ? prev : [...prev, u.id]));
    setWatcherIds((prev) => prev.filter((id) => id !== u.id));
    setExecutorQuery("");
  }

  function addWatcher(u: UserBrief) {
    setKnownUsers((prev) => ({ ...prev, [u.id]: u }));
    setWatcherIds((prev) => (prev.includes(u.id) ? prev : [...prev, u.id]));
    setExecutorIds((prev) => prev.filter((id) => id !== u.id));
    setWatcherQuery("");
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    create.mutate();
  }

  return (
    <div className="page stack">
      <div className="hero-section">
        <div>
          <h1>Новый проект</h1>
          <p className="lead">
            Создайте проект и сразу назначьте исполнителей и наблюдателей.
          </p>
        </div>
        <Link to="/" className="button button--ghost">
          ← К списку проектов
        </Link>
      </div>

      <form className="card stack" onSubmit={onSubmit}>
        <div className="card-header" style={{ marginBottom: 0 }}>
          <div className="card-title">Параметры проекта</div>
          <button
            type="submit"
            className="button"
            disabled={!name.trim() || create.isPending}
          >
            {create.isPending ? "Создание…" : "Создать проект"}
          </button>
        </div>

        <div className="field-row">
          <div className="field">
            <label>Название</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Мобильное приложение, интеграция…"
            />
          </div>
        </div>
        <div className="field">
          <label>Описание проекта</label>
          <textarea
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Кратко опишите цель проекта, границы работ и ожидаемый результат."
          />
        </div>
        <div className="field">
          <label>Периодичность</label>
          <select
            value={cadence ?? ""}
            onChange={(e) =>
              setCadence((e.target.value || null) as Project["cadence"])
            }
          >
            <option value="">—</option>
            <option value="weekly">Еженедельный</option>
            <option value="monthly">Ежемесячный</option>
          </select>
        </div>
        <div className="field-row">
          <label style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={weeklyReportEnabled}
              onChange={(e) => setWeeklyReportEnabled(e.target.checked)}
              style={{ width: "auto" }}
            />
            Еженедельный отчёт
          </label>
          <label style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={analyticsEnabled}
              onChange={(e) => setAnalyticsEnabled(e.target.checked)}
              style={{ width: "auto" }}
            />
            Аналитика
          </label>
        </div>

        <div className="field-row">
          <div className="field">
            <label>Исполнители проекта</label>
            <input
              value={executorQuery}
              onChange={(e) => setExecutorQuery(e.target.value)}
              placeholder="Начните вводить ФИО или логин (от 2 символов)"
            />
            <div className="table-wrap" style={{ maxHeight: 180, overflow: "auto" }}>
              {(executorSuggestions ?? []).map((u) => (
                <button
                  key={u.id}
                  type="button"
                  className="button button--ghost"
                  style={{ margin: 4, fontSize: "0.8rem" }}
                  onClick={() => addExecutor(u)}
                >
                  + {userLabel(u)}
                </button>
              ))}
            </div>
            <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 8 }}>
              {executorIds.map((uid) => (
                <span key={uid} className="chip chip--pri-normal" style={{ textTransform: "none" }}>
                  {userLabel(knownUsers[uid])}
                  <button
                    type="button"
                    onClick={() =>
                      setExecutorIds((prev) => prev.filter((id) => id !== uid))
                    }
                    style={{ marginLeft: 6, border: 0, background: "transparent", cursor: "pointer", color: "inherit" }}
                    aria-label="Удалить исполнителя"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
          <div className="field">
            <label>Наблюдатели проекта</label>
            <input
              value={watcherQuery}
              onChange={(e) => setWatcherQuery(e.target.value)}
              placeholder="Начните вводить ФИО или логин (от 2 символов)"
            />
            <div className="table-wrap" style={{ maxHeight: 180, overflow: "auto" }}>
              {(watcherSuggestions ?? []).map((u) => (
                <button
                  key={u.id}
                  type="button"
                  className="button button--ghost"
                  style={{ margin: 4, fontSize: "0.8rem" }}
                  onClick={() => addWatcher(u)}
                >
                  + {userLabel(u)}
                </button>
              ))}
            </div>
            <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 8 }}>
              {watcherIds.map((uid) => (
                <span key={uid} className="chip chip--pri-low" style={{ textTransform: "none" }}>
                  {userLabel(knownUsers[uid])}
                  <button
                    type="button"
                    onClick={() =>
                      setWatcherIds((prev) => prev.filter((id) => id !== uid))
                    }
                    style={{ marginLeft: 6, border: 0, background: "transparent", cursor: "pointer", color: "inherit" }}
                    aria-label="Удалить наблюдателя"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>

        {create.isError ? (
          <div className="error">
            {create.error instanceof Error ? create.error.message : "Ошибка"}
          </div>
        ) : null}
      </form>
    </div>
  );
}
