import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useEffect, useRef, useState } from "react";
import { apiFetch } from "../api/client";
import { RuFileInput } from "../components/RuFileInput";
import type {
  DirectorateAnalyticsDashboard,
  DirectorateChatMessage,
  DirectorateMember,
  DirectorateRecruit,
  DirectorateSubdivisionBrief,
  DirectorateWeeklyReport,
} from "../api/types";
import { useAuth } from "../auth/AuthProvider";

export function DirectoratePage() {
  const { me } = useAuth();
  const qc = useQueryClient();
  const [memberQuery, setMemberQuery] = useState("");
  const [recruitQuery, setRecruitQuery] = useState("");
  const [subdivisionByUser, setSubdivisionByUser] = useState<Record<number, string>>({});
  const [title, setTitle] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [chatDraft, setChatDraft] = useState("");
  const [chatFile, setChatFile] = useState<File | null>(null);
  const [editingChatId, setEditingChatId] = useState<number | null>(null);
  const [editingChatBody, setEditingChatBody] = useState("");
  const [expandedAnalyticsProjects, setExpandedAnalyticsProjects] = useState<number[]>([]);
  const [tab, setTab] = useState<"members" | "chat" | "analytics" | "report">("members");
  const chatListRef = useRef<HTMLDivElement>(null);
  const dirId = me?.directorate_detail?.id ?? null;
  const directorateName = me?.directorate_detail?.name ?? "—";
  const fmtDateTime = (iso: string): string => {
    try {
      return new Date(iso).toLocaleString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  };
  const fmtDate = (iso: string): string => {
    try {
      return new Date(iso).toLocaleDateString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    } catch {
      return iso;
    }
  };

  const { data: members } = useQuery({
    queryKey: ["directorate-members", memberQuery],
    queryFn: () =>
      apiFetch<DirectorateMember[]>(
        `/directorate/members/?q=${encodeURIComponent(memberQuery.trim())}`,
      ),
    enabled: !!dirId,
  });

  const canSearchRecruit = recruitQuery.trim().length >= 2;
  const { data: recruits } = useQuery({
    queryKey: ["directorate-recruits", recruitQuery],
    queryFn: () =>
      apiFetch<DirectorateRecruit[]>(
        `/directorate/recruits/?q=${encodeURIComponent(recruitQuery.trim())}`,
      ),
    enabled: !!dirId && canSearchRecruit,
  });

  const { data: subdivisions } = useQuery({
    queryKey: ["directorate-subdivisions", dirId ?? "none"],
    queryFn: () =>
      apiFetch<DirectorateSubdivisionBrief[]>(
        `/directorate-subdivisions/?directorate_id=${dirId}`,
      ),
    enabled: !!dirId,
  });

  const { data: analytics } = useQuery({
    queryKey: ["directorate-project-analytics"],
    queryFn: () =>
      apiFetch<DirectorateAnalyticsDashboard>("/directorate/projects/analytics/"),
    enabled: !!dirId,
  });

  const { data: reports } = useQuery({
    queryKey: ["directorate-weekly-reports"],
    queryFn: () => apiFetch<DirectorateWeeklyReport[]>("/directorate/weekly-reports/"),
    enabled: !!dirId,
  });
  const { data: chatRows, isLoading: chatLoading } = useQuery({
    queryKey: ["directorate-chat", dirId],
    queryFn: () => apiFetch<DirectorateChatMessage[]>("/directorate-chat/messages/"),
    enabled: !!dirId,
    refetchInterval: 12_000,
  });

  const addMu = useMutation({
    mutationFn: ({ userId, subdivisionId }: { userId: number; subdivisionId: number | null }) =>
      apiFetch<DirectorateRecruit>(`/directorate/recruits/${userId}/`, {
        method: "PATCH",
        json: { subdivision_id: subdivisionId },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["directorate-recruits"] }),
  });

  const createReportMu = useMutation({
    mutationFn: (payload: {
      title: string;
      period_start: string;
      period_end: string;
    }) =>
      apiFetch<DirectorateWeeklyReport>("/directorate/weekly-reports/", {
        method: "POST",
        json: payload,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["directorate-weekly-reports"] });
      setTitle("");
      setPeriodStart("");
      setPeriodEnd("");
    },
  });
  const deleteReportMu = useMutation({
    mutationFn: (reportId: number) =>
      apiFetch<void>(`/directorate/weekly-reports/${reportId}/`, {
        method: "DELETE",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["directorate-weekly-reports"] }),
  });
  const sendChatMu = useMutation({
    mutationFn: ({ body, attachment }: { body: string; attachment: File | null }) => {
      const form = new FormData();
      if (body.trim()) form.append("body", body.trim());
      if (attachment) form.append("attachment", attachment);
      return apiFetch<DirectorateChatMessage>("/directorate-chat/messages/", {
        method: "POST",
        body: form,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["directorate-chat", dirId] });
      setChatDraft("");
      setChatFile(null);
    },
  });
  const editChatMu = useMutation({
    mutationFn: ({ id, body }: { id: number; body: string }) =>
      apiFetch<DirectorateChatMessage>(`/directorate-chat/messages/${id}/`, {
        method: "PATCH",
        json: { body },
      }),
    onSuccess: () => {
      setEditingChatId(null);
      setEditingChatBody("");
      qc.invalidateQueries({ queryKey: ["directorate-chat", dirId] });
    },
  });
  const deleteChatMu = useMutation({
    mutationFn: (id: number) =>
      apiFetch<void>(`/directorate-chat/messages/${id}/`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["directorate-chat", dirId] });
    },
  });
  function printReport(report: DirectorateWeeklyReport): void {
    const w = window.open("", "_blank", "width=900,height=1000");
    if (!w) return;
    const esc = (s: string): string =>
      s
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
    const summaryText = report.summary?.trim() ? report.summary : "Данные отчёта пока пустые.";
    const lines = summaryText
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    const extractNumber = (prefix: string): string => {
      const match = lines.find((line) => line.startsWith(prefix));
      if (!match) return "0";
      return match.slice(prefix.length).trim() || "0";
    };
    const stats = {
      projects: extractNumber("Активных проектов:"),
      tasks: extractNumber("Всего задач:"),
      closed: extractNumber("Закрытых задач:"),
    };

    type ProjectBlock = { title: string; summary: string; tasks: string[] };
    const projectBlocks: ProjectBlock[] = [];
    let currentProject: ProjectBlock | null = null;
    for (const line of lines) {
      if (line.startsWith("Проект:")) {
        if (currentProject) projectBlocks.push(currentProject);
        currentProject = {
          title: line.slice("Проект:".length).trim(),
          summary: "",
          tasks: [],
        };
        continue;
      }
      if (line.startsWith("Итого за период:")) {
        if (currentProject) {
          currentProject.summary = line.slice("Итого за период:".length).trim();
        }
        continue;
      }
      if (line.startsWith("- ")) {
        if (currentProject) projectBlocks.push(currentProject);
        const body = line.slice(2);
        const sepIdx = body.indexOf(":");
        if (sepIdx >= 0) {
          currentProject = {
            title: body.slice(0, sepIdx).trim(),
            summary: body.slice(sepIdx + 1).trim(),
            tasks: [],
          };
        } else {
          currentProject = { title: body.trim(), summary: "", tasks: [] };
        }
        continue;
      }
      if (!currentProject) continue;
      if (line.startsWith("•")) {
        currentProject.tasks.push(line.slice(1).trim());
      }
    }
    if (currentProject) projectBlocks.push(currentProject);

    const projectsHtml = projectBlocks.length
      ? projectBlocks
          .map((block) => {
            const tasksHtml = block.tasks.length
              ? `<ul>${block.tasks
                  .map((task) => `<li>${esc(task)}</li>`)
                  .join("")}</ul>`
              : `<div class="empty-note">По проекту за период активных задач не найдено.</div>`;
            return `
              <section class="project-card">
                <div class="project-head">
                  <h3>${esc(block.title)}</h3>
                  ${block.summary ? `<p>${esc(block.summary)}</p>` : ""}
                </div>
                ${tasksHtml}
              </section>
            `;
          })
          .join("")
      : `<div class="empty-note">За выбранный период нет данных по проектам.</div>`;

    const html = `
      <html>
        <head>
          <title>Еженедельный отчёт</title>
          <style>
            body {
              font-family: "Segoe UI", Arial, sans-serif;
              margin: 0;
              color: #0f172a;
              background: #f8fafc;
            }
            .sheet {
              max-width: 920px;
              margin: 28px auto;
              background: #ffffff;
              border: 1px solid #e2e8f0;
              border-radius: 14px;
              padding: 24px 26px;
              box-shadow: 0 10px 26px rgba(15, 23, 42, 0.08);
            }
            .top {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              gap: 12px;
              margin-bottom: 18px;
            }
            h1 {
              margin: 0;
              font-size: 24px;
              line-height: 1.2;
            }
            .badge {
              background: #dbeafe;
              color: #1e40af;
              border-radius: 999px;
              padding: 6px 10px;
              font-size: 12px;
              font-weight: 600;
            }
            .meta-grid {
              display: grid;
              grid-template-columns: repeat(2, minmax(180px, 1fr));
              gap: 10px;
              margin-bottom: 16px;
            }
            .kpi-grid {
              display: grid;
              grid-template-columns: repeat(3, minmax(140px, 1fr));
              gap: 10px;
              margin-bottom: 16px;
            }
            .meta-card {
              border: 1px solid #e2e8f0;
              border-radius: 10px;
              padding: 10px 12px;
              background: #f8fafc;
            }
            .meta-label {
              color: #64748b;
              font-size: 12px;
              margin-bottom: 4px;
            }
            .meta-value {
              font-size: 14px;
              font-weight: 600;
            }
            .kpi-card {
              border: 1px solid #e2e8f0;
              border-radius: 10px;
              padding: 10px 12px;
              background: #ffffff;
            }
            .kpi-label {
              color: #64748b;
              font-size: 12px;
              margin-bottom: 4px;
            }
            .kpi-value {
              font-size: 20px;
              font-weight: 700;
              color: #0f172a;
            }
            .section-title {
              margin: 12px 0 10px;
              font-size: 16px;
              font-weight: 700;
            }
            .project-card {
              border: 1px solid #e2e8f0;
              border-radius: 10px;
              padding: 12px 14px;
              margin-bottom: 10px;
              background: #fff;
            }
            .project-head h3 {
              margin: 0 0 5px;
              font-size: 15px;
            }
            .project-head p {
              margin: 0;
              color: #475569;
              font-size: 12.5px;
            }
            ul {
              margin: 10px 0 0 0;
              padding-left: 18px;
            }
            li {
              margin-bottom: 6px;
              line-height: 1.5;
              font-size: 13px;
            }
            .empty-note {
              border: 1px dashed #cbd5e1;
              border-radius: 10px;
              padding: 10px 12px;
              color: #64748b;
              font-size: 13px;
            }
          </style>
        </head>
        <body>
          <div class="sheet">
            <div class="top">
              <h1>${esc(report.title)}</h1>
              <span class="badge">${esc(directorateName)}</span>
            </div>
            <div class="meta-grid">
              <div class="meta-card">
                <div class="meta-label">Период</div>
                <div class="meta-value">${esc(fmtDate(report.period_start))} - ${esc(fmtDate(report.period_end))}</div>
              </div>
              <div class="meta-card">
                <div class="meta-label">Тип отчёта</div>
                <div class="meta-value">Еженедельный отчёт по проектам и задачам</div>
              </div>
            </div>
            <div class="kpi-grid">
              <div class="kpi-card">
                <div class="kpi-label">Проекты</div>
                <div class="kpi-value">${esc(stats.projects)}</div>
              </div>
              <div class="kpi-card">
                <div class="kpi-label">Всего задач</div>
                <div class="kpi-value">${esc(stats.tasks)}</div>
              </div>
              <div class="kpi-card">
                <div class="kpi-label">Выполненные задачи</div>
                <div class="kpi-value">${esc(stats.closed)}</div>
              </div>
            </div>
            <div class="section-title">Проекты и задачи за период</div>
            <div>${projectsHtml}</div>
          </div>
        </body>
      </html>
    `;
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  }


  function submitReport(e: FormEvent) {
    e.preventDefault();
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(today.getDate() - 7);
    const toIso = (d: Date) => d.toISOString().slice(0, 10);
    const safeStart = periodStart || toIso(weekAgo);
    const safeEnd = periodEnd || toIso(today);
    const safeTitle = title.trim() || "Еженедельный отчёт";
    createReportMu.mutate({
      title: safeTitle,
      period_start: safeStart,
      period_end: safeEnd,
    });
  }

  useEffect(() => {
    const el = chatListRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [chatRows?.length]);

  function submitChat(e: FormEvent) {
    e.preventDefault();
    const t = chatDraft.trim();
    if ((!t && !chatFile) || sendChatMu.isPending) return;
    sendChatMu.mutate({ body: t, attachment: chatFile });
  }

  function toggleAnalyticsProject(projectId: number): void {
    setExpandedAnalyticsProjects((prev) =>
      prev.includes(projectId)
        ? prev.filter((id) => id !== projectId)
        : [...prev, projectId]
    );
  }

  if (!me?.directorate_detail) {
    return (
      <div className="page stack">
        <h1>Дирекция</h1>
        <div className="hint-banner">Сначала вам должна быть назначена дирекция.</div>
      </div>
    );
  }

  return (
    <div className="page stack">
      <div>
        <h1>Дирекция</h1>
        <p className="muted" style={{ margin: "0.35rem 0 0" }}>
          Управление сотрудниками, аналитикой проектов и еженедельными отчётами: «{me.directorate_detail.name}».
        </p>
      </div>
      <nav className="tab-strip" aria-label="Разделы дирекции">
        <button type="button" className={`tab${tab === "members" ? " tab--active" : ""}`} onClick={() => setTab("members")}>
          Сотрудники
        </button>
        <button type="button" className={`tab${tab === "chat" ? " tab--active" : ""}`} onClick={() => setTab("chat")}>
          Чат
        </button>
        <button type="button" className={`tab${tab === "analytics" ? " tab--active" : ""}`} onClick={() => setTab("analytics")}>
          Аналитика
        </button>
        <button type="button" className={`tab${tab === "report" ? " tab--active" : ""}`} onClick={() => setTab("report")}>
          Отчёт
        </button>
      </nav>

      {tab === "chat" ? (
      <div className="stack d-chat-page" style={{ minHeight: 0 }}>
      <div className="section-head">
        <h2>Чат дирекции</h2>
        <p className="section-subtitle">Общаются сотрудники вашей дирекции.</p>
      </div>
      <div className="card d-chat-shell stack">
        {chatLoading ? <div className="hint-banner">Загрузка сообщений…</div> : null}
        {sendChatMu.isError ? (
          <div className="error">
            {sendChatMu.error instanceof Error
              ? sendChatMu.error.message
              : "Не удалось отправить"}
          </div>
        ) : null}
        <div ref={chatListRef} className="d-chat-list" aria-live="polite">
          {!chatLoading && (chatRows ?? []).length === 0 ? (
            <p className="muted" style={{ margin: "0.5rem 0" }}>
              Пока нет сообщений — напишите первым.
            </p>
          ) : null}
          {(chatRows ?? []).map((m) => {
            const mine = m.author_username === me.username;
            return (
              <div key={m.id} className={`d-chat-msg${mine ? " d-chat-msg--mine" : ""}`}>
                <div className="d-chat-msg-meta">
                  <span className="d-chat-msg-author">{m.author_short_fio}</span>
                  <span className="d-chat-msg-login">@{m.author_username}</span>
                  <span className="d-chat-msg-time">{fmtDateTime(m.created_at)}</span>
                  {mine ? (
                    <span style={{ marginLeft: "auto", display: "inline-flex", gap: 6 }}>
                      <button
                        type="button"
                        className="button button--ghost"
                        style={{ padding: "0.18rem 0.45rem", fontSize: "0.75rem" }}
                        onClick={() => {
                          setEditingChatId(m.id);
                          setEditingChatBody(m.body ?? "");
                        }}
                      >
                        Редактировать
                      </button>
                      <button
                        type="button"
                        className="button button--ghost"
                        style={{ padding: "0.18rem 0.45rem", fontSize: "0.75rem" }}
                        onClick={() => deleteChatMu.mutate(m.id)}
                        disabled={deleteChatMu.isPending}
                      >
                        Удалить
                      </button>
                    </span>
                  ) : null}
                </div>
                {editingChatId === m.id ? (
                  <div className="stack" style={{ gap: 6 }}>
                    <textarea
                      className="d-chat-input"
                      rows={2}
                      value={editingChatBody}
                      onChange={(e) => setEditingChatBody(e.target.value)}
                    />
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        type="button"
                        className="button"
                        onClick={() =>
                          editChatMu.mutate({ id: m.id, body: editingChatBody.trim() })
                        }
                        disabled={editChatMu.isPending || !editingChatBody.trim()}
                      >
                        Сохранить
                      </button>
                      <button
                        type="button"
                        className="button button--ghost"
                        onClick={() => {
                          setEditingChatId(null);
                          setEditingChatBody("");
                        }}
                      >
                        Отмена
                      </button>
                    </div>
                  </div>
                ) : m.body ? (
                  <div className="d-chat-msg-body">{m.body}</div>
                ) : null}
                {m.attachment_url ? (
                  <a href={m.attachment_url} className="d-chat-attachment" target="_blank" rel="noreferrer">
                    📎 {m.attachment_name || "Файл"}
                  </a>
                ) : null}
              </div>
            );
          })}
        </div>
        <form className="d-chat-compose" onSubmit={submitChat}>
          <textarea
            className="d-chat-input"
            rows={3}
            value={chatDraft}
            maxLength={4000}
            onChange={(e) => setChatDraft(e.target.value)}
            placeholder="Сообщение дирекции…"
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                e.preventDefault();
                const t = chatDraft.trim();
                if ((!t && !chatFile) || sendChatMu.isPending) return;
                sendChatMu.mutate({ body: t, attachment: chatFile });
              }
            }}
          />
          <RuFileInput file={chatFile} onChange={setChatFile} />
          <div className="d-chat-compose-foot">
            <span className="muted" style={{ fontSize: "0.76rem" }}>
              Ctrl+Enter — отправить
            </span>
            <button type="submit" className="button" disabled={sendChatMu.isPending}>
              {sendChatMu.isPending ? "Отправка…" : "Отправить"}
            </button>
          </div>
        </form>
      </div>
      </div>
      ) : null}

      {tab === "members" ? (
      <>
      <div className="section-head">
        <h2>Сотрудники дирекции</h2>
        <p className="section-subtitle">
          Поиск сотрудников и добавление новых участников в дирекцию.
        </p>
      </div>
      <div className="card stack">
        <div className="card-title">Список сотрудников</div>
        <input
          value={memberQuery}
          onChange={(e) => setMemberQuery(e.target.value)}
          placeholder="Поиск по ФИО или логину"
        />
        <div className="table-wrap table-wrap--dense">
          <table className="table table--density">
            <thead>
              <tr>
                <th>Сотрудник</th>
                <th>Логин</th>
                <th>Должность</th>
                <th>Группа/отдел</th>
              </tr>
            </thead>
            <tbody>
              {(members ?? []).map((m) => (
                <tr key={m.id}>
                  <td>{m.short_fio || "—"}</td>
                  <td style={{ fontFamily: "var(--font-mono)" }}>{m.username}</td>
                  <td>{m.job_title || "—"}</td>
                  <td>{m.subdivision_detail?.name || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="card stack">
        <div className="card-title">Добавить сотрудника</div>
        <input
          value={recruitQuery}
          onChange={(e) => setRecruitQuery(e.target.value)}
          placeholder="Поиск кандидата (от 2 символов)"
        />
        <div className="table-wrap table-wrap--dense">
          <table className="table table--density">
            <thead>
              <tr>
                <th>Логин</th>
                <th>ФИО</th>
                <th>Должность</th>
                <th>Группа/отдел</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {!canSearchRecruit ? (
                <tr>
                  <td colSpan={5} className="muted" style={{ textAlign: "center" }}>
                    Введите минимум 2 символа.
                  </td>
                </tr>
              ) : null}
              {(recruits ?? []).map((u) => (
                <tr key={u.id}>
                  <td style={{ fontFamily: "var(--font-mono)" }}>{u.username}</td>
                  <td>{u.short_fio || "—"}</td>
                  <td>{u.job_title || "—"}</td>
                  <td>
                    <select
                      value={subdivisionByUser[u.id] ?? ""}
                      onChange={(e) =>
                        setSubdivisionByUser((prev) => ({ ...prev, [u.id]: e.target.value }))
                      }
                    >
                      <option value="">— без подразделения —</option>
                      {(subdivisions ?? []).map((s) => (
                        <option key={s.id} value={String(s.id)}>
                          {s.kind_label}: {s.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="button button--ghost"
                      onClick={() =>
                        addMu.mutate({
                          userId: u.id,
                          subdivisionId: subdivisionByUser[u.id]
                            ? Number(subdivisionByUser[u.id])
                            : null,
                        })
                      }
                    >
                      Добавить
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      </>
      ) : null}

      {tab === "analytics" ? (
      <>
      <div className="section-head">
        <h2>Аналитика</h2>
        <p className="section-subtitle">
          Сводные показатели по проектам дирекции за текущий период.
        </p>
      </div>
      <div className="card stack">
        <div className="card-title">Аналитика проектов дирекции</div>
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
          <div className="card" style={{ padding: "0.8rem" }}>
            <div className="muted" style={{ fontSize: "0.78rem" }}>Проекты</div>
            <div style={{ fontSize: "1.35rem", fontWeight: 700 }}>{analytics?.totals.projects_count ?? 0}</div>
          </div>
          <div className="card" style={{ padding: "0.8rem" }}>
            <div className="muted" style={{ fontSize: "0.78rem" }}>Всего задач</div>
            <div style={{ fontSize: "1.35rem", fontWeight: 700 }}>{analytics?.totals.tasks_count ?? 0}</div>
          </div>
          <div className="card" style={{ padding: "0.8rem" }}>
            <div className="muted" style={{ fontSize: "0.78rem" }}>Закрыто</div>
            <div style={{ fontSize: "1.35rem", fontWeight: 700 }}>{analytics?.totals.closed_tasks ?? 0}</div>
          </div>
        </div>
        <div>
          <div className="card-title" style={{ fontSize: "0.95rem" }}>Группы и отделы</div>
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
            {(analytics?.subdivisions ?? []).map((s) => (
              <div key={s.id} className="card" style={{ padding: "0.8rem" }}>
                <div style={{ fontWeight: 700 }}>{s.kind_label}: {s.name}</div>
                <div className="muted" style={{ marginTop: 4 }}>Сотрудники: {s.members_count}</div>
                <div className="muted">Назначенных задач: {s.assigned_tasks}</div>
                <div className="muted">Закрыто: {s.closed_tasks}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Проект</th>
                <th>Сотрудники</th>
                <th>Задачи</th>
                <th>Закрыто</th>
              </tr>
            </thead>
            <tbody>
              {(analytics?.projects ?? []).flatMap((p) => [
                <tr key={`main-${p.project_id}`}>
                  <td>
                    <button
                      type="button"
                      className="button button--ghost"
                      style={{ padding: "0.2rem 0.5rem", marginRight: 8 }}
                      onClick={() => toggleAnalyticsProject(p.project_id)}
                    >
                      {expandedAnalyticsProjects.includes(p.project_id) ? "▾" : "▸"}
                    </button>
                    <span style={{ fontWeight: 600 }}>{p.project_name}</span>
                  </td>
                  <td>{p.members_count}</td>
                  <td>{p.total_tasks}</td>
                  <td>{p.closed_tasks}</td>
                </tr>,
                expandedAnalyticsProjects.includes(p.project_id) ? (
                  <tr key={`tasks-${p.project_id}`}>
                    <td colSpan={4} style={{ background: "var(--surface-2)" }}>
                      <div className="table-wrap table-wrap--dense">
                        <table className="table table--density">
                          <thead>
                            <tr>
                              <th>Задача</th>
                              <th>Последний статус</th>
                              <th>Исполнитель</th>
                              <th>Срок</th>
                            </tr>
                          </thead>
                          <tbody>
                            {p.tasks.length ? (
                              p.tasks.map((t) => (
                                <tr key={t.id}>
                                  <td>{t.title}</td>
                                  <td>
                                    <div>{t.status_note_text}</div>
                                    <div className="muted" style={{ fontSize: "0.8rem" }}>
                                      {t.status_note_created_at
                                        ? fmtDateTime(t.status_note_created_at)
                                        : "—"}
                                    </div>
                                  </td>
                                  <td>{t.assignee_name}</td>
                                  <td>{t.due_date ? fmtDate(t.due_date) : "—"}</td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan={4} className="muted" style={{ textAlign: "center" }}>
                                  В проекте пока нет задач.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </td>
                  </tr>
                ) : null,
              ])}
            </tbody>
          </table>
        </div>
      </div>
      </>
      ) : null}

      {tab === "report" ? (
      <>
      <div className="section-head">
        <h2>Отчёт</h2>
        <p className="section-subtitle">
          Формирование и хранение еженедельных отчётов дирекции.
        </p>
      </div>
      <form className="card stack" onSubmit={submitReport}>
        <div className="card-title">Создание еженедельного отчёта</div>
        <p className="muted" style={{ margin: 0 }}>
          Формируется печатная форма по текущим проектам и задачам дирекции за указанный период.
        </p>
        <div className="field">
          <label>Заголовок</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="field-row">
          <div className="field">
            <label>Начало периода</label>
            <input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
          </div>
          <div className="field">
            <label>Конец периода</label>
            <input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
          </div>
        </div>
        <button
          type="submit"
          className="button"
          disabled={createReportMu.isPending}
        >
          {createReportMu.isPending ? "Создание…" : "Создать отчёт"}
        </button>
        {createReportMu.isError ? (
          <div className="error">
            {createReportMu.error instanceof Error
              ? createReportMu.error.message
              : "Не удалось создать отчёт"}
          </div>
        ) : null}
      </form>

      <div className="card stack">
        <div className="card-title">История еженедельных отчётов</div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Период</th>
                <th>Заголовок</th>
                <th>Автор</th>
                <th>Создан</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(reports ?? []).map((r) => (
                <tr key={r.id}>
                  <td>
                    {fmtDate(r.period_start)} - {fmtDate(r.period_end)}
                  </td>
                  <td>{r.title}</td>
                  <td>{r.author_short_fio}</td>
                  <td>{fmtDateTime(r.created_at)}</td>
                  <td style={{ width: 190 }}>
                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "nowrap" }}>
                    <button type="button" className="button button--ghost" onClick={() => printReport(r)}>
                      Печать
                    </button>
                    <button
                      type="button"
                      className="button button--ghost"
                      onClick={() => deleteReportMu.mutate(r.id)}
                    >
                      Удалить
                    </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      </>
      ) : null}
    </div>
  );
}
