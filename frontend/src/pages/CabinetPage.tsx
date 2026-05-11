import { useMutation, useQuery } from "@tanstack/react-query";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { apiFetch } from "../api/client";
import type { DirectorateSubdivisionBrief, MeUser, ThemeBrief } from "../api/types";

export function CabinetPage() {
  const { me, refreshMe } = useAuth();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [patronymic, setPatronymic] = useState("");
  const [directorateName, setDirectorateName] = useState<string>("");
  const [subdivisionId, setSubdivisionId] = useState<number | "">("");
  const [themeChoice, setThemeChoice] = useState<string>("");
  const [jobTitle, setJobTitle] = useState("");

  const { data: themes } = useQuery({
    queryKey: ["themes"],
    queryFn: () => apiFetch<ThemeBrief[]>("/themes/"),
    enabled: !!me,
  });
  /** В кабинете только темы для самовыбора; эксклюзив не показываем (только отдельными пунктами). */
  const publicThemeOptions = useMemo(() => {
    return themes ?? [];
  }, [themes]);
  const directorateId = me?.directorate_detail?.id ?? null;
  const { data: subdivisions } = useQuery({
    queryKey: ["directorate-subdivisions", directorateId ?? "none"],
    queryFn: () =>
      apiFetch<DirectorateSubdivisionBrief[]>(
        `/directorate-subdivisions/?directorate_id=${directorateId}`,
      ),
    enabled: !!me && !!directorateId,
  });
  const subdivisionOptions = useMemo(() => {
    const base = [...(subdivisions ?? [])];
    if (
      me?.subdivision_detail &&
      !base.some((s) => s.id === me.subdivision_detail!.id)
    ) {
      base.unshift({
        ...me.subdivision_detail,
        name: `${me.subdivision_detail.name} (не в актуальном справочнике)`,
      });
    }
    return base;
  }, [subdivisions, me?.subdivision_detail]);
  useEffect(() => {
    if (!me) return;
    setFirstName(me.first_name ?? "");
    setLastName(me.last_name ?? "");
    setPatronymic(me.patronymic ?? "");
    setDirectorateName(me.directorate_detail?.name ?? "");
    setSubdivisionId(me.subdivision_detail?.id ?? "");
    const pt = me.preferred_theme_detail;
    setThemeChoice(pt ? String(pt.id) : "");
    setJobTitle(me.job_title ?? "");
  }, [me]);

  const mut = useMutation({
    mutationFn: (
      payload: Partial<
        Omit<
          MeUser,
          "directorate_detail" | "subdivision_detail" | "theme_detail" | "preferred_theme_detail"
        >
      > & {
        subdivision_id?: number | null;
        theme_id?: number | null;
      },
    ) =>
      apiFetch<MeUser>("/users/me/", {
        method: "PATCH",
        json: payload,
      }),
    onSuccess: () => {
      refreshMe();
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!me) return;
    mut.reset();
    const body: Parameters<typeof mut.mutate>[0] = {
      first_name: firstName,
      last_name: lastName,
      patronymic,
      job_title: jobTitle,
      subdivision_id: subdivisionId === "" ? null : subdivisionId,
      theme_id: themeChoice === "" ? null : Number(themeChoice),
    };
    mut.mutate(body);
  }

  if (!me) {
    return <div className="page muted">Загрузка профиля…</div>;
  }

  return (
    <div className="page stack">
      <div>
        <h1>Личный кабинет</h1>
        <p className="muted" style={{ margin: "0.35rem 0 0" }}>
          Заполните ФИО и должность для отображения в системе. Дирекция и
          группа/отдел назначаются отдельно. Логин:{" "}
          <strong>{me.username}</strong>
          {me.is_staff ? (
            <span className="chip chip--pri-normal" style={{ marginLeft: "0.5rem", textTransform: "none" }}>
              администратор
            </span>
          ) : null}
        </p>
      </div>

      <form className="card stack" onSubmit={onSubmit}>
        <div className="card-title">Отображение в системе</div>
        <div className="field-row">
          <div className="field">
            <label>Сейчас вам присвоено ФИО</label>
            <input readOnly value={me.short_fio} className="muted" />
          </div>
        </div>

        <div className="card-title">Оформление интерфейса</div>
        <div className="field-row">
          <div className="field">
            <label>Тема</label>
            <select
              value={themeChoice}
              onChange={(e) => setThemeChoice(e.target.value)}
            >
              {themeChoice === "" ? (
                <option value="" disabled>
                  — выберите тему —
                </option>
              ) : null}
              {publicThemeOptions.map((t: ThemeBrief) => (
                <option key={t.id} value={String(t.id)}>
                  {t.name} ({t.slug})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="field-row">
          <div className="field">
            <label>Фамилия</label>
            <input value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
          <div className="field">
            <label>Имя</label>
            <input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </div>
          <div className="field">
            <label>Отчество</label>
            <input value={patronymic} onChange={(e) => setPatronymic(e.target.value)} />
          </div>
        </div>

        <div className="field-row">
          <div className="field">
            <label>Дирекция</label>
            <div className="hint-banner" style={{ padding: "0.55rem 0.65rem" }}>
              {directorateName || "ещё не назначена"}
            </div>
          </div>
          <div className="field">
            <label>Группа / отдел</label>
            <select
              value={subdivisionId === "" ? "" : String(subdivisionId)}
              onChange={(e) => {
                const v = e.target.value;
                setSubdivisionId(v === "" ? "" : Number(v));
              }}
              disabled={!directorateId}
            >
              <option value="">— не выбрано —</option>
              {subdivisionOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.kind_label}: {s.name}
                </option>
              ))}
            </select>
            <p className="muted" style={{ margin: "0.15rem 0 0", fontSize: "0.8rem" }}>
              Подразделение в рамках вашей дирекции.
            </p>
          </div>
        </div>

        <div className="field-row">
          <div className="field">
            <label>Должность</label>
            <input
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="Ваша должность в организации"
            />
          </div>
        </div>

        {mut.isError ? (
          <div className="error">
            {mut.error instanceof Error ? mut.error.message : "Не удалось сохранить"}
          </div>
        ) : null}
        {mut.isSuccess ? (
          <div className="hint-banner" style={{ borderColor: "rgba(65,208,149,0.35)" }}>
            Изменения сохранены.
          </div>
        ) : null}

        <button type="submit" className="button" disabled={mut.isPending}>
          {mut.isPending ? "Сохранение…" : "Сохранить"}
        </button>
      </form>
    </div>
  );
}
