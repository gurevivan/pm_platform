import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiFetch } from "../api/client";
import { RuFileInput } from "../components/RuFileInput";
import type {
  StatusModel,
  WorkItem,
  WorkItemAttachment,
  WorkItemComment,
  WorkItemType,
} from "../api/types";
import { useAuth } from "../auth/AuthProvider";

function fmt(value: string): string {
  const dt = new Date(value);
  if (Number.isNaN(dt.valueOf())) return value;
  return dt.toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" });
}

export function TaskDetailPage() {
  const { projectId, taskId } = useParams();
  const pid = Number(projectId);
  const wid = Number(taskId);
  const qc = useQueryClient();
  const { me } = useAuth();
  const [statusNote, setStatusNote] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [itemType, setItemType] = useState("");
  const [priority, setPriority] = useState<WorkItem["priority"]>("normal");
  const [statusId, setStatusId] = useState<number | "">("");
  const [assigneeId, setAssigneeId] = useState<number | "">("");
  const [dueDate, setDueDate] = useState("");
  const [weeklyReportEnabled, setWeeklyReportEnabled] = useState(false);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [editingNoteBody, setEditingNoteBody] = useState("");

  const { data: task } = useQuery({
    queryKey: ["work-item", pid, wid],
    enabled: !!pid && !!wid,
    queryFn: () => apiFetch<WorkItem>(`/projects/${pid}/work-items/${wid}/`),
  });
  const { data: statuses } = useQuery({
    queryKey: ["statuses", pid],
    enabled: !!pid,
    queryFn: () => apiFetch<StatusModel[]>(`/projects/${pid}/statuses/`),
  });
  const { data: notes } = useQuery({
    queryKey: ["work-item-comments", pid, wid],
    enabled: !!pid && !!wid,
    queryFn: () =>
      apiFetch<WorkItemComment[]>(`/projects/${pid}/work-items/${wid}/comments/`),
  });
  const { data: attachments } = useQuery({
    queryKey: ["work-item-attachments", pid, wid],
    enabled: !!pid && !!wid,
    queryFn: () =>
      apiFetch<WorkItemAttachment[]>(
        `/projects/${pid}/work-items/${wid}/attachments/`,
      ),
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

  const statusMap = useMemo(() => {
    const m = new Map<number, string>();
    (statuses ?? []).forEach((s) => m.set(s.id, s.name));
    return m;
  }, [statuses]);

  useEffect(() => {
    if (!task) return;
    setTitle(task.title);
    setDescription(task.description ?? "");
    setItemType(task.item_type);
    setPriority(task.priority);
    setStatusId(task.status);
    setAssigneeId(task.assignee ?? "");
    setDueDate(task.due_date ?? "");
    setWeeklyReportEnabled(task.weekly_report_enabled);
    setAnalyticsEnabled(task.analytics_enabled);
  }, [task]);

  const updateTaskMu = useMutation({
    mutationFn: () =>
      apiFetch<WorkItem>(`/projects/${pid}/work-items/${wid}/`, {
        method: "PATCH",
        json: {
          title,
          description,
          item_type: itemType,
          priority,
          status: statusId || undefined,
          assignee: assigneeId === "" ? null : assigneeId,
          due_date: dueDate || null,
          weekly_report_enabled: weeklyReportEnabled,
          analytics_enabled: analyticsEnabled,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["work-item", pid, wid] });
      qc.invalidateQueries({ queryKey: ["work-items", pid] });
    },
  });

  const addNoteMu = useMutation({
    mutationFn: (body: string) =>
      apiFetch<WorkItemComment>(`/projects/${pid}/work-items/${wid}/comments/`, {
        method: "POST",
        json: { body },
      }),
    onSuccess: () => {
      setStatusNote("");
      qc.invalidateQueries({ queryKey: ["work-item-comments", pid, wid] });
    },
  });
  const editNoteMu = useMutation({
    mutationFn: ({ id, body }: { id: number; body: string }) =>
      apiFetch<WorkItemComment>(`/projects/${pid}/work-items/${wid}/comments/${id}/`, {
        method: "PATCH",
        json: { body },
      }),
    onSuccess: () => {
      setEditingNoteId(null);
      setEditingNoteBody("");
      qc.invalidateQueries({ queryKey: ["work-item-comments", pid, wid] });
    },
  });
  const deleteNoteMu = useMutation({
    mutationFn: (id: number) =>
      apiFetch<void>(`/projects/${pid}/work-items/${wid}/comments/${id}/`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["work-item-comments", pid, wid] });
    },
  });

  const uploadMu = useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return apiFetch<WorkItemAttachment>(
        `/projects/${pid}/work-items/${wid}/attachments/`,
        {
          method: "POST",
          body: formData,
        },
      );
    },
    onSuccess: () => {
      setSelectedFile(null);
      qc.invalidateQueries({ queryKey: ["work-item-attachments", pid, wid] });
    },
  });

  function onAddStatusNote(e: FormEvent) {
    e.preventDefault();
    const body = statusNote.trim();
    if (!body) return;
    addNoteMu.mutate(body);
  }

  if (!task) {
    return <div className="card">Загрузка задачи...</div>;
  }

  return (
    <div className="stack">
      <div className="section-head">
        <h2>{task.title}</h2>
        <p className="section-subtitle">Карточка задачи</p>
      </div>

      <div className="card stack">
        <div className="card-title">Настройки задачи</div>
        <div className="field">
          <label>Название задачи</label>
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
              onChange={(e) => setStatusId(e.target.value ? Number(e.target.value) : "")}
            >
              {(statuses ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <div className="muted" style={{ fontSize: "0.85rem" }}>
              Текущий: {statusMap.get(Number(statusId)) ?? task.status_name}
            </div>
          </div>
          <div className="field">
            <label>Исполнитель</label>
            <select
              value={assigneeId === "" ? "" : String(assigneeId)}
              onChange={(e) => setAssigneeId(e.target.value ? Number(e.target.value) : "")}
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
            <label>Приоритет</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as WorkItem["priority"])}
            >
              <option value="low">Низкий</option>
              <option value="normal">Обычный</option>
              <option value="high">Высокий</option>
              <option value="urgent">Срочный</option>
            </select>
          </div>
          <div className="field">
            <label>Тип</label>
            <select value={itemType} onChange={(e) => setItemType(e.target.value)}>
              {(typeOptions ?? []).map((t) => (
                <option key={t.id} value={t.slug}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Дедлайн</label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
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
            type="button"
            className="button"
            disabled={updateTaskMu.isPending || !title.trim()}
            onClick={() => updateTaskMu.mutate()}
          >
            Сохранить настройки
          </button>
        </div>
      </div>

      <div className="card stack">
        <div className="card-title">Статусы в виде комментариев</div>
        <p className="muted" style={{ margin: 0 }}>
          Пишите рабочие статусы свободным текстом: например, "На согласовании у начальника склада".
        </p>
        <form className="stack" onSubmit={onAddStatusNote}>
          <textarea
            value={statusNote}
            onChange={(e) => setStatusNote(e.target.value)}
            placeholder="Напишите текущий статус/блокер/ожидание согласования..."
          />
          <div>
            <button className="button" type="submit" disabled={addNoteMu.isPending || !statusNote.trim()}>
              Добавить статус-комментарий
            </button>
          </div>
        </form>
        <div className="stack">
          {(notes ?? []).map((n) => (
            <div key={n.id} className="card" style={{ padding: "0.7rem" }}>
              {editingNoteId === n.id ? (
                <div className="stack" style={{ gap: 6, marginBottom: 6 }}>
                  <textarea
                    value={editingNoteBody}
                    onChange={(e) => setEditingNoteBody(e.target.value)}
                    rows={3}
                  />
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      type="button"
                      className="button"
                      onClick={() =>
                        editNoteMu.mutate({ id: n.id, body: editingNoteBody.trim() })
                      }
                      disabled={editNoteMu.isPending || !editingNoteBody.trim()}
                    >
                      Сохранить
                    </button>
                    <button
                      type="button"
                      className="button button--ghost"
                      onClick={() => {
                        setEditingNoteId(null);
                        setEditingNoteBody("");
                      }}
                    >
                      Отмена
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: "0.9rem", marginBottom: 6 }}>{n.body}</div>
              )}
              <div className="muted" style={{ fontSize: "0.8rem" }}>
                {n.author_name} · {fmt(n.created_at)}
              </div>
              {n.author === me?.id ? (
                <div style={{ marginTop: 8, display: "flex", gap: 6 }}>
                  <button
                    type="button"
                    className="button button--ghost"
                    onClick={() => {
                      setEditingNoteId(n.id);
                      setEditingNoteBody(n.body);
                    }}
                  >
                    Редактировать
                  </button>
                  <button
                    type="button"
                    className="button button--ghost"
                    onClick={() => deleteNoteMu.mutate(n.id)}
                    disabled={deleteNoteMu.isPending}
                  >
                    Удалить
                  </button>
                </div>
              ) : null}
            </div>
          ))}
          {!notes?.length ? (
            <div className="muted">Пока нет статус-комментариев.</div>
          ) : null}
        </div>
      </div>

      <div className="card stack">
        <div className="card-title">Вложения</div>
        <div style={{ display: "flex", gap: 8 }}>
          <RuFileInput file={selectedFile} onChange={setSelectedFile} />
          <button
            type="button"
            className="button"
            onClick={() => selectedFile && uploadMu.mutate(selectedFile)}
            disabled={!selectedFile || uploadMu.isPending}
          >
            Прикрепить файл
          </button>
        </div>
        <div className="stack">
          {(attachments ?? []).map((file) => (
            <a key={file.id} href={file.file_url} target="_blank" rel="noreferrer">
              {file.file_name}
            </a>
          ))}
          {!attachments?.length ? (
            <div className="muted">Файлы ещё не прикреплялись.</div>
          ) : null}
        </div>
      </div>

      <div>
        <Link className="button button--ghost" to={`/projects/${pid}/tasks`}>
          Назад к списку задач
        </Link>
      </div>
    </div>
  );
}
