import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../api/client";
import type { ThemeStaff } from "../api/types";

type PatchBody = Record<string, string | boolean | number | Record<string, string> | null>;

function parseCssVariablesJson(text: string): Record<string, string> {
  const parsed: unknown = JSON.parse(text);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Нужен JSON-объект с парами «--имя»: «значение».");
  }
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
    if (!k.startsWith("--")) {
      throw new Error(`Ключ «${k}» должен начинаться с --`);
    }
    out[k] = String(v);
  }
  return out;
}

function BlurText({
  tid,
  field,
  initial,
  onPatch,
}: {
  tid: number;
  field: string;
  initial: string;
  onPatch: (id: number, body: PatchBody) => void;
}) {
  return (
    <input
      key={`${tid}-${field}-${initial}`}
      defaultValue={initial}
      onBlur={(e) => {
        const v = e.target.value;
        if (v === initial) return;
        onPatch(tid, { [field]: v });
      }}
    />
  );
}

function BlurNumber({
  tid,
  field,
  initial,
  onPatch,
}: {
  tid: number;
  field: string;
  initial: number;
  onPatch: (id: number, body: PatchBody) => void;
}) {
  return (
    <input
      type="number"
      min={0}
      key={`${tid}-${field}-${initial}`}
      defaultValue={String(initial)}
      onBlur={(e) => {
        const n = Number(e.target.value);
        if (!Number.isFinite(n) || n < 0) return;
        if (n === initial) return;
        onPatch(tid, { [field]: n });
      }}
    />
  );
}

function CssVariablesArea({
  tid,
  initialObj,
  onPatch,
}: {
  tid: number;
  initialObj: Record<string, string>;
  onPatch: (id: number, body: PatchBody) => void;
}) {
  const initial = JSON.stringify(initialObj, null, 2);
  return (
    <textarea
      key={`${tid}-css-${initial}`}
      className="mono-input"
      rows={5}
      spellCheck={false}
      defaultValue={initial}
      onBlur={(e) => {
        const raw = e.target.value.trim();
        const same = raw === initial;
        if (same) return;
        try {
          const obj = raw === "" ? {} : parseCssVariablesJson(raw);
          onPatch(tid, { css_variables: obj });
        } catch (err) {
          window.alert(
            err instanceof Error ? err.message : "Некорректный JSON переменных",
          );
        }
      }}
      style={{
        width: "100%",
        minWidth: "12rem",
        fontFamily: "var(--font-mono)",
        fontSize: "0.78rem",
      }}
    />
  );
}

