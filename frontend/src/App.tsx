import { Navigate, Route, Routes } from "react-router-dom";
import { AdminGate } from "./layout/AdminGate";
import { ProtectedLayout } from "./layout/ProtectedLayout";
import { AdminUsersPage } from "./pages/AdminUsersPage";
import { CabinetPage } from "./pages/CabinetPage";
import { CreateProjectPage } from "./pages/CreateProjectPage";
import { DirectoratePage } from "./pages/DirectoratePage";
import { DirectorateRecruitsPage } from "./pages/DirectorateRecruitsPage";
import { GanttView } from "./pages/GanttView";
import { ProjectChatPage } from "./pages/ProjectChatPage";
import { ProjectSettingsPage } from "./pages/ProjectSettingsPage";
import { KanbanBoard } from "./pages/KanbanBoard";
import { LoginPage } from "./pages/LoginPage";
import { MyTasksPage } from "./pages/MyTasksPage";
import { ProjectShell } from "./pages/ProjectShell";
import { ProjectsPage } from "./pages/ProjectsPage";
import { RegisterPage } from "./pages/RegisterPage";
import { RelationsPage } from "./pages/RelationsPage";
import { TasksPage } from "./pages/TasksPage";
import { TaskDetailPage } from "./pages/TaskDetailPage";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route element={<ProtectedLayout />}>
        <Route path="/" element={<ProjectsPage />} />
        <Route path="/tasks" element={<MyTasksPage />} />
        <Route path="/projects/new" element={<CreateProjectPage />} />
        <Route path="/cabinet" element={<CabinetPage />} />
        <Route path="/directorate" element={<DirectoratePage />} />
        <Route path="/directorate-chat" element={<Navigate to="/directorate" replace />} />
        <Route path="/directorate-recruits" element={<DirectorateRecruitsPage />} />
        <Route
          path="/admin/users"
          element={
            <AdminGate>
              <AdminUsersPage />
            </AdminGate>
          }
        />
        <Route path="/admin/themes" element={<Navigate to="/" replace />} />
        <Route path="/projects/:projectId" element={<ProjectShell />}>
          <Route index element={<Navigate to="settings" replace />} />
          <Route path="settings" element={<ProjectSettingsPage />} />
          <Route path="tasks" element={<TasksPage />} />
          <Route path="tasks/:taskId" element={<TaskDetailPage />} />
          <Route path="chat" element={<ProjectChatPage />} />
          <Route path="kanban" element={<KanbanBoard />} />
          <Route path="relations" element={<RelationsPage />} />
          <Route path="gantt" element={<GanttView />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
