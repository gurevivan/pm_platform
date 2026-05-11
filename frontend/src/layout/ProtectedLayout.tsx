import { Navigate, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";

export function ProtectedLayout() {
  const {
    isAuthed,
    logout,
    me,
    isStaff,
    profileReady,
    access,
  } = useAuth();

  if (!isAuthed) {
    return <Navigate to="/login" replace />;
  }

  /* Пока грузится профиль, блокируем показ «пустых» данных в полосе ФИО */
  const profilePending = !!(access && !profileReady);

  return (
    <div className="app-root">
      <aside className="sidebar" aria-label="Навигация">
        <div className="sidebar-brand">
          <div className="sidebar-logo" aria-hidden />
          <div className="sidebar-title-wrap">
            <span className="sidebar-title">Проекты и задачи</span>
          </div>
        </div>
        <nav className="sidebar-links">
          <NavLink
            end
            to="/"
            className={({ isActive }) =>
              `sidebar-nav-link${isActive ? " sidebar-nav-link--active" : ""}`
            }
          >
            <span className="sidebar-nav-ico" aria-hidden>
              ◎
            </span>
            Проекты
          </NavLink>
          <NavLink
            to="/tasks"
            className={({ isActive }) =>
              `sidebar-nav-link${isActive ? " sidebar-nav-link--active" : ""}`
            }
          >
            <span className="sidebar-nav-ico" aria-hidden>
              ◈
            </span>
            Задачи
          </NavLink>
          <NavLink
            to="/cabinet"
            className={({ isActive }) =>
              `sidebar-nav-link${isActive ? " sidebar-nav-link--active" : ""}`
            }
          >
            <span className="sidebar-nav-ico" aria-hidden>
              ◐
            </span>
            Личный кабинет
          </NavLink>
          {profileReady && me?.directorate_detail ? (
            <>
              <NavLink
                to="/directorate"
                className={({ isActive }) =>
                  `sidebar-nav-link${isActive ? " sidebar-nav-link--active" : ""}`
                }
              >
                <span className="sidebar-nav-ico" aria-hidden>
                  ▣
                </span>
                Дирекция
              </NavLink>
            </>
          ) : null}
          {profileReady && isStaff ? (
            <>
              <NavLink
                to="/admin/users"
                className={({ isActive }) =>
                  `sidebar-nav-link${isActive ? " sidebar-nav-link--active" : ""}`
                }
              >
                <span className="sidebar-nav-ico" aria-hidden>
                  ⚙
                </span>
                Сотрудники
              </NavLink>
            </>
          ) : null}
        </nav>
        <div className="sidebar-foot">
          Схема API в браузере:{" "}
          <span style={{ opacity: 0.85 }}>/api/docs</span>
        </div>
      </aside>
      <div className="app-main">
        <header className="app-main-top">
          <div className="user-strip">
            <span className="user-strip-name">
              {profilePending
                ? "…"
                : me?.short_fio || me?.username || "—"}
            </span>
            <span className="user-strip-meta">
              {profilePending
                ? "загрузка карточки сотрудника"
                : me?.directorate_detail?.name || "укажите дирекцию в личном кабинете"}
            </span>
            <span className="user-strip-meta">
              {profilePending
                ? ""
                : me?.subdivision_detail?.name || "укажите группу/отдел при необходимости"}
            </span>
            <span className="user-strip-meta">
              {profilePending
                ? ""
                : me?.job_title || "укажите должность"}
            </span>
          </div>
          <button type="button" className="button button--ghost" onClick={logout}>
            Выход из системы
          </button>
        </header>
        <div className="main-scroll">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
