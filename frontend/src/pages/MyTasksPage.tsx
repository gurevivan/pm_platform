import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../api/client";
import type { WorkItem } from "../api/types";

export function MyTasksPage() {
  const navigate = useNavigate();
  const { data: items } = useQuery({
    queryKey: ["my-tasks"],
    queryFn: () => apiFetch<WorkItem[]>("/my-tasks/"),
  });

  const priorityLabel: Record<string, string> = {
    low: "Низкий",
    normal: "Обычный",
    high: "Высокий",
    urgent: "Срочный",
  };

  return (
    <div className="page stack">
      <div className="section-head">
        <h2>Задачи</h2>
        <p className="section-subtitle">
          Список задач, где вы исполнитель или наблюдатель проекта.
        </p>
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Задача</th>
              <th>Проект</th>
              <th>Статус</th>
              <th>Приоритет</th>
              <th>Дедлайн</th>
              <th>Исполнитель</th>
            </tr>
          </thead>
          <tbody>
            {(items ?? []).map((w) => (
              <tr
                key={w.id}
                onClick={() => navigate(`/projects/${w.project}/tasks/${w.id}`)}
                style={{ cursor: "pointer" }}
              >
                <td style={{ fontWeight: 600 }}>{w.title}</td>
                <td>{w.project_name}</td>
                <td>{w.status_name}</td>
                <td>{priorityLabel[w.priority] ?? w.priority}</td>
                <td>{w.due_date ?? "—"}</td>
                <td>{w.assignee_detail?.short_fio ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
