import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useState } from "react";
import { apiFetch } from "../api/client";
import type {
  AdminUserRecord,
  DirectorateBrief,
  DirectorateSubdivisionBrief,
  WorkItemType,
} from "../api/types";
import { useAuth } from "../auth/AuthProvider";

type PatchBody = Record<string, string | boolean | number | null>;

function DirectorateSelectCell({
  uid,
  fallback,
  onPatch,
}: {
  uid: number;
  fallback: DirectorateBrief | null;
  onPatch: (id: number, body: PatchBody) => void;
}) {
  const { data } = useQuery({
    queryKey: ["directorates"],
    queryFn: () => apiFetch<DirectorateBrief[]>("/directorates/"),
  });
  const list = (): DirectorateBrief[] => {
    const base = [...(data ?? [])];
    if (
      fallback &&
      !base.some((d) => d.id === fallback.id)
    ) {
      base.unshift({ ...fallback, name: `${fallback.name} (в списке скрыта)` });
    }
    return base;
  };
  const currentId = fallback?.id ?? "";
  return (
    <select
      value={currentId === "" ? "" : String(currentId)}
      onChange={(e) => {
        const v = e.target.value;
        onPatch(uid, {
          directorate_id: v === "" ? null : Number(v),
        });
      }}
    >
      <option value="">—</option>
      {list().map((d) => (
        <option key={d.id} value={d.id}>
          {d.name}
        </option>
      ))}
    </select>
  );
}

function SubdivisionSelectCell({
  uid,
  directorateId,
  fallback,
  onPatch,
}: {
  uid: number;
  directorateId: number | null;
  fallback: DirectorateSubdivisionBrief | null;
  onPatch: (id: number, body: PatchBody) => void;
}) {
  const { data } = useQuery({
    queryKey: ["directorate-subdivisions", directorateId ?? "all"],
    queryFn: () =>
      apiFetch<DirectorateSubdivisionBrief[]>(
        directorateId
          ? `/directorate-subdivisions/?directorate_id=${directorateId}`
          : "/directorate-subdivisions/",
      ),
  });
  const list = (): DirectorateSubdivisionBrief[] => {
    const base = [...(data ?? [])];
    if (fallback && !base.some((s) => s.id === fallback.id)) {
      base.unshift({ ...fallback, name: `${fallback.name} (в списке скрыта)` });
    }
    return base;
  };
  const cur = fallback?.id ?? "";
  return (
    <select
      value={cur === "" ? "" : String(cur)}
      onChange={(e) => {
        const v = e.target.value;
        onPatch(uid, { subdivision_id: v === "" ? null : Number(v) });
      }}
    >
      <option value="">—</option>
      {list().map((s) => (
        <option key={s.id} value={s.id}>
          {s.kind_label}: {s.name}
        </option>
      ))}
    </select>
  );
}

function BlurField({
  uid,
  initial,
  field,
  onPatch,
}: {
  uid: number;
  initial: string;
  field: string;
  onPatch: (id: number, body: PatchBody) => void;
}) {
  return (
    <input
      key={`${uid}-${field}-${initial}`}
      defaultValue={initial}
      onBlur={(e) => {
        const v = e.target.value;
        if (v === initial) return;
        onPatch(uid, { [field]: v });
      }}
    />
  );
}

