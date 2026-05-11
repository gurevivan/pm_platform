import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useState } from "react";
import { useParams } from "react-router-dom";
import { apiFetch } from "../api/client";
import type { RelationType, WorkItem, WorkItemRelation } from "../api/types";

const typeLabel: Record<RelationType, string> = {
  precedes: "Предшествует · Гант FS",
  blocks: "Блокирует",
  relates: "Связана",
  duplicates: "Дубликат",
};

export function RelationsPage() {
  const { projectId } = useParams();
  const pid = Number(projectId);
  const qc = useQueryClient();

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

  const [from, setFrom] = useState<number | "">("");
  const [to, setTo] = useState<number | "">("");
  const [relType, setRelType] = useState<RelationType>("precedes");

  const mut = useMutation({
    mutationFn: () =>
      apiFetch(`/projects/${pid}/relations/`, {
        method: "POST",
        json: {
          from_item: from,
          to_item: to,
          relation_type: relType,
        },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["relations", pid] }),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (from === "" || to === "") return;
    mut.mutate();
  }

  function title(id: number) {
    const w = (items ?? []).find((x) => x.id === id);
    return w ? `#${id} · ${w.title}` : `#${id}`;
  }

  return (
    <div className="stack">
      <div className="section-head">
        <h2>Связи между задачами</h2>
        <p className="section-subtitle">
          Тип «предшествует» задаёт последовательность для дорожной карты и упрощённого Ганта.
        </p>
      </div>

      <form className="card stack" onSubmit={onSubmit}>
        <div className="card-title">Новая связь</div>
        <div className="field-row">
          <div className="field">
            <label>От задачи</label>
            <select
              value={from === "" ? "" : String(from)}
              onChange={(e) =>
                setFrom(e.target.value ? Number(e.target.value) : "")
              }
            >
              <option value="">—</option>
              {(items ?? []).map((w) => (
                <option key={w.id} value={w.id}>
                  #{w.id} {w.title}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>К задаче</label>
            <select
              value={to === "" ? "" : String(to)}
              onChange={(e) =>
                setTo(e.target.value ? Number(e.target.value) : "")
              }
            >
              <option value="">—</option>
              {(items ?? []).map((w) => (
                <option key={w.id} value={w.id}>
                  #{w.id} {w.title}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Тип связи</label>
            <select
              value={relType}
              onChange={(e) =>
                setRelType(e.target.value as RelationType)
              }
            >
              {(Object.entries(typeLabel) as [RelationType, string][]).map(
                ([k, lbl]) => (
                  <option key={k} value={k}>
                    {lbl}
                  </option>
                ),
              )}
            </select>
          </div>
        </div>
        <button
          className="button"
          type="submit"
          disabled={from === "" || to === ""}
        >
          Сохранить связь
        </button>
        {mut.isError ? (
          <div className="error">
            {mut.error instanceof Error ? mut.error.message : ""}
          </div>
        ) : null}
      </form>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Источник</th>
              <th>Тип</th>
              <th>Цель</th>
              <th style={{ width: 110 }} />
            </tr>
          </thead>
          <tbody>
            {!relations?.length ? (
              <tr>
                <td colSpan={4} className="muted" style={{ textAlign: "center", padding: "2rem" }}>
                  Связей пока нет.
                </td>
              </tr>
            ) : null}
            {(relations ?? []).map((r) => (
              <tr key={r.id}>
                <td>{title(r.from_item)}</td>
                <td>
                  <span className="chip chip--pri-normal" style={{ textTransform: "none", maxWidth: 220 }}>
                    {typeLabel[r.relation_type]}
                  </span>
                </td>
                <td>{title(r.to_item)}</td>
                <td>
                  <button
                    type="button"
                    className="button button--ghost button--sm button--danger"
                    onClick={async () => {
                      await apiFetch(`/projects/${pid}/relations/${r.id}/`, {
                        method: "DELETE",
                      });
                      qc.invalidateQueries({ queryKey: ["relations", pid] });
                    }}
                  >
                    Удалить
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
