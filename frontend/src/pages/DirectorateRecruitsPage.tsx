import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { apiFetch } from "../api/client";
import type { DirectorateRecruit, DirectorateSubdivisionBrief } from "../api/types";
import { useAuth } from "../auth/AuthProvider";

export function DirectorateRecruitsPage() {
  const { me } = useAuth();
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [subdivisionByUser, setSubdivisionByUser] = useState<Record<number, string>>({});
  const dirId = me?.directorate_detail?.id ?? null;
  const normalizedQuery = query.trim();
  const canSearch = normalizedQuery.length >= 2;

  const { data: recruits, isLoading, error } = useQuery({
    queryKey: ["directorate-recruits", normalizedQuery],
    queryFn: () =>
      apiFetch<DirectorateRecruit[]>(
        `/directorate/recruits/?q=${encodeURIComponent(normalizedQuery)}`,
      ),
    enabled: !!dirId && canSearch,
  });

  const { data: subdivisions } = useQuery({
    queryKey: ["directorate-subdivisions", dirId ?? "none"],
    queryFn: () =>
      apiFetch<DirectorateSubdivisionBrief[]>(
        `/directorate-subdivisions/?directorate_id=${dirId}`,
      ),
    enabled: !!dirId,
  });

  const addMu = useMutation({
    mutationFn: ({ userId, subdivisionId }: { userId: number; subdivisionId: number | null }) =>
      apiFetch<DirectorateRecruit>(`/directorate/recruits/${userId}/`, {
        method: "PATCH",
        json: { subdivision_id: subdivisionId },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["directorate-recruits"] }),
  });

  if (!me?.directorate_detail) {
    return (
      <div className="page stack">
        <h1>Добавление в дирекцию</h1>
        <div className="hint-banner">Сначала вам должна быть назначена дирекция.</div>
      </div>
    );
  }

  return (
    <div className="page stack">
      <div>
        <h1>Добавление в дирекцию</h1>
        <p className="muted" style={{ margin: "0.35rem 0 0" }}>
          Найдите пользователя по ФИО или логину и добавьте в «{me.directorate_detail.name}».
        </p>
      </div>
      <div className="field">
        <label>Поиск пользователя</label>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Начните вводить ФИО или логин (от 2 символов)"
        />
      </div>
      {isLoading ? <div className="hint-banner">Загрузка…</div> : null}
      {error ? (
        <div className="error">{error instanceof Error ? error.message : "Ошибка"}</div>
      ) : null}
      {addMu.isError ? (
        <div className="error">
          {addMu.error instanceof Error ? addMu.error.message : "Не удалось добавить"}
        </div>
      ) : null}
      <div className="table-wrap table-wrap--dense">
        <table className="table table--density">
          <thead>
            <tr>
              <th>Логин</th>
              <th>ФИО</th>
              <th>Должность</th>
              <th>Группа/отдел (опционально)</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {!canSearch ? (
              <tr>
                <td colSpan={5} className="muted" style={{ textAlign: "center" }}>
                  Введите минимум 2 символа для поиска.
                </td>
              </tr>
            ) : null}
            {(recruits ?? []).map((u) => (
              <tr key={u.id}>
                <td style={{ fontFamily: "var(--font-mono)", fontSize: "0.85rem" }}>{u.username}</td>
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
                    disabled={addMu.isPending}
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
            {canSearch && !isLoading && (recruits ?? []).length === 0 ? (
              <tr>
                <td colSpan={5} className="muted" style={{ textAlign: "center" }}>
                  Ничего не найдено среди пользователей без дирекции.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
