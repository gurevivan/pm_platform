import { useQuery } from "@tanstack/react-query";
import { NavLink, Outlet, useParams } from "react-router-dom";
import { apiFetch } from "../api/client";
import type { Project } from "../api/types";

const tabs = [
  ["settings", "Настройки"],
  ["tasks", "Задачи"],
  ["chat", "Чат"],
  ["kanban", "Канбан"],
  ["relations", "Связи"],
  ["gantt", "Диаграмма Гантта"],
] as const;

export function ProjectShell() {
  const { projectId } = useParams();
  const pid = Number(projectId);
  const base = `/projects/${projectId}`;

  const { data: project } = useQuery({
    queryKey: ["project", pid],
    enabled: !!pid && !Number.isNaN(pid),
    queryFn: () => apiFetch<Project>(`/projects/${pid}/`),
  });
  return (
    <div className="page stack">
      <div className="project-bar">
        <div className="project-head">
          <div className="project-name">{project?.name ?? "Проект"}</div>
          <div style={{ marginTop: "0.35rem" }}>
            {project?.cadence === "weekly" ? (
              <span className="chip chip--pri-normal" style={{ textTransform: "none" }}>
                Еженедельный
              </span>
            ) : null}
            {project?.cadence === "monthly" ? (
              <span className="chip chip--pri-normal" style={{ textTransform: "none" }}>
                Ежемесячный
              </span>
            ) : null}
          </div>
          <div className="muted" style={{ maxWidth: "52ch" }}>
            {project?.description?.trim()
              ? project.description
              : "Карточки задач, доска статусов и дорожная карта."}
          </div>
        </div>
      </div>
      <nav className="tab-strip" aria-label="Разделы проекта">
        {tabs.map(([path, title]) => (
          <NavLink
            key={path}
            to={`${base}/${path}`}
            className={({ isActive }) =>
              `tab${isActive ? " tab--active" : ""}`
            }
          >
            {title}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}
