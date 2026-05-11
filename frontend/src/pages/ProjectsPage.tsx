import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { apiFetch } from "../api/client";
import type { Project } from "../api/types";

export function ProjectsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["projects"],
    queryFn: () => apiFetch<Project[]>(`/projects/`),
  });

  const list = data ?? [];

  return (
    <div className="page stack">
      <div className="hero-section">
        <div>
          <h1>Проекты</h1>
          <p className="lead">
            Панели задач с канбаном и графиками — каждый проект живёт в
            своём рабочем пространстве.
          </p>
        </div>
        <Link className="button" to="/projects/new">
          + Новый проект
        </Link>
      </div>

      {isLoading ? (
        <div className="muted hint-banner">Загружаем проекты…</div>
      ) : null}
      {error ? (
        <div className="error">
          {error instanceof Error ? error.message : "Ошибка"}
        </div>
      ) : null}

      {!isLoading && !list.length ? (
        <div className="empty-state">
          Проектов пока нет. Нажмите «Новый проект» и создайте первый.
        </div>
      ) : (
        <div className="project-grid">
          {list.map((p) => (
            <Link
              key={p.id}
              to={`/projects/${p.id}`}
              className="card card--lift transition-card stack"
              style={{ minHeight: 140, textDecoration: "none", color: "inherit" }}
            >
              <div className="card-header" style={{ marginBottom: 0 }}>
                <div>
                  <div className="card-title">{p.name}</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: "0.45rem" }}>
                    {p.weekly_report_enabled ? (
                      <span className="chip chip--pri-high" style={{ textTransform: "none" }}>
                        Еженедельный отчёт
                      </span>
                    ) : null}
                    {p.analytics_enabled ? (
                      <span className="chip chip--pri-low" style={{ textTransform: "none" }}>
                        Аналитика
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