export function AdminUsersPage() {
  const { me } = useAuth();
  const qc = useQueryClient();
  const [newDirectorateName, setNewDirectorateName] = useState("");
  const [newTypeName, setNewTypeName] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => apiFetch<AdminUserRecord[]>(`/admin/users/`),
  });

  const patchMu = useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: number;
      body: PatchBody;
    }) =>
      apiFetch(`/admin/users/${id}/`, { method: "PATCH", json: body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });

  const doPatch = (id: number, body: PatchBody) => {
    patchMu.mutate({ id, body });
  };

  const createDirMu = useMutation({
    mutationFn: () =>
      apiFetch<DirectorateBrief>("/directorates/", {
        method: "POST",
        json: { name: newDirectorateName.trim() },
      }),
    onSuccess: () => {
      setNewDirectorateName("");
      qc.invalidateQueries({ queryKey: ["directorates"] });
    },
  });

  const createTypeMu = useMutation({
    mutationFn: () =>
      apiFetch<WorkItemType>("/work-item-types/", {
        method: "POST",
        json: {
          name: newTypeName.trim(),
          is_active: true,
          sort_order: 100,
        },
      }),
    onSuccess: () => {
      setNewTypeName("");
      qc.invalidateQueries({ queryKey: ["work-item-types"] });
    },
  });

  function onCreateDirectorate(e: FormEvent) {
    e.preventDefault();
    if (!newDirectorateName.trim()) return;
    createDirMu.mutate();
  }

  function onCreateType(e: FormEvent) {
    e.preventDefault();
    if (!newTypeName.trim()) return;
    createTypeMu.mutate();
  }

  return (
    <div className="page page--spread stack">
      <div>
        <h1>Сотрудники</h1>
        <p className="muted" style={{ margin: "0.35rem 0 0" }}>
          Назначение администратора даёт доступ к этой странице и к панели Django
          только при отдельном входе в админку сайта.
        </p>
      </div>

      {me?.is_superuser ? (
        <div className="field-row">
          <form className="card stack" onSubmit={onCreateDirectorate}>
            <div className="card-title">Добавить дирекцию</div>
            <input
              value={newDirectorateName}
              onChange={(e) => setNewDirectorateName(e.target.value)}
              placeholder="Название дирекции"
            />
            <button type="submit" className="button" disabled={createDirMu.isPending}>
              Добавить
            </button>
          </form>
          <form className="card stack" onSubmit={onCreateType}>
            <div className="card-title">Добавить тип задачи</div>
            <input
              value={newTypeName}
              onChange={(e) => setNewTypeName(e.target.value)}
              placeholder="Название, например Риск"
            />
            <button type="submit" className="button" disabled={createTypeMu.isPending}>
              Добавить
            </button>
          </form>
        </div>
      ) : null}

      {isLoading ? <div className="hint-banner">Загрузка…</div> : null}
      {error ? (
        <div className="error">
          {error instanceof Error ? error.message : "Ошибка"}
        </div>
      ) : null}

      <div className="table-wrap table-wrap--dense">
        <table className="table table--density">
          <thead>
            <tr>
              <th>Логин</th>
              <th>Фамилия</th>
              <th>Имя</th>
              <th>Отчество</th>
              <th>Дирекция</th>
              <th>Группа/отдел</th>
              <th>Должность</th>
              <th>Админ</th>
              <th>Активен</th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((u) => (
              <tr key={u.id}>
                <td style={{ fontFamily: "var(--font-mono)", fontSize: "0.85rem", whiteSpace: "nowrap" }}>
                  {u.username}
                  {u.is_superuser ? (
                    <span
                      className="chip chip--pri-urgent"
                      style={{
                        marginLeft: 6,
                        fontSize: "0.62rem",
                        textTransform: "none",
                      }}
                    >
                      суперадмин
                    </span>
                  ) : null}
                </td>
                <td>
                  <BlurField
                    uid={u.id}
                    field="last_name"
                    initial={u.last_name}
                    onPatch={doPatch}
                  />
                </td>
                <td>
                  <BlurField
                    uid={u.id}
                    field="first_name"
                    initial={u.first_name}
                    onPatch={doPatch}
                  />
                </td>
                <td>
                  <BlurField
                    uid={u.id}
                    field="patronymic"
                    initial={u.patronymic}
                    onPatch={doPatch}
                  />
                </td>
                <td>
                  <DirectorateSelectCell
                    uid={u.id}
                    fallback={u.directorate_detail ?? null}
                    onPatch={doPatch}
                  />
                </td>
                <td>
                  <SubdivisionSelectCell
                    uid={u.id}
                    directorateId={u.directorate_detail?.id ?? null}
                    fallback={u.subdivision_detail ?? null}
                    onPatch={doPatch}
                  />
                </td>
                <td>
                  <BlurField
                    uid={u.id}
                    field="job_title"
                    initial={u.job_title}
                    onPatch={doPatch}
                  />
                </td>
                <td>
                  <label style={{ cursor: "pointer", userSelect: "none" }}>
                    <input
                      type="checkbox"
                      checked={u.is_staff}
                      disabled={u.is_superuser}
                      onChange={(e) =>
                        doPatch(u.id, { is_staff: e.target.checked })
                      }
                    />{" "}
                    да
                  </label>
                </td>
                <td>
                  <label style={{ cursor: "pointer", userSelect: "none" }}>
                    <input
                      type="checkbox"
                      checked={u.is_active}
                      disabled={u.is_superuser}
                      onChange={(e) =>
                        doPatch(u.id, { is_active: e.target.checked })
                      }
                    />{" "}
                    да
                  </label>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