export function AdminThemesPage() {
  const qc = useQueryClient();
  const [createSlug, setCreateSlug] = useState("");
  const [createName, setCreateName] = useState("");
  const [createOrder, setCreateOrder] = useState(100);
  const [createJson, setCreateJson] = useState("{}");
  const [createDataBase, setCreateDataBase] = useState<"dark" | "light">("dark");
  const [createErr, setCreateErr] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["themes"],
    queryFn: () => apiFetch<ThemeStaff[]>("/themes/"),
  });

  const patchMu = useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: number;
      body: PatchBody;
    }) => apiFetch<ThemeStaff>(`/themes/${id}/`, { method: "PATCH", json: body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["themes"] }),
  });

  const createMu = useMutation({
    mutationFn: (body: PatchBody) =>
      apiFetch<ThemeStaff>("/themes/", { method: "POST", json: body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["themes"] });
      setCreateSlug("");
      setCreateName("");
      setCreateOrder(100);
      setCreateJson("{}");
      setCreateDataBase("dark");
      setCreateErr(null);
    },
    onError: (e) => {
      setCreateErr(e instanceof Error ? e.message : String(e));
    },
  });

  const delMu = useMutation({
    mutationFn: (id: number) =>
      apiFetch<unknown>(`/themes/${id}/`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["themes"] }),
  });

  const doPatch = (id: number, body: PatchBody) => {
    patchMu.mutate({ id, body });
  };

  function onCreate(e: FormEvent) {
    e.preventDefault();
    setCreateErr(null);
    let vars: Record<string, string>;
    try {
      vars =
        createJson.trim() === "" ? {} : parseCssVariablesJson(createJson);
    } catch (err) {
      setCreateErr(err instanceof Error ? err.message : "Неверный JSON");
      return;
    }
    const slug = createSlug.trim();
    const name = createName.trim();
    if (!slug || !name) {
      setCreateErr("Укажите slug и название.");
      return;
    }
    createMu.mutate({
      slug,
      name,
      sort_order: createOrder,
      css_variables: vars,
      is_active: true,
      is_exclusive: false,
      data_theme_base: createDataBase,
      is_default_for_unassigned: false,
    });
  }

  return (
    <div className="page page--spread stack">
      <div>
        <h1>Темы оформления</h1>
        <p className="muted" style={{ margin: "0.35rem 0 0" }}>
          База <strong>CSS</strong> (светлая/тёмная ветка селекторов) задаётся полем «База
          интерфейса». Имя slug может быть своим, если заполнены переменные.
        </p>
      </div>

      <form className="card stack" onSubmit={onCreate}>
        <div className="card-title">Новая тема</div>
        <div className="field-row">
          <div className="field">
            <label>Slug</label>
            <input
              value={createSlug}
              onChange={(e) => setCreateSlug(e.target.value)}
              placeholder="например corporate-dark"
              style={{ fontFamily: "var(--font-mono)" }}
            />
          </div>
          <div className="field">
            <label>Название</label>
            <input
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="Как показывается в списках"
            />
          </div>
          <div className="field" style={{ maxWidth: "8rem" }}>
            <label>Порядок</label>
            <input
              type="number"
              min={0}
              value={createOrder}
              onChange={(e) => setCreateOrder(Number(e.target.value) || 0)}
            />
          </div>
          <div className="field" style={{ maxWidth: "12rem" }}>
            <label>База интерфейса</label>
            <select
              value={createDataBase}
              onChange={(e) =>
                setCreateDataBase(e.target.value === "light" ? "light" : "dark")
              }
            >
              <option value="dark">Тёмная ветка CSS</option>
              <option value="light">Светлая ветка CSS</option>
            </select>
          </div>
        </div>
        <div className="field">
          <label>Переменные CSS (JSON)</label>
          <textarea
            className="mono-input"
            rows={6}
            spellCheck={false}
            value={createJson}
            onChange={(e) => setCreateJson(e.target.value)}
            placeholder='{\n  "--accent": "#6d9cf8"\n}'
            style={{ width: "100%", fontFamily: "var(--font-mono)", fontSize: "0.85rem" }}
          />
        </div>
        {createErr ? <div className="error">{createErr}</div> : null}
        <button type="submit" className="button" disabled={createMu.isPending}>
          {createMu.isPending ? "Создание…" : "Создать тему"}
        </button>
      </form>

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
              <th>Slug</th>
              <th>Название</th>
              <th>Порядок</th>
              <th>База CSS</th>
              <th>Активна</th>
              <th>Дефолт сайта</th>
              <th>CSS переменные</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((t) => (
              <tr key={t.id}>
                <td style={{ whiteSpace: "nowrap" }}>
                  <BlurText tid={t.id} field="slug" initial={t.slug} onPatch={doPatch} />
                </td>
                <td>
                  <BlurText tid={t.id} field="name" initial={t.name} onPatch={doPatch} />
                </td>
                <td>
                  <BlurNumber
                    tid={t.id}
                    field="sort_order"
                    initial={t.sort_order}
                    onPatch={doPatch}
                  />
                </td>
                <td>
                  <select
                    key={`${t.id}-dtb-${t.data_theme_base}`}
                    defaultValue={t.data_theme_base}
                    onChange={(e) =>
                      doPatch(t.id, {
                        data_theme_base:
                          e.target.value === "light" ? "light" : "dark",
                      })
                    }
                    style={{ fontSize: "0.85rem" }}
                  >
                    <option value="dark">dark</option>
                    <option value="light">light</option>
                  </select>
                </td>
                <td>
                  <label style={{ cursor: "pointer", userSelect: "none" }}>
                    <input
                      type="checkbox"
                      checked={t.is_active}
                      onChange={(e) =>
                        doPatch(t.id, { is_active: e.target.checked })
                      }
                    />{" "}
                    да
                  </label>
                </td>
                <td>
                  <label style={{ cursor: "pointer", userSelect: "none" }}>
                    <input
                      type="radio"
                      name="site-default-theme"
                      checked={t.is_default_for_unassigned}
                      onChange={() =>
                        doPatch(t.id, { is_default_for_unassigned: true })
                      }
                    />
                  </label>
                </td>
                <td>
                  <CssVariablesArea
                    tid={t.id}
                    initialObj={t.css_variables ?? {}}
                    onPatch={doPatch}
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className="button button--ghost"
                    style={{ fontSize: "0.78rem" }}
                    onClick={() => {
                      if (
                        window.confirm(
                          `Удалить тему «${t.name}»? Пользователи с этой темой потеряют привязку.`,
                        )
                      ) {
                        delMu.mutate(t.id);
                      }
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
