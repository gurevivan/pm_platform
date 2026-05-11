import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../api/client";
import { RuFileInput } from "../components/RuFileInput";
import type { DirectorateChatMessage } from "../api/types";
import { useAuth } from "../auth/AuthProvider";

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("ru-RU", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function DirectorateChatPage() {
  const { me } = useAuth();
  const qc = useQueryClient();
  const listRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editBody, setEditBody] = useState("");

  const dirId = me?.directorate_detail?.id ?? null;

  const { data, isLoading, error } = useQuery({
    queryKey: ["directorate-chat", dirId],
    queryFn: () =>
      apiFetch<DirectorateChatMessage[]>("/directorate-chat/messages/"),
    enabled: dirId !== null,
    refetchInterval: 12_000,
  });

  const sendMu = useMutation({
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
      setDraft("");
      setFile(null);
    },
  });
  const editMu = useMutation({
    mutationFn: ({ id, body }: { id: number; body: string }) =>
      apiFetch<DirectorateChatMessage>(`/directorate-chat/messages/${id}/`, {
        method: "PATCH",
        json: { body },
      }),
    onSuccess: () => {
      setEditingId(null);
      setEditBody("");
      qc.invalidateQueries({ queryKey: ["directorate-chat", dirId] });
    },
  });
  const deleteMu = useMutation({
    mutationFn: (id: number) =>
      apiFetch<void>(`/directorate-chat/messages/${id}/`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["directorate-chat", dirId] });
    },
  });

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [data?.length, dirId]);

  if (!me) {
    return <div className="page muted">Загрузка…</div>;
  }

  if (!me.directorate_detail) {
    return (
      <div className="page stack">
        <div>
          <h1>Чат дирекции</h1>
          <p className="muted" style={{ margin: "0.35rem 0 0" }}>
            Общий канал для сотрудников одной дирекции.
          </p>
        </div>
        <div className="card hint-banner stack" style={{ gap: "0.5rem" }}>
          <strong>В профиле не указана дирекция</strong>
          <p className="muted" style={{ margin: 0 }}>
            Укажите дирекцию в{" "}
            <Link to="/cabinet">личном кабинете</Link> — после сохранения здесь появится
            переписка с коллегами вашего подразделения.
          </p>
        </div>
      </div>
    );
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const t = draft.trim();
    if ((!t && !file) || sendMu.isPending) return;
    sendMu.mutate({ body: t, attachment: file });
  }

  const rows = Array.isArray(data) ? data : [];

  return (
    <div className="page stack d-chat-page">
      <div>
        <h1>Чат дирекции</h1>
        <p className="muted" style={{ margin: "0.35rem 0 0" }}>
          {me.directorate_detail.name}. Видят и пишут только сотрудники с той же дирекцией.
        </p>
      </div>

      <div className="card d-chat-shell stack">
        {isLoading ? (
          <div className="hint-banner">Загрузка сообщений…</div>
        ) : null}
        {error ? (
          <div className="error">
            {error instanceof Error ? error.message : "Не удалось загрузить чат"}
          </div>
        ) : null}
        {sendMu.isError ? (
          <div className="error">
            {sendMu.error instanceof Error
              ? sendMu.error.message
              : "Не удалось отправить"}
          </div>
        ) : null}

        <div ref={listRef} className="d-chat-list" aria-live="polite">
          {!isLoading && rows.length === 0 ? (
            <p className="muted" style={{ margin: "0.5rem 0" }}>
              Пока нет сообщений — напишите первым.
            </p>
          ) : null}
          {rows.map((m) => {
            const mine = m.author_username === me.username;
            return (
              <div
                key={m.id}
                className={`d-chat-msg${mine ? " d-chat-msg--mine" : ""}`}
              >
                <div className="d-chat-msg-meta">
                  <span className="d-chat-msg-author">{m.author_short_fio}</span>
                  <span className="d-chat-msg-login">@{m.author_username}</span>
                  <span className="d-chat-msg-time">{fmtTime(m.created_at)}</span>
                  {mine ? (
                    <span style={{ marginLeft: "auto", display: "inline-flex", gap: 6 }}>
                      <button
                        type="button"
                        className="button button--ghost"
                        style={{ padding: "0.18rem 0.45rem", fontSize: "0.75rem" }}
                        onClick={() => {
                          setEditingId(m.id);
                          setEditBody(m.body ?? "");
                        }}
                      >
                        Редактировать
                      </button>
                      <button
                        type="button"
                        className="button button--ghost"
                        style={{ padding: "0.18rem 0.45rem", fontSize: "0.75rem" }}
                        onClick={() => deleteMu.mutate(m.id)}
                        disabled={deleteMu.isPending}
                      >
                        Удалить
                      </button>
                    </span>
                  ) : null}
                </div>
                {editingId === m.id ? (
                  <div className="stack" style={{ gap: 6 }}>
                    <textarea
                      className="d-chat-input"
                      rows={2}
                      value={editBody}
                      onChange={(e) => setEditBody(e.target.value)}
                    />
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        type="button"
                        className="button"
                        onClick={() => editMu.mutate({ id: m.id, body: editBody.trim() })}
                        disabled={editMu.isPending || !editBody.trim()}
                      >
                        Сохранить
                      </button>
                      <button
                        type="button"
                        className="button button--ghost"
                        onClick={() => {
                          setEditingId(null);
                          setEditBody("");
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
                  <a
                    href={m.attachment_url}
                    className="d-chat-attachment"
                    target="_blank"
                    rel="noreferrer"
                  >
                    📎 {m.attachment_name || "Файл"}
                  </a>
                ) : null}
              </div>
            );
          })}
        </div>

        <form className="d-chat-compose" onSubmit={onSubmit}>
          <textarea
            className="d-chat-input"
            rows={3}
            placeholder="Сообщение коллегам…"
            value={draft}
            maxLength={4000}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                e.preventDefault();
                const t = draft.trim();
                if ((!t && !file) || sendMu.isPending) return;
                sendMu.mutate({ body: t, attachment: file });
              }
            }}
          />
          <RuFileInput file={file} onChange={setFile} />
          <div className="d-chat-compose-foot">
            <span className="muted" style={{ fontSize: "0.76rem" }}>
              Ctrl+Enter — отправить. Можно текст, файл или оба сразу.
            </span>
            <button type="submit" className="button" disabled={sendMu.isPending}>
              {sendMu.isPending ? "Отправка…" : "Отправить"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
