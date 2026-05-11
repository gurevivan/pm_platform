import { FormEvent, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { apiFetch, tokenStorage } from "../api/client";
import { useAuth } from "../auth/AuthProvider";

export function RegisterPage() {
  const { isAuthed } = useAuth();
  const [username, setUser] = useState("");
  const [password, setPass] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [patronymic, setPatronymic] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (isAuthed) return <Navigate to="/" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const reg: Record<string, string | number | null> = {
        username,
        password,
        first_name: firstName,
        last_name: lastName,
        patronymic,
        job_title: jobTitle,
      };
      await apiFetch("/auth/register/", {
        method: "POST",
        json: reg,
      });
      const tok = await apiFetch<{ access: string; refresh: string }>(
        `/auth/token/`,
        {
          method: "POST",
          json: { username, password },
        },
      );
      tokenStorage.set(tok.access, tok.refresh);
      window.location.href = "/";
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Не удалось зарегистрироваться",
      );
      setBusy(false);
    }
  }

  return (
    <div className="auth-layout">
      <div className="auth-hero">
        <div className="auth-hero-visual" aria-hidden />
        <h1>Присоединяйтесь к команде</h1>
        <p>
          Укажите ФИО и должность — коллеги увидят вас в задачах и журналах
          времени.
        </p>
      </div>
      <div className="auth-panel">
        <div className="auth-card stack">
          <h2>Регистрация</h2>
          <p className="subtitle">
            Если регистрация отключена политикой безопасности, обратитесь к
            администратору.
          </p>
          <form className="stack" onSubmit={onSubmit}>
            <div className="field-row">
              <div className="field">
                <label>Логин</label>
                <input
                  value={username}
                  onChange={(e) => setUser(e.target.value)}
                  placeholder="Необходим для входа"
                  autoComplete="username"
                  required
                />
              </div>
              <div className="field">
                <label>Пароль</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPass(e.target.value)}
                  autoComplete="new-password"
                  placeholder="Не короче 8 символов"
                  required
                  minLength={8}
                />
              </div>
            </div>
            <div className="card-title" style={{ fontSize: "0.98rem", marginTop: "0.5rem" }}>
              Паспортная часть профиля
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
                <input
                  value={patronymic}
                  onChange={(e) => setPatronymic(e.target.value)}
                />
              </div>
            </div>
            <div className="field-row">
              <div className="field">
                <label>Должность</label>
                <input
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder="Должность по штату"
                />
              </div>
            </div>
            {error ? <div className="error">{error}</div> : null}
            <button className="button" type="submit" disabled={busy}>
              {busy ? "Создаём запись…" : "Зарегистрироваться"}
            </button>
          </form>
          <p className="auth-footer">
            Уже есть учётная запись?{" "}
            <Link to="/login" className="link-inline">
              На страницу входа
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
