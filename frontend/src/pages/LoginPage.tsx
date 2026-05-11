import { FormEvent, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";

export function LoginPage() {
  const { login, isAuthed } = useAuth();
  const [username, setUser] = useState("");
  const [password, setPass] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (isAuthed) return <Navigate to="/" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await login(username, password);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Не удалось выполнить вход",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="auth-layout">
      <div className="auth-hero">
        <div className="auth-hero-visual" aria-hidden />
        <h1>Добро пожаловать</h1>
        <p>
          Внутренний портал для проектных команд: задачи, сроки и план без
          лишней суеты.
        </p>
      </div>
      <div className="auth-panel">
        <div className="auth-card stack">
          <h2>Вход в систему</h2>
          <p className="subtitle">
            Используйте логин и пароль, выданные администратором.
          </p>
          <form className="stack" onSubmit={onSubmit}>
            <div className="field">
              <label htmlFor="u">Логин</label>
              <input
                id="u"
                autoComplete="username"
                value={username}
                onChange={(ev) => setUser(ev.target.value)}
                placeholder="Логин"
              />
            </div>
            <div className="field">
              <label htmlFor="p">Пароль</label>
              <input
                id="p"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(ev) => setPass(ev.target.value)}
                placeholder="Пароль"
              />
            </div>
            {error ? <div className="error">{error}</div> : null}
            <button className="button" type="submit" disabled={pending}>
              {pending ? "Проверка…" : "Войти"}
            </button>
          </form>
          <p className="auth-footer">
            Новый пользователь?{" "}
            <Link to="/register" className="link-inline">
              Зарегистрироваться
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
