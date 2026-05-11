import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../api/client";
import type { SubdivisionChatMessage } from "../api/types";
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

export function SubdivisionChatPage() {
  const { me } = useAuth();
  const qc = useQueryClient();
  const listRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState("");

  const subdivisionId = me?.subdivision_detail?.id ?? null;

  const { data, isLoading, error } = useQuery({
    queryKey: ["subdivision-chat", subdivisionId],
    queryFn: () => apiFetch<SubdivisionChatMessage[]>("/subdivision-chat/messages/"),
    enabled: subdivisionId !== null,
    refetchInterval: 12_000,
  });

  const sendMu = useMutation({
    mutationFn: (body: string) =>
      apiFetch<SubdivisionChatMessage>("/subdivision-chat/messages/", {
        method: "POST",
        json: { body },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["subdivision-chat", subdivisionId] });
      setDraft("");
    },
  });

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [data?.length, subdivisionId]);

  if (!me) {
    return <div className="page muted">Загрузка…</div>;
  }

  if (!me.subdivision_detail) {
    return (
      <div className="page stack">
        <div>
          <h1>Чат группы/отдела</h1>
          <p className="muted" style={{ margin: "0.35rem 0 0" }}>
            Отдельный канал вашей рабочей группы или отдела внутри дирекции.
          </p>
        </div>
        <div className="card hint-banner stack" style={{ gap: "0.5rem" }}>
          <strong>В профиле не указана группа/отдел</strong>
          <p className="muted" style={{ margin: 0 }}>
            Укажите подразделение в <Link to="/cabinet">личном кабинете</Link> —
            после сохранения появится приватный чат вашей группы/отдела.
          </p>
        </div>
      </div>
    );
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const t = draft.trim();
    if (!t || sendMu.isPending) return;
    sendMu.mutate(t);
  }

  const rows = Array.isArray(data) ? data : [];

  return (
    <div className="page stack d-chat-page">
      <div>
        <h1>Чат группы/отдела</h1>
        <p className="muted" style={{ margin: "0.35rem 0 0" }}>
          {me.subdivision_detail.name}. Видят и пишут только участники этого
          подразделения.
        </p>
      </div>

      <div className="card d-chat-shell stack">
        {isLoading ? <div className="hint-banner">Загрузка сообщений…</div> : null}
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
                </div>
                <div className="d-chat-msg-body">{m.body}</div>
              </div>
            );
          })}
        </div>

        <form className="d-chat-compose" onSubmit={onSubmit}>
          <textarea
            className="d-chat-input"
            rows={3}
            placeholder="Сообщение коллегам по подразделению…"
            value={draft}
            maxLength={4000}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                e.preventDefault();
                const t = draft.trim();
                if (!t || sendMu.isPending) return;
                sendMu.mutate(t);
              }
            }}
          />
          <div className="d-chat-compose-foot">
            <span className="muted" style={{ fontSize: "0.76rem" }}>
              Ctrl+Enter — отправить
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
