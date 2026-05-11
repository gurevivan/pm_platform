import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { apiFetch } from "../api/client";
import type { Project, UserBrief } from "../api/types";

export function ProjectSettingsPage() {
  const { projectId } = useParams();
  const pid = Number(projectId);
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [cadence, setCadence] = useState<Project["cadence"]>(null);
  const [weeklyReportEnabled, setWeeklyReportEnabled] = useState(false);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false);
  const [memberQuery, setMemberQuery] = useState("");

  const { data: project } = useQuery({
    queryKey: ["project", pid],
    enabled: !!pid && !Number.isNaN(pid),
    queryFn: () => apiFetch<Project>(`/projects/${pid}/`),
  });
  const { data: memberships } = useQuery({
    queryKey: ["memberships", pid],
    enabled: !!pid && !Number.isNaN(pid),
    queryFn: () =>
      apiFetch<{ id: number; user: number; username: string; role: string }[]>(
        `/projects/${pid}/memberships/`,
      ),
  });
  const { data: userOptions } = useQuery({
    queryKey: ["users-directory", "project", memberQuery],
    queryFn: () =>
      apiFetch<UserBrief[]>(`/users/?q=${encodeURIComponent(memberQuery.trim())}`),
    enabled: memberQuery.trim().length >= 2,
  });

  useEffect(() => {
    if (!project) return;
    setName(project.name || "");
    setDescription(project.description || "");
    setCadence(project.cadence || null);
    setWeeklyReportEnabled(!!project.weekly_report_enabled);
    setAnalyticsEnabled(!!project.analytics_enabled);
  }, [project]);

  const saveProjectMu = useMutation({
    mutationFn: () =>
      apiFetch<Project>(`/projects/${pid}/`, {
        method: "PATCH",
        json: {
          name,
          description,
          cadence,
          weekly_report_enabled: weeklyReportEnabled,
          analytics_enabled: analyticsEnabled,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project", pid] });
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });

  const membershipMu = useMutation({
    mutationFn: async ({
      userId,
      role,
    }: {
      userId: number;
      role: "member" | "viewer";
    }) => {
      const existing = (memberships ?? []).find((m) => m.user === userId);
      if (existing) {
        return apiFetch(`/projects/${pid}/memberships/${existing.id}/`, {
          method: "PATCH",
          json: { role },
        });
      }
      return apiFetch(`/projects/${pid}/memberships/`, {
        method: "POST",
        json: { user: userId, role },
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["memberships", pid] }),
  });

  return (
    <div className="stack">
      <div className="section-head">
        <h2>Настройки проекта</h2>
        <p className="section-subtitle">
          Изменение параметров проекта, периодичности и состава участников.
        </p>
      </div>
      <div className="card stack">
      <div className="field">
        <label>Название проекта</label>
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="field">
        <label>Описание</label>
        <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="field">
        <label>Периодичность</label>
        <select
          value={cadence ?? ""}
          onChange={(e) => setCadence((e.target.value || null) as Project["cadence"])}
        >
          <option value="">—</option>
          <option value="weekly">Еженедельный</option>
          <option value="monthly">Ежемесячный</option>
        </select>
      </div>
      <div className="field-row">
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="checkbox"
            checked={weeklyReportEnabled}
            onChange={(e) => setWeeklyReportEnabled(e.target.checked)}
            style={{ width: "auto" }}
          />
          Еженедельный отчёт
        </label>
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="checkbox"
            checked={analyticsEnabled}
            onChange={(e) => setAnalyticsEnabled(e.target.checked)}
            style={{ width: "auto" }}
          />
          Аналитика
        </label>
        <button
          type="button"
          className="button"
          disabled={saveProjectMu.isPending || !name.trim()}
          onClick={() => saveProjectMu.mutate()}
        >
          {saveProjectMu.isPending ? "Сохранение..." : "Сохранить"}
        </button>
      </div>
      <div className="field">
        <label>Добавить исполнителей / наблюдателей</label>
        <input
          value={memberQuery}
          onChange={(e) => setMemberQuery(e.target.value)}
          placeholder="Поиск пользователя (от 2 символов)"
        />
        <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {(userOptions ?? []).map((u) => (
            <div key={u.id} className="chip chip--pri-normal" style={{ textTransform: "none" }}>
              {u.short_fio || u.username}
              <button
                type="button"
                className="button button--ghost"
                style={{ marginLeft: 6 }}
                onClick={() => membershipMu.mutate({ userId: u.id, role: "member" })}
              >
                Исполнитель
              </button>
              <button
                type="button"
                className="button button--ghost"
                style={{ marginLeft: 6 }}
                onClick={() => membershipMu.mutate({ userId: u.id, role: "viewer" })}
              >
                Наблюдатель
              </button>
            </div>
          ))}
        </div>
      </div>
      <div className="table-wrap table-wrap--dense">
        <table className="table table--density">
          <thead>
            <tr>
              <th>Пользователь</th>
              <th>Роль</th>
            </tr>
          </thead>
          <tbody>
            {(memberships ?? []).map((m) => (
              <tr key={m.id}>
                <td>{m.username}</td>
                <td>
                  <select
                    value={m.role}
                    onChange={(e) =>
                      membershipMu.mutate({
                        userId: m.user,
                        role: e.target.value === "viewer" ? "viewer" : "member",
                      })
                    }
                  >
                    <option value="member">Исполнитель</option>
                    <option value="viewer">Наблюдатель</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </div>
    </div>
  );
}
