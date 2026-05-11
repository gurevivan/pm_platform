import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiFetch } from "../api/client";
import { RuFileInput } from "../components/RuFileInput";
import type {
  Project,
  StatusModel,
  WorkItem,
  WorkItemType,
} from "../api/types";

type FormKind = "" | WorkItem["item_type"];
type Priority = WorkItem["priority"];

function priChip(p: Priority): string {
  return `chip chip--pri chip--pri-${p}`;
}

export function TasksPage() {
  const { projectId } = useParams();
  const pid = Number(projectId);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: items } = useQuery({
    queryKey: ["work-items", pid],
    enabled: !!pid,
    queryFn: () => apiFetch<WorkItem[]>(`/projects/${pid}/work-items/`),
  });

  const { data: statuses } = useQuery({
    queryKey: ["statuses", pid],
    enabled: !!pid,
    queryFn: () =>
      apiFetch<StatusModel[]>(`/projects/${pid}/statuses/`),
  });
  const { data: project } = useQuery({
    queryKey: ["project", pid],
    enabled: !!pid,
    queryFn: () => apiFetch<Project>(`/projects/${pid}/`),
  });

  const { data: typeOptions } = useQuery({
    queryKey: ["work-item-types"],
    queryFn: () => apiFetch<WorkItemType[]>(`/work-item-types/`),
  });
  const { data: memberships } = useQuery({
    queryKey: ["memberships", pid],
    enabled: !!pid,
    queryFn: () =>
      apiFetch<{ id: number; user: number; username: string; user_short_fio?: string; role: string }[]>(
        `/projects/${pid}/memberships/`,
      ),
  });

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [statusId, setStatusId] = useState<number | "">("");
  const [priority, setPriority] = useState<Priority>("normal");
  const [itemType, setItemType] = useState<FormKind>("task");
  const [assigneeId, setAssigneeId] = useState<number | "">("");
  const [dueDate, setDueDate] = useState("");
  const [createFile, setCreateFile] = useState<File | null>(null);
  const [weeklyReportEnabled, setWeeklyReportEnabled] = useState(false);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false);

  const firstStatusId = statuses?.[0]?.id;

  useEffect(() => {
    if (!project) return;
    setWeeklyReportEnabled(!!project.weekly_report_enabled);
    setAnalyticsEnabled(!!project.analytics_enabled);
  }, [project?.id, project?.weekly_report_enabled, project?.analytics_enabled]);

  const createMu = useMutation({
    mutationFn: async () => {
      const workItem = await apiFetch<WorkItem>(`/projects/${pid}/work-items/`, {
        method: "POST",
        json: {
          title,
          description,
          item_type: itemType,
          priority,
          weekly_report_enabled: weeklyReportEnabled,
          analytics_enabled: analyticsEnabled,
          status: statusId || firstStatusId,
          due_date: dueDate || null,
          assignee: assigneeId === "" ? null : assigneeId,
        },
      });
      if (createFile) {
        const formData = new FormData();
        formData.append("file", createFile);
        await apiFetch(
          `/projects/${pid}/work-items/${workItem.id}/attachments/`,
          {
            method: "POST",
            body: formData,
          },
        );
      }
      return workItem;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["work-items", pid] });
      setTitle("");
      setDescription("");
      setAssigneeId("");
      setDueDate("");
      setCreateFile(null);
      setWeeklyReportEnabled(!!project?.weekly_report_enabled);
      setAnalyticsEnabled(!!project?.analytics_enabled);
    },
  });

  function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!(statusId || firstStatusId)) return;
    createMu.mutate();
  }

  const statusLookup = useMemo(() => {
    const m = new Map<number, string>();
    statuses?.forEach((s) => m.set(s.id, s.name));
    return m;
  }, [statuses]);

  const prioLabel: Record<string, string> = {
    low: "низкий",
    normal: "обычный",
    high: "высокий",
    urgent: "срочный",
  };

  return (
    <div className="stack">
      <div className="section-head">
        <h2>Задачи</h2>
        <p className="section-subtitle">
          Табличный режим: приоритет и даты планирования.
        </p>
      </div>

      <form className="card stack" onSubmit={onCreate}>
        <div className="card-title">Новая задача</div>
        <div className="field">
          <label>Заголовок</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="field">
          <label>Описание</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="field-row">
          <div className="field">
            <label>Статус</label>
            <select
              value={statusId === "" ? "" : String(statusId)}
              onChange={(e) =>
                setStatusId(e.target.value ? Number(e.target.value) : "")
              }
            >
              <option value="">первый статус проекта</option>
              {statuses?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Приоритет</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as Priority)}
            >
              {(Object.keys(prioLabel) as Priority[]).map((p) => (
                <option key={p} value={p}>
                  {prioLabel[p]}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Тип</label>
            <select
              value={itemType}
              onChange={(e) =>
                setItemType(e.target.value as FormKind)
              }
            >
              {(typeOptions ?? []).map((t) => (
                <option key={t.id} value={t.slug}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Исполнитель</label>
            <select
              value={assigneeId === "" ? "" : String(assigneeId)}
              onChange={(e) =>
                setAssigneeId(e.target.value ? Number(e.target.value) : "")
              }
            >
              <option value="">— не назначен —</option>
              {(memberships ?? []).map((m) => (
                <option key={m.id} value={m.user}>
                  {m.user_short_fio || "Без имени"}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Дедлайн</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
          <div className="field">
            <label>Файл к задаче</label>
            <RuFileInput file={createFile} onChange={setCreateFile} />
          </div>
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
        <div>
          <button
            type="submit"
            disabled={createMu.isPending || !title.trim()}
            className="button"
          >
            Добавить задачу
          </button>
        </div>
      </form>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Задача</th>
              <th>Статус</th>
              <th>Приоритет</th>
              <th>Еженедельный отчёт</th>
              <th>Аналитика</th>
              <th>Старт / дедлайн</th>
              <th>Исполнитель</th>
            </tr>
          </thead>
          <tbody>
            {(items ?? []).map((w) => (
              <tr
                key={w.id}
                onClick={() => navigate(`/projects/${pid}/tasks/${w.id}`)}
                style={{ cursor: "pointer" }}
              >
                <td>
                  <div style={{ fontWeight: 600 }}>{w.title}</div>
                  <div className="muted" style={{ fontSize: "0.8rem", marginTop: "0.2rem" }}>
                    {w.assignee_detail?.short_fio ?? "исполнитель не назначен"}
                  </div>
                </td>
                <td>
                  <span className="chip chip--pri-normal" style={{ textTransform: "none" }}>
                    {statusLookup.get(w.status) ?? w.status_name}
                  </span>
                </td>
                <td>
                  <div style={{ marginBottom: 6 }}>
                    <span className={priChip(w.priority)}>{prioLabel[w.priority]}</span>
                  </div>
                </td>
                <td>
                  {w.weekly_report_enabled ? "Да" : "Нет"}
                </td>
                <td>
                  {w.analytics_enabled ? "Да" : "Нет"}
                </td>
                <td className="cell-dates">
                  {(w.start_date ?? "—")} / {(w.due_date ?? "—")}
                </td>
                <td>
                  {w.assignee_detail?.short_fio ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
